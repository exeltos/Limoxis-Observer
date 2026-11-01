-- Department meeting groups: one per department («Συναντήσεις ΜΕΘ»), defined by the
-- administration with how often the department meets. Inside it the department holds its
-- regular (and extraordinary) meetings. A meeting belongs to a group; its attendance is the
-- department's active employees, each present or absent (employee_id).
--
-- Read: Quality and the group's department. Write: Quality only (the department writes its
-- meetings, not the group). Closed with the Quality module.
-- From FileMaker: «Meeting» (the groups, with «Meeting Frequency» in days) and
-- «Meeting_REVIEWS».MeetingID (the meeting's group).

create table if not exists public.quality_department_meeting_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  name text not null check (length(btrim(name)) > 0),
  frequency_days integer not null default 90 check (frequency_days between 1 and 730),
  duration_hours numeric(4,1) check (duration_hours is null or duration_hours > 0),
  manager_label text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quality_department_meeting_groups_org_department_idx on public.quality_department_meeting_groups (organization_id, department_id);

alter table public.quality_department_meetings add column if not exists group_id uuid references public.quality_department_meeting_groups(id) on delete set null;
create index if not exists quality_department_meetings_group_idx on public.quality_department_meetings (group_id);
alter table public.quality_department_meeting_participants add column if not exists employee_id uuid references public.employees(id) on delete set null;

alter table public.quality_department_meeting_groups enable row level security;
do $policies$
declare
  quality_read text := '(select public.current_user_is_platform_owner())
    or coalesce(organization_id = any ((select private.fast_orgs_role(array[''hospital_admin''::public.app_role,''quality_manager''::public.app_role,''infection_control_lead''::public.app_role]))::uuid[]), false)
    or coalesce(organization_id = any ((select private.fast_orgs_capability(''view_quality''))::uuid[]), false)';
  quality_write text := '(select public.current_user_is_platform_owner())
    or coalesce(organization_id = any ((select private.fast_orgs_role(array[''hospital_admin''::public.app_role,''quality_manager''::public.app_role]))::uuid[]), false)
    or coalesce(organization_id = any ((select private.fast_orgs_capability(''manage_quality''))::uuid[]), false)';
  gate text := '(select not private.current_user_has_locked_modules()) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs(''{quality}''::text[]))::uuid[]))';
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quality_department_meeting_groups' and policyname = 'quality_department_meeting_groups_read') then
    execute format('create policy quality_department_meeting_groups_read on public.quality_department_meeting_groups for select to authenticated using (%s or coalesce((organization_id::text || '':'' || department_id::text) = any ((select private.current_user_department_scopes())::text[]), false))', quality_read);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quality_department_meeting_groups' and policyname = 'quality_department_meeting_groups_manage') then
    execute format('create policy quality_department_meeting_groups_manage on public.quality_department_meeting_groups for all to authenticated using (%s) with check (%s)', quality_write, quality_write);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quality_department_meeting_groups' and policyname = 'quality_department_meeting_groups_module_gate') then
    execute format('create policy quality_department_meeting_groups_module_gate on public.quality_department_meeting_groups as restrictive for all to authenticated using (%s) with check (%s)', gate, gate);
  end if;
end
$policies$;
revoke all on public.quality_department_meeting_groups from anon;
grant select, insert, update, delete on public.quality_department_meeting_groups to authenticated;

create or replace trigger trg_quality_department_meeting_groups_touch before update on public.quality_department_meeting_groups
  for each row execute function private.department_register_touch();

-- A FileMaker department text («ΜΕΘ», «ΟΦΘΑΛΜΟΛΟΓΙΚΟ», «MENN») to a department: same name
-- without accents, or one the start of the other.
create or replace function private.fm_department_by_name(p_name text)
returns uuid language sql stable set search_path = '' as $$
  with wanted as (select translate(upper(btrim(replace(p_name, 'MENN', 'ΜΕΝΝ'))), 'ΆΈΉΊΌΎΏΪΫ', 'ΑΕΗΙΟΥΩΙΥ') as t)
  select d.id from public.departments d, wanted w
  where d.organization_id = private.fm_org() and w.t <> ''
    and (translate(upper(d.name), 'ΆΈΉΊΌΎΏΪΫ', 'ΑΕΗΙΟΥΩΙΥ') = w.t
      or translate(upper(d.name), 'ΆΈΉΊΌΎΏΪΫ', 'ΑΕΗΙΟΥΩΙΥ') like w.t || '%'
      or w.t like translate(upper(d.name), 'ΆΈΉΊΌΎΏΪΫ', 'ΑΕΗΙΟΥΩΙΥ') || '%')
  order by translate(upper(d.name), 'ΆΈΉΊΌΎΏΪΫ', 'ΑΕΗΙΟΥΩΙΥ') = w.t desc, length(d.name)
  limit 1
$$;
revoke all on function private.fm_department_by_name(text) from public, anon, authenticated;

-- The groups of FileMaker: the department of their meetings, else the one their name gives.
create or replace function private.fm_sync_department_meeting_groups()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_groups integer;
begin
  with src as (
    select g.record_id, g.data d,
      coalesce(
        (select m.department_id from public.fm_stage_records r
           join public.fm_stage_links l on l.base_table = 'Meeting_REVIEWS' and l.record_id = r.record_id and l.target_table = 'quality_department_meetings'
           join public.quality_department_meetings m on m.id = l.target_id
          where r.base_table = 'Meeting_REVIEWS' and r.data->>'MeetingID' = g.data->>'MeetingID_PrimaryKey'
          group by m.department_id order by count(*) desc limit 1),
        private.fm_department_by_name(coalesce(nullif(g.data->>'DepartmentID', ''), g.data->>'CreatedBy'))) as department_id
    from public.fm_stage_records g
    where g.base_table = 'Meeting'
      and not exists (select 1 from public.fm_stage_links l where l.base_table = 'Meeting' and l.record_id = g.record_id)
  ), ins as (
    insert into public.quality_department_meeting_groups (id, organization_id, department_id, name, frequency_days, duration_hours, created_at)
    select md5('fm-Meeting-' || s.record_id)::uuid, private.fm_org(), s.department_id,
           'Συναντήσεις ' || coalesce((select d.name from public.departments d where d.id = s.department_id), initcap(lower(coalesce(nullif(s.d->>'DepartmentID', ''), s.d->>'CreatedBy', '')))),
           least(greatest(coalesce(nullif(regexp_replace(coalesce(s.d->>'Meeting Frequency', ''), '[^0-9]', '', 'g'), '')::integer, 90), 1), 730),
           nullif(replace(substring(coalesce(s.d->>'Duration', '') from '^[0-9]+(?:[.,][0-9]+)?'), ',', '.'), '')::numeric,
           coalesce(private.fm_local_ts(s.d->>'CreationTimestamp'), now())
    from src s
    on conflict do nothing
    returning id
  ), links as (
    insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
    select 'Meeting', s.record_id, 'quality_department_meeting_groups', i.id, 'created', 'meeting groups', now()
    from src s join ins i on i.id = md5('fm-Meeting-' || s.record_id)::uuid
    returning 1
  )
  select count(*) into v_groups from links;
  -- Each FileMaker meeting in its group.
  update public.quality_department_meetings m set group_id = private.fm_target('Meeting', g.record_id, 'quality_department_meeting_groups')
  from public.fm_stage_links l
  join public.fm_stage_records r on r.base_table = 'Meeting_REVIEWS' and r.record_id = l.record_id
  join public.fm_stage_records g on g.base_table = 'Meeting' and g.data->>'MeetingID_PrimaryKey' = r.data->>'MeetingID'
  where l.base_table = 'Meeting_REVIEWS' and l.target_table = 'quality_department_meetings' and l.target_id = m.id and m.group_id is null;
  return v_groups;
end;
$$;
revoke all on function private.fm_sync_department_meeting_groups() from public, anon, authenticated;
select private.fm_sync_department_meeting_groups();

-- Meetings recorded in the app (no FileMaker group) join their department's group, created when missing.
insert into public.quality_department_meeting_groups (organization_id, department_id, name)
select distinct m.organization_id, m.department_id, 'Συναντήσεις ' || d.name
from public.quality_department_meetings m join public.departments d on d.id = m.department_id
where m.group_id is null
  and not exists (select 1 from public.quality_department_meeting_groups g where g.organization_id = m.organization_id and g.department_id = m.department_id);
update public.quality_department_meetings m set group_id = (
  select g.id from public.quality_department_meeting_groups g where g.organization_id = m.organization_id and g.department_id = m.department_id order by g.created_at limit 1)
where m.group_id is null;

-- Attendance names to employees (only an unambiguous match in the same hospital).
update public.quality_department_meeting_participants p set employee_id = (
  select e.id from public.employees e
  where e.organization_id = p.organization_id and lower(btrim(e.first_name || ' ' || e.last_name)) = lower(btrim(p.name)))
where p.employee_id is null
  and (select count(*) from public.employees e where e.organization_id = p.organization_id and lower(btrim(e.first_name || ' ' || e.last_name)) = lower(btrim(p.name))) = 1;

-- The hourly sync: attendance to employees, and the groups after the meetings.
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
  return v_meetings + v_decisions + v_people + private.fm_sync_department_meeting_groups();
end;
$$;
