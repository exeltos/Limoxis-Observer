-- Hospital Admin surveillance read alignment.
--
-- The application grants Hospital Admin VIEW_SURVEILLANCE at organization scope,
-- while the strict clinical RLS helper previously omitted that role entirely.
-- This made the production Surveillance registry fail/return no patient cases for
-- Hospital Admin even though the module is intentionally visible in navigation.
--
-- Keep least privilege: this migration grants read visibility only. It does not
-- grant occupational-health access, patient/surveillance mutation capabilities,
-- or clinical lifecycle authority.

create or replace function public.can_view_surveillance_record(target_org uuid,target_department uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(
      target_org,
      array['hospital_admin','infection_control_lead','infection_control_member']::public.app_role[]
    )
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

-- Patients need the same organization-wide read boundary because the production
-- Surveillance registry hydrates cases with their patient identity/department.
drop policy if exists patients_clinical_read on public.patients;
create policy patients_clinical_read on public.patients
for select to authenticated
using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(
    organization_id,
    array['hospital_admin','infection_control_lead','infection_control_member']::public.app_role[]
  )
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

-- Child clinical read policies already delegate to can_view_surveillance_record,
-- so replacing the helper above propagates Hospital Admin read access to the
-- canonical surveillance journey without widening any write policy.
