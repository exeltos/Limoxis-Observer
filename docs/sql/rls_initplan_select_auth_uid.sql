-- Για τον ιδιοκτήτη (SQL Editor): 12 κανόνες πρόσβασης γράφουν auth.uid() χωρίς (select …), οπότε η βάση
-- τον ξαναϋπολογίζει σε κάθε γραμμή (Supabase advisor «auth_rls_initplan»). Ίδιος κανόνας, μόνο γρηγορότερος:
-- auth.uid() → (select auth.uid()). Καμία άλλη αλλαγή στη λογική.
begin;

alter policy antimicrobial_therapy_reviews_insert on public.antimicrobial_therapy_reviews
  with check (((reviewed_by = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM antimicrobial_therapies t
  WHERE ((t.id = antimicrobial_therapy_reviews.therapy_id) AND (t.organization_id = antimicrobial_therapy_reviews.organization_id)))) AND (( SELECT current_user_is_platform_owner() AS current_user_is_platform_owner) OR COALESCE((organization_id = ANY (( SELECT private.fast_orgs_role(ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'doctor_reviewer'::app_role, 'pharmacy'::app_role]) AS fast_orgs_role)::uuid[])), false))));

alter policy clinical_protocol_events_insert on public.clinical_protocol_events
  with check (((actor_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM clinical_protocol_runs r
  WHERE ((r.id = clinical_protocol_events.run_id) AND (r.organization_id = clinical_protocol_events.organization_id) AND (( SELECT current_user_is_platform_owner() AS current_user_is_platform_owner) OR COALESCE((r.organization_id = ANY (( SELECT private.fast_orgs_role(ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]) AS fast_orgs_role)::uuid[])), false) OR (COALESCE((r.organization_id = ANY (( SELECT private.fast_orgs_role(ARRAY['department_manager'::app_role, 'link_nurse'::app_role]) AS fast_orgs_role)::uuid[])), false) AND (r.department_id IS NOT NULL) AND COALESCE(((((r.organization_id)::text || ':'::text) || (r.department_id)::text) = ANY (( SELECT private.current_user_department_scopes() AS current_user_department_scopes)::text[])), false))))))));

alter policy clinical_protocol_runs_insert on public.clinical_protocol_runs
  with check (((started_by = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM surveillance_cases c
  WHERE ((c.id = clinical_protocol_runs.surveillance_case_id) AND (c.organization_id = clinical_protocol_runs.organization_id)))) AND (( SELECT current_user_is_platform_owner() AS current_user_is_platform_owner) OR COALESCE((organization_id = ANY (( SELECT private.fast_orgs_role(ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]) AS fast_orgs_role)::uuid[])), false) OR (COALESCE((organization_id = ANY (( SELECT private.fast_orgs_role(ARRAY['department_manager'::app_role, 'link_nurse'::app_role]) AS fast_orgs_role)::uuid[])), false) AND (department_id IS NOT NULL) AND COALESCE(((((organization_id)::text || ':'::text) || (department_id)::text) = ANY (( SELECT private.current_user_department_scopes() AS current_user_department_scopes)::text[])), false)))));

alter policy clinical_protocol_steps_insert on public.clinical_protocol_steps
  with check (((recorded_by = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM clinical_protocol_runs r
  WHERE ((r.id = clinical_protocol_steps.run_id) AND (r.organization_id = clinical_protocol_steps.organization_id) AND (( SELECT current_user_is_platform_owner() AS current_user_is_platform_owner) OR COALESCE((r.organization_id = ANY (( SELECT private.fast_orgs_role(ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]) AS fast_orgs_role)::uuid[])), false) OR (COALESCE((r.organization_id = ANY (( SELECT private.fast_orgs_role(ARRAY['department_manager'::app_role, 'link_nurse'::app_role]) AS fast_orgs_role)::uuid[])), false) AND (r.department_id IS NOT NULL) AND COALESCE(((((r.organization_id)::text || ':'::text) || (r.department_id)::text) = ANY (( SELECT private.current_user_department_scopes() AS current_user_department_scopes)::text[])), false))))))));

alter policy platform_announcement_views_own_insert on public.platform_announcement_views
  with check (((user_id = (select auth.uid())) AND current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role])));

alter policy platform_announcement_views_own_read on public.platform_announcement_views
  using (((user_id = (select auth.uid())) OR current_user_is_platform_owner()));

alter policy platform_announcement_views_own_update on public.platform_announcement_views
  using ((user_id = (select auth.uid())))
  with check (((user_id = (select auth.uid())) AND current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role])));

alter policy platform_announcements_admin_read on public.platform_announcements
  using (((status = 'active'::text) AND (starts_at <= now()) AND ((ends_at IS NULL) OR (ends_at > now())) AND (EXISTS ( SELECT 1
   FROM (organization_members om
     JOIN organizations o ON ((o.id = om.organization_id)))
  WHERE ((om.user_id = (select auth.uid())) AND (om.status = 'active'::member_status) AND (om.role = 'hospital_admin'::app_role) AND ((platform_announcements.audience_all_hospitals AND (NOT o.is_demo)) OR (om.organization_id = ANY (platform_announcements.audience_org_ids))))))));

alter policy platform_announcements_demo_target_read on public.platform_announcements
  using (((status = 'active'::text) AND (starts_at <= now()) AND ((ends_at IS NULL) OR (ends_at > now())) AND (EXISTS ( SELECT 1
   FROM (organization_members om
     JOIN organizations o ON ((o.id = om.organization_id)))
  WHERE ((om.user_id = (select auth.uid())) AND (om.status = 'active'::member_status) AND o.is_demo AND (om.organization_id = ANY (platform_announcements.audience_org_ids)))))));

alter policy roster_requests_own_cancel on public.roster_requests
  using (((status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.user_id = (select auth.uid())) AND (e.id = roster_requests.employee_id))))))
  with check (((status = 'cancelled'::text) AND (decided_by IS NULL) AND (EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.user_id = (select auth.uid())) AND (e.id = roster_requests.employee_id))))));

alter policy roster_requests_own_insert on public.roster_requests
  with check (((status = 'pending'::text) AND (decided_by IS NULL) AND (EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.user_id = (select auth.uid())) AND (e.id = roster_requests.employee_id) AND (e.organization_id = roster_requests.organization_id)))) AND current_user_has_department_scope(organization_id, department_id)));

alter policy roster_requests_own_read on public.roster_requests
  using ((EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.user_id = (select auth.uid())) AND (e.organization_id = roster_requests.organization_id) AND ((e.id = roster_requests.employee_id) OR (e.id = roster_requests.swap_employee_id))))));

commit;
