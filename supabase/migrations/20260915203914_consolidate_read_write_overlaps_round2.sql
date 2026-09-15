-- Second batch of multiple_permissive_policies consolidation. All 11
-- tables verified safe to split the ALL "write/manage" policy down to
-- INSERT/UPDATE/DELETE only (dropping its redundant SELECT reach),
-- because the existing SELECT "read" policy is a proven superset:
--
-- antiseptic_consumption_periods, hand_hygiene_sessions,
-- hand_hygiene_observations, prevention_bundle_assessments,
-- waste_measurements: current_user_can_read_X() and
-- current_user_can_write_X() both gate on the SAME capability key via
-- current_user_has_capability(org, 'record_X') - read only adds an
-- extra `is_org_admin()` OR-branch on top. Same key both sides means no
-- custom-role configuration can grant write without also satisfying
-- read's identical check.
--
-- departments: manage checks current_user_has_capability(org,
-- 'manage_libraries'); current_user_has_capability's own body requires
-- an active organization_members row (or platform owner) on every
-- non-platform-owner branch, for ANY capability key - so a successful
-- capability check always implies is_org_member(org), which is exactly
-- what departments' read policy checks. Holds regardless of custom role
-- configuration.
--
-- quality_audits/quality_capa_actions/quality_findings/
-- quality_record_links/work_assignments: both sides use
-- current_user_has_org_role() with hardcoded role arrays (not
-- capability keys), and in every case manage's role array is a literal
-- subset of read's (plus read has extra OR-clauses: owner_id=self,
-- department-scoped manager, or assignment membership). No custom-role
-- ambiguity since these don't route through capabilities at all.
--
-- NOT touched here: control_assignments, control_definitions,
-- training_records - their read/write route through *different*
-- capability keys (view_controls vs manage_controls,
-- role-array-read vs manage_training), so a custom role could in
-- principle be granted one capability without the other. Left alone,
-- same reasoning as the committee_* domain in the previous pass.

drop policy if exists antiseptic_write on public.antiseptic_consumption_periods;
create policy antiseptic_insert on public.antiseptic_consumption_periods for insert to authenticated, anon
  with check (current_user_can_write_antiseptic(organization_id, department_id));
create policy antiseptic_update on public.antiseptic_consumption_periods for update to authenticated, anon
  using (current_user_can_write_antiseptic(organization_id, department_id))
  with check (current_user_can_write_antiseptic(organization_id, department_id));
create policy antiseptic_delete on public.antiseptic_consumption_periods for delete to authenticated, anon
  using (current_user_can_write_antiseptic(organization_id, department_id));

drop policy if exists hand_hygiene_write on public.hand_hygiene_sessions;
create policy hand_hygiene_insert on public.hand_hygiene_sessions for insert to authenticated, anon
  with check (current_user_can_write_hand_hygiene(organization_id, department_id));
create policy hand_hygiene_update on public.hand_hygiene_sessions for update to authenticated, anon
  using (current_user_can_write_hand_hygiene(organization_id, department_id))
  with check (current_user_can_write_hand_hygiene(organization_id, department_id));
create policy hand_hygiene_delete on public.hand_hygiene_sessions for delete to authenticated, anon
  using (current_user_can_write_hand_hygiene(organization_id, department_id));

drop policy if exists hand_hygiene_observations_write on public.hand_hygiene_observations;
create policy hand_hygiene_observations_insert on public.hand_hygiene_observations for insert to authenticated, anon
  with check (exists (select 1 from hand_hygiene_sessions s where s.id = hand_hygiene_observations.session_id and current_user_can_write_hand_hygiene(s.organization_id, s.department_id)));
create policy hand_hygiene_observations_update on public.hand_hygiene_observations for update to authenticated, anon
  using (exists (select 1 from hand_hygiene_sessions s where s.id = hand_hygiene_observations.session_id and current_user_can_write_hand_hygiene(s.organization_id, s.department_id)))
  with check (exists (select 1 from hand_hygiene_sessions s where s.id = hand_hygiene_observations.session_id and current_user_can_write_hand_hygiene(s.organization_id, s.department_id)));
create policy hand_hygiene_observations_delete on public.hand_hygiene_observations for delete to authenticated, anon
  using (exists (select 1 from hand_hygiene_sessions s where s.id = hand_hygiene_observations.session_id and current_user_can_write_hand_hygiene(s.organization_id, s.department_id)));

drop policy if exists bundles_write on public.prevention_bundle_assessments;
create policy bundles_insert on public.prevention_bundle_assessments for insert to authenticated, anon
  with check (current_user_can_write_prevention_bundle(organization_id, department_id));
create policy bundles_update on public.prevention_bundle_assessments for update to authenticated, anon
  using (current_user_can_write_prevention_bundle(organization_id, department_id))
  with check (current_user_can_write_prevention_bundle(organization_id, department_id));
create policy bundles_delete on public.prevention_bundle_assessments for delete to authenticated, anon
  using (current_user_can_write_prevention_bundle(organization_id, department_id));

drop policy if exists waste_write on public.waste_measurements;
create policy waste_insert on public.waste_measurements for insert to authenticated, anon
  with check (current_user_can_write_waste(organization_id, department_id));
create policy waste_update on public.waste_measurements for update to authenticated, anon
  using (current_user_can_write_waste(organization_id, department_id))
  with check (current_user_can_write_waste(organization_id, department_id));
create policy waste_delete on public.waste_measurements for delete to authenticated, anon
  using (current_user_can_write_waste(organization_id, department_id));

drop policy if exists departments_manage_library_capability on public.departments;
create policy departments_insert_library_capability on public.departments for insert to authenticated, anon
  with check (current_user_has_capability(organization_id, 'manage_libraries'));
create policy departments_update_library_capability on public.departments for update to authenticated, anon
  using (current_user_has_capability(organization_id, 'manage_libraries'))
  with check (current_user_has_capability(organization_id, 'manage_libraries'));
create policy departments_delete_library_capability on public.departments for delete to authenticated, anon
  using (current_user_has_capability(organization_id, 'manage_libraries'));

drop policy if exists quality_audit_manage on public.quality_audits;
create policy quality_audit_insert on public.quality_audits for insert to authenticated, anon
  with check (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'quality_manager'::app_role]));
create policy quality_audit_update on public.quality_audits for update to authenticated, anon
  using (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'quality_manager'::app_role]))
  with check (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'quality_manager'::app_role]));
create policy quality_audit_delete on public.quality_audits for delete to authenticated, anon
  using (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'quality_manager'::app_role]));

drop policy if exists quality_capa_manage on public.quality_capa_actions;
create policy quality_capa_insert on public.quality_capa_actions for insert to authenticated, anon
  with check (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'quality_manager'::app_role]));
create policy quality_capa_update on public.quality_capa_actions for update to authenticated, anon
  using (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'quality_manager'::app_role]))
  with check (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'quality_manager'::app_role]));
create policy quality_capa_delete on public.quality_capa_actions for delete to authenticated, anon
  using (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'quality_manager'::app_role]));

drop policy if exists quality_finding_manage on public.quality_findings;
create policy quality_finding_insert on public.quality_findings for insert to authenticated, anon
  with check (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'quality_manager'::app_role]));
create policy quality_finding_update on public.quality_findings for update to authenticated, anon
  using (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'quality_manager'::app_role]))
  with check (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'quality_manager'::app_role]));
create policy quality_finding_delete on public.quality_findings for delete to authenticated, anon
  using (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'quality_manager'::app_role]));

drop policy if exists quality_links_manage on public.quality_record_links;
create policy quality_links_insert on public.quality_record_links for insert to authenticated, anon
  with check (current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'quality_manager'::app_role]));
create policy quality_links_update on public.quality_record_links for update to authenticated, anon
  using (current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'quality_manager'::app_role]))
  with check (current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'quality_manager'::app_role]));
create policy quality_links_delete on public.quality_record_links for delete to authenticated, anon
  using (current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'quality_manager'::app_role]));

drop policy if exists assignments_manage_authorized on public.work_assignments;
create policy assignments_insert_authorized on public.work_assignments for insert to authenticated, anon
  with check (is_org_admin(organization_id) OR (exists (select 1 from organization_members om where om.user_id = (select auth.uid()) and om.organization_id = work_assignments.organization_id and om.status = 'active' and om.role = ANY (ARRAY['infection_control_lead'::app_role, 'quality_manager'::app_role]))));
create policy assignments_update_authorized on public.work_assignments for update to authenticated, anon
  using (is_org_admin(organization_id) OR (exists (select 1 from organization_members om where om.user_id = (select auth.uid()) and om.organization_id = work_assignments.organization_id and om.status = 'active' and om.role = ANY (ARRAY['infection_control_lead'::app_role, 'quality_manager'::app_role]))))
  with check (is_org_admin(organization_id) OR (exists (select 1 from organization_members om where om.user_id = (select auth.uid()) and om.organization_id = work_assignments.organization_id and om.status = 'active' and om.role = ANY (ARRAY['infection_control_lead'::app_role, 'quality_manager'::app_role]))));
create policy assignments_delete_authorized on public.work_assignments for delete to authenticated, anon
  using (is_org_admin(organization_id) OR (exists (select 1 from organization_members om where om.user_id = (select auth.uid()) and om.organization_id = work_assignments.organization_id and om.status = 'active' and om.role = ANY (ARRAY['infection_control_lead'::app_role, 'quality_manager'::app_role]))));
