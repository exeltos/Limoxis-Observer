-- IND02 strict role audit: workforce registry scope alignment.
-- Employee administrative identity follows the same capability/role scope model as the UI.
-- Occupational-health clinical data remains separately protected.

create or replace function public.current_user_can_view_employee(target_org uuid,target_department uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    public.current_user_is_platform_owner()
    or public.is_org_admin(target_org)
    or public.current_user_has_org_role(target_org,array['infection_control_lead','hr_office','occupational_physician']::public.app_role[])
    or (
      public.current_user_has_org_role(target_org,array['link_nurse','department_manager','laboratory']::public.app_role[])
      and public.current_user_has_department_scope(target_org,target_department)
    )
    or (
      public.current_user_has_capability(target_org,'manage_staff_admin')
      and not public.current_user_has_org_role(target_org,array['link_nurse','department_manager','laboratory','department_user']::public.app_role[])
    )
    or (
      public.current_user_has_capability(target_org,'manage_occupational_health')
      and not public.current_user_has_org_role(target_org,array['link_nurse','department_manager','laboratory','department_user']::public.app_role[])
    );
$$;

revoke all on function public.current_user_can_view_employee(uuid,uuid) from public;
grant execute on function public.current_user_can_view_employee(uuid,uuid) to authenticated;

drop policy if exists employees_read on public.employees;
create policy employees_read on public.employees
for select to authenticated
using (public.current_user_can_view_employee(organization_id,department_id));

-- Administrative employee writes remain hospital-wide HR/admin governance.
-- Department-scoped roles may view their own department but cannot mutate the registry.
drop policy if exists employees_write on public.employees;
create policy employees_write on public.employees
for all to authenticated
using (
  public.current_user_is_platform_owner()
  or public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id,array['hr_office']::public.app_role[])
  or (
    public.current_user_has_capability(organization_id,'manage_staff_admin')
    and not public.current_user_has_org_role(organization_id,array['link_nurse','department_manager','laboratory','department_user']::public.app_role[])
  )
)
with check (
  public.current_user_is_platform_owner()
  or public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id,array['hr_office']::public.app_role[])
  or (
    public.current_user_has_capability(organization_id,'manage_staff_admin')
    and not public.current_user_has_org_role(organization_id,array['link_nurse','department_manager','laboratory','department_user']::public.app_role[])
  )
);
