-- Performance: wrap auth.uid() in (select auth.uid()) so Postgres evaluates
-- it once per query (via InitPlan) instead of once per row. Pure perf fix,
-- no change to authorization semantics - see
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

alter policy control_executions_edit on public.control_executions
  using ((status = 'completed'::text) AND current_user_has_governance_capability(organization_id, 'edit_control_execution'::text) AND current_user_can_access_control_department(organization_id, department_id) AND ((performed_by = (select auth.uid())) OR current_user_has_capability(organization_id, 'manage_controls'::text)))
  with check ((status = 'completed'::text) AND current_user_has_governance_capability(organization_id, 'edit_control_execution'::text) AND current_user_can_access_control_department(organization_id, department_id));

alter policy attachments_committee_insert_allow on public.attachments
  with check ((entity_type = 'committee_document'::text) AND (uploaded_by = (select auth.uid())) AND (entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::text) AND current_user_can_manage_committee(organization_id, (entity_id)::uuid, 'manage_committee_documents'::text));

alter policy management_announcements_read_targeted on public.management_announcements
  using (is_org_member(organization_id) AND ((audience_type = 'all'::text) OR ((audience_type = 'user'::text) AND (audience_values ? ((select auth.uid()))::text)) OR ((audience_type = 'role'::text) AND (EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.organization_id = management_announcements.organization_id) AND (om.user_id = (select auth.uid())) AND (om.status = 'active'::member_status) AND (management_announcements.audience_values ? (om.role)::text))))) OR ((audience_type = 'department'::text) AND (EXISTS ( SELECT 1
   FROM (organization_members om
     JOIN organization_member_scopes oms ON ((oms.membership_id = om.id)))
  WHERE ((om.organization_id = management_announcements.organization_id) AND (om.user_id = (select auth.uid())) AND (om.status = 'active'::member_status) AND (management_announcements.audience_values ? (oms.department_id)::text)))))));

alter policy management_announcement_ack_read on public.management_announcement_acknowledgements
  using ((user_id = (select auth.uid())) AND is_org_member(organization_id));

alter policy management_announcement_ack_insert on public.management_announcement_acknowledgements
  with check ((user_id = (select auth.uid())) AND is_org_member(organization_id) AND (EXISTS ( SELECT 1
   FROM management_announcements a
  WHERE ((a.id = management_announcement_acknowledgements.announcement_id) AND (a.organization_id = management_announcement_acknowledgements.organization_id) AND a.requires_ack))));

alter policy management_announcement_ack_delete on public.management_announcement_acknowledgements
  using ((user_id = (select auth.uid())) AND is_org_member(organization_id));

alter policy quality_incident_org_read on public.quality_incidents
  using (current_user_is_platform_owner() OR (reported_by = (select auth.uid())) OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'quality_manager'::app_role, 'infection_control_lead'::app_role]) OR ((department_id IS NOT NULL) AND current_user_has_org_role(organization_id, ARRAY['department_manager'::app_role]) AND current_user_has_department_scope(organization_id, department_id)));

alter policy quality_finding_authorized_read on public.quality_findings
  using (current_user_is_platform_owner() OR (owner_id = (select auth.uid())) OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'quality_manager'::app_role, 'infection_control_lead'::app_role]) OR ((department_id IS NOT NULL) AND current_user_has_org_role(organization_id, ARRAY['department_manager'::app_role]) AND current_user_has_department_scope(organization_id, department_id)));

alter policy quality_capa_authorized_read on public.quality_capa_actions
  using (current_user_is_platform_owner() OR (owner_id = (select auth.uid())) OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'quality_manager'::app_role, 'infection_control_lead'::app_role]) OR ((department_id IS NOT NULL) AND current_user_has_org_role(organization_id, ARRAY['department_manager'::app_role]) AND current_user_has_department_scope(organization_id, department_id)));
