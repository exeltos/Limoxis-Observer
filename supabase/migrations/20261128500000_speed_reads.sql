-- Faster reads for screens that waited on many requests.
--
-- public.control_recent_executions(org, assignment_ids, limit)
--     one control's entry form read the latest entries of each department
--     with one request per assignment (up to 15 for one control). Now one
--     request: the latest p_limit entries of every assignment, from the
--     (assignment_id, performed_at desc) index.
-- public.patient_infection_flags(org)
--     the patient registry hydrated every surveillance episode (13 tables) to
--     show the resistance badge. Now one row per patient: the classification
--     of the newest non-cancelled episode with a resistant sample, its
--     organism and the episode's start, with the rules of
--     patientInfectionFlagsService.js (a sample's result is its validated one,
--     otherwise its newest; the result's newest AMR classification wins over
--     resistance_class).
-- Both are SECURITY INVOKER: they read through the tables' own row level
-- security, so a caller sees the same rows as with a direct select.
--
-- recycle_bin_insert evaluated auth.uid() for every row (advisor
-- auth_rls_initplan); it is now evaluated once per statement.

create or replace function public.control_recent_executions(p_organization_id uuid, p_assignment_ids uuid[], p_limit integer default 50)
returns setof public.control_executions
language plpgsql stable security invoker set search_path = '' set plan_cache_mode = force_custom_plan
as $$
begin
  return query
  select e.*
  from unnest(p_assignment_ids) as a(id)
  cross join lateral (
    select x.*
    from public.control_executions x
    where x.assignment_id = a.id and x.organization_id = p_organization_id
    order by x.performed_at desc, x.id desc
    limit greatest(coalesce(p_limit, 50), 1)
  ) e;
end;
$$;

create or replace function public.patient_infection_flags(p_organization_id uuid)
returns table (patient_id uuid, classification text, organism text, since timestamptz)
language plpgsql stable security invoker set search_path = '' set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
begin
  return query
  with cases as (
    select c.id, c.patient_id, c.started_at
    from public.surveillance_cases c
    where c.organization_id = p_organization_id
      and c.patient_id is not null
      and c.status is distinct from 'cancelled'
  ),
  samples as (
    select s.id, s.surveillance_case_id, s.requested_at,
           coalesce(nullif(amr.classification, ''), nullif(r.resistance_class, '')) as resistance,
           nullif(r.organism, '') as organism
    from public.laboratory_samples s
    join cases c on c.id = s.surveillance_case_id
    left join lateral (
      select m.id, m.resistance_class, m.organism
      from public.microbiology_results m
      where m.sample_id = s.id
      order by coalesce(m.validation_status = 'validated', false) desc, m.resulted_at desc, m.id
      limit 1
    ) r on true
    left join lateral (
      select x.classification
      from public.amr_classifications x
      where x.microbiology_result_id = r.id
      order by x.classified_at desc nulls last, x.id
      limit 1
    ) amr on true
  ),
  flagged as (
    select c.id, c.patient_id, c.started_at,
           (select s.resistance from samples s where s.surveillance_case_id = c.id and s.resistance is not null
             order by s.requested_at desc nulls last, s.id limit 1) as resistance,
           (select s.organism from samples s where s.surveillance_case_id = c.id and s.organism is not null
             order by s.requested_at desc nulls last, s.id limit 1) as organism
    from cases c
  )
  select distinct on (f.patient_id) f.patient_id, f.resistance, coalesce(f.organism, ''), f.started_at
  from flagged f
  where f.resistance is not null
  order by f.patient_id, f.started_at desc, f.id;
end;
$$;

revoke all on function public.control_recent_executions(uuid, uuid[], integer) from public, anon;
revoke all on function public.patient_infection_flags(uuid) from public, anon;
grant execute on function public.control_recent_executions(uuid, uuid[], integer) to authenticated;
grant execute on function public.patient_infection_flags(uuid) to authenticated;

alter policy recycle_bin_insert on public.recycle_bin
  with check (
    deleted_by = (select auth.uid())
    and (select public.current_user_has_org_role(organization_id, array[
      'hospital_admin', 'infection_control_lead', 'infection_control_member', 'link_nurse', 'doctor_reviewer',
      'department_manager', 'department_user', 'laboratory', 'committee_secretariat', 'hr_office', 'pharmacy',
      'occupational_physician', 'quality_manager'
    ]::public.app_role[]))
  );
