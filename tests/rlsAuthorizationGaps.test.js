import { readFileSync } from 'node:fs'
import { URL } from 'node:url'
import { describe, expect, it } from 'vitest'

const identityTenants = readFileSync(new URL('../supabase/migrations/202608270001_v020_identity_tenants.sql', import.meta.url), 'utf8')
const clinicalCore = readFileSync(new URL('../supabase/migrations/202608270005_v050_clinical_surveillance_core.sql', import.meta.url), 'utf8')
const parallelSurveillance = readFileSync(new URL('../supabase/migrations/202608270006_v051_parallel_surveillance.sql', import.meta.url), 'utf8')
const labMicrobiology = readFileSync(new URL('../supabase/migrations/202608270007_v060_laboratory_microbiology.sql', import.meta.url), 'utf8')
const governanceCoverage = readFileSync(new URL('../supabase/migrations/202608300015_v0272_governance_schema_coverage.sql', import.meta.url), 'utf8')
const clinicalGapFix = readFileSync(new URL('../supabase/migrations/202608300016_v0273_clinical_rls_gap_fix.sql', import.meta.url), 'utf8')
const ownerFullControl = readFileSync(new URL('../supabase/migrations/202608300019_v0279_platform_owner_full_control.sql', import.meta.url), 'utf8')

// These tests document a gap between the documented authorization model
// (docs/AUTHORIZATION_MODEL.md) and the SQL RLS layer that
// docs/ARCHITECTURE.md names "the authoritative isolation layer" (UI
// permission checks are usability only), found while extending permission
// engine test coverage.
//
// Applied migrations are never edited in place, so v050/v051/v060 still
// contain the original, permissive text below — that is expected and this
// suite intentionally keeps asserting it as a historical record. The actual
// gap is closed by a later migration (202608300016_v0273), asserted in the
// second describe block. The general current_user_has_org_role()/
// has_org_role() helpers are deliberately left with their platform_owner
// bypass intact everywhere else (memberships, training, committees,
// controls, quality) — it is still the only way to bootstrap a brand new
// organization's first membership, so v0273 overrides only the specific
// clinical/laboratory policies named in AUTHORIZATION_MODEL.md, not the
// shared helpers.

describe('RLS gap: platform_owner has a blanket bypass on the pre-v0272 role-check helpers', () => {
  it('bakes an unconditional platform_owner OR into has_org_role (v020) and current_user_has_org_role (v050)', () => {
    // AUTHORIZATION_MODEL.md rule #2: "platform_owner is a platform identity
    // attribute, not an organization membership role. It never grants an
    // implicit hospital-record RLS bypass." Both helpers below do exactly
    // that, and they back most policies added before v0272 (lab, clinical,
    // memberships, audit log, quality/CAPA).
    expect(identityTenants).toContain('select public.current_user_is_platform_owner() or exists(')
    expect(clinicalCore).toContain('select public.current_user_is_platform_owner() or exists (')
  })

  it('shows the v0272 governance helper closing the same bypass, proving the fix is known but not backported', () => {
    expect(governanceCoverage).toContain('select not public.current_user_is_platform_owner() and (')
  })
})

describe('RLS gap (historical, as originally shipped): hospital_admin could read protected clinical, laboratory and AMR data', () => {
  // The frontend explicitly excludes hospital_admin from these domains
  // (see hospitalAdminExcluded in src/core/permissions/systemRoleMatrix.js:
  // VIEW_LAB, VIEW_PATIENTS, VIEW_SURVEILLANCE, CLASSIFY_RESISTANCE,
  // COMMUNICATE_CRITICAL_RESULTS, MANAGE_ANTIMICROBIAL_THERAPY, REVIEW_CLINICAL),
  // but the original migrations below still listed the role directly. See
  // "RLS gap fix" below for the migration that overrides every one of these.

  it('grants hospital_admin read access to microbiology, AMR and critical-result-communication tables', () => {
    expect(labMicrobiology).toContain('create policy ast_authorized_read on public.antimicrobial_susceptibility_results for select using (')
    expect(labMicrobiology).toContain("array['hospital_admin','infection_control_lead','infection_control_member','laboratory','pharmacy','doctor_reviewer']::public.app_role[]")
    expect(labMicrobiology).toContain('create policy amr_authorized_read on public.amr_classifications for select using (')
    expect(labMicrobiology).toContain('create policy critical_comm_authorized_read on public.critical_result_communications for select using (')
    expect(labMicrobiology).toContain("array['hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer']::public.app_role[]")
  })

  it('grants hospital_admin read access to laboratory samples and antimicrobial therapy records', () => {
    expect(clinicalCore).toContain('create policy laboratory_samples_read on public.laboratory_samples for select using (')
    expect(clinicalCore).toContain("public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory']::public.app_role[])")
    expect(clinicalCore).toContain('create policy antimicrobial_therapies_read on public.antimicrobial_therapies for select using (')
    expect(clinicalCore).toContain("public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','pharmacy','doctor_reviewer']::public.app_role[])")
  })

  it('grants hospital_admin read access to the clinical audit log and write access to HAI classifications', () => {
    expect(clinicalCore).toContain('create policy clinical_audit_authorized_read on public.clinical_audit_log for select using (')
    expect(clinicalCore).toContain("public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead']::public.app_role[])")
    expect(parallelSurveillance).toContain('create policy hai_classification_write on public.hai_classifications for all using (')
    expect(parallelSurveillance).toContain("array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]")
  })

  it('lets hospital_admin view any surveillance record through can_view_surveillance_record', () => {
    expect(clinicalCore).toContain('create or replace function public.can_view_surveillance_record(target_org uuid, target_department uuid)')
    expect(clinicalCore).toContain("select public.current_user_has_org_role(target_org, array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])")
  })
})

describe('RLS gap fix (v0273): hospital_admin and platform_owner excluded from clinical/laboratory data', () => {
  it('overrides every affected policy to drop hospital_admin from the role array and exclude platform_owner explicitly', () => {
    for (const policy of [
      'ast_authorized_read',
      'amr_authorized_read',
      'critical_comm_authorized_read',
      'laboratory_samples_read',
      'antimicrobial_therapies_read',
      'clinical_audit_authorized_read',
      'hai_classification_write',
    ]) {
      expect(clinicalGapFix).toContain(`drop policy if exists ${policy} on `)
    }
    expect(clinicalGapFix).not.toContain("'hospital_admin'")
    expect(clinicalGapFix).toContain('not public.current_user_is_platform_owner()')
  })

  it('redefines can_view_surveillance_record without hospital_admin and with platform_owner excluded', () => {
    expect(clinicalGapFix).toContain('create or replace function public.can_view_surveillance_record(target_org uuid, target_department uuid)')
    expect(clinicalGapFix).toContain("array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]")
  })

  it('does not touch the shared has_org_role/current_user_has_org_role helpers (still needed for org onboarding)', () => {
    expect(clinicalGapFix).not.toContain('create or replace function public.has_org_role')
    expect(clinicalGapFix).not.toContain('create or replace function public.current_user_has_org_role')
  })
})


describe('Platform Owner full-control override (v0279)', () => {
  it('restores explicit owner access without restoring hospital_admin clinical access', () => {
    expect(ownerFullControl).toContain('public.current_user_is_platform_owner()')
    expect(ownerFullControl).toContain('create policy laboratory_samples_read')
    expect(ownerFullControl).toContain('create policy antimicrobial_therapies_read')
    expect(ownerFullControl).toContain('create policy clinical_audit_authorized_read')
    expect(ownerFullControl).not.toContain("array['hospital_admin','infection_control_lead','infection_control_member','laboratory']")
  })

  it('restores owner access to governance and control helpers', () => {
    expect(ownerFullControl).toContain('create or replace function public.current_user_has_governance_capability')
    expect(ownerFullControl).toContain('select public.current_user_is_platform_owner() or (')
    expect(ownerFullControl).toContain('create or replace function public.current_user_can_access_control_department')
  })
})
