import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { buildSectionModel } from '../src/features/analysis/analysisDomains'
import { mergeDomainMetrics } from '../src/features/analysis/analysisDomainMerge'

const tx = (el) => el
const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const snapshot = {
  microbiology: { totalPositive: 10, totalCritical: 2, resistance: [['MDR', 3], ['XDR', 1]], monthly: [['2026-01', 1], ['2026-03', 2]], byDepartment: [['ΜΕΘ', 4]], departmentCount: 6 },
  domains: {
    surveillance: { total: 6, active: 5, closed: 1, haiConfirmed: 2, haiProbable: 1, byCaseStatus: [['confirmed', 2], ['suspected', 1]], byHaiType: [['bloodstreamInfection', 2]], byDepartment: [['ΜΕΘ', 5]], monthly: [['2026-09', 6]], isolationActive: 1, isolationReviewOverdue: 1, devicesActive: 1 },
    handHygiene: { sessions: 2, observations: 20, compliant: 15, byDepartment: [['ΜΕΘ', 10, 8]], byCategory: [], monthly: [['2026-09', 20, 15]] },
    bundles: { assessments: 2, averageScore: 75, byBundle: [['CLABSI', 2, 75]], byDepartment: [] },
    waste: { records: 1, totalKg: 100, patientDays: 200, byDepartment: [] },
    quality: { incidents: 3, openIncidents: 1, harm: 0, bySeverity: [['high', 1]], byStatus: [], capaOpen: 2, capaOverdue: 1 },
    controls: { executions: 4, completed: 4, withFinding: 1, overdueAssignments: 0, byDepartment: [] },
    antimicrobial: { total: 3, active: 2, pending: 1, byAgent: [['Colistin', 2]], byApproval: [['pending', 1]] },
  },
}

describe('Analysis section model', () => {
  it('computes hand hygiene compliance as a rate, not a record count', () => {
    const model = buildSectionModel('hand', snapshot, tx)
    expect(model.kpis[0]).toEqual(['Συμμόρφωση', '75%', 'στόχος ≥ 80% (ΠΟΥ)', 'warning'])
    expect(model.charts.find(chart => chart.type === 'rate').rows).toEqual([['ΜΕΘ', 80]])
  })

  it('shows confirmed HAI, isolations and translated classification labels', () => {
    const model = buildSectionModel('surveillance', snapshot, tx)
    expect(model.kpis.map(row => row[1])).toEqual([6, 2, 1, 1])
    expect(model.charts.find(chart => chart.type === 'donut').rows).toEqual([['Επιβεβαιωμένη', 2], ['Υπό διερεύνηση', 1]])
    expect(model.charts.find(chart => chart.title === 'Τύπος λοίμωξης (HAI)').rows).toEqual([['Λοίμωξη αιματικής ροής', 2]])
  })

  it('returns null when the section metrics are not available', () => {
    expect(buildSectionModel('surveillance', { microbiology: {} }, tx)).toBeNull()
  })

  it('merges hospitals by summing counts and weighting bundle averages', () => {
    const merged = mergeDomainMetrics([
      { bundles: { assessments: 1, averageScore: 100, byBundle: [['CLABSI', 1, 100]], byDepartment: [] }, surveillance: { total: 2, byDepartment: [['ΜΕΘ', 2]] } },
      { bundles: { assessments: 3, averageScore: 60, byBundle: [['CLABSI', 3, 60]], byDepartment: [] }, surveillance: { total: 1, byDepartment: [['ΜΕΘ', 1]] } },
    ])
    expect(merged.bundles.averageScore).toBe(70)
    expect(merged.surveillance.total).toBe(3)
    expect(merged.surveillance.byDepartment).toEqual([['ΜΕΘ', 3]])
  })

  it('excludes cancelled and voided surveillance in the production metrics', () => {
    const sql = read('supabase/migrations/20260925140000_analysis_domain_metrics.sql')
    expect(sql).toContain("s.voided_at is null and coalesce(s.status,'') <> 'cancelled'")
    expect(sql).toContain("array['hospital_admin','infection_control_lead']")
  })
})

describe('Surveillance screens show names, not ids', () => {
  it('resolves assessment signs and risk factors through the library', () => {
    const page = read('src/features/surveillance/PatientClinicalCanonicalPage.jsx')
    expect(page).toContain('function libraryLabel(value,rows=[],language=\'el\',t=null)')
    expect(page).toContain('rows={libraries.clinicalSymptoms||[]}')
    expect(page).toContain("clinicalTerm(record.assessment.classification||'undetermined',language,t)")
  })

  it('groups the Surveillance Center by patient and hides cancelled episodes by default', () => {
    const page = read('src/features/surveillance/SurveillanceCanonicalPage.jsx')
    expect(page).toContain("const HIDDEN_CASE_STATUSES=new Set(['cancelled','voided','void'])")
    expect(page).toContain('return groupByPatient(cases.filter(')
  })

  it('shows laboratory request materials as labelled choices', () => {
    const dialog = read('src/features/surveillance/EmployeeSurveillanceRecordDialog.jsx')
    expect(dialog).toContain("{id:'nasalSwab',el:'Ρινικό επίχρισμα',en:'Nasal swab'}")
    expect(dialog).toContain('materialLabels(sample.source,en)')
  })
})
