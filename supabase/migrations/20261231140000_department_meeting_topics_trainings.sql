-- Department meetings: the topics discussed (each with what was said and its conclusion)
-- and the training that came up in the meeting (who needs it, by when, the training
-- programme created for it). Same access as the meeting's decisions: Quality and the
-- meeting's own department; closed with the Quality module.
--
-- The FileMaker hourly sync wrote each «TopicDiscussed» as a decision; from now on it
-- writes a topic. The earlier ones are copied to topics here (same id); removing the
-- copied decisions is left to the owner (docs/sql/department_meeting_topics_cleanup.sql).

create table if not exists public.quality_department_meeting_topics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  meeting_id uuid not null,
  position integer not null default 0,
  subject text not null check (length(btrim(subject)) > 0),
  discussion text,
  conclusion text,
  foreign key (meeting_id, organization_id) references public.quality_department_meetings(id, organization_id) on delete cascade
);
create index if not exists quality_department_meeting_topics_meeting_idx on public.quality_department_meeting_topics (meeting_id);

create table if not exists public.quality_department_meeting_trainings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  meeting_id uuid not null,
  position integer not null default 0,
  topic text not null check (length(btrim(topic)) > 0),
  audience text,
  due_date date,
  training_program_id uuid references public.training_programs(id) on delete set null,
  foreign key (meeting_id, organization_id) references public.quality_department_meetings(id, organization_id) on delete cascade
);
create index if not exists quality_department_meeting_trainings_meeting_idx on public.quality_department_meeting_trainings (meeting_id);

do $policies$
declare
  t text;
  scope text;
begin
  foreach t in array array['quality_department_meeting_topics','quality_department_meeting_trainings'] loop
    execute format('alter table public.%I enable row level security', t);
    scope := format('exists (select 1 from public.quality_department_meetings m where m.id = %I.meeting_id and coalesce((m.organization_id::text || '':'' || m.department_id::text) = any ((select private.current_user_department_scopes())::text[]), false))', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_read') then
      execute format($p$create policy %1$I on public.%2$I for select to authenticated using (
        (select public.current_user_is_platform_owner())
        or coalesce(organization_id = any ((select private.fast_orgs_role(array['hospital_admin'::public.app_role,'quality_manager'::public.app_role,'infection_control_lead'::public.app_role]))::uuid[]), false)
        or coalesce(organization_id = any ((select private.fast_orgs_capability('view_quality'))::uuid[]), false)
        or %3$s)$p$, t || '_read', t, scope);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_manage') then
      execute format($p$create policy %1$I on public.%2$I for all to authenticated using (
        (select public.current_user_is_platform_owner())
        or coalesce(organization_id = any ((select private.fast_orgs_role(array['hospital_admin'::public.app_role,'quality_manager'::public.app_role]))::uuid[]), false)
        or coalesce(organization_id = any ((select private.fast_orgs_capability('manage_quality'))::uuid[]), false)
        or %3$s)
        with check (
        (select public.current_user_is_platform_owner())
        or coalesce(organization_id = any ((select private.fast_orgs_role(array['hospital_admin'::public.app_role,'quality_manager'::public.app_role]))::uuid[]), false)
        or coalesce(organization_id = any ((select private.fast_orgs_capability('manage_quality'))::uuid[]), false)
        or %3$s)$p$, t || '_manage', t, scope);
    end if;
    -- Closed with the Quality module, like the meeting itself.
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_module_gate') then
      execute format('create policy %I on public.%I as restrictive for all to authenticated using (%s) with check (%s)', t || '_module_gate', t,
        '(select not private.current_user_has_locked_modules()) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs(''{quality}''::text[]))::uuid[]))',
        '(select not private.current_user_has_locked_modules()) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs(''{quality}''::text[]))::uuid[]))');
    end if;
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end
$policies$;

-- The FileMaker «TopicDiscussed» rows already imported as closed decisions become topics
-- (same id, same position). Those left «open» wait for the owner's review.
insert into public.quality_department_meeting_topics (id, organization_id, meeting_id, position, subject)
select d.id, d.organization_id, d.meeting_id, d.position, d.title
from public.quality_department_meeting_decisions d
join public.fm_stage_links l on l.target_table = 'quality_department_meeting_decisions' and l.target_id = d.id
where d.status = 'done' and d.owner_label is null and d.due_date is null and d.capa_id is null
on conflict (id) do nothing;

-- The links of the copied rows follow them, so the sync never brings them back.
update public.fm_stage_links l set target_table = 'quality_department_meeting_topics'
where l.target_table = 'quality_department_meeting_decisions'
  and exists (select 1 from public.quality_department_meeting_topics t where t.id = l.target_id);

-- From now on a FileMaker «TopicDiscussed» is a topic of the meeting, not a decision.
create or replace function private.fm_sync_department_meetings()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_meetings integer; v_decisions integer; v_people integer;
begin
  with src as (
    select r.record_id, r.data d, nullif(r.data->>'DATE', '')::date as meeting_date, private.fm_department(r.data->>'CreatedBy') as department_id
    from public.fm_stage_records r
    where r.base_table = 'Meeting_REVIEWS' and coalesce(r.data->>'CreationTimestamp', '') >= '2026-10-19' and nullif(r.data->>'DATE', '') is not null
      and not exists (select 1 from public.fm_stage_links l where l.base_table = 'Meeting_REVIEWS' and l.record_id = r.record_id)
  ), numbered as (
    select s.*, 'DM-' || extract(year from s.meeting_date)::integer || '-' || lpad((
             (select count(*) from public.quality_department_meetings m where m.department_id = s.department_id and extract(year from m.meeting_date) = extract(year from s.meeting_date))
             + row_number() over (partition by s.department_id, extract(year from s.meeting_date) order by s.meeting_date, s.record_id))::text, 2, '0') as code
    from src s where s.department_id is not null
  ), ins as (
    insert into public.quality_department_meetings (id, organization_id, department_id, code, title, kind, meeting_date, next_meeting_date, status, finalized_at, created_by, created_at)
    select md5('fm-MeetingREVIEWS-' || n.record_id)::uuid, private.fm_org(), n.department_id, n.code, 'Συνάντηση τμήματος', 'regular', n.meeting_date, n.meeting_date + 90,
           case when n.meeting_date <= (now() at time zone 'Europe/Athens')::date then 'final' else 'draft' end,
           case when n.meeting_date <= (now() at time zone 'Europe/Athens')::date then (n.meeting_date::timestamp + interval '12 hours') at time zone 'UTC' end,
           private.fm_importer(), coalesce(private.fm_local_ts(n.d->>'CreationTimestamp'), now())
    from numbered n
    on conflict do nothing
    returning id
  ), links as (
    insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
    select 'Meeting_REVIEWS', n.record_id, 'quality_department_meetings', i.id, 'created', 'hourly sync', now()
    from numbered n join ins i on i.id = md5('fm-MeetingREVIEWS-' || n.record_id)::uuid
    returning 1
  )
  select count(*) into v_meetings from links;

  with src as (
    select r.record_id, r.data d, private.fm_target('Meeting_REVIEWS', m.record_id, 'quality_department_meetings') as meeting_id
    from public.fm_stage_records r
    join public.fm_stage_records m on m.base_table = 'Meeting_REVIEWS' and m.data->>'Review_ID_PrimaryKey' = r.data->>'MeetingReviewID'
    where r.base_table = 'Μeeting_Decisions' and coalesce(r.data->>'CreationTimestamp', '') >= '2026-10-19' and private.fm_text(r.data->>'TopicDiscussed') is not null
      and not exists (select 1 from public.fm_stage_links l where l.base_table = 'Μeeting_Decisions' and l.record_id = r.record_id)
  ), ins as (
    insert into public.quality_department_meeting_topics (id, organization_id, meeting_id, subject, position)
    select md5('fm-MeetingDecisions-' || s.record_id)::uuid, private.fm_org(), s.meeting_id, private.fm_text(s.d->>'TopicDiscussed'),
           (select count(*) from public.quality_department_meeting_topics x where x.meeting_id = s.meeting_id)
           + row_number() over (partition by s.meeting_id order by s.d->>'CreationTimestamp', s.record_id)
    from src s where s.meeting_id is not null
    on conflict do nothing
    returning id
  ), links as (
    insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
    select 'Μeeting_Decisions', s.record_id, 'quality_department_meeting_topics', i.id, 'created', 'hourly sync', now()
    from src s join ins i on i.id = md5('fm-MeetingDecisions-' || s.record_id)::uuid
    returning 1
  )
  select count(*) into v_decisions from links;

  with src as (
    select r.record_id, r.data d,
           coalesce(
             (select private.fm_target('Meeting_REVIEWS', m.record_id, 'quality_department_meetings') from public.fm_stage_records m
               where m.base_table = 'Meeting_REVIEWS' and m.data->>'Training ID' = r.data->>'Training ID' limit 1),
             (select private.fm_target('Meeting_REVIEWS', m.record_id, 'quality_department_meetings') from public.fm_stage_records m
               where m.base_table = 'Meeting_REVIEWS' and lower(m.data->>'CreatedBy') = lower(r.data->>'Creation Account')
                 and private.fm_local_ts(m.data->>'CreationTimestamp') <= private.fm_local_ts(r.data->>'Creation Timestamp')
                 and private.fm_local_ts(m.data->>'CreationTimestamp') > private.fm_local_ts(r.data->>'Creation Timestamp') - interval '1 day'
               order by m.data->>'CreationTimestamp' desc limit 1)) as meeting_id,
           (select coalesce(nullif(btrim(e.first_name || ' ' || e.last_name), ''), null) from public.fm_stage_records pr
              join public.employees e on e.id = private.fm_target('People', pr.record_id, 'employees')
             where pr.base_table = 'People' and pr.data->>'People ID' = r.data->>'Participant ID' limit 1) as employee_name
    from public.fm_stage_records r
    where r.base_table = 'Training Participants' and coalesce(r.data->>'Creation Timestamp', '') >= '2026-10-19'
      and not exists (select 1 from public.fm_stage_records t where t.base_table = 'Training' and t.data->>'Train_ID' = r.data->>'Training ID')
      and not exists (select 1 from public.fm_stage_links l where l.base_table = 'Training Participants' and l.record_id = r.record_id)
  ), ins as (
    insert into public.quality_department_meeting_participants (id, organization_id, meeting_id, name, attended, position)
    select md5('fm-MeetingParticipants-' || s.record_id)::uuid, private.fm_org(), s.meeting_id,
           coalesce(s.employee_name, replace(private.fm_text(s.d->>'Participant Full Name'), E'\n', ' '), '—'), true,
           (select count(*) from public.quality_department_meeting_participants x where x.meeting_id = s.meeting_id)
           + row_number() over (partition by s.meeting_id order by s.d->>'Creation Timestamp', s.record_id)
    from src s where s.meeting_id is not null
    on conflict do nothing
    returning id
  ), links as (
    insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
    select 'Training Participants', s.record_id, 'quality_department_meeting_participants', i.id, 'created', 'hourly sync', now()
    from src s join ins i on i.id = md5('fm-MeetingParticipants-' || s.record_id)::uuid
    returning 1
  )
  select count(*) into v_people from links;
  return v_meetings + v_decisions + v_people;
end;
$$;
