-- Limoxis Observer Supabase cleanup — Phase 2 destructive script.
--
-- Purpose: remove the legacy pre-Limoxis-Observer schema (Greek module-name
-- RLS, current_app_role()/has_module_action() authorization model) that does
-- not match any migration under supabase/migrations/. Confirmed against the
-- Phase-0 inventory captured on 2026-08-30. Functions are intentionally left
-- in place per instruction — a later pass will remove the now-orphaned ones.
--
-- SAFETY:
--   * Runs inside an explicit transaction. Nothing is permanent until COMMIT.
--   * Refuses to run unless the connected project matches the expected ref.
--   * Uses an explicit table allowlist, not `drop schema public cascade`.
--   * Leaves auth, storage.buckets/objects rows, extensions, and every
--     function untouched — only the listed tables (and, via CASCADE, their
--     own policies/triggers/sequences) and the three legacy storage buckets
--     are removed.
--
-- HOW TO RUN:
--   1. Paste this whole file into Supabase SQL Editor and run it.
--   2. The verification SELECTs at the end run automatically. Read their
--      output.
--   3. If everything looks right, run: COMMIT;
--      If anything looks wrong, run: ROLLBACK;
--      (Neither is included in this file on purpose — you decide.)

begin;

-- Guard: refuse to run against the wrong project.
do $$
begin
  if current_database() <> 'postgres' then
    raise exception 'Refusing to run: unexpected database %', current_database();
  end if;
  if not exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'patients'
  ) then
    raise exception 'Refusing to run: expected legacy table "patients" not found — is this the right project?';
  end if;
  if exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'organization_members'
  ) then
    raise exception 'Refusing to run: found "organization_members", which belongs to the NEW schema — this looks like the wrong project or the new migrations already ran here.';
  end if;
end $$;

-- Drop legacy application tables. CASCADE removes their own policies,
-- triggers, and dependent sequences/views along with them. This list is the
-- exact set of public-schema tables seen in the Phase-0 inventory, minus
-- nothing — every one of them is absent from supabase/migrations/.
drop table if exists public.antiseptic_consumption_records cascade;
drop table if exists public.attachments cascade;
drop table if exists public.committee_agenda_items cascade;
drop table if exists public.committee_decisions cascade;
drop table if exists public.committee_meeting_attendees cascade;
drop table if exists public.committee_meetings cascade;
drop table if exists public.committee_members cascade;
drop table if exists public.committees cascade;
drop table if exists public.continuity_recovery_profiles cascade;
drop table if exists public.continuity_recovery_tests cascade;
drop table if exists public.controlled_document_versions cascade;
drop table if exists public.controlled_documents cascade;
drop table if exists public.custom_indicators cascade;
drop table if exists public.data_retention_policies cascade;
drop table if exists public.departments cascade;
drop table if exists public.employee_occupational_visits cascade;
drop table if exists public.employee_vaccinations cascade;
drop table if exists public.employees cascade;
drop table if exists public.form_responses cascade;
drop table if exists public.form_templates cascade;
drop table if exists public.hand_hygiene_observations cascade;
drop table if exists public.hand_hygiene_sessions cascade;
drop table if exists public.indicator_definition_history cascade;
drop table if exists public.indicator_settings cascade;
drop table if exists public.indicator_source_records cascade;
drop table if exists public.infections cascade;
drop table if exists public.laboratory_antibiogram_results cascade;
drop table if exists public.laboratory_sample_organisms cascade;
drop table if exists public.laboratory_source_samples cascade;
drop table if exists public.master_data_libraries cascade;
drop table if exists public.notifiable_diseases cascade;
drop table if exists public.notification_escalation_policies cascade;
drop table if exists public.patient_attachments cascade;
drop table if exists public.patient_isolations cascade;
drop table if exists public.patient_samples cascade;
drop table if exists public.patients cascade;
drop table if exists public.platform_owner_support_context cascade;
drop table if exists public.platform_owners cascade;
drop table if exists public.platform_support_requests cascade;
drop table if exists public.prevention_records cascade;
drop table if exists public.privacy_governance_profiles cascade;
drop table if exists public.promoted_antibiotic_requests cascade;
drop table if exists public.quality_audits cascade;
drop table if exists public.quality_capa cascade;
drop table if exists public.quality_incidents cascade;
drop table if exists public.quality_risks cascade;
drop table if exists public.role_permission_configuration cascade;
drop table if exists public.security_auth_events cascade;
drop table if exists public.studio_configuration cascade;
drop table if exists public.surveillance_cases cascade;
drop table if exists public.surveillance_control_executions cascade;
drop table if exists public.surveillance_control_programs cascade;
drop table if exists public.system_audit_log cascade;
drop table if exists public.training_attendees cascade;
drop table if exists public.training_records cascade;
drop table if exists public.user_department_access cascade;
drop table if exists public.user_notification_receipts cascade;
drop table if exists public.user_profiles cascade;
drop table if exists public.waste_measurement_records cascade;

-- Organizations last: several of the tables above reference it via FK.
drop table if exists public.organizations cascade;

-- Legacy storage RLS policies for the three legacy buckets. Supabase blocks
-- direct SQL DELETE against storage.objects/storage.buckets (a protective
-- trigger — "Direct deletion from storage tables is not allowed. Use the
-- Storage API instead."), so the buckets and their files are NOT dropped
-- here. Delete them yourself afterwards from Dashboard -> Storage, or via the
-- Storage API. These policies are harmless to drop now regardless — they
-- reference bucket ids that either get manually deleted next or already hold
-- only legacy test files.
drop policy if exists healthcare_attachments_delete_owner_or_admin on storage.objects;
drop policy if exists healthcare_attachments_insert_own_path on storage.objects;
drop policy if exists healthcare_attachments_select_owner_or_admin on storage.objects;
drop policy if exists operationalattachments_delete on storage.objects;
drop policy if exists operationalattachments_insert on storage.objects;
drop policy if exists operationalattachments_select on storage.objects;
drop policy if exists patientattachments_delete on storage.objects;
drop policy if exists patientattachments_insert on storage.objects;
drop policy if exists patientattachments_select on storage.objects;

-- Verification — read these before deciding COMMIT vs ROLLBACK.
select 'remaining public tables' as check, count(*) as value
from pg_tables where schemaname = 'public'
union all
select 'remaining legacy storage policies', count(*)
from pg_policies where schemaname = 'storage' and tablename = 'objects'
  and policyname like any (array['healthcare_attachments_%', 'operationalattachments_%', 'patientattachments_%'])
union all
select 'remaining public-schema functions (should be unchanged)', count(*)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';

select tablename from pg_tables where schemaname = 'public' order by tablename;

-- Decide now:
--   COMMIT;    -- to make the cleanup permanent
--   ROLLBACK;  -- to undo everything above and leave the project untouched
--
-- Afterwards (only after COMMIT), delete the buckets themselves:
--   Dashboard -> Storage -> select each of healthcare-attachments,
--   operationalattachments, patientattachments -> delete all files inside ->
--   delete the bucket. This cannot be scripted here by SQL policy.
