-- IND02 strict role audit: Laboratory is department-scoped for workforce identity,
-- but its laboratory operations are organization-wide within its own hospital.
-- This migration makes that distinction explicit at the RLS boundary.

create or replace function public.current_user_can_view_laboratory_sample(target_org uuid,target_department uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(
      target_org,
      array['hospital_admin','infection_control_lead','infection_control_member','laboratory']::public.app_role[]
    )
    or (
      public.current_user_has_org_role(target_org,array['department_manager','link_nurse']::public.app_role[])
      and target_department is not null
      and public.current_user_has_department_scope(target_org,target_department)
    );
$$;

revoke all on function public.current_user_can_view_laboratory_sample(uuid,uuid) from public;
grant execute on function public.current_user_can_view_laboratory_sample(uuid,uuid) to authenticated;

drop policy if exists laboratory_samples_read on public.laboratory_samples;
create policy laboratory_samples_read on public.laboratory_samples
for select to authenticated
using (public.current_user_can_view_laboratory_sample(organization_id,department_id));

-- Laboratory processing is hospital-wide: a laboratory user may process samples
-- submitted by any clinical department in the same organization. The sample's
-- clinical department is therefore not used as the laboratory user's workforce scope.
drop policy if exists laboratory_samples_write on public.laboratory_samples;
create policy laboratory_samples_write on public.laboratory_samples
for all to authenticated
using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id,array['laboratory']::public.app_role[])
)
with check (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id,array['laboratory']::public.app_role[])
);

-- Result visibility inherits the parent sample authorization instead of relying
-- on a permissive existence check alone.
drop policy if exists microbiology_results_read on public.microbiology_results;
create policy microbiology_results_read on public.microbiology_results
for select to authenticated
using (
  exists (
    select 1
    from public.laboratory_samples s
    where s.id = sample_id
      and s.organization_id = organization_id
      and public.current_user_can_view_laboratory_sample(s.organization_id,s.department_id)
  )
);

drop policy if exists microbiology_results_write on public.microbiology_results;
create policy microbiology_results_write on public.microbiology_results
for all to authenticated
using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id,array['laboratory']::public.app_role[])
)
with check (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id,array['laboratory']::public.app_role[])
);
