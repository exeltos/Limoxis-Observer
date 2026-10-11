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

describe('Workforce, training and governance sections', () => {
  const snap = { microbiology: {}, domains: {
    workforce: { activeEmployees: 10, vaccinatedEmployees: 8, byVaccine: [['Influenza', 8]], visits: 3, byVisitType: [['periodic', 3]], followUpsDue: 1, byDepartment: [] },
    training: { assignments: 4, completed: 3, overdue: 1, averageScore: 90, byDepartment: [['ΜΕΘ', 2, 1]] },
    governance: { documents: 5, published: 3, reviewOverdue: 1, byType: [['policy', 2]], byStatus: [], committees: 2, meetings: 4, minutesFinalized: 2, minutesPending: 1 },
  } }
  it('reports vaccination coverage and hides it without health permission', () => {
    expect(buildSectionModel('occupational', snap, tx).kpis[1][1]).toBe('80%')
    const restricted = { ...snap, domains: { ...snap.domains, workforce: { ...snap.domains.workforce, vaccinatedEmployees: null } } }
    expect(buildSectionModel('occupational', restricted, tx).kpis[1][1]).toBe('—')
  })
  it('reports training completion and pending minutes', () => {
    expect(buildSectionModel('training', snap, tx).kpis[0][1]).toBe('75%')
    expect(buildSectionModel('training', snap, tx).charts[0].rows).toEqual([['ΜΕΘ', 50]])
    expect(buildSectionModel('governance', snap, tx).kpis[3][1]).toBe(1)
  })
  it('keeps occupational health aggregated and permission-gated in the database', () => {
    const sql = read('supabase/migrations/20260925160000_analysis_people_metrics.sql')
    expect(sql).toContain("public.current_user_has_capability(p_organization_id,'view_occupational_health')")
    expect(sql).toContain("'vaccinatedEmployees',case when can_health then")
  })
})

describe('Platform Owner inside a hospital and LIRA composer', () => {
  it('shows the full hospital dashboard to the Platform Owner inside a hospital', () => {
    const dashboard = read('src/features/dashboard/DashboardPage.jsx')
    expect(dashboard).toContain('actualRole===ROLES.PLATFORM_OWNER&&tenant')
  })
  it('keeps the LIRA chat input free of the generic textarea expander', () => {
    expect(read('src/features/lira/LiraAssistantLauncher.jsx')).toContain('data-limoxis-no-expand="true"')
  })
})

describe('add-on analysis sections', () => {
  const tx = (el) => el
  it('derives PPS prevalence and trend from the surveys', async () => {
    const { buildPpsMetrics } = await import('../src/features/analysis/analysisAddonMetrics')
    const { buildSectionModel } = await import('../src/features/analysis/analysisDomains')
    const pps = buildPpsMetrics([
      { surveyDate: '2026-03-14', patientsTotal: 100, patientsWithHai: 10, patientsOnAntibiotics: 40 },
      { surveyDate: '2026-06-13', patientsTotal: 100, patientsWithHai: 8, patientsOnAntibiotics: 38 },
    ], {})
    const model = buildSectionModel('pps', { domains: { pps } }, tx, key => key)
    expect(model.kpis[0][1]).toBe('8%')
    expect(model.charts[0].points).toEqual([['2026-03', 10], ['2026-06', 8]])
  })
  it('summarizes LIRA investigations with average closing time', async () => {
    const { buildLiraMetrics } = await import('../src/features/analysis/analysisAddonMetrics')
    const { buildSectionModel } = await import('../src/features/analysis/analysisDomains')
    const lira = buildLiraMetrics([
      { status: 'closed', organism: 'KPC', created_at: '2026-05-01T00:00:00Z', closed_at: '2026-05-11T00:00:00Z' },
      { status: 'active', organism: 'KPC', created_at: '2026-06-01T00:00:00Z' },
    ], {}, 2)
    const model = buildSectionModel('lira', { domains: { lira } }, tx, key => key)
    expect(model.kpis[0].slice(1, 3)).toEqual([2, '1 ενεργές'])
    expect(model.kpis[1][2]).toContain('10')
    expect(model.kpis[2][1]).toBe(2)
  })
})
