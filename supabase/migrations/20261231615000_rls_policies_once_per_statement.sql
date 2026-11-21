-- Ταχύτητα: 28 κανόνες πρόσβασης (RLS) καλούσαν is_org_member / is_org_admin / current_user_has_capability /
-- current_user_has_org_role(organization_id, …) για ΚΑΘΕ γραμμή (~0,2–0,5 ms η κλήση· π.χ. τα 414 προγράμματα
-- εκπαίδευσης του ΙΑΣΩ ≈ 0,5–1 s). Γράφονται με τις ήδη υπάρχουσες private.fast_orgs_member / fast_orgs_admin /
-- fast_orgs_capability / fast_orgs_role, που υπολογίζουν μία φορά ανά ερώτημα (initplan) τον πίνακα των νοσοκομείων
-- όπου ο χρήστης έχει το δικαίωμα, καλώντας τις ίδιες συναρτήσεις για κάθε νοσοκομείο-υποψήφιο (ενεργή συμμετοχή ή
-- ιδιοκτήτης πλατφόρμας). Η πρόσβαση ΔΕΝ αλλάζει: ελέγχθηκε (21/11/2026) γραμμή-γραμμή, παλιός και νέος κανόνας,
-- για τον ιδιοκτήτη πλατφόρμας, τους δύο διαχειριστές, τον Διευθυντή Τομέα και χρήστη χωρίς νοσοκομείο — 0 διαφορές.
-- Το current_user_has_department_scope(organization_id, department_id) μένει ως έχει (εξαρτάται από το τμήμα).
-- Περιέχει ALTER POLICY: το τρέχει ο ιδιοκτήτης στο SQL Editor.

begin;

alter policy department_rosters_read on public.department_rosters
  using (((organization_id = ANY ((SELECT private.fast_orgs_admin())::uuid[])) OR ((organization_id = ANY ((SELECT private.fast_orgs_role(ARRAY['department_manager'::app_role]))::uuid[])) AND public.current_user_has_department_scope(organization_id, department_id)) OR ((status = 'published'::text) AND public.current_user_has_department_scope(organization_id, department_id))));

alter policy department_rosters_write on public.department_rosters
  using (((organization_id = ANY ((SELECT private.fast_orgs_admin())::uuid[])) OR ((organization_id = ANY ((SELECT private.fast_orgs_role(ARRAY['department_manager'::app_role]))::uuid[])) AND public.current_user_has_department_scope(organization_id, department_id))))
  with check (((organization_id = ANY ((SELECT private.fast_orgs_admin())::uuid[])) OR ((organization_id = ANY ((SELECT private.fast_orgs_role(ARRAY['department_manager'::app_role]))::uuid[])) AND public.current_user_has_department_scope(organization_id, department_id))));

alter policy epi_questionnaire_question_settings_read on public.epi_questionnaire_question_settings
  using ((( SELECT current_user_is_platform_owner() AS current_user_is_platform_owner) OR (organization_id = ANY ((SELECT private.fast_orgs_member())::uuid[]))));

alter policy hr_application_links_read on public.hr_application_links
  using (((organization_id = ANY ((SELECT private.fast_orgs_capability('view_interviews'::text))::uuid[])) OR (organization_id = ANY ((SELECT private.fast_orgs_capability('manage_interviews'::text))::uuid[]))));

alter policy hr_candidate_employers_read on public.hr_candidate_employers
  using (((organization_id = ANY ((SELECT private.fast_orgs_capability('view_interviews'::text))::uuid[])) OR (organization_id = ANY ((SELECT private.fast_orgs_capability('manage_interviews'::text))::uuid[]))));

alter policy hr_candidate_languages_read on public.hr_candidate_languages
  using (((organization_id = ANY ((SELECT private.fast_orgs_capability('view_interviews'::text))::uuid[])) OR (organization_id = ANY ((SELECT private.fast_orgs_capability('manage_interviews'::text))::uuid[]))));

alter policy hr_candidate_signatures_read on public.hr_candidate_signatures
  using (((organization_id = ANY ((SELECT private.fast_orgs_capability('view_interviews'::text))::uuid[])) OR (organization_id = ANY ((SELECT private.fast_orgs_capability('manage_interviews'::text))::uuid[]))));

alter policy hr_candidates_read on public.hr_candidates
  using (((organization_id = ANY ((SELECT private.fast_orgs_capability('view_interviews'::text))::uuid[])) OR (organization_id = ANY ((SELECT private.fast_orgs_capability('manage_interviews'::text))::uuid[]))));

alter policy hr_division_categories_read on public.hr_division_categories
  using (((organization_id = ANY ((SELECT private.fast_orgs_capability('view_interviews'::text))::uuid[])) OR (organization_id = ANY ((SELECT private.fast_orgs_capability('manage_interviews'::text))::uuid[]))));

alter policy hr_division_categories_write on public.hr_division_categories
  using ((organization_id = ANY ((SELECT private.fast_orgs_capability('manage_interviews'::text))::uuid[])))
  with check ((organization_id = ANY ((SELECT private.fast_orgs_capability('manage_interviews'::text))::uuid[])));

alter policy hr_division_departments_read on public.hr_division_departments
  using (((organization_id = ANY ((SELECT private.fast_orgs_capability('view_interviews'::text))::uuid[])) OR (organization_id = ANY ((SELECT private.fast_orgs_capability('manage_interviews'::text))::uuid[]))));

alter policy hr_division_departments_write on public.hr_division_departments
  using ((organization_id = ANY ((SELECT private.fast_orgs_capability('manage_interviews'::text))::uuid[])))
  with check ((organization_id = ANY ((SELECT private.fast_orgs_capability('manage_interviews'::text))::uuid[])));

alter policy hr_division_members_read on public.hr_division_members
  using (((organization_id = ANY ((SELECT private.fast_orgs_capability('view_interviews'::text))::uuid[])) OR (organization_id = ANY ((SELECT private.fast_orgs_capability('manage_interviews'::text))::uuid[]))));

alter policy hr_division_members_write on public.hr_division_members
  using ((organization_id = ANY ((SELECT private.fast_orgs_capability('manage_interviews'::text))::uuid[])))
  with check ((organization_id = ANY ((SELECT private.fast_orgs_capability('manage_interviews'::text))::uuid[])));

alter policy hr_divisions_read on public.hr_divisions
  using (((organization_id = ANY ((SELECT private.fast_orgs_capability('view_interviews'::text))::uuid[])) OR (organization_id = ANY ((SELECT private.fast_orgs_capability('manage_interviews'::text))::uuid[]))));

alter policy hr_divisions_write on public.hr_divisions
  using ((organization_id = ANY ((SELECT private.fast_orgs_capability('manage_interviews'::text))::uuid[])))
  with check ((organization_id = ANY ((SELECT private.fast_orgs_capability('manage_interviews'::text))::uuid[])));

alter policy hr_interview_settings_read on public.hr_interview_settings
  using (((organization_id = ANY ((SELECT private.fast_orgs_capability('view_interviews'::text))::uuid[])) OR (organization_id = ANY ((SELECT private.fast_orgs_capability('manage_interviews'::text))::uuid[]))));

alter policy hr_interview_settings_write on public.hr_interview_settings
  using ((organization_id = ANY ((SELECT private.fast_orgs_capability('manage_interviews'::text))::uuid[])))
  with check ((organization_id = ANY ((SELECT private.fast_orgs_capability('manage_interviews'::text))::uuid[])));

alter policy hr_interviews_read on public.hr_interviews
  using (((organization_id = ANY ((SELECT private.fast_orgs_capability('view_interviews'::text))::uuid[])) OR (organization_id = ANY ((SELECT private.fast_orgs_capability('manage_interviews'::text))::uuid[]))));

alter policy legacy_person_matches_select on public.legacy_person_matches
  using ((public.current_user_is_platform_owner() OR (organization_id = ANY ((SELECT private.fast_orgs_role(ARRAY['hospital_admin'::app_role, 'quality_manager'::app_role]))::uuid[])) OR (organization_id = ANY ((SELECT private.fast_orgs_capability('manage_quality'::text))::uuid[]))));

alter policy organization_indicator_settings_read on public.organization_indicator_settings
  using (((organization_id = ANY ((SELECT private.fast_orgs_member())::uuid[])) OR public.current_user_is_platform_owner()));

alter policy roster_requests_manager_all on public.roster_requests
  using (((organization_id = ANY ((SELECT private.fast_orgs_admin())::uuid[])) OR ((organization_id = ANY ((SELECT private.fast_orgs_role(ARRAY['department_manager'::app_role]))::uuid[])) AND public.current_user_has_department_scope(organization_id, department_id))))
  with check (((organization_id = ANY ((SELECT private.fast_orgs_admin())::uuid[])) OR ((organization_id = ANY ((SELECT private.fast_orgs_role(ARRAY['department_manager'::app_role]))::uuid[])) AND public.current_user_has_department_scope(organization_id, department_id))));

alter policy training_certificates_read on public.training_certificates
  using (((organization_id = ANY ((SELECT private.fast_orgs_role(ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'hr_office'::app_role]))::uuid[])) OR ((department_id IS NOT NULL) AND (organization_id = ANY ((SELECT private.fast_orgs_role(ARRAY['department_manager'::app_role, 'department_user'::app_role]))::uuid[])) AND public.current_user_has_department_scope(organization_id, department_id)) OR (employee_user_id = ( SELECT auth.uid() AS uid)) OR (organization_id = ANY ((SELECT private.fast_orgs_capability('manage_training'::text))::uuid[])) OR (EXISTS ( SELECT 1
   FROM public.training_assignments a
  WHERE (a.id = training_certificates.assignment_id)))));

alter policy training_feedback_templates_read on public.training_feedback_templates
  using (((organization_id = ANY ((SELECT private.fast_orgs_role(ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'hr_office'::app_role]))::uuid[])) OR (organization_id = ANY ((SELECT private.fast_orgs_capability('manage_training'::text))::uuid[]))));

alter policy training_history_events_read on public.training_history_events
  using (((organization_id = ANY ((SELECT private.fast_orgs_role(ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'hr_office'::app_role]))::uuid[])) OR (organization_id = ANY ((SELECT private.fast_orgs_capability('manage_training'::text))::uuid[]))));

alter policy training_programs_read on public.training_programs
  using (((organization_id = ANY ((SELECT private.fast_orgs_member())::uuid[])) OR (organization_id = ANY ((SELECT private.fast_orgs_capability('manage_training'::text))::uuid[]))));

alter policy training_requirements_read on public.training_requirements
  using (((organization_id = ANY ((SELECT private.fast_orgs_member())::uuid[])) OR (organization_id = ANY ((SELECT private.fast_orgs_capability('manage_training'::text))::uuid[]))));

alter policy user_view_preferences_select_own on public.user_view_preferences
  using (((user_id = ( SELECT auth.uid() AS uid)) AND (organization_id = ANY ((SELECT private.fast_orgs_member())::uuid[]))));

commit;
