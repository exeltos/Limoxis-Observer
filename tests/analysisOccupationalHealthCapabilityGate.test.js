import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const migration = fs.readFileSync('supabase/migrations/20260919300000_gate_analysis_occupational_health_by_capability.sql', 'utf8')

// Regression test for an Analysis-page audit finding (P0): 20260919120000
// deliberately removed hospital_admin's blanket view_occupational_health/
// manage_occupational_health capability grant ("Hospital Admin should have
// no automatic access to this domain"), but platform_report_summary's own
// access gate only ever checked org role (hospital_admin or
// infection_control_lead) — so this security-definer function, which
// bypasses RLS entirely, kept handing any hospital_admin an unconditional
// occupational_health_visits count via the Analysis page, reintroducing in
// aggregate form the exact access the codebase already decided to remove.
describe('platform_report_summary gates occupationalHealth by capability, not just org role', () => {
  it('still gates the whole function on hospital_admin/infection_control_lead org role (unchanged entry check)', () => {
    expect(migration).toContain("array['hospital_admin','infection_control_lead']::public.app_role[]")
  })

  it('additionally requires the view_occupational_health capability before returning a real occupationalHealth count', () => {
    expect(migration).toContain("'occupationalHealth',(case when p_department_id is null and public.current_user_has_capability(p_organization_id,'view_occupational_health') then")
  })

  it('keeps the pre-existing department-scope null (only adds the capability check alongside it)', () => {
    expect(migration).toContain('p_department_id is null and public.current_user_has_capability')
  })
})
