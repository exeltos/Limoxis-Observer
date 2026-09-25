-- Supabase performance advisors (2026-09-25). No access rule changes: every
-- predicate below is the existing one, only restructured.
--
-- 1. auth_rls_initplan: auth.uid() inside a policy is re-evaluated per row;
--    (select auth.uid()) is evaluated once per statement.
-- 2. multiple_permissive_policies: a FOR ALL write policy next to a SELECT
--    policy makes Postgres evaluate both on every read. Write policies are
--    split per command; duplicate SELECT/INSERT/UPDATE policies are merged
--    with OR (identical semantics for permissive policies).
-- 3. unindexed_foreign_keys: covering indexes for 35 foreign keys.

-- 1. initplan ---------------------------------------------------------------
alter policy employees_select_authorized on public.employees using (
  current_user_is_platform_owner() or (user_id = (select auth.uid()))
  or current_user_has_org_role(organization_id, array['hospital_admin','hr_office','occupational_physician','infection_control_lead']::app_role[])
  or current_user_has_capability(organization_id, 'manage_staff_admin')
  or current_user_has_capability(organization_id, 'manage_occupational_health')
  or ((department_id is not null) and current_user_has_org_role(organization_id, array['department_manager','link_nurse','laboratory']::app_role[]) and current_user_has_department_scope(organization_id, department_id))
);

alter policy occupational_health_visits_select_authorized on public.occupational_health_visits using (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, array['occupational_physician']::app_role[])
  or current_user_has_capability(organization_id, 'manage_occupational_health')
  or exists (select 1 from public.employees e where e.id = occupational_health_visits.employee_id and e.organization_id = occupational_health_visits.organization_id and e.user_id = (select auth.uid()))
);

alter policy employee_vaccinations_select_authorized on public.employee_vaccinations using (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, array['occupational_physician']::app_role[])
  or current_user_has_capability(organization_id, 'manage_occupational_health')
  or exists (select 1 from public.employees e where e.id = employee_vaccinations.employee_id and e.organization_id = employee_vaccinations.organization_id and e.user_id = (select auth.uid()))
);

alter policy employee_evaluations_select_authorized on public.employee_evaluations using (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, array['hospital_admin','hr_office','occupational_physician','infection_control_lead']::app_role[])
  or current_user_has_capability(organization_id, 'manage_staff_admin')
  or exists (select 1 from public.employees e where e.id = employee_evaluations.employee_id and e.organization_id = employee_evaluations.organization_id and e.user_id = (select auth.uid()))
  or exists (select 1 from public.employees e where e.id = employee_evaluations.employee_id and e.organization_id = employee_evaluations.organization_id and e.department_id is not null
             and current_user_has_org_role(employee_evaluations.organization_id, array['department_manager','link_nurse','laboratory']::app_role[])
             and current_user_has_department_scope(employee_evaluations.organization_id, e.department_id))
);

alter policy employee_evaluations_update_authorized on public.employee_evaluations
  using (
    current_user_is_platform_owner() or is_org_admin(organization_id)
    or current_user_has_org_role(organization_id, array['hr_office']::app_role[])
    or current_user_has_capability(organization_id, 'manage_staff_admin')
    or (status = 'submitted' and exists (select 1 from public.employees e where e.id = employee_evaluations.employee_id and e.organization_id = employee_evaluations.organization_id and e.user_id = (select auth.uid())))
  )
  with check (
    current_user_is_platform_owner() or is_org_admin(organization_id)
    or current_user_has_org_role(organization_id, array['hr_office']::app_role[])
    or current_user_has_capability(organization_id, 'manage_staff_admin')
    or (status = 'employee_acknowledged' and exists (select 1 from public.employees e where e.id = employee_evaluations.employee_id and e.organization_id = employee_evaluations.organization_id and e.user_id = (select auth.uid())))
  );

alter policy patient_scale_delete on public.patient_clinical_scale_assessments
  using ((created_by = (select auth.uid())) or current_user_is_platform_owner());

alter policy patient_scale_insert on public.patient_clinical_scale_assessments
  with check ((created_by = (select auth.uid())) and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','doctor_reviewer','department_manager','staff_user']::app_role[])));

alter policy patient_scale_update on public.patient_clinical_scale_assessments
  using ((created_by = (select auth.uid())) or current_user_is_platform_owner())
  with check ((created_by = (select auth.uid())) or current_user_is_platform_owner());

-- 2. multiple permissive policies -------------------------------------------
-- Platform-owner-only write policies declared FOR ALL.
drop policy clinical_sources_owner_write on public.clinical_content_sources;
create policy clinical_sources_owner_insert on public.clinical_content_sources for insert to authenticated with check (current_user_is_platform_owner());
create policy clinical_sources_owner_update on public.clinical_content_sources for update to authenticated using (current_user_is_platform_owner()) with check (current_user_is_platform_owner());
create policy clinical_sources_owner_delete on public.clinical_content_sources for delete to authenticated using (current_user_is_platform_owner());

drop policy clinical_scale_definitions_owner_write on public.clinical_scale_definitions;
create policy clinical_scale_definitions_owner_insert on public.clinical_scale_definitions for insert to authenticated with check (current_user_is_platform_owner());
create policy clinical_scale_definitions_owner_update on public.clinical_scale_definitions for update to authenticated using (current_user_is_platform_owner()) with check (current_user_is_platform_owner());
create policy clinical_scale_definitions_owner_delete on public.clinical_scale_definitions for delete to authenticated using (current_user_is_platform_owner());

drop policy platform_update_runs_owner_write on public.platform_update_runs;
create policy platform_update_runs_owner_insert on public.platform_update_runs for insert to authenticated with check (current_user_is_platform_owner());
create policy platform_update_runs_owner_update on public.platform_update_runs for update to authenticated using (current_user_is_platform_owner()) with check (current_user_is_platform_owner());
create policy platform_update_runs_owner_delete on public.platform_update_runs for delete to authenticated using (current_user_is_platform_owner());

-- Hospital-admin write, wider read (read already covers every writer).
drop policy clinical_scale_org_settings_write on public.clinical_scale_org_settings;
create policy clinical_scale_org_settings_insert on public.clinical_scale_org_settings for insert to authenticated
  with check (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin']::app_role[]));
create policy clinical_scale_org_settings_update on public.clinical_scale_org_settings for update to authenticated
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin']::app_role[]))
  with check (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin']::app_role[]));
create policy clinical_scale_org_settings_delete on public.clinical_scale_org_settings for delete to authenticated
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin']::app_role[]));

-- Occupational exposure: read and write predicates are identical.
drop policy occupational_exposure_incidents_write on public.occupational_exposure_incidents;
create policy occupational_exposure_incidents_insert on public.occupational_exposure_incidents for insert to authenticated
  with check (current_user_has_org_role(organization_id, array['occupational_physician']::app_role[]) or current_user_has_capability(organization_id, 'manage_occupational_health'));
create policy occupational_exposure_incidents_update on public.occupational_exposure_incidents for update to authenticated
  using (current_user_has_org_role(organization_id, array['occupational_physician']::app_role[]) or current_user_has_capability(organization_id, 'manage_occupational_health'))
  with check (current_user_has_org_role(organization_id, array['occupational_physician']::app_role[]) or current_user_has_capability(organization_id, 'manage_occupational_health'));
create policy occupational_exposure_incidents_delete on public.occupational_exposure_incidents for delete to authenticated
  using (current_user_has_org_role(organization_id, array['occupational_physician']::app_role[]) or current_user_has_capability(organization_id, 'manage_occupational_health'));

-- WHO DDD reference: platform-owner write and hospital-admin write merged.
drop policy who_ddd_reference_platform_write on public.who_ddd_reference;
drop policy who_ddd_reference_write on public.who_ddd_reference;
create policy who_ddd_reference_insert on public.who_ddd_reference for insert to authenticated
  with check (current_user_is_platform_owner() or (organization_id is not null and is_org_admin(organization_id)));
create policy who_ddd_reference_update on public.who_ddd_reference for update to authenticated
  using (current_user_is_platform_owner() or (organization_id is not null and is_org_admin(organization_id)))
  with check (current_user_is_platform_owner() or (organization_id is not null and is_org_admin(organization_id)));
create policy who_ddd_reference_delete on public.who_ddd_reference for delete to authenticated
  using (current_user_is_platform_owner() or (organization_id is not null and is_org_admin(organization_id)));
-- Writers could previously read every row through the FOR ALL policies; keep that.
alter policy who_ddd_reference_read on public.who_ddd_reference
  using ((organization_id is null) or is_org_member(organization_id) or current_user_is_platform_owner());

-- Announcement acknowledgements: own rows or manager view, one SELECT policy.
drop policy management_announcement_ack_manager_read on public.management_announcement_acknowledgements;
alter policy management_announcement_ack_read on public.management_announcement_acknowledgements using (
  ((user_id = (select auth.uid())) and is_org_member(organization_id))
  or is_org_admin(organization_id)
  or current_user_has_org_role(organization_id, array['infection_control_lead','quality_manager','committee_secretariat']::app_role[])
);

-- CAPA: quality managers, plus IPC Lead for outbreak-sourced actions.
drop policy quality_capa_outbreak_ipc_insert on public.quality_capa_actions;
alter policy quality_capa_insert on public.quality_capa_actions with check (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, array['hospital_admin','quality_manager']::app_role[])
  or (current_user_has_org_role(organization_id, array['infection_control_lead']::app_role[]) and source_type = 'outbreak_investigation'
      and exists (select 1 from public.lira_outbreak_investigations i where i.id::text = quality_capa_actions.source_id and i.organization_id = quality_capa_actions.organization_id and i.status = 'active'))
);
drop policy quality_capa_outbreak_ipc_update on public.quality_capa_actions;
alter policy quality_capa_update on public.quality_capa_actions
  using (
    current_user_is_platform_owner()
    or current_user_has_org_role(organization_id, array['hospital_admin','quality_manager']::app_role[])
    or (current_user_has_org_role(organization_id, array['infection_control_lead']::app_role[]) and source_type = 'outbreak_investigation'
        and exists (select 1 from public.lira_outbreak_investigations i where i.id::text = quality_capa_actions.source_id and i.organization_id = quality_capa_actions.organization_id))
  )
  with check (
    current_user_is_platform_owner()
    or current_user_has_org_role(organization_id, array['hospital_admin','quality_manager']::app_role[])
    or (current_user_has_org_role(organization_id, array['infection_control_lead']::app_role[]) and source_type = 'outbreak_investigation'
        and exists (select 1 from public.lira_outbreak_investigations i where i.id::text = quality_capa_actions.source_id and i.organization_id = quality_capa_actions.organization_id))
  );

-- 3. foreign-key covering indexes -------------------------------------------
create index if not exists antibiotic_dispensing_periods_created_by_idx on public.antibiotic_dispensing_periods (created_by);
create index if not exists antibiotic_dispensing_periods_updated_by_idx on public.antibiotic_dispensing_periods (updated_by);
create index if not exists antimicrobial_therapy_administrations_administered_by_idx on public.antimicrobial_therapy_administrations (administered_by);
create index if not exists antimicrobial_therapy_administrations_created_by_idx on public.antimicrobial_therapy_administrations (created_by);
create index if not exists clinical_content_source_history_checked_by_idx on public.clinical_content_source_history (checked_by);
create index if not exists clinical_content_source_history_reviewed_by_idx on public.clinical_content_source_history (reviewed_by);
create index if not exists clinical_content_source_history_source_id_idx on public.clinical_content_source_history (source_id);
create index if not exists clinical_scale_org_settings_scale_definition_id_idx on public.clinical_scale_org_settings (scale_definition_id);
create index if not exists hospital_structure_snapshots_created_by_idx on public.hospital_structure_snapshots (created_by);
create index if not exists lira_ai_provider_settings_configured_by_idx on public.lira_ai_provider_settings (configured_by);
create index if not exists lira_knowledge_source_revisions_changed_by_idx on public.lira_knowledge_source_revisions (changed_by);
create index if not exists lira_knowledge_sources_approved_by_idx on public.lira_knowledge_sources (approved_by);
create index if not exists lira_knowledge_sources_created_by_idx on public.lira_knowledge_sources (created_by);
create index if not exists lira_knowledge_sources_reviewed_by_idx on public.lira_knowledge_sources (reviewed_by);
create index if not exists lira_knowledge_sources_updated_by_idx on public.lira_knowledge_sources (updated_by);
create index if not exists lira_outbreak_case_reviews_organization_id_idx on public.lira_outbreak_case_reviews (organization_id);
create index if not exists lira_outbreak_case_reviews_patient_id_idx on public.lira_outbreak_case_reviews (patient_id);
create index if not exists lira_outbreak_case_reviews_reviewer_id_idx on public.lira_outbreak_case_reviews (reviewer_id);
create index if not exists lira_outbreak_investigation_events_created_by_idx on public.lira_outbreak_investigation_events (created_by);
create index if not exists lira_outbreak_investigation_events_organization_id_idx on public.lira_outbreak_investigation_events (organization_id);
create index if not exists lira_outbreak_investigations_created_by_idx on public.lira_outbreak_investigations (created_by);
create index if not exists lira_outbreak_investigations_department_id_idx on public.lira_outbreak_investigations (department_id);
create index if not exists lira_outbreak_investigations_updated_by_idx on public.lira_outbreak_investigations (updated_by);
create index if not exists occupational_exposure_incidents_created_by_idx on public.occupational_exposure_incidents (created_by);
create index if not exists occupational_exposure_incidents_employee_id_idx on public.occupational_exposure_incidents (employee_id);
create index if not exists occupational_exposure_incidents_updated_by_idx on public.occupational_exposure_incidents (updated_by);
create index if not exists patient_clinical_scale_assessments_admission_id_idx on public.patient_clinical_scale_assessments (admission_id);
create index if not exists patient_clinical_scale_assessments_patient_id_idx on public.patient_clinical_scale_assessments (patient_id);
create index if not exists patient_clinical_scale_assessments_scale_definition_id_idx on public.patient_clinical_scale_assessments (scale_definition_id);
create index if not exists patients_archived_by_idx on public.patients (archived_by);
create index if not exists platform_update_runs_started_by_idx on public.platform_update_runs (started_by);
create index if not exists point_prevalence_surveys_created_by_idx on public.point_prevalence_surveys (created_by);
create index if not exists point_prevalence_surveys_updated_by_idx on public.point_prevalence_surveys (updated_by);
create index if not exists who_ddd_reference_created_by_idx on public.who_ddd_reference (created_by);
create index if not exists who_ddd_reference_organization_id_idx on public.who_ddd_reference (organization_id);
