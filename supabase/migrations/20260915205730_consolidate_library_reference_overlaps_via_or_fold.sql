-- environmental_standards: fold the two manage ALL policies into one, then fold into read
drop policy if exists environmental_standards_manage_hospital on public.environmental_standards;
drop policy if exists environmental_standards_manage_system_owner on public.environmental_standards;
drop policy if exists environmental_standards_read on public.environmental_standards;
create policy environmental_standards_read on public.environmental_standards for select to authenticated
  using (
    is_org_member(organization_id)
    or current_user_is_platform_owner()
    or (current_user_has_capability(organization_id, 'manage_libraries') and coalesce((payload->>'system')::boolean, false) = false)
  );
create policy environmental_standards_insert on public.environmental_standards for insert to authenticated
  with check (
    (current_user_has_capability(organization_id, 'manage_libraries') and coalesce((payload->>'system')::boolean, false) = false)
    or (coalesce((payload->>'system')::boolean, false) = true and current_user_is_platform_owner())
  );
create policy environmental_standards_update on public.environmental_standards for update to authenticated
  using (
    (current_user_has_capability(organization_id, 'manage_libraries') and coalesce((payload->>'system')::boolean, false) = false)
    or (coalesce((payload->>'system')::boolean, false) = true and current_user_is_platform_owner())
  )
  with check (
    (current_user_has_capability(organization_id, 'manage_libraries') and coalesce((payload->>'system')::boolean, false) = false)
    or (coalesce((payload->>'system')::boolean, false) = true and current_user_is_platform_owner())
  );
create policy environmental_standards_delete on public.environmental_standards for delete to authenticated
  using (
    (current_user_has_capability(organization_id, 'manage_libraries') and coalesce((payload->>'system')::boolean, false) = false)
    or (coalesce((payload->>'system')::boolean, false) = true and current_user_is_platform_owner())
  );

-- external_reference_versions
drop policy if exists external_refs_manage_hospital on public.external_reference_versions;
drop policy if exists external_refs_manage_system_owner on public.external_reference_versions;
drop policy if exists external_refs_read on public.external_reference_versions;
create policy external_refs_read on public.external_reference_versions for select to authenticated
  using (
    (organization_id is null)
    or is_org_member(organization_id)
    or current_user_is_platform_owner()
    or (organization_id is not null and is_org_admin(organization_id))
  );
create policy external_refs_insert on public.external_reference_versions for insert to authenticated
  with check (
    (organization_id is not null and is_org_admin(organization_id))
    or (organization_id is null and current_user_is_platform_owner())
  );
create policy external_refs_update on public.external_reference_versions for update to authenticated
  using (
    (organization_id is not null and is_org_admin(organization_id))
    or (organization_id is null and current_user_is_platform_owner())
  )
  with check (
    (organization_id is not null and is_org_admin(organization_id))
    or (organization_id is null and current_user_is_platform_owner())
  );
create policy external_refs_delete on public.external_reference_versions for delete to authenticated
  using (
    (organization_id is not null and is_org_admin(organization_id))
    or (organization_id is null and current_user_is_platform_owner())
  );

-- indicator_definitions
drop policy if exists indicators_manage_hospital on public.indicator_definitions;
drop policy if exists indicators_manage_system_owner on public.indicator_definitions;
drop policy if exists indicators_read on public.indicator_definitions;
create policy indicators_read on public.indicator_definitions for select to authenticated
  using (
    (organization_id is null)
    or is_org_member(organization_id)
    or current_user_is_platform_owner()
    or (organization_id is not null and current_user_has_capability(organization_id, 'manage_indicators'))
  );
create policy indicators_insert on public.indicator_definitions for insert to authenticated
  with check (
    (organization_id is not null and current_user_has_capability(organization_id, 'manage_indicators'))
    or (organization_id is null and current_user_is_platform_owner())
  );
create policy indicators_update on public.indicator_definitions for update to authenticated
  using (
    (organization_id is not null and current_user_has_capability(organization_id, 'manage_indicators'))
    or (organization_id is null and current_user_is_platform_owner())
  )
  with check (
    (organization_id is not null and current_user_has_capability(organization_id, 'manage_indicators'))
    or (organization_id is null and current_user_is_platform_owner())
  );
create policy indicators_delete on public.indicator_definitions for delete to authenticated
  using (
    (organization_id is not null and current_user_has_capability(organization_id, 'manage_indicators'))
    or (organization_id is null and current_user_is_platform_owner())
  );

-- master_library_items (manage_hospital is "to public", manage_system_owner+read are "to authenticated")
drop policy if exists master_library_items_manage_hospital on public.master_library_items;
drop policy if exists master_library_items_manage_system_owner on public.master_library_items;
drop policy if exists master_library_items_read on public.master_library_items;
create policy master_library_items_read on public.master_library_items for select to authenticated
  using (
    is_org_member(organization_id)
    or current_user_is_platform_owner()
    or (current_user_has_capability(organization_id, 'manage_libraries') and coalesce(metadata->>'system','false') <> 'true')
  );
create policy master_library_items_insert on public.master_library_items for insert to public
  with check (
    (current_user_has_capability(organization_id, 'manage_libraries') and coalesce(metadata->>'system','false') <> 'true')
    or (coalesce(metadata->>'system','false') = 'true' and current_user_is_platform_owner())
  );
create policy master_library_items_update on public.master_library_items for update to public
  using (
    (current_user_has_capability(organization_id, 'manage_libraries') and coalesce(metadata->>'system','false') <> 'true')
    or (coalesce(metadata->>'system','false') = 'true' and current_user_is_platform_owner())
  )
  with check (
    (current_user_has_capability(organization_id, 'manage_libraries') and coalesce(metadata->>'system','false') <> 'true')
    or (coalesce(metadata->>'system','false') = 'true' and current_user_is_platform_owner())
  );
create policy master_library_items_delete on public.master_library_items for delete to public
  using (
    (current_user_has_capability(organization_id, 'manage_libraries') and coalesce(metadata->>'system','false') <> 'true')
    or (coalesce(metadata->>'system','false') = 'true' and current_user_is_platform_owner())
  );

-- prevention_bundle_templates
drop policy if exists prevention_bundle_templates_manage_hospital on public.prevention_bundle_templates;
drop policy if exists prevention_bundle_templates_manage_system_owner on public.prevention_bundle_templates;
drop policy if exists prevention_bundle_templates_read on public.prevention_bundle_templates;
create policy prevention_bundle_templates_read on public.prevention_bundle_templates for select to authenticated
  using (
    is_system
    or (organization_id is not null and is_org_member(organization_id))
    or (not is_system and organization_id is not null and (is_org_admin(organization_id) or current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role])))
    or (is_system and organization_id is null and current_user_is_platform_owner())
  );
create policy prevention_bundle_templates_insert on public.prevention_bundle_templates for insert to authenticated
  with check (
    (not is_system and organization_id is not null and (is_org_admin(organization_id) or current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role])))
    or (is_system and organization_id is null and current_user_is_platform_owner())
  );
create policy prevention_bundle_templates_update on public.prevention_bundle_templates for update to authenticated
  using (
    (not is_system and organization_id is not null and (is_org_admin(organization_id) or current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role])))
    or (is_system and organization_id is null and current_user_is_platform_owner())
  )
  with check (
    (not is_system and organization_id is not null and (is_org_admin(organization_id) or current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role])))
    or (is_system and organization_id is null and current_user_is_platform_owner())
  );
create policy prevention_bundle_templates_delete on public.prevention_bundle_templates for delete to authenticated
  using (
    (not is_system and organization_id is not null and (is_org_admin(organization_id) or current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role])))
    or (is_system and organization_id is null and current_user_is_platform_owner())
  );
