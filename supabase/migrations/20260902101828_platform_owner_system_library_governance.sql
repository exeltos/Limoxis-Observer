drop policy if exists master_library_items_manage on public.master_library_items;
drop policy if exists master_library_items_read on public.master_library_items;
create policy master_library_items_read on public.master_library_items for select to authenticated using (public.is_org_member(organization_id) or public.current_user_is_platform_owner());
create policy master_library_items_manage_hospital on public.master_library_items for all to authenticated using (public.is_org_admin(organization_id) and coalesce(metadata->>'system','false') <> 'true') with check (public.is_org_admin(organization_id) and coalesce(metadata->>'system','false') <> 'true');
create policy master_library_items_manage_system_owner on public.master_library_items for all to authenticated using (coalesce(metadata->>'system','false') = 'true' and public.current_user_is_platform_owner()) with check (coalesce(metadata->>'system','false') = 'true' and public.current_user_is_platform_owner());
