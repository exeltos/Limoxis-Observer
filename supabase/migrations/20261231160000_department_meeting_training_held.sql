-- A department meeting records whether a training was held during it, and which one:
-- training_held (the FileMaker «TrainingPerformed» ΝΑΙ/ΟΧΙ) and training_program_id (the
-- training programme created or linked for it; FileMaker: Training.Review_ID = the meeting).
-- Replaces the «training needs» list of the first design (quality_department_meeting_trainings
-- stays in the database, unused).

alter table public.quality_department_meetings add column if not exists training_held boolean not null default false;
alter table public.quality_department_meetings add column if not exists training_program_id uuid references public.training_programs(id) on delete set null;
create index if not exists quality_department_meetings_training_idx on public.quality_department_meetings (training_program_id) where training_program_id is not null;

-- The FileMaker values. SECURITY INVOKER on purpose: it is only called from the sync below
-- (which runs as its owner); anyone else calling it runs under RLS and changes nothing.
create or replace function private.fm_sync_meeting_training()
returns integer language plpgsql set search_path = '' as $$
declare v_flags integer; v_links integer;
begin
  update public.quality_department_meetings m set training_held = true
  from public.fm_stage_links l join public.fm_stage_records r on r.base_table = 'Meeting_REVIEWS' and r.record_id = l.record_id
  where l.base_table = 'Meeting_REVIEWS' and l.target_table = 'quality_department_meetings' and l.target_id = m.id
    and upper(btrim(coalesce(r.data->>'TrainingPerformed', ''))) in ('ΝΑΙ', 'YES') and m.training_held = false;
  get diagnostics v_flags = row_count;
  update public.quality_department_meetings m set training_program_id = pl.target_id, training_held = true
  from public.fm_stage_links ml
  join public.fm_stage_records r on r.base_table = 'Meeting_REVIEWS' and r.record_id = ml.record_id
  join public.fm_stage_records t on t.base_table = 'Training' and t.data->>'Review_ID' = r.data->>'Review_ID_PrimaryKey'
  join public.fm_stage_links pl on pl.base_table = 'Training' and pl.record_id = t.record_id and pl.target_table = 'training_programs'
  where ml.base_table = 'Meeting_REVIEWS' and ml.target_table = 'quality_department_meetings' and ml.target_id = m.id
    and m.training_program_id is null;
  get diagnostics v_links = row_count;
  return v_flags + v_links;
end;
$$;
select private.fm_sync_meeting_training();

-- The hourly department-meetings sync also brings the training (same function as before, one more step).
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
             where pr.base_table = 'People' and pr.data->>'People ID' = r.data->>'Participant ID' limit 1) as employee_name,
           (select private.fm_target('People', pr.record_id, 'employees') from public.fm_stage_records pr
             where pr.base_table = 'People' and pr.data->>'People ID' = r.data->>'Participant ID' limit 1) as employee_id
    from public.fm_stage_records r
    where r.base_table = 'Training Participants' and coalesce(r.data->>'Creation Timestamp', '') >= '2026-10-19'
      and not exists (select 1 from public.fm_stage_records t where t.base_table = 'Training' and t.data->>'Train_ID' = r.data->>'Training ID')
      and not exists (select 1 from public.fm_stage_links l where l.base_table = 'Training Participants' and l.record_id = r.record_id)
  ), ins as (
    insert into public.quality_department_meeting_participants (id, organization_id, meeting_id, employee_id, name, attended, position)
    select md5('fm-MeetingParticipants-' || s.record_id)::uuid, private.fm_org(), s.meeting_id, s.employee_id,
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
  -- New groups, and every new meeting in its group.
  return v_meetings + v_decisions + v_people + private.fm_sync_department_meeting_groups() + private.fm_sync_meeting_training();
end;
$$;
