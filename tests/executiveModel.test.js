import fs from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { controlRanking, delta, executiveKpis, filtersToQuery, parseFilters, periodRange, previousRange, redFlags, shiftMonths, visibleFor, withDeltas } from '../src/features/executive/executiveModel'

vi.mock('../src/core/supabase/client', () => ({ supabase: null }))
vi.mock('../src/features/platform/platformService', () => ({ loadAnalysisSections: () => { throw new Error('not in tests') } }))

const today = new Date(2026, 9, 19)

describe('executive dashboard periods', () => {
  it('computes each preset up to today', () => {
    expect(periodRange({ period: 'month' }, today)).toEqual({ from: '2026-10-01', to: '2026-10-19' })
    expect(periodRange({ period: '3m' }, today)).toEqual({ from: '2026-08-01', to: '2026-10-19' })
    expect(periodRange({ period: '6m' }, today)).toEqual({ from: '2026-05-01', to: '2026-10-19' })
    expect(periodRange({ period: '12m' }, today)).toEqual({ from: '2025-11-01', to: '2026-10-19' })
    expect(periodRange({ period: 'year' }, today)).toEqual({ from: '2026-01-01', to: '2026-10-19' })
    expect(periodRange({ period: 'custom', from: '2026-03-10', to: '2026-02-01' }, today)).toEqual({ from: '2026-02-01', to: '2026-03-10' })
    expect(periodRange({ period: 'nonsense' }, today)).toEqual({ from: '2026-08-01', to: '2026-10-19' })
  })
  it('compares with the same calendar span before, or the same number of days for custom dates', () => {
    expect(previousRange({ from: '2026-10-01', to: '2026-10-19' }, 'month')).toEqual({ from: '2026-09-01', to: '2026-09-19' })
    expect(previousRange({ from: '2026-08-01', to: '2026-10-19' }, '3m')).toEqual({ from: '2026-05-01', to: '2026-07-19' })
    expect(previousRange({ from: '2026-01-01', to: '2026-10-19' }, 'year')).toEqual({ from: '2025-01-01', to: '2025-10-19' })
    expect(previousRange({ from: '2026-03-01', to: '2026-03-10' }, 'custom')).toEqual({ from: '2026-02-19', to: '2026-02-28' })
    expect(shiftMonths('2026-03-31', 1)).toBe('2026-02-28')
  })
  it('keeps the filters in the URL query, defaults left out', () => {
    expect(filtersToQuery({ period: '3m', department: '', compare: true })).toBe('')
    const query = filtersToQuery({ period: 'custom', from: '2026-01-01', to: '2026-02-01', department: 'd1', compare: false })
    expect(parseFilters(query)).toEqual({ period: 'custom', from: '2026-01-01', to: '2026-02-01', department: 'd1', compare: false })
    expect(parseFilters('?period=year&from=2026-01-01')).toEqual({ period: 'year', from: '', to: '', department: '', compare: true })
  })
})

const snapshot = {
  domains: {
    surveillance: { total: 20, active: 4, haiConfirmed: 2, isolationReviewOverdue: 1 },
    handHygiene: { observations: 100, compliant: 72 },
    bundles: { assessments: 5, averageScore: 93 },
    controls: { executions: 200, completed: 190, overdueAssignments: 0, byDepartment: [['ΜΕΘ', 50, 5], ['ΤΕΠ', 40, 0], ['Παθολογική', 30, 9], ['Μικρό', 2, 2]] },
    quality: { incidents: 6, openIncidents: 3, bySeverity: [['critical', 1], ['low', 5]], capaOpen: 4, capaOverdue: 2 },
    training: { assignments: 50, completed: 40, overdue: 6 },
    workforce: { activeEmployees: 417 },
    governance: { committees: 5, reviewOverdue: 3, minutesPending: 0 },
    qualityFood: { certificatesExpired: 0, certificatesExpiring: 2, thermalOut: 1, thermalMeasured: 40, receiptsOut: 0, receipts: 10 },
  },
  microbiology: { totalPositive: 30, resistance: [['MDR', 4], ['XDR', 1], ['S', 25]] },
  clusters: [{ organism: 'K. pneumoniae' }],
}
const byId = items => Object.fromEntries(items.map(item => [item.id, item]))

describe('executive dashboard measures', () => {
  it('builds values and traffic lights', () => {
    const k = byId(executiveKpis(snapshot, { openDecisions: 69, overdueDecisions: 0 }))
    expect(k.mdro.value).toBe(5)
    expect(k.handHygiene).toMatchObject({ value: 72, tone: 'warning' })
    expect(k.bundles.tone).toBe('good')
    expect(k.incidents.tone).toBe('danger')
    expect(k.capaOverdue).toMatchObject({ value: 2, tone: 'warning' })
    expect(k.training).toMatchObject({ value: 80, tone: 'warning' })
    expect(k.temperature).toMatchObject({ value: 1, tone: 'warning' })
    expect(k.decisions).toMatchObject({ value: 69, tone: 'good' })
    expect(k.staff.value).toBe(417)
    expect(executiveKpis({}, null).find(item => item.id === 'handHygiene')).toMatchObject({ value: null, tone: 'neutral' })
  })
  it('computes the change against the previous period, never for the counts of today', () => {
    expect(delta(72, 80, 'up')).toEqual({ diff: -8, change: -10, trend: 'down', good: false })
    expect(delta(2, 4, 'down')).toMatchObject({ trend: 'down', good: true, change: -50 })
    expect(delta(3, 0, 'down')).toMatchObject({ diff: 3, change: null, good: false })
    expect(delta(5, 5)).toMatchObject({ trend: 'flat', good: null })
    expect(delta(null, 5)).toBeNull()
    const previous = executiveKpis({ ...snapshot, domains: { ...snapshot.domains, handHygiene: { observations: 100, compliant: 80 } } })
    const k = byId(withDeltas(executiveKpis(snapshot), previous))
    expect(k.handHygiene.delta).toMatchObject({ diff: -8, good: false })
    expect(k.capaOverdue.delta).toBeNull()
    expect(byId(withDeltas(executiveKpis(snapshot), null)).hai.delta).toBeNull()
  })
  it('hides the measures of modules that are off', () => {
    const ids = visibleFor(executiveKpis(snapshot), module => module !== 'kitchen' && module !== 'prevention').map(item => item.id)
    expect(ids).not.toContain('temperature')
    expect(ids).not.toContain('handHygiene')
    expect(ids).toContain('certificates')
    expect(ids).toContain('staff')
  })
  it('ranks departments by finding rate, leaving out the ones with few executions', () => {
    const { best, worst } = controlRanking(snapshot.domains.controls.byDepartment)
    expect(best.map(row => row.name)).toEqual(['ΤΕΠ', 'ΜΕΘ', 'Παθολογική'])
    expect(best[1].rate).toBe(10)
    expect(worst).toEqual([])
    const many = controlRanking(Array.from({ length: 12 }, (_, i) => [`T${i}`, 10, i]))
    expect(many.best.map(row => row.name)).toEqual(['T0', 'T1', 'T2', 'T3', 'T4'])
    expect(many.worst.map(row => row.name)).toEqual(['T11', 'T10', 'T9', 'T8', 'T7'])
  })
  it('lists what needs attention, the most serious first, only for modules that are on', () => {
    const flags = redFlags(executiveKpis(snapshot, { openDecisions: 1, overdueDecisions: 0 }), snapshot)
    const ids = flags.map(flag => flag.id)
    expect(ids).toEqual(expect.arrayContaining(['incidents', 'mdro', 'clusters', 'handHygiene', 'capaOverdue', 'isolationReviews', 'documentReviews', 'trainingOverdue']))
    expect(ids).not.toContain('bundles')
    expect(ids).not.toContain('minutesPending')
    expect(flags.findIndex(flag => flag.severity === 'warning')).toBeGreaterThan(flags.findLastIndex(flag => flag.severity === 'danger'))
    expect(flags.find(flag => flag.id === 'handHygiene').text).toEqual(['Υγιεινή χεριών: 72%', 'Hand hygiene: 72%'])
    expect(redFlags(executiveKpis(snapshot), snapshot, module => module !== 'laboratory' && module !== 'surveillance').map(flag => flag.id)).not.toContain('clusters')
  })
})

describe('executive dashboard reads', () => {
  it('keeps one load per organization, period and department for a short while', async () => {
    const { loadExecutiveParts, clearExecutiveCache, CACHE_TTL_MS } = await import('../src/features/executive/executiveService')
    clearExecutiveCache()
    const loader = vi.fn(() => ({ domains: Promise.resolve({}) }))
    const args = { organizationId: 'o', from: '2026-01-01', to: '2026-02-01', departmentId: '' }
    const first = loadExecutiveParts(args, { now: 0, loader })
    expect(loadExecutiveParts(args, { now: 1000, loader })).toBe(first)
    loadExecutiveParts({ ...args, departmentId: 'd' }, { now: 1000, loader })
    loadExecutiveParts(args, { now: CACHE_TTL_MS + 1, loader })
    expect(loader).toHaveBeenCalledTimes(3)
    const failing = vi.fn(() => ({ domains: Promise.reject(new Error('x')) }))
    const broken = loadExecutiveParts({ ...args, organizationId: 'b' }, { now: 0, loader: failing })
    await broken.domains.catch(() => {})
    await Promise.resolve()
    loadExecutiveParts({ ...args, organizationId: 'b' }, { now: 1, loader: failing })
    expect(failing).toHaveBeenCalledTimes(2)
  })
  it('lets the Director into Analysis, and grants the analysis RPCs to the director role', () => {
    const page = fs.readFileSync('src/features/analysis/AnalysisPage.jsx', 'utf8')
    expect(page).toContain('ROLES.HOSPITAL_DIRECTOR,ROLES.DEMO].includes(role)')
    const sql = fs.readFileSync('supabase/migrations/20261128400000_executive_director_analysis_access.sql', 'utf8')
    for (const fn of ['analysis_domain_metrics', 'analysis_people_metrics', 'analysis_quality_food_metrics', 'analysis_crosstab_metrics', 'platform_report_summary', 'detect_organism_clusters']) expect(sql).toContain(fn)
    expect(sql).toContain("raise exception '%: role array not found exactly once (%)'")
    expect((sql.match(/'doctor_reviewer','hospital_director'\]::public\.app_role\[\]/g) || []).length).toBe(2)
  })
})
