import { describe, expect, it } from 'vitest'
import { historyChartHtml, objectiveSection, objectivesDossier } from '../src/features/quality/review/objectiveDossier'
import { dossierIndicatorResult, manualForYear, missingDataTable, platformIndicatorsTable } from '../src/features/quality/review/dossierIndicators'

const objective = (extra = {}) => ({ id: 'o1', code: 'QO-2026-01', year: 2026, title: 'Μέση διάρκεια νοσηλείας έως 12 ημέρες', direction: 'lower', target: 12, unit: 'ημέρες', ownerLabel: 'Διευθυντής', dueDate: '2026-12-31', indicator: null, register: null, current: { value: 24.4, status: 'missed' }, ...extra })
const history = [{ month: 1, value: 25.9 }, { month: 2, value: 21.1 }, { month: 3, value: 11 }]

describe('the quality objectives file for the auditor', () => {
  it('has the objective, its months and a chart with the target', () => {
    const section = objectiveSection(objective(), history, 'el')
    expect(section.title).toContain('QO-2026-01')
    expect(section.table.rows).toHaveLength(3)
    expect((section.table.rows[2][2] as { text: string }).text).toBe('Επιτυγχάνεται')
    expect(historyChartHtml(objective(), history, 'el')).toContain('stroke-dasharray')
    expect(historyChartHtml(objective(), [history[0]], 'el')).toBe('')
  })
  it('lists the year\'s objectives with their counts and the last decided review', () => {
    const doc = objectivesDossier({ objectives: [objective(), objective({ id: 'o2', code: 'QO-2025-01', year: 2025 })], histories: new Map([['o1', history]]), reviews: [{ code: 'MR-1', status: 'draft', reviewDate: '2026-12-01', actions: [] }, { code: 'MR-2', status: 'completed', reviewDate: '2026-06-01', summary: 'Σύνοψη', actions: [{ title: 'Ενέργεια', ownerLabel: 'Υπεύθυνος', dueDate: '2026-09-01', status: 'open' }] }], year: 2026, language: 'el' })
    expect(doc.title).toBe('Στόχοι και δείκτες 2026')
    expect(doc.meta[0]).toEqual(['Στόχοι', '1'])
    expect(doc.sections[0].title).toBe('Σύνοψη')
    expect(doc.sections[1].title).toBe('Στόχοι νοσοκομείου')
    expect(doc.sections[1].table.rows).toHaveLength(1)
    expect(doc.sections.at(-2).title).toContain('MR-2')
    expect(doc.sections.at(-1).title).toBe('Δεδομένα που λείπουν')
    expect(objectivesDossier({ objectives: [], histories: new Map(), reviews: [], year: 2026, language: 'en' }).sections.at(-2).text).toMatch(/No management review/)
  })
  it('holds every objective: the departments\' and the committees\' annual plans, the year\'s indicators and the surveys', () => {
    const department = objective({ id: 'o3', code: 'QO-2026-03', level: 'department', registerId: 'r1' })
    const plan = { id: 'p1', committeeName: 'Επιτροπή Λοιμώξεων', title: 'Μείωση CLABSI', indicator: 'CLABSI', baseline: '2,4', target: '< 1,5', ownerLabel: 'ΕΝΛ', dueDate: '2026-12-31', status: 'in_progress', year: 2026 }
    const extras = { year: 2026, indicatorRows: [{ def: { id: 'who-hh', titleEl: 'Συμμόρφωση Υγιεινής Χεριών WHO', unit: '%', target: 85, direction: 'higher' }, value: 79.1 }], surveyRows: [{ survey: { code: 'SRV-1', title: 'Ικανοποίηση' }, summary: { responses: 10, satisfied: 90, target: 80, nps: 20 } }] }
    const hospital = objective({ platformIndicatorKey: 'who-hh', target: 80, direction: 'higher', unit: '%' })
    const doc = objectivesDossier({ objectives: [hospital, department], committeeTargets: [plan], histories: new Map(), reviews: [], extras, year: 2026, language: 'el' })
    const titles = doc.sections.map(section => section.title)
    expect(titles).toContain('Στόχοι τμημάτων')
    // The committees' annual plans are grouped under their committee (one table per place, no months).
    expect(titles).toContain('Στόχοι επιτροπών')
    expect(titles).toContain('Επιτροπή Λοιμώξεων (1)')
    expect(titles).not.toContain('Οι δείκτες του 2026')
    expect(titles).toContain('Ερωτηματολόγια ικανοποίησης')
    // The platform's indicators have their own reports: the file holds the objectives, the registers and the surveys.
    expect(doc.meta[0]).toEqual(['Στόχοι', '3'])
  })
  it('shows the numerator and denominator, and what is missing where an indicator has no value', () => {
    const clabsi = { id: 'clabsi', titleEl: 'CLABSI', numerator: 'clabsi_events', denominator: 'central_line_days', multiplier: 1000, unit: '/1.000', calculation: 'auto' }
    const hh = { id: 'hh', titleEl: 'Υγιεινή χεριών', numerator: 'hh_compliant_actions', denominator: 'hh_opportunities', multiplier: 100, unit: '%', target: 80, direction: 'higher', calculation: 'auto' }
    const ssi = { id: 'ssi-rate', titleEl: 'ΛΧΠ', numerator: 'ssi_episodes', denominator: 'patient_days', multiplier: 1000, calculation: 'auto' }
    const eody = { id: 'eody', titleEl: 'Πληρότητα ΕΟΔΥ', unit: '%', calculation: 'manual' }
    const metrics = { clabsi_events: 2, central_line_days: 0, hh_compliant_actions: 109, hh_opportunities: 130, ssi_episodes: 3, patient_days: 5000 }
    const rows = [clabsi, hh, ssi, eody].map(def => ({ def, ...dossierIndicatorResult(def, metrics, def.id === 'eody' ? manualForYear([{ indicator_key: 'eody', calculation_type: 'manual', period_start: '2026-01-01', period_end: '2026-06-30', value: 92 }], 'eody', 2026) : null) }))
    const table = platformIndicatorsTable(rows, [], 'el')
    expect(table.rows[0][4].text).toBe('Δεν καταγράφονται ημέρες κεντρικού καθετήρα')
    expect(table.rows[1][1]).toBe('83,8%')
    expect(table.rows[1][2]).toBe('109 / 130')
    expect(table.rows[2][1]).toBe('—')
    expect(table.rows[2][4].text).toBe('Δεν καταγράφονται χειρουργικές επεμβάσεις')
    expect(table.rows[3][1]).toBe('92%')
    expect(table.rows[3][2]).toContain('Καταχώριση')
    const missing = missingDataTable({ indicatorRows: rows, objectives: [{ code: 'QO-1', current: { value: null } }] }, 'el')
    expect(missing.rows.map(row => row[0])).toEqual(['Δεν καταγράφονται ημέρες κεντρικού καθετήρα', 'Δεν καταγράφονται χειρουργικές επεμβάσεις', 'Στόχοι χωρίς τιμή ακόμα'])
  })
})
