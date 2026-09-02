drop policy if exists external_refs_manage on public.external_reference_versions;
drop policy if exists external_refs_read on public.external_reference_versions;
create policy external_refs_read on public.external_reference_versions for select to authenticated using (organization_id is null or public.is_org_member(organization_id) or public.current_user_is_platform_owner());
create policy external_refs_manage_hospital on public.external_reference_versions for all to authenticated using (organization_id is not null and public.is_org_admin(organization_id)) with check (organization_id is not null and public.is_org_admin(organization_id));
create policy external_refs_manage_system_owner on public.external_reference_versions for all to authenticated using (organization_id is null and public.current_user_is_platform_owner()) with check (organization_id is null and public.current_user_is_platform_owner());
