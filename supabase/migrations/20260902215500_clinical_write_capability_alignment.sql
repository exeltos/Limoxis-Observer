-- IND02 strict role audit: clinical writes must follow explicit capabilities and
-- the same record scope as reads. A role that can see a record does not thereby
-- gain permission to alter clinical state.

create or replace function public.current_user_can_write_case_capability(target_org uuid,target_department uuid,target_case uuid,target_capability text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    public.current_user_is_platform_owner()
    or (
      public.current_user_has_capability(target_org,target_capability)
      and (
        public.current_user_has_org_role(target_org,array['infection_control_lead','infection_control_member']::public.app_role[])
        or (
          public.current_user_has_org_role(target_org,array['department_manager','link_nurse']::public.app_role[])
          and target_department is not null
          and public.current_user_has_department_scope(target_org,target_department)
        )
        or (
          target_case is not null
          and public.current_user_has_case_assignment(target_org,target_case)
        )
      )
    );
$$;

revoke all on function public.current_user_can_write_case_capability(uuid,uuid,uuid,text) from public;
grant execute on function public.current_user_can_write_case_capability(uuid,uuid,uuid,text) to authenticated;

drop policy if exists clinical_assessments_write on public.clinical_assessments;
create policy clinical_assessments_write on public.clinical_assessments
for all to authenticated
using (public.current_user_can_write_case_capability(organization_id,department_id,surveillance_case_id,'record_clinical_assessment'))
with check (public.current_user_can_write_case_capability(organization_id,department_id,surveillance_case_id,'record_clinical_assessment'));

drop policy if exists isolation_episodes_write on public.isolation_episodes;
create policy isolation_episodes_write on public.isolation_episodes
for all to authenticated
using (public.current_user_can_write_case_capability(organization_id,department_id,surveillance_case_id,'manage_isolation'))
with check (public.current_user_can_write_case_capability(organization_id,department_id,surveillance_case_id,'manage_isolation'));

drop policy if exists reassessments_write on public.surveillance_reassessments;
create policy reassessments_write on public.surveillance_reassessments
for insert to authenticated
with check (
  exists (
    select 1 from public.surveillance_cases sc
    where sc.id = surveillance_case_id
      and sc.organization_id = organization_id
      and public.current_user_can_write_case_capability(sc.organization_id,sc.department_id,sc.id,'reassess_surveillance')
  )
);

drop policy if exists outcomes_write on public.surveillance_outcomes;
create policy outcomes_write on public.surveillance_outcomes
for all to authenticated
using (
  exists (
    select 1 from public.surveillance_cases sc
    where sc.id = surveillance_case_id
      and sc.organization_id = organization_id
      and public.current_user_can_write_case_capability(sc.organization_id,sc.department_id,sc.id,'record_surveillance_outcome')
  )
)
with check (
  exists (
    select 1 from public.surveillance_cases sc
    where sc.id = surveillance_case_id
      and sc.organization_id = organization_id
      and public.current_user_can_write_case_capability(sc.organization_id,sc.department_id,sc.id,'record_surveillance_outcome')
  )
);
