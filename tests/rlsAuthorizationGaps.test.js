import { readFileSync } from 'node:fs'
import { URL } from 'node:url'
import { describe, expect, it } from 'vitest'

const identityTenants = readFileSync(new URL('../supabase/migrations/202608270001_v020_identity_tenants.sql', import.meta.url), 'utf8')
const clinicalCore = readFileSync(new URL('../supabase/migrations/202608270005_v050_clinical_surveillance_core.sql', import.meta.url), 'utf8')
const parallelSurveillance = readFileSync(new URL('../supabase/migrations/202608270006_v051_parallel_surveillance.sql', import.meta.url), 'utf8')
const labMicrobiology = readFileSync(new URL('../supabase/migrations/202608270007_v060_laboratory_microbiology.sql', import.meta.url), 'utf8')
const governanceCoverage = readFileSync(new URL('../supabase/migrations/202608300015_v0272_governance_schema_coverage.sql', import.meta.url), 'utf8')

// These tests document, but deliberately do not fix, a gap between the
// documented authorization model (docs/AUTHORIZATION_MODEL.md) and the SQL
// RLS layer that docs/ARCHITECTURE.md names "the authoritative isolation
// layer" (UI permission checks are usability only). They are canaries: each
// assertion should start failing the day someone tightens the corresponding
// policy, which is the intended signal to update or delete it here — not a
// real regression to chase.

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

describe('RLS gap: hospital_admin can read protected clinical, laboratory and AMR data', () => {
  // The frontend explicitly excludes hospital_admin from these domains
  // (see hospitalAdminExcluded in src/core/permissions/systemRoleMatrix.js:
  // VIEW_LAB, VIEW_PATIENTS, VIEW_SURVEILLANCE, CLASSIFY_RESISTANCE,
  // COMMUNICATE_CRITICAL_RESULTS, MANAGE_ANTIMICROBIAL_THERAPY, REVIEW_CLINICAL),
  // but the RLS policies below still list the role directly.

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
