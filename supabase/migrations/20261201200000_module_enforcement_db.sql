-- Modules locked by the Platform Owner are now enforced by the database, not only
-- hidden by the UI.
--
-- A hospital's modules come from organizations.operating_profile / enabled_modules /
-- enabled_addons. Until now only the UI read them (src/core/organization/operatingProfile.js):
-- a locked module disappeared from the menu, but its rows stayed reachable through the
-- API. This migration:
--   1. mirrors normalizeProfile + MODULE_CAPABILITIES + ADDON_CAPABILITIES in SQL
--      (private.module_catalogue, private.module_capabilities, private.org_disabled_modules,
--      private.org_disabled_capabilities). tests/moduleEnforcementSql.test.js fails if
--      the two drift apart;
--   2. makes public.current_user_has_capability answer false for a capability of a
--      locked module. The Platform Owner keeps full access;
--   3. adds one RESTRICTIVE policy (<table>_module_gate) to every module-bound table.
--      Postgres ANDs a restrictive policy with the existing permissive ones, so it can
--      only take rows away, and the existing policies stay as they are. A table that
--      serves several modules is closed only when all of them are locked.
--
-- Nothing is dropped or revoked. Data is kept and comes back as it was when the module
-- is switched on again. SECURITY DEFINER RPCs (dashboard, analysis, executive) are not
-- covered here: they keep their own checks.

-- 1. The module catalogue ----------------------------------------------------------------

-- Every module and add-on. kind: core (always on) | module | addon. preset_tier: the first
-- preset that contains the module (0 basic, 1 surveillance, 2 full), as MODULES[*].from.
create or replace function private.module_catalogue()
returns table(module text, kind text, preset_tier integer)
language sql immutable set search_path = ''
as $function$
  values
    ('patients', 'core', 0),
    ('laboratory', 'module', 1),
    ('national', 'module', 1),
    ('surveillance', 'module', 1),
    ('indicators', 'module', 1),
    ('prevention', 'module', 2),
    ('controls', 'module', 2),
    ('quality', 'module', 2),
    ('training', 'module', 2),
    ('governance', 'module', 2),
    ('kitchen', 'module', 2),
    ('suppliers', 'module', 2),
    ('interviews', 'module', 2),
    ('analysis', 'module', 1),
    ('executive', 'module', 2),
    ('occupational_health', 'addon', null),
    ('pharmacy', 'addon', null),
    ('prevalence_survey', 'addon', null),
    ('lira', 'addon', null)
$function$;

-- The capabilities each module and add-on takes away when it is locked
-- (MODULE_CAPABILITIES + ADDON_CAPABILITIES). national and suppliers have none: they are
-- gated inside Analysis and Quality.
create or replace function private.module_capabilities()
returns table(module text, capability text)
language sql immutable set search_path = ''
as $function$
  values
    ('laboratory', 'view_lab'),
    ('laboratory', 'manage_lab_samples'),
    ('laboratory', 'validate_lab_results'),
    ('laboratory', 'reopen_lab_record'),
    ('surveillance', 'view_surveillance'),
    ('surveillance', 'create_surveillance'),
    ('surveillance', 'edit_surveillance'),
    ('surveillance', 'delete_surveillance'),
    ('surveillance', 'close_surveillance'),
    ('surveillance', 'reopen_surveillance'),
    ('surveillance', 'reassess_surveillance'),
    ('surveillance', 'record_surveillance_outcome'),
    ('surveillance', 'manage_isolation'),
    ('surveillance', 'manage_antimicrobial_therapy'),
    ('surveillance', 'record_clinical_assessment'),
    ('surveillance', 'review_clinical'),
    ('indicators', 'view_indicators'),
    ('indicators', 'manage_indicators'),
    ('indicators', 'manage_bed_days'),
    ('prevention', 'view_prevention'),
    ('prevention', 'record_hand_hygiene'),
    ('prevention', 'record_waste'),
    ('prevention', 'record_antiseptic'),
    ('prevention', 'record_prevention_bundle'),
    ('controls', 'view_controls'),
    ('controls', 'manage_controls'),
    ('controls', 'execute_control'),
    ('controls', 'edit_control_definition'),
    ('controls', 'edit_control_execution'),
    ('controls', 'void_control_execution'),
    ('controls', 'archive_control_definition'),
    ('controls', 'delete_control_draft'),
    ('quality', 'view_quality'),
    ('quality', 'manage_quality'),
    ('quality', 'report_incident'),
    ('training', 'view_training'),
    ('training', 'manage_training'),
    ('kitchen', 'view_kitchen'),
    ('kitchen', 'record_kitchen'),
    ('kitchen', 'manage_kitchen'),
    ('interviews', 'view_interviews'),
    ('interviews', 'manage_interviews'),
    ('analysis', 'view_analysis'),
    ('executive', 'view_executive_dashboard'),
    ('governance', 'view_committees'),
    ('governance', 'manage_committees'),
    ('governance', 'create_committee'),
    ('governance', 'manage_committee_members'),
    ('governance', 'create_committee_meeting'),
    ('governance', 'edit_committee_minutes'),
    ('governance', 'finalize_committee_minutes'),
    ('governance', 'manage_committee_decisions'),
    ('governance', 'manage_committee_documents'),
    ('governance', 'archive_committee'),
    ('governance', 'view_documents'),
    ('governance', 'manage_documents'),
    ('governance', 'submit_document_review'),
    ('governance', 'approve_document'),
    ('governance', 'publish_document'),
    ('governance', 'supersede_document'),
    ('governance', 'archive_document'),
    ('governance', 'delete_document_draft'),
    ('occupational_health', 'view_occupational_health'),
    ('occupational_health', 'manage_occupational_health'),
    ('pharmacy', 'view_pharmacy'),
    ('pharmacy', 'manage_pharmacy'),
    ('pharmacy', 'record_pharmacy'),
    ('prevalence_survey', 'record_prevalence_survey'),
    ('lira', 'view_lira')
$function$;

-- 2. Locked modules of one organization (normalizeProfile) --------------------------------
-- enabled_modules, when set, wins (core modules always on). Without it the preset decides:
-- basic / surveillance / full, the legacy 'laboratory' preset, and anything else
-- ('custom', unknown) reads as full. enabled_addons null means every add-on.
-- An unknown organization has nothing locked.
-- The helpers below are plpgsql, so each session plans their queries once and reuses the
-- plans; RLS calls them on every statement.
create or replace function private.org_disabled_modules(target_org uuid)
returns text[]
language plpgsql stable security definer set search_path = ''
as $function$
declare
  org record;
begin
  select o.operating_profile, o.enabled_modules, o.enabled_addons into org
  from public.organizations o where o.id = target_org;
  if not found then
    return '{}'::text[];
  end if;
  return coalesce((
    select array_agg(c.module order by c.module)
    from private.module_catalogue() c
    where case
      when c.kind = 'core' then false
      when c.kind = 'addon' then org.enabled_addons is not null and not coalesce(c.module = any (org.enabled_addons), false)
      when org.enabled_modules is not null then not coalesce(c.module = any (org.enabled_modules), false)
      when org.operating_profile = 'laboratory' then c.module <> all (array['patients', 'laboratory', 'national', 'analysis'])
      when org.operating_profile = 'basic' then c.preset_tier > 0
      when org.operating_profile = 'surveillance' then c.preset_tier > 1
      else false
    end
  ), '{}'::text[]);
end;
$function$;
grant execute on function private.org_disabled_modules(uuid) to authenticated;

-- Capabilities switched off by an organization's locked modules (disabledCapabilitiesFor).
create or replace function private.org_disabled_capabilities(target_org uuid)
returns text[]
language plpgsql stable security definer set search_path = ''
as $function$
declare
  locked text[] := private.org_disabled_modules(target_org);
begin
  if locked = '{}'::text[] then
    return '{}'::text[];
  end if;
  return coalesce((
    select array_agg(distinct mc.capability)
    from private.module_capabilities() mc
    where mc.module = any (locked)
  ), '{}'::text[]);
end;
$function$;
grant execute on function private.org_disabled_capabilities(uuid) to authenticated;

-- 3. Per-statement helpers for RLS -----------------------------------------------------------
-- Used as `(select private.…)` so Postgres evaluates them once per statement (initplan).
-- The Platform Owner (profiles.is_platform_owner, as public.current_user_is_platform_owner)
-- keeps full access: nothing is ever locked for them.

-- Whether any organization of the caller has a locked module. The gates test this first:
-- while it is false the per-organization helper below is never evaluated.
create or replace function private.current_user_has_locked_modules()
returns boolean
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if coalesce((select p.is_platform_owner from public.profiles p where p.id = auth.uid()), false) then
    return false;
  end if;
  return exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.status = 'active'
      and private.org_disabled_modules(om.organization_id) <> '{}'::text[]
  );
end;
$function$;
grant execute on function private.current_user_has_locked_modules() to authenticated;

-- The caller's organizations in which every module of p_modules is locked.
create or replace function private.current_user_locked_module_orgs(p_modules text[])
returns uuid[]
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if coalesce((select p.is_platform_owner from public.profiles p where p.id = auth.uid()), false) then
    return '{}'::uuid[];
  end if;
  return coalesce((
    select array_agg(distinct om.organization_id)
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.status = 'active'
      and p_modules <@ private.org_disabled_modules(om.organization_id)
  ), '{}'::uuid[]);
end;
$function$;
grant execute on function private.current_user_locked_module_orgs(text[]) to authenticated;

-- The caller's organizations in which a capability is switched off by a locked module.
create or replace function private.current_user_disabled_capability_orgs(p_capability text)
returns uuid[]
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if coalesce((select p.is_platform_owner from public.profiles p where p.id = auth.uid()), false) then
    return '{}'::uuid[];
  end if;
  return coalesce((
    select array_agg(distinct om.organization_id)
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.status = 'active'
      and p_capability = any (private.org_disabled_capabilities(om.organization_id))
  ), '{}'::uuid[]);
end;
$function$;
grant execute on function private.current_user_disabled_capability_orgs(text) to authenticated;

-- 4. current_user_has_capability honours locked modules ------------------------------------
-- As 20261127110100 left it, plus: a capability of a locked module is false for every
-- organization role. The Platform Owner keeps full access.
create or replace function public.current_user_has_capability(target_org uuid, capability_key text)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select public.current_user_is_platform_owner()
  or ((
    exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = target_org
        and om.status = 'active'
        and om.role = 'hospital_admin'
        and capability_key not in ('view_platform','manage_platform')
        and (
          capability_key not in ('view_occupational_health','manage_occupational_health')
          or exists (select 1 from public.organizations o where o.id = target_org and o.is_demo)
        )
    )
    or exists (
      select 1
      from public.organization_members om
      where om.user_id=auth.uid()
        and om.organization_id=target_org
        and om.status='active'
        and (
          exists (
            select 1
            from public.custom_role_capabilities crc
            where crc.custom_role_id=om.custom_role_id
              and crc.capability=capability_key
          )
          or exists (
            select 1
            from public.organization_member_capabilities omc
            where omc.membership_id=om.id
              and (
                (omc.capability='lab_access' and capability_key='view_lab')
                or (omc.capability='quality_access' and capability_key in ('view_quality','view_controls'))
              )
          )
          or case capability_key
            when 'view_training' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse','department_manager','department_user','hr_office')
            when 'manage_training' then om.role in ('hospital_admin','infection_control_lead')
            when 'view_prevention' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse')
            when 'view_lab' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer')
            when 'manage_libraries' then om.role in ('hospital_admin','infection_control_lead')
            when 'view_controls' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse','department_manager','department_user','laboratory','quality_manager')
            when 'manage_controls' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
            when 'view_indicators' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse','department_manager','pharmacy','doctor_reviewer','quality_manager','hospital_director')
            when 'manage_indicators' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
            when 'record_pharmacy' then om.role in ('hospital_admin','infection_control_lead','pharmacy')
            when 'record_prevalence_survey' then om.role in ('hospital_admin','infection_control_lead','infection_control_member')
            when 'record_hand_hygiene' then om.role in ('link_nurse')
            when 'record_waste' then om.role in ('link_nurse')
            when 'record_antiseptic' then om.role in ('link_nurse')
            when 'record_prevention_bundle' then om.role in ('link_nurse')
            when 'view_kitchen' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
            when 'record_kitchen' then om.role in ('hospital_admin','quality_manager')
            when 'manage_kitchen' then om.role in ('hospital_admin','quality_manager')
            when 'view_executive_dashboard' then om.role in ('hospital_admin','hospital_director')
            when 'view_interviews' then om.role in ('hospital_admin','hr_office')
            when 'manage_interviews' then om.role in ('hospital_admin','hr_office')
            else false
          end
        )
    )
  )
  and not (capability_key = any (private.org_disabled_capabilities(target_org))));
$function$;

-- 5. Module-bound tables -------------------------------------------------------------------
-- One row per (table, module group). A table is closed in an organization when, for any of
-- its groups, every module of the group is locked there: tables read by several modules
-- list all of them in one group (laboratory_samples is read by Surveillance too, so it
-- closes only when both are locked). Rows without an organization (shared templates) stay.
create or replace function private.module_gated_tables()
returns table(table_name text, modules text[])
language sql immutable set search_path = ''
as $function$
  values
    -- Kitchen (HACCP) & recall drill
    ('kitchen_settings', array['kitchen']),
    ('kitchen_limits', array['kitchen']),
    ('kitchen_haccp_steps', array['kitchen']),
    ('kitchen_products', array['kitchen']),
    ('kitchen_menus', array['kitchen']),
    ('kitchen_receipts', array['kitchen']),
    ('kitchen_receipt_items', array['kitchen']),
    ('kitchen_stock_writeoffs', array['kitchen']),
    ('kitchen_productions', array['kitchen']),
    ('kitchen_production_meals', array['kitchen']),
    ('kitchen_material_usage', array['kitchen']),
    ('kitchen_thermal_processes', array['kitchen']),
    ('kitchen_pureeing', array['kitchen']),
    ('kitchen_defrosting', array['kitchen']),
    ('kitchen_recall_drills', array['kitchen']),
    -- Candidate interviews (HR)
    ('hr_application_links', array['interviews']),
    ('hr_candidates', array['interviews']),
    ('hr_candidate_employers', array['interviews']),
    ('hr_candidate_languages', array['interviews']),
    ('hr_candidate_signatures', array['interviews']),
    ('hr_interviews', array['interviews']),
    -- Suppliers & certificates: a tab of Quality, so closed when either is locked.
    -- The supplier list itself is also read by the Kitchen (receipts).
    ('quality_suppliers', array['suppliers', 'kitchen']),
    ('quality_suppliers', array['quality', 'kitchen']),
    ('quality_supplier_contacts', array['suppliers']),
    ('quality_supplier_contacts', array['quality']),
    ('quality_supplier_certifications', array['suppliers']),
    ('quality_supplier_certifications', array['quality']),
    ('quality_supplier_certificate_requests', array['suppliers']),
    ('quality_supplier_certificate_requests', array['quality']),
    ('quality_supplier_certificate_request_items', array['suppliers']),
    ('quality_supplier_certificate_request_items', array['quality']),
    ('quality_supplier_eval_templates', array['suppliers']),
    ('quality_supplier_eval_templates', array['quality']),
    ('quality_supplier_eval_template_criteria', array['suppliers']),
    ('quality_supplier_eval_template_criteria', array['quality']),
    ('quality_supplier_evaluations', array['suppliers']),
    ('quality_supplier_evaluations', array['quality']),
    ('quality_supplier_evaluation_scores', array['suppliers']),
    ('quality_supplier_evaluation_scores', array['quality']),
    ('quality_supplier_nonconformities', array['suppliers']),
    ('quality_supplier_nonconformities', array['quality']),
    -- Quality (incidents, audits, CAPA, risks, reviews, equipment, surveys)
    ('quality_incidents', array['quality']),
    ('quality_incident_blue_codes', array['quality']),
    ('quality_incident_falls', array['quality']),
    ('quality_incident_obstetric', array['quality']),
    ('quality_incident_sharps', array['quality']),
    ('quality_audits', array['quality']),
    ('quality_audit_templates', array['quality']),
    ('quality_audit_template_questions', array['quality']),
    ('quality_audit_checklist_items', array['quality']),
    ('quality_audit_team_members', array['quality']),
    ('quality_findings', array['quality']),
    ('quality_capa_actions', array['quality', 'lira']),
    ('quality_capa_progress', array['quality']),
    ('quality_capa_sub_actions', array['quality']),
    ('quality_capa_root_cause_analyses', array['quality']),
    ('quality_capa_root_cause_factors', array['quality']),
    ('quality_capa_root_cause_whys', array['quality']),
    ('quality_risks', array['quality']),
    ('quality_risk_assessments', array['quality']),
    ('quality_risk_opportunities', array['quality']),
    ('quality_objectives', array['quality']),
    ('quality_management_reviews', array['quality']),
    ('quality_management_review_actions', array['quality']),
    ('quality_management_review_participants', array['quality']),
    ('quality_management_review_sections', array['quality']),
    ('quality_department_meetings', array['quality']),
    ('quality_department_meeting_decisions', array['quality']),
    ('quality_department_meeting_participants', array['quality']),
    ('quality_equipment', array['quality']),
    ('quality_equipment_events', array['quality']),
    ('quality_surveys', array['quality']),
    ('quality_survey_responses', array['quality']),
    ('quality_record_links', array['quality']),
    -- Controls
    ('control_definitions', array['controls']),
    ('control_assignments', array['controls']),
    ('control_assignment_stats', array['controls']),
    ('control_drafts', array['controls']),
    ('control_executions', array['controls']),
    ('control_execution_revisions', array['controls']),
    -- Committees & Documents
    ('committees', array['governance']),
    ('committee_members', array['governance']),
    ('committee_meetings', array['governance']),
    ('committee_meeting_attendance', array['governance']),
    ('committee_decisions', array['governance']),
    ('committee_documents', array['governance']),
    ('committee_history', array['governance']),
    ('committee_minutes_approvals', array['governance']),
    ('committee_minutes_approval_history', array['governance']),
    ('committee_minutes_external_approvals', array['governance']),
    ('committee_plan_items', array['governance', 'indicators']),
    ('controlled_documents', array['governance']),
    -- Infection surveillance (HAI, isolation, therapy, outcome)
    ('surveillance_cases', array['surveillance']),
    ('surveillance_events', array['surveillance']),
    ('surveillance_outcomes', array['surveillance']),
    ('surveillance_reassessments', array['surveillance']),
    ('surveillance_case_infection_types', array['surveillance']),
    ('surveillance_neonatal_details', array['surveillance']),
    ('surveillance_surgical_procedures', array['surveillance']),
    ('surveillance_devices', array['surveillance', 'prevention']),
    ('hai_classifications', array['surveillance']),
    ('isolation_episodes', array['surveillance']),
    ('isolation_episode_precautions', array['surveillance']),
    ('clinical_assessments', array['surveillance']),
    ('clinical_assessment_findings', array['surveillance']),
    ('antimicrobial_therapies', array['surveillance', 'pharmacy']),
    ('antimicrobial_therapy_administrations', array['surveillance', 'pharmacy']),
    -- Laboratory & microbiology/AMR (Surveillance reads samples and results too)
    ('laboratory_samples', array['laboratory', 'surveillance']),
    ('microbiology_results', array['laboratory', 'surveillance']),
    ('microbiology_result_organisms', array['laboratory', 'surveillance']),
    ('antimicrobial_susceptibility_results', array['laboratory', 'surveillance']),
    ('amr_classifications', array['laboratory', 'surveillance']),
    ('critical_result_communications', array['laboratory', 'surveillance']),
    ('notifiable_disease_reports', array['national', 'laboratory', 'surveillance']),
    -- Prevention & hand hygiene
    ('hand_hygiene_sessions', array['prevention']),
    ('hand_hygiene_observations', array['prevention']),
    ('waste_measurements', array['prevention']),
    ('antiseptic_consumption_periods', array['prevention']),
    ('prevention_bundle_assessments', array['prevention']),
    -- Training (programmes, assignments and certificates stay: the employee record reads them)
    ('training_requirements', array['training']),
    ('training_requirement_programs', array['training']),
    ('training_requirement_targets', array['training']),
    ('training_program_materials', array['training']),
    ('training_program_effectiveness', array['training']),
    ('training_program_feedback_questions', array['training']),
    ('training_assessment_questions', array['training']),
    ('training_assessment_options', array['training']),
    ('training_assessment_answers', array['training']),
    ('training_feedback_templates', array['training']),
    ('training_feedback_template_questions', array['training']),
    ('training_feedback_responses', array['training']),
    ('training_feedback_scores', array['training']),
    ('training_history_events', array['training']),
    -- Indicators
    ('indicator_snapshots', array['indicators']),
    -- Add-ons
    ('occupational_health_visits', array['occupational_health']),
    ('employee_vaccinations', array['occupational_health']),
    ('occupational_exposure_incidents', array['occupational_health']),
    ('antibiotic_dispensing_periods', array['pharmacy']),
    ('point_prevalence_surveys', array['prevalence_survey']),
    ('lira_outbreak_investigations', array['lira']),
    ('lira_outbreak_investigation_events', array['lira']),
    ('lira_outbreak_case_reviews', array['lira'])
$function$;

do $$
declare
  r record;
begin
  for r in
    select g.table_name,
      string_agg(format('organization_id = any ((select private.current_user_locked_module_orgs(%L::text[]))::uuid[])', g.modules::text), ' or ' order by g.modules::text) as locked
    from private.module_gated_tables() g
    group by g.table_name
  loop
    if to_regclass('public.' || quote_ident(r.table_name)) is null then
      raise notice 'module gate: table public.% not found, skipped', r.table_name;
      continue;
    end if;
    if not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = r.table_name and p.policyname = r.table_name || '_module_gate') then
      -- The first term is one boolean per statement: while nothing is locked for the caller,
      -- the rows pass without evaluating the per-organization helper at all.
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated using (%s) with check (%s)',
        r.table_name || '_module_gate', r.table_name,
        format('(select not private.current_user_has_locked_modules()) or organization_id is null or not (%s)', r.locked),
        format('(select not private.current_user_has_locked_modules()) or organization_id is null or not (%s)', r.locked));
    end if;
  end loop;
end $$;
