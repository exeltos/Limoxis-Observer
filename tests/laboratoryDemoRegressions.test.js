import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

// User-reported style regression review of the Laboratory module (same pass
// as Committees/Training/Indicators/Analysis): the employee-surveillance
// dialog's "laboratory request" Edit/Cancel/Delete actions call
// laboratoryRequestManagementService, which is Supabase-only (assertCloud()
// throws "Supabase is not configured." whenever supabase is null, i.e.
// always in a demo tenant). The menu was shown purely from a capability
// check with no isDemo gate, so a demo user saw working-looking actions
// that threw a generic cloud error on click.
describe('the employee laboratory-request actions are hidden in demo tenants (Supabase-only service)', () => {
  const dialog = fs.readFileSync('src/features/surveillance/EmployeeSurveillanceRecordDialog.jsx', 'utf8')

  it('reads isDemo from tenant context', () => {
    expect(dialog).toContain('const {role,membership,isDemo}=useTenant()')
  })

  it('gates the manage-lab capability (and therefore the request actions menu) behind !isDemo', () => {
    expect(dialog).toContain('const canManageLab=!isDemo&&can(role,CAPABILITIES.MANAGE_LAB_SAMPLES')
  })
})
