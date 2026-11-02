-- FileMaker → Limoxis, the hourly sync (20261211130000_filemaker_hourly_sync.sql)
-- for the rest of the areas the owner asked for on 27/10/2026, from 19/10/2026
-- on: staff (People), training (Training, Training Participants), department
-- meetings (Meeting_REVIEWS, Μeeting_Decisions and their participants),
-- committee meetings (Commitees_REVIEWS, Commitees_Decisions) and incidents
-- (IncidentManagement, Death). Each new FileMaker record is added the way the
-- first transfer added it (fm_stage_links shows the pairs) and linked, so it is
-- never added twice. Insert only: a record changed in FileMaker after it was
-- added is not changed again here.

-- The hospital of the FileMaker transfer and the account its records are written by.
create or replace function private.fm_org()
returns uuid language sql stable set search_path = '' as $$
  select d.organization_id from public.fm_stage_links l join public.departments d on d.id = l.target_id
  where l.base_table = 'Departments' and l.target_table = 'departments' limit 1
$$;

create or replace function private.fm_importer()
returns uuid language sql stable set search_path = '' as $$
  select e.created_by from public.fm_stage_links l join public.employees e on e.id = l.target_id
  where l.base_table = 'People' and l.target_table = 'employees' and e.created_by is not null limit 1
$$;

-- FileMaker text: \r line breaks, tabs and runs of spaces; null when empty.
create or replace function private.fm_text(p_value text)
returns text language sql immutable set search_path = '' as $$
  select nullif(btrim(regexp_replace(regexp_replace(regexp_replace(replace(coalesce(p_value, ''), E'\r', E'\n'), E'[ \t]+', ' ', 'g'), E' *\n *', E'\n', 'g'), E'\n{2,}', E'\n', 'g'), E' \n'), '')
$$;

-- FileMaker timestamps are wall-clock times in Athens written with a «Z».
create or replace function private.fm_local_ts(p_value text)
returns timestamptz language sql immutable set search_path = '' as $$
  select case when p_value ~ '^\d{4}-\d{2}-\d{2}' then (replace(replace(p_value, 'T', ' '), 'Z', '')::timestamp at time zone 'Europe/Athens') end
$$;

-- The department of a FileMaker account: the department with that account
-- name, else the department of the person with that account.
create or replace function private.fm_department(p_account text)
returns uuid language sql stable set search_path = '' as $$
  select coalesce(
    (select l.target_id from public.fm_stage_records d
       join public.fm_stage_links l on l.base_table = 'Departments' and l.record_id = d.record_id and l.target_table = 'departments'
      where d.base_table = 'Departments' and lower(btrim(d.data->>'Account Name')) = lower(btrim(p_account)) limit 1),
    (select l.target_id from public.fm_stage_records p
       join public.fm_stage_records d on d.base_table = 'Departments' and lower(btrim(d.data->>'Account Name')) = lower(btrim(p.data->>'DepartmentAccount LK'))
       join public.fm_stage_links l on l.base_table = 'Departments' and l.record_id = d.record_id and l.target_table = 'departments'
      where p.base_table = 'People' and lower(btrim(p.data->>'account name')) = lower(btrim(p_account)) limit 1))
$$;

-- The Limoxis row a FileMaker record was added as.
create or replace function private.fm_target(p_base_table text, p_record_id text, p_target_table text)
returns uuid language sql stable set search_path = '' as $$
  select l.target_id from public.fm_stage_links l
  where l.base_table = p_base_table and l.record_id = p_record_id and l.target_table = p_target_table limit 1
$$;

-- New staff (People).
create or replace function private.fm_sync_people()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  with src as (
    select r.record_id, r.data d, private.fm_department(r.data->>'DepartmentAccount LK') as department_id
    from public.fm_stage_records r
    where r.base_table = 'People' and coalesce(r.data->>'Creation Date', '') >= '2026-10-19'
      and not exists (select 1 from public.fm_stage_links l where l.base_table = 'People' and l.record_id = r.record_id)
  ), ins as (
    insert into public.employees (id, organization_id, employee_code, first_name, last_name, father_name, email, phone, birth_date, hire_date, department_id, department_name, employment_status, created_by, updated_by)
    select md5('fm-People-' || s.record_id)::uuid, private.fm_org(), coalesce(private.fm_text(s.d->>'Mhtroo'), 'FM-' || s.record_id),
           coalesce(private.fm_text(s.d->>'People_Name'), '—'), coalesce(replace(private.fm_text(s.d->>'People_Surname'), E'\n', ' '), '—'),
           private.fm_text(s.d->>'People_ FatherName'), private.fm_text(s.d->>'People_email'), private.fm_text(s.d->>'People_Phone'),
           nullif(s.d->>'People_Birth Date', '')::date, nullif(s.d->>'People_HireDate', '')::date,
           s.department_id, (select dp.name from public.departments dp where dp.id = s.department_id),
           case s.d->>'People_Status' when 'Ανενεργός' then 'inactive' when 'Εγκυμοσύνη' then 'leave' else 'active' end,
           private.fm_importer(), private.fm_importer()
    from src s
    on conflict do nothing
    returning id
  ), links as (
    insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
    select 'People', s.record_id, 'employees', i.id, 'created', 'hourly sync', now()
    from src s join ins i on i.id = md5('fm-People-' || s.record_id)::uuid
    returning 1
  )
  select count(*) into v_count from links;
  return v_count;
end;
$$;

-- New training programmes (Training) and their participants (Training Participants).
create or replace function private.fm_sync_training()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_programs integer; v_people integer;
begin
  with src as (
    select r.record_id, r.data d
    from public.fm_stage_records r
    where r.base_table = 'Training' and coalesce(r.data->>'CreationTimestamp', '') >= '2026-10-19'
      -- A programme still being filled in (no theme yet) waits for the next hour.
      and private.fm_text(r.data->>'Train_Theme') is not null
      and not exists (select 1 from public.fm_stage_links l where l.base_table = 'Training' and l.record_id = r.record_id)
  ), ins as (
    insert into public.training_programs (id, organization_id, program_key, title, status, trainer, start_date, due_date, location, duration_hours, department_id, method, delivery_kind, start_time, cost, requires_assessment, created_by, updated_by, created_at)
    select md5('fm-Training-' || s.record_id)::uuid, private.fm_org(), 'TRN-FM-' || coalesce(s.d->>'Train_ID', s.record_id),
           coalesce(replace(private.fm_text(s.d->>'Train_Theme'), E'\n', ' '), 'Εκπαίδευση'),
           case lower(coalesce(s.d->>'Train_Status', '')) when 'completed' then 'completed' when 'cancelled' then 'cancelled' else 'planned' end,
           private.fm_text(s.d->>'Train_Instructor'), nullif(s.d->>'Train_StartDay', '')::date,
           coalesce(nullif(s.d->>'Train_FinishDay', ''), nullif(s.d->>'Train_StartDay', ''))::date,
           private.fm_text(s.d->>'Train_Location'),
           case when s.d->>'Train_Hours' ~ '^[0-9.]+$' and (s.d->>'Train_Hours')::numeric > 0 then (s.d->>'Train_Hours')::numeric end,
           private.fm_department(s.d->>'CreatedBy'),
           case when s.d->>'Type train' is not null then 'in_person' end,
           case s.d->>'Type train' when 'ΕΝΔΟΤΜΗΜΑΤΙΚΗ' then 'intra_department' when 'ΕΞΩΤΕΡΙΚΗ' then 'external' when 'ΕΣΩΤΕΡΙΚΗ' then 'internal' end,
           case when s.d->>'time' ~ '^\d{2}:\d{2}' then left(s.d->>'time', 8)::time end,
           case when s.d->>'cost' ~ '^[0-9.]+$' then (s.d->>'cost')::numeric end,
           false, private.fm_importer(), private.fm_importer(), coalesce(private.fm_local_ts(s.d->>'CreationTimestamp'), now())
    from src s
    on conflict do nothing
    returning id
  ), links as (
    insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
    select 'Training', s.record_id, 'training_programs', i.id, 'created', 'hourly sync', now()
    from src s join ins i on i.id = md5('fm-Training-' || s.record_id)::uuid
    returning 1
  )
  select count(*) into v_programs from links;

  with src as (
    select r.record_id, r.data d, p.id as program_id, p.status, p.start_date, p.due_date, e.id as employee_id, e.employee_code, e.email, e.department_id, e.department_name
    from public.fm_stage_records r
    join public.fm_stage_records t on t.base_table = 'Training' and t.data->>'Train_ID' = r.data->>'Training ID'
    join public.training_programs p on p.id = private.fm_target('Training', t.record_id, 'training_programs')
    left join public.fm_stage_records pr on pr.base_table = 'People' and pr.data->>'People ID' = r.data->>'Participant ID'
    left join public.employees e on e.id = private.fm_target('People', pr.record_id, 'employees')
    where r.base_table = 'Training Participants' and coalesce(r.data->>'Creation Timestamp', '') >= '2026-10-19'
      and not exists (select 1 from public.fm_stage_links l where l.base_table = 'Training Participants' and l.record_id = r.record_id)
  ), ins as (
    insert into public.training_assignments (id, organization_id, program_id, employee_id, employee_code, employee_name, email, department_id, department_name, assignment_key, status, assigned_date, due_date, completed_date, attendance, manual_entry, account_linked, attendance_response, created_by, updated_by, created_at)
    select md5('fm-TrainingParticipants-' || s.record_id)::uuid, private.fm_org(), s.program_id, s.employee_id, s.employee_code,
           coalesce(replace(private.fm_text(s.d->>'Participant Full Name'), E'\n', ' '), '—'), s.email, s.department_id, s.department_name,
           'TRA-FM-' || s.record_id, case when s.status = 'completed' then 'completed' else 'assigned' end,
           s.start_date, s.due_date, case when s.status = 'completed' then s.due_date end, case when s.status = 'completed' then true end,
           false, false, 'not_sent', private.fm_importer(), private.fm_importer(), coalesce(private.fm_local_ts(s.d->>'Creation Timestamp'), now())
    from src s
    on conflict do nothing
    returning id
  ), links as (
    insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
    select 'Training Participants', s.record_id, 'training_assignments', i.id, 'created', 'hourly sync', now()
    from src s join ins i on i.id = md5('fm-TrainingParticipants-' || s.record_id)::uuid
    returning 1
  )
  select count(*) into v_people from links;
  return v_programs + v_people;
end;
$$;

-- New department meetings (Meeting_REVIEWS), their decisions (Μeeting_Decisions)
-- and their participants (Training Participants of the meeting: by its training
-- id, else the participants entered by the same account the day it was made).
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
    insert into public.quality_department_meeting_decisions (id, organization_id, meeting_id, title, status, position)
    select md5('fm-MeetingDecisions-' || s.record_id)::uuid, private.fm_org(), s.meeting_id, private.fm_text(s.d->>'TopicDiscussed'), 'open',
           (select count(*) from public.quality_department_meeting_decisions x where x.meeting_id = s.meeting_id)
           + row_number() over (partition by s.meeting_id order by s.d->>'CreationTimestamp', s.record_id)
    from src s where s.meeting_id is not null
    on conflict do nothing
    returning id
  ), links as (
    insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
    select 'Μeeting_Decisions', s.record_id, 'quality_department_meeting_decisions', i.id, 'created', 'hourly sync', now()
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

-- A committee decision's text with the patient's name as initials, as the first
-- transfer did («Ασθενής: Παπαδόπουλος Γεώργιος» → «Ασθενής: Π.Γ.»).
create or replace function private.fm_patient_initials(p_value text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(p_value, '(Ασθενής:)\s*([^\s.]{1})[^\s]*\s+([^\s.]{1})[^\s,]*', '\1 \2.\3.', 'g')
$$;

-- New committee meetings (Commitees_REVIEWS) and decisions (Commitees_Decisions).
create or replace function private.fm_sync_committees()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_meetings integer; v_decisions integer;
begin
  with src as (
    select r.record_id, r.data d, nullif(r.data->>'DATE', '')::date as meeting_date,
           (select private.fm_target('Commitees', c.record_id, 'committees') from public.fm_stage_records c
             where c.base_table = 'Commitees' and c.data->>'CommiteeID_PrimaryKey' = r.data->>'CommiteeID' limit 1) as committee_id
    from public.fm_stage_records r
    where r.base_table = 'Commitees_REVIEWS' and coalesce(r.data->>'CreationTimestamp', '') >= '2026-10-19' and nullif(r.data->>'DATE', '') is not null
      and not exists (select 1 from public.fm_stage_links l where l.base_table = 'Commitees_REVIEWS' and l.record_id = r.record_id)
  ), ins as (
    insert into public.committee_meetings (id, organization_id, committee_id, title, status, client_key, scheduled_at, finalized_at, meeting_type, created_by, created_at)
    select md5('fm-CommiteesREVIEWS-' || s.record_id)::uuid, private.fm_org(), s.committee_id, 'Συνεδρίαση ' || to_char(s.meeting_date, 'DD/MM/YYYY'),
           case when s.meeting_date <= (now() at time zone 'Europe/Athens')::date then 'finalized' else 'planned' end, 'FM-CR-' || s.record_id,
           (s.meeting_date::timestamp + interval '12 hours') at time zone 'UTC',
           case when s.meeting_date <= (now() at time zone 'Europe/Athens')::date then private.fm_local_ts(s.d->>'ModificationTimestamp') end,
           'regular', private.fm_importer(), coalesce(private.fm_local_ts(s.d->>'CreationTimestamp'), now())
    from src s where s.committee_id is not null
    on conflict do nothing
    returning id
  ), links as (
    insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
    select 'Commitees_REVIEWS', s.record_id, 'committee_meetings', i.id, 'created', 'hourly sync', now()
    from src s join ins i on i.id = md5('fm-CommiteesREVIEWS-' || s.record_id)::uuid
    returning 1
  )
  select count(*) into v_meetings from links;

  with src as (
    select r.record_id, r.data d, m.id as meeting_id, m.committee_id
    from public.fm_stage_records r
    join public.fm_stage_records cr on cr.base_table = 'Commitees_REVIEWS' and cr.data->>'Review_ID_PrimaryKey' = r.data->>'CommiteeReviewID'
    join public.committee_meetings m on m.id = private.fm_target('Commitees_REVIEWS', cr.record_id, 'committee_meetings')
    where r.base_table = 'Commitees_Decisions' and coalesce(r.data->>'CreationTimestamp', '') >= '2026-10-19' and private.fm_text(r.data->>'TopicDiscussed') is not null
      and not exists (select 1 from public.fm_stage_links l where l.base_table = 'Commitees_Decisions' and l.record_id = r.record_id)
  ), ins as (
    insert into public.committee_decisions (id, organization_id, committee_id, meeting_id, title, status, priority, topic_key, client_key, created_by, created_at)
    select md5('fm-CommiteesDecisions-' || s.record_id)::uuid, private.fm_org(), s.committee_id, s.meeting_id,
           private.fm_patient_initials(private.fm_text(s.d->>'TopicDiscussed')), 'open', 'medium', 'TOP-FM-' || s.record_id,
           'DEC-FM-' || coalesce(s.d->>'DecisionNo', s.record_id), private.fm_importer(), coalesce(private.fm_local_ts(s.d->>'CreationTimestamp'), now())
    from src s
    on conflict do nothing
    returning id
  ), links as (
    insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
    select 'Commitees_Decisions', s.record_id, 'committee_decisions', i.id, 'created', 'hourly sync', now()
    from src s join ins i on i.id = md5('fm-CommiteesDecisions-' || s.record_id)::uuid
    returning 1
  )
  select count(*) into v_decisions from links;
  return v_meetings + v_decisions;
end;
$$;

-- New incidents (IncidentManagement), as reported («Αναφέρθηκε») for the
-- Quality office to review; a death's record (Death) is linked to its incident.
create or replace function private.fm_sync_incidents()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_incidents integer; v_deaths integer;
begin
  with src as (
    select r.record_id, r.data d, r.data->>'Incident type' as kind, nullif(r.data->>'Date', '')::date as occurred_on
    from public.fm_stage_records r
    where r.base_table = 'IncidentManagement' and coalesce(r.data->>'CreationTimestamp', '') >= '2026-10-19' and nullif(r.data->>'Date', '') is not null
      and not exists (select 1 from public.fm_stage_links l where l.base_table = 'IncidentManagement' and l.record_id = r.record_id)
  ), typed as (
    select s.*,
           case s.kind when 'Θάνατος' then 'death' when 'ΜΠΛΕ ΚΩΔΙΚΟΣ' then 'blue_code' when 'Επανεισαγωγή' then 'readmission'
                       when 'Επανείσοδος στο Χειρουργείο' then 'return_to_theatre' when 'Αιμορραγία' then 'haemorrhage'
                       when 'Μαιευτικό Συμβάν' then 'obstetric' when 'Τραυματισμός / Πτώση / Έκθεση σε επικίνδυνο παράγοντα' then 'injury_fall_exposure'
                       else 'other' end as event_type,
           case when s.d->>'Imporance' like '%Πολύ Υψηλή%' then 'critical' when s.d->>'Imporance' like 'Υψηλή%' then 'high'
                when s.d->>'Imporance' like 'Μέτρια%' then 'medium' when s.d->>'Imporance' like '%Χαμηλή%' then 'low'
                when s.kind = 'Θάνατος' then 'critical' else 'high' end as severity
    from src s
  ), ins as (
    insert into public.quality_incidents (id, organization_id, code, title, department_id, occurred_at, event_time, severity, status, description, category, impact, incident_class, reached_patient, harm_occurred, report_kind, event_type, reported_by_label, lifecycle_status, history, created_at)
    select md5('fm-IncidentManagement-' || t.record_id)::uuid, private.fm_org(),
           'INC-' || to_char(t.occurred_on, 'YYMMDD') || '-' || lpad(t.record_id, 6, '0'),
           case t.event_type when 'death' then 'Θάνατος' when 'blue_code' then 'Μπλε κωδικός (ανακοπή)' when 'readmission' then 'Επανεισαγωγή'
                             when 'return_to_theatre' then 'Επιστροφή στο χειρουργείο' when 'haemorrhage' then 'Αιμορραγία'
                             when 'obstetric' then 'Μαιευτικό συμβάν' || coalesce(': ' || private.fm_text(t.d->>'μαιευτικό συμβάν υποκατηγορία'), '')
                             else coalesce(private.fm_text(t.d->>'Injured_SubcategoryCategory'), private.fm_text(t.d->>'Incident Title'), t.kind, 'Συμβάν') end,
           private.fm_department(t.d->>'CreatedBy'), (t.occurred_on::timestamp + interval '12 hours') at time zone 'UTC',
           case when t.d->>'Time GInc' ~ '^\d{2}:\d{2}' then left(t.d->>'Time GInc', 8)::time end,
           t.severity, case when t.d->>'Status' = 'Close' then 'closed' else 'reported' end,
           private.fm_text(coalesce(t.d->>'Incident Details', t.d->>'Incident Title')),
           case t.event_type when 'return_to_theatre' then 'surgery' else 'clinical' end,
           case when t.event_type = 'death' then 'death' else 'none' end,
           case when t.event_type = 'death' then 'harmful' else 'nearMiss' end,
           t.event_type = 'death', t.event_type = 'death', 'clinical', t.event_type,
           private.fm_text(t.d->>'Reported by'), 'active',
           jsonb_build_array(jsonb_build_object('at', now(), 'actor', 'Μεταφορά από ISOWISE (FileMaker)', 'action', 'imported')),
           coalesce(private.fm_local_ts(t.d->>'CreationTimestamp'), now())
    from typed t
    on conflict do nothing
    returning id
  ), links as (
    insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
    select 'IncidentManagement', t.record_id, 'quality_incidents', i.id, 'created', 'hourly sync', now()
    from typed t join ins i on i.id = md5('fm-IncidentManagement-' || t.record_id)::uuid
    returning 1
  )
  select count(*) into v_incidents from links;

  with src as (
    select r.record_id, private.fm_target('IncidentManagement', im.record_id, 'quality_incidents') as incident_id
    from public.fm_stage_records r
    join public.fm_stage_records im on im.base_table = 'IncidentManagement' and im.data->>'Incident_ID_Auto' = r.data->>'Incident ID'
    where r.base_table = 'Death' and coalesce(r.data->>'CreationTimestamp', '') >= '2026-10-19'
      and not exists (select 1 from public.fm_stage_links l where l.base_table = 'Death' and l.record_id = r.record_id)
  ), links as (
    insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
    select 'Death', s.record_id, 'quality_incidents', s.incident_id, 'matched', 'hourly sync', now()
    from src s where s.incident_id is not null
    on conflict do nothing
    returning 1
  )
  select count(*) into v_deaths from links;
  return v_incidents + v_deaths;
end;
$$;

create or replace function private.fm_sync_tables()
returns text[] language sql immutable set search_path = '' as $$
  select array['PerformedControls', 'People', 'Departments', 'Controls', 'Training', 'Training Participants', 'Meeting_REVIEWS', 'Μeeting_Decisions',
               'Commitees', 'Commitees_REVIEWS', 'Commitees_Decisions', 'IncidentManagement', 'Death']
$$;

-- Staff first (training and meetings name them), then the rest.
create or replace function private.fm_sync_all()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not coalesce((select s.enabled from public.fm_stage_settings s where s.id), false) then return null; end if;
  v_result := jsonb_build_object('task', 'hourly_sync', 'at', now(), 'people', private.fm_sync_people());
  v_result := v_result || jsonb_build_object('controls', private.fm_sync_controls(), 'training', private.fm_sync_training(),
    'department_meetings', private.fm_sync_department_meetings(), 'committees', private.fm_sync_committees(), 'incidents', private.fm_sync_incidents());
  update public.fm_stage_settings set last_result = v_result where id;
  return v_result;
end;
$$;
