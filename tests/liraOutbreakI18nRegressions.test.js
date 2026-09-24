import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

// User-reported: reviewing LIRA alongside Quality/Employees/Prevention
// before merge surfaced several outbreak-investigation strings that were
// hardcoded in English regardless of the language toggle — including some
// that were already wrapped in an `en?'X':'Y'` ternary but used the exact
// same English text for both branches (a translation that was never
// actually written). Status/priority/classification codes were also shown
// to the user as raw internal values (e.g. "medium", "suspected") instead
// of a translated label.
describe('the LIRA outbreak investigation panel and its printable report translate every label, not just some', () => {
  const panel = fs.readFileSync('src/features/management/LiraOutbreakInvestigationsPanel.jsx', 'utf8')
  const report = fs.readFileSync('src/features/lira/LiraOutbreakReport.jsx', 'utf8')

  it('no longer has a bare, untranslated "Case definition" label', () => {
    expect(panel).not.toContain('<span>Case definition</span>')
    expect(panel).not.toContain('<th>Case definition</th>')
    expect(report).not.toContain('<span>Case definition</span>')
  })

  it('no longer has a ternary that renders the same English text for both languages', () => {
    expect(panel).not.toContain("en?'Candidates':'Candidates'")
    expect(report).not.toContain("en?'Candidates':'Candidates'")
  })

  it('translates action status, priority, action type, and case classification codes instead of showing them raw', () => {
    expect(panel).toContain('const actionStatusLabel=')
    expect(panel).toContain('const priorityLabel=')
    expect(panel).toContain('const actionTypeLabel=')
    expect(panel).toContain('const classificationLabel=')
    expect(panel).toContain('{priorityLabel(a.priority,en)}')
    expect(panel).toContain('classificationLabel(human.classification,en)')
  })

  it('the printable report translates the investigation status badge, case classifications, and action status instead of the raw code', () => {
    expect(report).toContain('statusLabel(investigation.status,en)')
    expect(report).toContain('classificationLabel(r.classification,en)')
    expect(report).toContain('actionStatusLabel(a.status,en)')
  })
})
