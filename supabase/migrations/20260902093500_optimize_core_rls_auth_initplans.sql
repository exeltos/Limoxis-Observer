-- Avoid evaluating auth.uid() once per candidate row in high-traffic identity and
-- training policies. Wrapping it in a scalar subquery preserves policy semantics while
-- allowing PostgreSQL to build an initplan once per statement.

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read
on public.profiles
for select
using ((id = (select auth.uid())) or public.current_user_is_platform_owner());

drop policy if exists profiles_org_admin_read on public.profiles;
create policy profiles_org_admin_read
on public.profiles
for select
using (
  (id = (select auth.uid()))
  or public.current_user_is_platform_owner()
  or exists (
    select 1
    from public.organization_members viewer
    join public.organization_members target
      on target.organization_id = viewer.organization_id
    where viewer.user_id = (select auth.uid())
      and viewer.status = 'active'::public.member_status
      and viewer.role = 'hospital_admin'::public.app_role
      and target.user_id = profiles.id
  )
);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
on public.profiles
for update
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists memberships_member_read on public.organization_members;
create policy memberships_member_read
on public.organization_members
for select
using (
  (user_id = (select auth.uid()))
  or public.has_org_role(organization_id, array['hospital_admin'::public.app_role])
);

drop policy if exists memberships_platform_owner_read on public.organization_members;
create policy memberships_platform_owner_read
on public.organization_members
for select
using (
  public.current_user_is_platform_owner()
  or (user_id = (select auth.uid()))
  or public.has_org_role(organization_id, array['hospital_admin'::public.app_role])
);

drop policy if exists training_records_read on public.training_records;
create policy training_records_read
on public.training_records
for select
using (
  ((record_type = 'program') and public.is_org_member(organization_id))
  or public.current_user_has_org_role(
    organization_id,
    array[
      'hospital_admin'::public.app_role,
      'infection_control_lead'::public.app_role,
      'infection_control_member'::public.app_role,
      'hr_office'::public.app_role
    ]
  )
  or (
    department_id is not null
    and public.current_user_has_org_role(
      organization_id,
      array['department_manager'::public.app_role,'department_user'::public.app_role]
    )
    and public.current_user_has_department_scope(organization_id, department_id)
  )
  or (employee_user_id = (select auth.uid()))
);
