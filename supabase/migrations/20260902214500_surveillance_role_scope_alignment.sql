-- IND02 strict role audit: align patient/surveillance reads with the canonical role model.
-- IPC roles retain hospital-wide surveillance visibility; Link Nurse and Department
-- Manager are limited to assigned departments; Doctor Reviewer remains assignment-scoped.

create or replace function public.current_user_has_case_assignment(target_org uuid,target_case uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    public.current_user_is_platform_owner()
    or exists (
      select 1
      from public.work_assignments wa
      join public.organization_members om on om.id = wa.membership_id
      where wa.organization_id = target_org
        and wa.source_id = target_case
        and wa.source_type in ('surveillance_case','surveillance')
        and wa.status in ('open','in_progress','overdue')
        and om.user_id = auth.uid()
        and om.organization_id = target_org
        and om.status = 'active'
        and om.role = 'doctor_reviewer'::public.app_role
    );
$$;

revoke all on function public.current_user_has_case_assignment(uuid,uuid) from public;
grant execute on function public.current_user_has_case_assignment(uuid,uuid) to authenticated;

-- Preserve the legacy two-argument helper because existing policies depend on it.
-- It is deliberately conservative; case-aware policies use the overload below.
create or replace function public.can_view_surveillance_record(target_org uuid,target_department uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(target_org,array['infection_control_lead','infection_control_member']::public.app_role[])
    or (
      public.current_user_has_org_role(target_org,array['department_manager','link_nurse']::public.app_role[])
      and target_department is not null
      and public.current_user_has_department_scope(target_org,target_department)
    );
$$;

create or replace function public.can_view_surveillance_record(target_org uuid,target_department uuid,target_case uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    public.can_view_surveillance_record(target_org,target_department)
    or (
      target_case is not null
      and public.current_user_has_case_assignment(target_org,target_case)
    );
$$;

revoke all on function public.can_view_surveillance_record(uuid,uuid) from public;
grant execute on function public.can_view_surveillance_record(uuid,uuid) to authenticated;
revoke all on function public.can_view_surveillance_record(uuid,uuid,uuid) from public;
grant execute on function public.can_view_surveillance_record(uuid,uuid,uuid) to authenticated;

drop policy if exists patients_clinical_read on public.patients;
create policy patients_clinical_read on public.patients
for select to authenticated
using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[])
  or (
    public.current_user_has_org_role(organization_id,array['department_manager','link_nurse']::public.app_role[])
    and department_id is not null
    and public.current_user_has_department_scope(organization_id,department_id)
  )
  or exists (
    select 1 from public.surveillance_cases sc
    where sc.patient_id = patients.id
      and sc.organization_id = patients.organization_id
      and public.current_user_has_case_assignment(sc.organization_id,sc.id)
  )
);

drop policy if exists surveillance_clinical_read on public.surveillance_cases;
create policy surveillance_clinical_read on public.surveillance_cases
for select to authenticated
using (public.can_view_surveillance_record(organization_id,department_id,id));

drop policy if exists surveillance_events_clinical_read on public.surveillance_events;
create policy surveillance_events_clinical_read on public.surveillance_events
for select to authenticated
using (
  exists (
    select 1 from public.surveillance_cases sc
    where sc.id = surveillance_case_id
      and public.can_view_surveillance_record(sc.organization_id,sc.department_id,sc.id)
  )
);

drop policy if exists clinical_assessments_read on public.clinical_assessments;
create policy clinical_assessments_read on public.clinical_assessments
for select to authenticated
using (public.can_view_surveillance_record(organization_id,department_id,surveillance_case_id));

drop policy if exists isolation_episodes_read on public.isolation_episodes;
create policy isolation_episodes_read on public.isolation_episodes
for select to authenticated
using (public.can_view_surveillance_record(organization_id,department_id,surveillance_case_id));

drop policy if exists reassessments_read on public.surveillance_reassessments;
create policy reassessments_read on public.surveillance_reassessments
for select to authenticated
using (
  exists (
    select 1 from public.surveillance_cases sc
    where sc.id = surveillance_case_id
      and public.can_view_surveillance_record(sc.organization_id,sc.department_id,sc.id)
  )
);

drop policy if exists outcomes_read on public.surveillance_outcomes;
create policy outcomes_read on public.surveillance_outcomes
for select to authenticated
using (
  exists (
    select 1 from public.surveillance_cases sc
    where sc.id = surveillance_case_id
      and public.can_view_surveillance_record(sc.organization_id,sc.department_id,sc.id)
  )
);

-- Rebind journey-table reads to case-aware authorization so Doctor Reviewer
-- visibility is assignment-scoped without dropping unrelated dependent policies.
drop policy if exists hai_classification_read on public.hai_classifications;
create policy hai_classification_read on public.hai_classifications
for select to authenticated
using (
  exists (
    select 1 from public.surveillance_cases sc
    where sc.id = surveillance_case_id
      and public.can_view_surveillance_record(sc.organization_id,sc.department_id,sc.id)
  )
);

drop policy if exists surveillance_devices_read on public.surveillance_devices;
create policy surveillance_devices_read on public.surveillance_devices
for select to authenticated
using (public.can_view_surveillance_record(organization_id,department_id,surveillance_case_id));
