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

// User-reported: the Laboratory record page's tabs looked visibly
// different from every other canonical record page (Committees, Training,
// Indicators, ...) — smaller text, wrapping onto multiple rows instead of
// the shared single-row scrolling tab bar. Root cause: a leftover
// "v0.14.5 — no-scroll lab tabs" override in core.css, scoped to
// .laboratory-record-shell .entity-record-tabs, predating the later
// canonical-tabs-final.css pass that every other module now relies on.
describe('the Laboratory record tabs use the shared canonical tab style, not a module-specific override', () => {
  it('core.css no longer overrides .laboratory-record-shell .entity-record-tabs', () => {
    const core = fs.readFileSync('src/styles/foundation.css', 'utf8')
    expect(core).not.toContain('.laboratory-record-shell .entity-record-tabs')
  })
})
