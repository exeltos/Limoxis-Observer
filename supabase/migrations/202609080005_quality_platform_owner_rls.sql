drop policy if exists quality_incident_org_read on public.quality_incidents;
create policy quality_incident_org_read on public.quality_incidents
for select using (
  current_user_is_platform_owner()
  or reported_by = auth.uid()
  or current_user_has_org_role(organization_id, array['hospital_admin'::app_role,'quality_manager'::app_role,'infection_control_lead'::app_role])
  or (department_id is not null and current_user_has_org_role(organization_id, array['department_manager'::app_role]) and current_user_has_department_scope(organization_id, department_id))
);

drop policy if exists quality_incident_report on public.quality_incidents;
create policy quality_incident_report on public.quality_incidents
for insert with check (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, array['hospital_admin'::app_role,'quality_manager'::app_role,'infection_control_lead'::app_role,'infection_control_member'::app_role,'department_manager'::app_role,'department_user'::app_role,'laboratory'::app_role,'pharmacy'::app_role,'hr_office'::app_role,'occupational_physician'::app_role,'doctor_reviewer'::app_role])
);

drop policy if exists quality_incident_manage on public.quality_incidents;
create policy quality_incident_manage on public.quality_incidents
for update using (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, array['hospital_admin'::app_role,'quality_manager'::app_role])
) with check (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, array['hospital_admin'::app_role,'quality_manager'::app_role])
);

drop policy if exists quality_finding_authorized_read on public.quality_findings;
create policy quality_finding_authorized_read on public.quality_findings
for select using (
  current_user_is_platform_owner()
  or owner_id = auth.uid()
  or current_user_has_org_role(organization_id, array['hospital_admin'::app_role,'quality_manager'::app_role,'infection_control_lead'::app_role])
  or (department_id is not null and current_user_has_org_role(organization_id, array['department_manager'::app_role]) and current_user_has_department_scope(organization_id, department_id))
);

drop policy if exists quality_finding_manage on public.quality_findings;
create policy quality_finding_manage on public.quality_findings
for all using (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, array['hospital_admin'::app_role,'quality_manager'::app_role])
) with check (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, array['hospital_admin'::app_role,'quality_manager'::app_role])
);

drop policy if exists quality_capa_authorized_read on public.quality_capa_actions;
create policy quality_capa_authorized_read on public.quality_capa_actions
for select using (
  current_user_is_platform_owner()
  or owner_id = auth.uid()
  or current_user_has_org_role(organization_id, array['hospital_admin'::app_role,'quality_manager'::app_role,'infection_control_lead'::app_role])
  or (department_id is not null and current_user_has_org_role(organization_id, array['department_manager'::app_role]) and current_user_has_department_scope(organization_id, department_id))
);

drop policy if exists quality_capa_manage on public.quality_capa_actions;
create policy quality_capa_manage on public.quality_capa_actions
for all using (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, array['hospital_admin'::app_role,'quality_manager'::app_role])
) with check (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, array['hospital_admin'::app_role,'quality_manager'::app_role])
);

drop policy if exists quality_audit_authorized_read on public.quality_audits;
create policy quality_audit_authorized_read on public.quality_audits
for select using (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, array['hospital_admin'::app_role,'quality_manager'::app_role,'infection_control_lead'::app_role])
  or (department_id is not null and current_user_has_org_role(organization_id, array['department_manager'::app_role]) and current_user_has_department_scope(organization_id, department_id))
);

drop policy if exists quality_audit_manage on public.quality_audits;
create policy quality_audit_manage on public.quality_audits
for all using (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, array['hospital_admin'::app_role,'quality_manager'::app_role])
) with check (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, array['hospital_admin'::app_role,'quality_manager'::app_role])
);
