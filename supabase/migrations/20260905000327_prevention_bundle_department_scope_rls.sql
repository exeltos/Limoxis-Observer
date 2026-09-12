create or replace function public.current_user_can_read_prevention_bundle(target_org uuid,target_department uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    public.current_user_is_platform_owner()
    or public.is_org_admin(target_org)
    or public.current_user_has_org_role(target_org,array['infection_control_lead','infection_control_member']::public.app_role[])
    or (
      target_department is not null
      and public.current_user_has_department_scope(target_org,target_department)
      and public.current_user_has_capability(target_org,'view_prevention')
    );
$$;

create or replace function public.current_user_can_write_prevention_bundle(target_org uuid,target_department uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    public.current_user_is_platform_owner()
    or public.is_org_admin(target_org)
    or public.current_user_has_org_role(target_org,array['infection_control_lead','infection_control_member']::public.app_role[])
    or (
      target_department is not null
      and public.current_user_has_department_scope(target_org,target_department)
      and public.current_user_has_capability(target_org,'record_prevention_bundle')
    );
$$;

drop policy if exists bundles_read on public.prevention_bundle_assessments;
create policy bundles_read
on public.prevention_bundle_assessments
for select
using (public.current_user_can_read_prevention_bundle(organization_id,department_id));

drop policy if exists bundles_write on public.prevention_bundle_assessments;
create policy bundles_write
on public.prevention_bundle_assessments
for all
using (public.current_user_can_write_prevention_bundle(organization_id,department_id))
with check (public.current_user_can_write_prevention_bundle(organization_id,department_id));
