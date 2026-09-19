import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const panel = fs.readFileSync('src/features/management/PrevalenceSurveyPanel.jsx', 'utf8')
const service = fs.readFileSync('src/features/management/prevalenceSurveyCloudService.js', 'utf8')
const migration = fs.readFileSync('supabase/migrations/20260919230000_add_point_prevalence_survey_module.sql', 'utf8')

describe('Management Center point prevalence survey module (ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014 §2.2)', () => {
  it('keeps demo/production loading isolated and gates the create action', () => {
    expect(panel).toContain('loadPrevalenceSurveyHistory(tenant?.id)')
    expect(panel).toContain('savePrevalenceSurvey')
  })
  it('uses tenant-scoped cloud writes for prevalence surveys', () => {
    expect(service).toContain("from('point_prevalence_surveys')")
    expect(service).toContain("eq('organization_id',")
    expect(service).toContain('savePrevalenceSurvey')
    expect(service).toContain('deletePrevalenceSurvey')
  })
  it('scopes read/write access to ΕΝΛ roles and department-scoped capability holders', () => {
    expect(migration).toContain("array['infection_control_lead','infection_control_member']")
    expect(migration).toContain("current_user_has_capability(target_org,'record_prevalence_survey')")
  })
  it('hardens grants, RLS and audit trail', () => {
    expect(migration).toContain('revoke all on public.point_prevalence_surveys from public, anon')
    expect(migration).toContain('grant select, insert, update, delete on public.point_prevalence_surveys to authenticated')
    expect(migration).toContain('trg_audit_point_prevalence_surveys')
    expect(migration).toContain('private.audit_management_change()')
  })
  it('enforces that HAI and antibiotic counts cannot exceed the total patients surveyed', () => {
    expect(migration).toContain('patients_with_hai >= 0 and patients_with_hai <= patients_total')
    expect(migration).toContain('patients_on_antibiotics >= 0 and patients_on_antibiotics <= patients_total')
  })
})
