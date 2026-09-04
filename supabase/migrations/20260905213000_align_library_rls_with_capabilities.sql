drop policy if exists departments_manage_admin on public.departments;
create policy departments_manage_library_capability on public.departments
for all
using (public.current_user_has_capability(organization_id,'manage_libraries'))
with check (public.current_user_has_capability(organization_id,'manage_libraries'));

drop policy if exists departments_view_org on public.departments;
create policy departments_read_org_or_owner on public.departments
for select
using (public.is_org_member(organization_id) or public.current_user_is_platform_owner());

drop policy if exists master_library_items_manage_hospital on public.master_library_items;
create policy master_library_items_manage_hospital on public.master_library_items
for all
using (
  public.current_user_has_capability(organization_id,'manage_libraries')
  and coalesce(metadata->>'system','false') <> 'true'
)
with check (
  public.current_user_has_capability(organization_id,'manage_libraries')
  and coalesce(metadata->>'system','false') <> 'true'
);
