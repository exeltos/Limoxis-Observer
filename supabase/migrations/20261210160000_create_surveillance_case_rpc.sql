-- A new surveillance episode in one transaction: the case (with its admission link) and
-- the «surveillance start» event of its timeline. The app made three separate calls
-- (insert case, insert event, link admission); a failure in between left an episode
-- without its start event or its admission. Runs as the caller, so RLS decides who may.

create or replace function public.create_surveillance_case(
  p_organization_id uuid,
  p_patient_id uuid,
  p_department_id uuid default null,
  p_started_at timestamptz default null,
  p_review_due date default null,
  p_room text default null,
  p_reason text default null,
  p_reason_en text default null,
  p_suspected_source text default null,
  p_admission_id uuid default null
)
returns setof public.surveillance_cases
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_case public.surveillance_cases;
  v_started timestamptz := coalesce(p_started_at, now());
begin
  if p_department_id is not null and not exists (
    select 1 from public.departments d
    where d.id = p_department_id and d.organization_id = p_organization_id and d.is_active
  ) then
    raise exception 'Selected department is not available for this organization.';
  end if;
  insert into public.surveillance_cases (
    organization_id, patient_id, department_id, status, started_at,
    review_due_on, room, reason, reason_en, suspected_source, admission_id, created_by
  ) values (
    p_organization_id, p_patient_id, p_department_id, 'active', v_started,
    p_review_due, nullif(p_room, ''), nullif(p_reason, ''), nullif(p_reason_en, ''),
    nullif(p_suspected_source, ''), p_admission_id, auth.uid()
  ) returning * into v_case;
  insert into public.surveillance_events (
    organization_id, surveillance_case_id, event_type, event_status, occurred_at, detail, created_by
  ) values (
    p_organization_id, v_case.id, 'surveillance_start', 'completed', v_started, 'created', auth.uid()
  );
  return next v_case;
end;
$function$;
