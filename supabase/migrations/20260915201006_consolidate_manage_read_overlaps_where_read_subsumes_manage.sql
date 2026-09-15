-- Consolidates 5 of the 11 "manage(ALL) overlaps read(SELECT)" findings -
-- specifically the ones where read's condition is a verified strict
-- superset of manage's, so splitting manage down to INSERT/UPDATE/DELETE
-- only (removing its redundant SELECT reach) causes zero capability loss.
-- The other 6 (committee_decisions/documents/meeting_attendance/members/
-- plan_items, management_announcements) were deliberately left alone:
-- current_user_can_manage_committee(...) does not provably imply
-- current_user_can_view_committee(...) for every capability it checks
-- (e.g. 'manage_committee_decisions' capability doesn't itself grant
-- 'edit_committee_minutes' or committee membership), and
-- management_announcements' read additionally requires an audience
-- match that an org admin managing announcements might not satisfy -
-- merging those without individually proving subsumption risks a real
-- access regression on a governance-sensitive domain for a
-- performance-only advisory finding.

-- system_audit_log: two independent SELECT-only policies (not an
-- ALL-vs-SELECT case) - straightforward OR merge, no splitting needed.
drop policy if exists audit_admin_read on public.system_audit_log;
drop policy if exists audit_platform_owner_read on public.system_audit_log;
create policy audit_read on public.system_audit_log
  for select
  to authenticated
  using (
    (organization_id is not null and has_org_role(organization_id, ARRAY['hospital_admin'::app_role]))
    or current_user_is_platform_owner()
  );

-- custom_roles: is_org_admin(org) => is_org_member(org) always (admin is
-- an active member with role='hospital_admin'), so read's
-- is_org_member-based condition already covers everything manage's
-- is_org_admin-based condition does.
drop policy if exists custom_roles_admin on public.custom_roles;
create policy custom_roles_insert on public.custom_roles for insert to authenticated
  with check (is_org_admin(organization_id) OR current_user_is_platform_owner());
create policy custom_roles_update on public.custom_roles for update to authenticated
  using (is_org_admin(organization_id) OR current_user_is_platform_owner())
  with check (is_org_admin(organization_id) OR current_user_is_platform_owner());
create policy custom_roles_delete on public.custom_roles for delete to authenticated
  using (is_org_admin(organization_id) OR current_user_is_platform_owner());

-- custom_role_capabilities: same is_org_admin/is_org_member subsumption,
-- via the parent custom_roles row.
drop policy if exists custom_role_caps_admin on public.custom_role_capabilities;
create policy custom_role_caps_insert on public.custom_role_capabilities for insert to authenticated
  with check (exists (select 1 from custom_roles r where r.id = custom_role_capabilities.custom_role_id and (is_org_admin(r.organization_id) or current_user_is_platform_owner())));
create policy custom_role_caps_update on public.custom_role_capabilities for update to authenticated
  using (exists (select 1 from custom_roles r where r.id = custom_role_capabilities.custom_role_id and (is_org_admin(r.organization_id) or current_user_is_platform_owner())))
  with check (exists (select 1 from custom_roles r where r.id = custom_role_capabilities.custom_role_id and (is_org_admin(r.organization_id) or current_user_is_platform_owner())));
create policy custom_role_caps_delete on public.custom_role_capabilities for delete to authenticated
  using (exists (select 1 from custom_roles r where r.id = custom_role_capabilities.custom_role_id and (is_org_admin(r.organization_id) or current_user_is_platform_owner())));

-- patient_day_periods: read's OR-list (platform_owner, view_indicators
-- capability, manage_bed_days capability, hospital_admin/
-- infection_control_lead/infection_control_member/quality_manager roles)
-- is a strict superset of manage's (platform_owner, manage_bed_days
-- capability, hospital_admin/infection_control_lead roles).
drop policy if exists patient_day_periods_manage on public.patient_day_periods;
create policy patient_day_periods_insert on public.patient_day_periods for insert to authenticated
  with check (current_user_is_platform_owner() OR current_user_has_capability(organization_id, 'manage_bed_days') OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role]));
create policy patient_day_periods_update on public.patient_day_periods for update to authenticated
  using (current_user_is_platform_owner() OR current_user_has_capability(organization_id, 'manage_bed_days') OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role]))
  with check (current_user_is_platform_owner() OR current_user_has_capability(organization_id, 'manage_bed_days') OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role]));
create policy patient_day_periods_delete on public.patient_day_periods for delete to authenticated
  using (current_user_is_platform_owner() OR current_user_has_capability(organization_id, 'manage_bed_days') OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role]));

-- patient_days: identical pattern to patient_day_periods.
drop policy if exists patient_days_manage on public.patient_days;
create policy patient_days_insert on public.patient_days for insert to authenticated
  with check (current_user_is_platform_owner() OR current_user_has_capability(organization_id, 'manage_bed_days') OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role]));
create policy patient_days_update on public.patient_days for update to authenticated
  using (current_user_is_platform_owner() OR current_user_has_capability(organization_id, 'manage_bed_days') OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role]))
  with check (current_user_is_platform_owner() OR current_user_has_capability(organization_id, 'manage_bed_days') OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role]));
create policy patient_days_delete on public.patient_days for delete to authenticated
  using (current_user_is_platform_owner() OR current_user_has_capability(organization_id, 'manage_bed_days') OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role]));
