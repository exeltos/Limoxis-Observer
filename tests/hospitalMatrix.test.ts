// @vitest-environment jsdom
// «Χάρτης τμημάτων» and «Επισημάνσεις» of the hospital's home (owner, 24/11/2026).
import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'
import { departmentMap, homeAlerts, normalizeHospitalMatrix } from '../src/features/dashboard/hospitalMatrixModel'
import { collectDemoDepartmentMatrix } from '../src/features/dashboard/demoDashboardMetrics'
import { departmentHomeWindow } from '../src/features/dashboard/departmentHomeModel'

const matrix = normalizeHospitalMatrix({ hospitalTarget: 80, departments: [
  { department: 'ΜΕΘ', positives: 5, positivesMdr: 2, comparePositives: 3, episodes: 4, compareEpisodes: 1, handHygienePct: 62.4, handHygieneObservations: 40, compareHandHygienePct: 70, handHygieneTarget: 80, lateControls: 0, compareLateControls: 2 },
  { department: 'Καρδιολογική', positives: 0, positivesMdr: 0, comparePositives: 0, episodes: 1, compareEpisodes: 1, handHygienePct: 91, handHygieneObservations: 20, compareHandHygienePct: 88, handHygieneTarget: 80, lateControls: 3, compareLateControls: 3 },
  { department: 'Ορθοπαιδική', positives: null, positivesMdr: null, comparePositives: null, episodes: null, compareEpisodes: null, handHygienePct: null, handHygieneObservations: 0, compareHandHygienePct: null, handHygieneTarget: 75, lateControls: 0, compareLateControls: 0 },
] })
const columns = ['positives', 'episodes', 'handHygiene', 'lateControls', 'capa', 'certificates'] as const

describe('«Χάρτης τμημάτων» (owner, 24/11/2026)', () => {
  it('colours each cell and marks the change from the comparison period', () => {
    const [icu] = departmentMap(matrix, [{ department: 'ΜΕΘ', controls: 0, capa: 1, certificates: 0, total: 1 }], { columns: [...columns], comparing: true })
    expect(icu.department).toBe('ΜΕΘ')
    expect(icu.cells.positives).toMatchObject({ text: '5 (2)', tone: 'bad', trend: 'up', worse: true })
    expect(icu.cells.episodes).toMatchObject({ text: '4', tone: 'bad', trend: 'up' })
    expect(icu.cells.handHygiene).toMatchObject({ text: '62%', tone: 'bad', trend: 'down', worse: true })
    expect(icu.cells.lateControls).toMatchObject({ text: '0', tone: 'good', trend: 'down', worse: false })
    expect(icu.cells.capa).toMatchObject({ text: '1', tone: 'bad' })
    expect(icu.cells.certificates).toMatchObject({ text: '0', tone: 'good' })
  })
  it('puts the departments that need attention first and shows no arrows without a comparison', () => {
    const rows = departmentMap(matrix, null, { columns: [...columns], comparing: false })
    expect(rows.map(row => row.department)).toEqual(['ΜΕΘ', 'Καρδιολογική', 'Ορθοπαιδική'])
    expect(rows.every(row => Object.values(row.cells).every(cell => cell.trend === null))).toBe(true)
    expect(rows[2].cells.handHygiene).toMatchObject({ text: '—', tone: 'none' })
    expect(rows[1].cells.lateControls).toMatchObject({ tone: 'warn' })
  })
  it('adds the departments that only have overdue items today and keeps only the columns asked for', () => {
    const rows = departmentMap(matrix, [{ department: 'ΤΕΠ', controls: 2, capa: 0, certificates: 3, total: 5 }], { columns: ['handHygiene', 'certificates'], comparing: true })
    const ed = rows.find(row => row.department === 'ΤΕΠ')
    expect(ed?.cells.certificates).toMatchObject({ text: '3', tone: 'bad' })
    expect(Object.keys(rows[0].cells).sort()).toEqual(['certificates', 'handHygiene'])
  })
})

describe('«Επισημάνσεις» (owner, 24/11/2026)', () => {
  it('lists possible clusters, the departments under their hand hygiene target, then the decisions', () => {
    const alerts = homeAlerts({
      clusters: [{ department: 'ΜΕΘ', organism: 'Klebsiella pneumoniae', count: 4, windowDays: 14 }],
      matrix,
      decisions: [{ key: 'pendingApprovals', title: 'Αντιμικροβιακές προς έγκριση', count: 2, to: '/pharmacy', urgent: false }],
    })
    expect(alerts.map(alert => alert.key)).toEqual(['cluster:ΜΕΘ:Klebsiella pneumoniae', 'handHygieneBelow', 'pendingApprovals'])
    expect(alerts[0]).toMatchObject({ title: 'Πιθανή συρροή: Klebsiella pneumoniae', detail: 'ΜΕΘ · 4 ασθενείς σε 14 ημέρες', to: '/surveillance?tab=outbreaks', tone: 'danger' })
    expect(alerts[1]).toMatchObject({ detail: 'ΜΕΘ 62% (στόχος 80%)', count: 1 })
    expect(alerts[2]).toMatchObject({ tone: 'warning', count: 2 })
  })
  it('links a cluster only to a screen the user may open', () => {
    const [alert] = homeAlerts({ clusters: [{ department: 'ΜΕΘ', organism: 'A. baumannii', count: 3 }], matrix: null, decisions: [], canOpen: to => to === '/surveillance', language: 'en' })
    expect(alert).toMatchObject({ title: 'Possible cluster: A. baumannii', to: '/surveillance', detail: 'ΜΕΘ · 3 patients in 14 days' })
  })
})

describe('the Demo map and the database read', () => {
  it('counts each Demo department as «Το τμήμα μου» counts it', () => {
    const demo = collectDemoDepartmentMatrix({ window: departmentHomeWindow('month', '2026-11-24') })
    expect(demo.departments.length).toBeGreaterThan(2)
    expect(demo.departments.some(row => row.department === 'ΜΕΘ')).toBe(true)
  })
  it('reads hospital_department_period_matrix for the administrator, infection control and quality, without laboratory or surveillance for quality', () => {
    const sql = readSource('supabase/migrations/20261231638000_hospital_department_period_matrix.sql')
    expect(sql).toContain("array['infection_control_lead', 'infection_control_member', 'quality_manager']::public.app_role[]")
    expect(sql).toContain("v_disabled := v_disabled || array['laboratory', 'surveillance'];")
    expect(sql).toContain('security definer')
    const overview = readSource('supabase/migrations/20261231639000_department_home_period_infection_quality_roles.sql')
    expect(overview).toContain("'doctor_reviewer', 'quality_manager']::public.app_role[])) then")
    expect(overview).toContain("if cardinality(v_departments) = 0 and public.current_user_has_org_role(p_organization_id, array['infection_control_lead', 'infection_control_member', 'quality_manager']::public.app_role[]) then")
    const page = readSource('src/features/dashboard/DashboardPage.tsx')
    expect(page).toContain('const HOSPITAL_HOME_ROLES: ReadonlySet<string>=new Set([ROLES.HOSPITAL_ADMIN,ROLES.INFECTION_CONTROL_LEAD,ROLES.INFECTION_CONTROL_MEMBER,ROLES.QUALITY_MANAGER])')
    expect(page).toContain('const clinicalHome=role!==ROLES.QUALITY_MANAGER')
  })
})

describe('the Codex findings on the hospital home (PR #705)', () => {
  it('keeps the severe open incidents among the alerts, urgent', async () => {
    const { otherDecisionItems } = await import('../src/features/dashboard/adminHomeModel')
    expect(otherDecisionItems({ severeOpenIncidents: 2 })).toEqual([{ key: 'severeOpenIncidents', title: 'Σοβαρά ανοικτά συμβάντα', count: 2, to: '/quality', urgent: true }])
  })
  it('clears the previous hospital\'s clusters and feeds every department\'s overdue items to the map', () => {
    const page = readSource('src/features/dashboard/DashboardPage.tsx')
    expect(page).toContain('    setClusters(null)\n    if(!clustersOn)')
    expect(page).toContain('departmentsNeedingAttention(adminCountEvents,calendarSources?.training,Number.POSITIVE_INFINITY,adminNow)')
  })
})
