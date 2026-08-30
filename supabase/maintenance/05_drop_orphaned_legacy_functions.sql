-- Limoxis Observer Supabase cleanup — Phase 4: drop orphaned legacy functions.
--
-- After Phase 2 (legacy tables/policies dropped) and Phase 3 (real
-- migrations applied), the public schema had 86 functions: 19 defined by
-- supabase/migrations/*.sql (still needed) and 67 left over from the old
-- pre-Limoxis-Observer schema (has_module_action(), current_app_role(),
-- is_app_admin(), etc. — a completely different authorization model, no
-- longer called by anything since their tables/policies are gone).
--
-- Verified before writing this script:
--   * Every one of the 67 names below is absent from supabase/migrations/
--     (only false-positive substring matches, e.g. "has_capability" inside
--     "current_user_has_capability", which is a real, kept function).
--   * No function name is overloaded in the live database (each name maps
--     to exactly one signature), so plain DROP FUNCTION IF EXISTS
--     public.<name> is unambiguous — no argument types needed.
--
-- Run this whole script in ONE execution in Supabase SQL Editor.

begin;

do $$
begin
  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'laboratory_samples') then
    raise exception 'Refusing to run: public.laboratory_samples not found — Phase 3 (apply migrations) does not look complete yet.';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'has_module_action') then
    raise exception 'Refusing to run: legacy function has_module_action() already gone — this cleanup looks already applied.';
  end if;
end $$;

drop function if exists public.activate_my_profile();
drop function if exists public.allocate_organization_username(uuid);
drop function if exists public.audit_findings_evidence(jsonb);
drop function if exists public.audit_redact(jsonb);
drop function if exists public.block_platform_owner_support_write();
drop function if exists public.bootstrap_first_admin(uuid, text, text, text, text);
drop function if exists public.can_access_clinical_department(uuid);
drop function if exists public.can_access_control_record(uuid, jsonb);
drop function if exists public.can_manage_clinical();
drop function if exists public.can_manage_laboratory_source_sample(text, text);
drop function if exists public.can_manage_occupational_health();
drop function if exists public.can_manage_operational();
drop function if exists public.can_manage_quality();
drop function if exists public.can_view_staff_directory();
drop function if exists public.capture_custom_indicator_definition_history();
drop function if exists public.capture_department_access_security_event();
drop function if exists public.capture_indicator_definition_history();
drop function if exists public.capture_system_audit();
drop function if exists public.capture_user_profile_security_event();
drop function if exists public.complete_assigned_surveillance_control(text, jsonb);
drop function if exists public.current_app_role();
drop function if exists public.current_organization_id();
drop function if exists public.get_my_authorization_context();
drop function if exists public.get_my_context();
drop function if exists public.get_my_module_access();
drop function if exists public.get_my_staff_self_service();
drop function if exists public.get_platform_owner_context();
drop function if exists public.get_platform_owner_support_context();
drop function if exists public.guard_finalized_quality_audit();
drop function if exists public.guard_hospital_admin_role_permissions();
drop function if exists public.guard_manual_surveillance_closure();
drop function if exists public.guard_quality_evidence_delete();
drop function if exists public.guard_quality_incident_lifecycle();
drop function if exists public.has_capability(text);
drop function if exists public.has_controls_action(text);
drop function if exists public.has_department_access(uuid);
drop function if exists public.has_module_access(text, boolean);
drop function if exists public.has_module_action(text, text);
drop function if exists public.is_app_admin();
drop function if exists public.is_platform_owner();
drop function if exists public.list_my_safety_incidents();
drop function if exists public.module_access_level(text);
drop function if exists public.module_capability_key(text);
drop function if exists public.platform_owner_purge_organization(uuid);
drop function if exists public.platform_owner_support_organization_id();
drop function if exists public.platform_tenant_purge_active();
drop function if exists public.prevent_controlled_document_version_change();
drop function if exists public.prevent_non_draft_document_delete();
drop function if exists public.prevention_module_for(text);
drop function if exists public.report_safety_incident(date, time, text, text, text, text, text, text, text, text, boolean);
drop function if exists public.role_allows_high_risk_action(text, text, text);
drop function if exists public.seed_controls_role_permission();
drop function if exists public.set_updated_at();
drop function if exists public.update_my_safety_incident(text, date, time, text, text, text, text, text, text, text, text, boolean);
drop function if exists public.validate_committee_payload();
drop function if exists public.validate_configuration_json_rows();
drop function if exists public.validate_controlled_document();
drop function if exists public.validate_infection_relationships();
drop function if exists public.validate_isolation_relationships();
drop function if exists public.validate_laboratory_governance();
drop function if exists public.validate_occupational_employee_relationship();
drop function if exists public.validate_patient_sample_relationships();
drop function if exists public.validate_quality_audit_source();
drop function if exists public.validate_quality_capa_source();
drop function if exists public.validate_staff_prevention_relationships();
drop function if exists public.validate_user_department_access();
drop function if exists public.validate_user_profile_tenant_integrity();

select 'remaining public-schema functions (expect 19)' as check, count(*) as value
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';

select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by p.proname;

commit;
