// @vitest-environment jsdom
// «Το τμήμα μου» of the Department Manager (owner, 20/11/2026): five figures, two charts and three
// cards for the manager's department (the middle one: the department's register, or its incidents); locked modules are not shown; a hospital reads one RPC
// (department_home_overview) and a failed read never shows the Demo's figures; the Link Nurse keeps
// the previous home.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readSource } from './helpers/readSource'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'
import { monthKeys, monthlyHandHygieneSeries, normalizeDepartmentHome, organismSummary, weekStarts, weeklyPositiveSeries } from '../src/features/dashboard/departmentHomeModel'
import { countDepartmentIncidents } from '../src/features/dashboard/departmentFocusService'

let tenant
vi.mock('../src/core/tenant/TenantContext', () => ({ useTenant: () => tenant }))
vi.mock('../src/core/notifications/NotificationContext', () => ({
  useNotifications: () => ({ operational: [], visibleAnnouncements: [], notificationItems: [], unreadCount: 0, markRead: () => {}, markAllRead: () => {} }),
}))
vi.mock('../src/features/quality/review/QualityObjectives', () => ({ useObjectives: () => ({ objectives: [] }) }))
vi.mock('../src/features/calendar/useCalendarSources', () => ({ calendarKindsFor: () => [], useCalendarSources: () => null }))
vi.mock('../src/features/laboratory/hooks/useSamplesAwaitingReview', () => ({ useSamplesAwaitingReview: () => ({ rows: [], loading: false }) }))
vi.mock('../src/features/dashboard/dashboardCloudService', () => ({
  loadDashboardMetrics: async () => ({ overdueControls: 3 }),
  readStoredDashboardMetrics: async () => null,
}))
const loadOverview = vi.fn()
vi.mock('../src/features/dashboard/departmentHomeService', () => ({ loadDepartmentHomeOverview: (...args) => loadOverview(...args) }))

const { collectDemoDepartmentHome } = await import('../src/features/dashboard/demoDashboardMetrics')
const { MyDepartmentPage } = await import('../src/features/workspaces/MyDepartmentPage')
const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')

vi.setConfig({ testTimeout: 20000 })
beforeEach(() => { loadOverview.mockReset() })
afterEach(() => { cleanup(); configureDataEnvironment({ mode: 'production' }) })

describe('the series of the department home', () => {
  it('counts 12 Monday-to-Sunday weeks up to the current one', () => {
    const weeks = weekStarts('2026-11-20')
    expect(weeks).toHaveLength(12)
    expect(weeks.at(-1)).toBe('2026-11-16')
    expect(weeks[0]).toBe('2026-08-31')
    expect(weeks.every(day => new Date(`${day}T00:00:00Z`).getUTCDay() === 1)).toBe(true)
  })
  it('puts each positive sample in its week, MDR/XDR apart from the others', () => {
    const rows = weeklyPositiveSeries([
      { day: '2026-11-16', mdr: true }, { day: '2026-11-20', mdr: false }, { day: '2026-11-22', mdr: false },
      { day: '2026-08-31', mdr: false }, { day: '2026-08-30', mdr: true },
    ], '2026-11-20')
    expect(rows.at(-1)).toEqual({ week: '2026-11-16', mdr: 1, other: 1 })
    expect(rows[0]).toEqual({ week: '2026-08-31', mdr: 0, other: 1 })
    expect(rows.reduce((sum, row) => sum + row.mdr + row.other, 0)).toBe(3)
  })
  it('adds hand hygiene up by month, with no percentage for a month without observations', () => {
    expect(monthKeys('2026-01-10')).toEqual(['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01'])
    const rows = monthlyHandHygieneSeries([
      { day: '2026-11-03', observations: 10, compliant: 8 }, { day: '2026-11-12', observations: 10, compliant: 9 },
      { day: '2026-09-01', observations: 4, compliant: 4 }, { day: '2026-04-01', observations: 9, compliant: 1 },
    ], '2026-11-20')
    expect(rows.map(row => row.month)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'])
    expect(rows.at(-1)).toMatchObject({ observations: 20, compliant: 17, pct: 85 })
    expect(rows[3].pct).toBe(100)
    expect(rows[4].pct).toBeNull()
  })
  it('fills the weeks and months the database left out and keeps null for locked modules', () => {
    const overview = normalizeDepartmentHome({ inpatients: 4, handHygienePct: null, activeSurveillance: null, weeklyPositives: [{ week: '2026-11-16', mdr: 2, other: 1 }], monthlyHandHygiene: [{ month: '2026-11', observations: 5, compliant: 4 }], organisms30: [{ organism: ' Klebsiella pneumoniae ', count: 3, mdr: 2 }, { organism: '', count: 1, mdr: 0 }], organismsOtherCount: 2, patients30: 3 }, '2026-11-20')
    expect(overview.weeklyPositives).toHaveLength(12)
    expect(overview.weeklyPositives.at(-1)).toEqual({ week: '2026-11-16', mdr: 2, other: 1 })
    expect(overview.monthlyHandHygiene.at(-1)).toMatchObject({ pct: 80 })
    expect(overview.activeSurveillance).toBeNull()
    expect(overview.handHygieneTarget).toBe(80)
    expect(overview.organisms30).toEqual([{ organism: 'Klebsiella pneumoniae', count: 3, mdr: 2 }])
    expect(overview).toMatchObject({ organismsOtherCount: 2, patients30: 3, organisms30Count: null })
    expect(overview).not.toHaveProperty('latestPositives')
  })
  it('counts the organisms of the positives: distinct patients and kinds, the 4 most frequent and the rest together', () => {
    const summary = organismSummary([
      { patient: 'p1', organism: 'Klebsiella pneumoniae', mdr: true }, { patient: 'p2', organism: 'Klebsiella pneumoniae ', mdr: false },
      { patient: 'p2', organism: 'Acinetobacter baumannii', mdr: true }, { patient: 'p3', organism: 'Escherichia coli', mdr: false },
      { patient: 'p4', organism: 'Pseudomonas aeruginosa', mdr: false }, { patient: 'p5', organism: 'Candida albicans', mdr: false },
      { patient: 'p5', organism: 'Serratia marcescens', mdr: false }, { patient: 'p6', organism: null, mdr: false },
    ])
    expect(summary).toEqual({
      patients30: 6, organisms30Count: 6, organismsOtherCount: 2,
      organisms30: [{ organism: 'Klebsiella pneumoniae', count: 2, mdr: 1 }, { organism: 'Acinetobacter baumannii', count: 1, mdr: 1 }, { organism: 'Candida albicans', count: 1, mdr: 0 }, { organism: 'Escherichia coli', count: 1, mdr: 0 }],
    })
  })
})

describe('the Demo department home', () => {
  it('counts the ICU from the sample records the other Demo screens show', () => {
    configureDataEnvironment({ mode: 'demo' })
    const icu = collectDemoDepartmentHome({ department: 'ΜΕΘ', now: new Date('2026-08-29T12:00:00+03:00') })
    expect(icu.inpatients).toBeGreaterThan(0)
    expect(icu.positives30).toBeGreaterThan(0)
    expect(icu.positivesMdr30).toBeLessThanOrEqual(icu.positives30)
    expect(icu.positivesAwaiting30).toBeLessThanOrEqual(icu.positives30)
    expect(icu.weeklyPositives).toHaveLength(12)
    expect(icu.monthlyHandHygiene).toHaveLength(6)
    expect(icu.handHygienePct).toBeGreaterThan(0)
    expect(icu.organisms30.length).toBeGreaterThan(0)
    expect(icu.organisms30.length).toBeLessThanOrEqual(4)
    expect(icu.organisms30.reduce((sum, row) => sum + row.count, 0) + icu.organismsOtherCount).toBeLessThanOrEqual(icu.positives30)
    expect(icu.organisms30.map(row => row.count)).toEqual([...icu.organisms30.map(row => row.count)].sort((a, b) => b - a))
    expect(icu.patients30).toBeGreaterThan(0)
    expect(icu.patients30).toBeLessThanOrEqual(icu.positives30)
    expect(JSON.stringify(icu)).not.toMatch(/"patient"|sampleCode/)
    expect(icu).toMatchObject({ pendingRosterRequests: 2, trainingPct: 94, fluPct: 71 })
    const none = collectDemoDepartmentHome({ department: 'Καμία', now: new Date('2026-08-29T12:00:00+03:00') })
    expect(none).toMatchObject({ inpatients: 0, positives30: 0, handHygienePct: null, organisms30: [], patients30: 0, organisms30Count: 0, pendingRosterRequests: 0 })
  })
})

const open = () => render(<MemoryRouter><LanguageProvider><MyDepartmentPage/></LanguageProvider></MemoryRouter>)
const managerTenant = (overrides = {}) => ({
  role: 'department_manager', actualRole: 'department_manager', isDemo: true, tenant: { id: 'demo-hospital', is_demo: true },
  membership: { previewDepartment: 'ΜΕΘ', capabilities: [], customCapabilities: [] },
  moduleEnabled: () => true, canAccessRecord: () => true, ...overrides,
})

describe('«Το τμήμα μου» of the Department Manager', () => {
  it('shows four figures, the weekly chart with the organisms, and three cards, and no roster card', async () => {
    configureDataEnvironment({ mode: 'demo' })
    tenant = managerTenant()
    const { container } = open()
    await waitFor(() => expect(container.querySelectorAll('.dephome-tile')).toHaveLength(4))
    expect([...container.querySelectorAll('.dephome-tile-label')].map(el => el.textContent)).toEqual(['Θετικά δείγματα (30 ημ.)', 'Σε επιτήρηση / απομόνωση', 'Υγιεινή χεριών', 'Εκπρόθεσμοι έλεγχοι'])
    expect(screen.getByText('Θετικά δείγματα ανά εβδομάδα')).toBeTruthy()
    expect(screen.getByText('Μικρόβια του τμήματος')).toBeTruthy()
    expect([...container.querySelectorAll('.dephome-organism-figures dt')].map(el => el.textContent)).toEqual(['θετικά δείγματα', 'ασθενείς', 'MDR/XDR', 'είδη μικροβίων'])
    // The ICU has a register: its card takes the place of the monthly hand hygiene chart.
    await waitFor(() => expect(container.querySelector('.dephome-focus .lo-card-heading strong')?.textContent).toMatch(/^Μητρώο: /))
    expect(container.querySelectorAll('.dephome-chart svg')).toHaveLength(1)
    expect(container.textContent).not.toContain('Υγιεινή χεριών ανά μήνα')
    expect(container.querySelectorAll('.dephome-cards>.dashboard-card')).toHaveLength(3)
    expect(screen.getByText('Για μένα σήμερα')).toBeTruthy()
    expect(container.textContent).not.toContain('Τελευταία θετικά')
    expect(screen.getByText('Ανακοινώσεις')).toBeTruthy()
    expect(screen.getByText('Το τμήμα (30 ημ.)')).toBeTruthy()
    expect(container.textContent).not.toContain('Σήμερα στη βάρδια')
    expect(loadOverview).not.toHaveBeenCalled()
  })

  it('hides the figures and charts of locked modules', async () => {
    configureDataEnvironment({ mode: 'demo' })
    tenant = managerTenant({ moduleEnabled: module => !['surveillance', 'prevention', 'quality'].includes(module) })
    const { container } = open()
    await waitFor(() => expect(container.querySelectorAll('.dephome-tile')).toHaveLength(2))
    expect(container.textContent).not.toContain('Σε επιτήρηση / απομόνωση')
    expect(container.textContent).not.toContain('Υγιεινή χεριών')
    expect(container.textContent).not.toContain('Πτώσεις / κατακλίσεις')
    expect(container.querySelectorAll('.dephome-chart svg')).toHaveLength(1)
  })

  it('reads the hospital once for the manager\'s departments and shows the error, not the Demo, when it fails', async () => {
    configureDataEnvironment({ mode: 'production' })
    loadOverview.mockRejectedValue(new Error('denied'))
    tenant = managerTenant({ isDemo: false, tenant: { id: 'org-1' }, membership: { departmentIds: ['dep-1'], departmentName: 'Χειρουργική', capabilities: [], customCapabilities: [] } })
    const { container } = open()
    await waitFor(() => expect(screen.getByText('Τα στοιχεία του τμήματος δεν φορτώθηκαν. Δοκιμάστε ξανά σε λίγο.')).toBeTruthy())
    expect(loadOverview).toHaveBeenCalledWith('org-1', ['dep-1'])
    expect(container.querySelectorAll('.dephome-focus-list li')).toHaveLength(0)
    expect(container.querySelector('.dephome-tile-value')?.textContent).toBe('—')
  })

  it('keeps the previous home for the Link Nurse', async () => {
    configureDataEnvironment({ mode: 'demo' })
    tenant = managerTenant({ role: 'link_nurse', actualRole: 'link_nurse' })
    const { container } = open()
    await waitFor(() => expect(screen.getByText('Για μένα σήμερα')).toBeTruthy())
    expect(container.querySelector('.dephome')).toBeNull()
    expect(container.querySelector('.dashboard-home')).not.toBeNull()
    expect(screen.getByText('Ενημερώσεις & ανακοινώσεις')).toBeTruthy()
  })
})

describe('the register or incidents card (owner, 20/11/2026)', () => {
  it('shows the ICU register\'s main indicators this month, worst first, in four lines that never scroll', async () => {
    configureDataEnvironment({ mode: 'demo' })
    tenant = managerTenant()
    const { container } = open()
    await waitFor(() => expect(container.querySelector('.dephome-focus .lo-card-heading strong')?.textContent).toMatch(/^Μητρώο: /))
    const lines = [...container.querySelectorAll('.dephome-focus-list li')]
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.length).toBeLessThanOrEqual(4)
    const rank = { 'Πέρα από το όριο': 0, 'Εκτός στόχου': 1, 'Εντός στόχου': 2 }
    const ranks = lines.map(line => rank[line.querySelector('.status-badge')?.textContent ?? ''] ?? 3)
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
    expect(lines.every(line => line.querySelector('.dephome-focus-copy small')?.textContent)).toBe(true)
    expect(container.querySelector('.dephome-focus .inline-empty')).toBeNull()
    // The falls / pressure ulcers stay in the announcements' footer while the card shows the register.
    expect(screen.getByText('Πτώσεις / κατακλίσεις')).toBeTruthy()
  })

  it('shows hand hygiene per month for a department without a register, the falls staying in the footer', async () => {
    configureDataEnvironment({ mode: 'demo' })
    tenant = managerTenant({ membership: { previewDepartment: 'Καρδιολογική', capabilities: [], customCapabilities: [] } })
    const { container } = open()
    await waitFor(() => expect(screen.getByText('Υγιεινή χεριών ανά μήνα')).toBeTruthy())
    expect(container.querySelectorAll('.dephome-cards>.dashboard-card')).toHaveLength(3)
    expect(container.querySelectorAll('.dephome-chart svg')).toHaveLength(2)
    expect(container.textContent).not.toContain('Μητρώο:')
    expect(container.textContent).not.toContain('Συμβάντα τμήματος')
    expect(screen.getByText('Πτώσεις / κατακλίσεις')).toBeTruthy()
  })

  it('shows the incidents of the last 30 days when there is no register and hand hygiene is locked, and drops falls from the footer', async () => {
    configureDataEnvironment({ mode: 'demo' })
    tenant = managerTenant({ moduleEnabled: module => module !== 'prevention', membership: { previewDepartment: 'Καρδιολογική', capabilities: [], customCapabilities: [] } })
    const { container } = open()
    await waitFor(() => expect(screen.getByText('Συμβάντα τμήματος')).toBeTruthy())
    expect([...container.querySelectorAll('.dephome-focus-list li .dephome-focus-copy strong')].map(el => el.textContent)).toEqual(['Πτώση', 'Έλκη που αναπτύσσονται κατά τη νοσηλεία', 'Φαρμακευτικό λάθος', 'Λοιπά συμβάντα', 'Ανοιχτά (υπό αξιολόγηση)'])
    expect(container.textContent).not.toContain('Πτώσεις / κατακλίσεις')
    expect(container.textContent).not.toContain('Μητρώο:')
  })

  it('counts the reports of 30 days by kind (earlier categories read as their ΟΔΙΠΥ item), suggestions left out', () => {
    const counts = countDepartmentIncidents([
      { category: 'odipy-fall', status: 'reported', at: '2026-11-20' },
      { category: 'fall', status: 'closed', at: '2026-10-22' },
      { category: 'pressureinjury', status: 'under_review', at: '2026-11-01T10:00:00Z' },
      { category: 'odipy-medication', status: 'closed', at: '2026-11-02' },
      { category: 'equipment', status: 'underReview', at: '2026-11-03' },
      { category: 'other', status: 'reported', reportKind: 'suggestion', at: '2026-11-04' },
      { category: 'odipy-fall', status: 'reported', at: '2026-10-21' },
    ], '2026-11-20')
    expect(counts).toEqual({ total: 5, open: 3, falls: 2, pressureUlcers: 1, medication: 1, other: 1 })
  })

  it('keeps the card at a fixed height: no scrolling list inside it', () => {
    const css = readSource('src/features/dashboard/departmentHome.css')
    for (const list of ['dephome-focus-list', 'dephome-organism-list']) {
      const rule = css.match(new RegExp(`\\.${list}\\{[^}]*\\}`))?.[0] || ''
      expect(rule).toContain('overflow:hidden')
      expect(rule).not.toMatch(/overflow(-y)?:\s*(auto|scroll)/)
    }
    expect(css).not.toContain('dephome-latest')
    expect(readSource('src/features/dashboard/DepartmentHome.tsx')).not.toContain('latestPositives')
  })
})

describe('contamination notes are no positives (owner, 20/11/2026)', () => {
  it('leaves a contamination note out of the Demo department home', async () => {
    configureDataEnvironment({ mode: 'demo' })
    const { laboratorySamples } = await import('../src/features/laboratory/laboratoryDemoData')
    const now = new Date('2026-08-29T12:00:00+03:00')
    const before = collectDemoDepartmentHome({ department: 'ΜΕΘ', now })
    const note = { ...laboratorySamples.find(row => row.department === 'ΜΕΘ' && row.result === 'positive'), id: 'LAB-CONTAM-1', organism: 'Επιμόλυνση δείγματος', resistance: 'MDR', collectedAt: '2026-08-28T09:00:00+03:00', status: 'completed' }
    laboratorySamples.push(note)
    try {
      const after = collectDemoDepartmentHome({ department: 'ΜΕΘ', now })
      expect(after.positives30).toBe(before.positives30)
      expect(after.positivesMdr30).toBe(before.positivesMdr30)
      expect(after.weeklyPositives).toEqual(before.weeklyPositives)
    } finally { laboratorySamples.splice(laboratorySamples.indexOf(note), 1) }
  })
  it('leaves it out of department_home_overview, Candida still counting', () => {
    const sql = readSource('supabase/migrations/20261231602000_department_home_contamination.sql')
    expect(sql).toContain("and coalesce(res.organism, '') !~* '(επιμόλυνση|επιμολυνση|contaminat|3\\s+είδ|3\\s+ειδ)'")
    expect(sql.toLowerCase()).not.toContain('^\\s*candida')
    expect(sql).toContain("array['department_manager', 'infection_control_lead', 'infection_control_member', 'doctor_reviewer']::public.app_role[]")
    expect(sql).toContain("array_agg(z.c order by case z.c when 'PDR' then 3 when 'XDR' then 2 else 1 end desc)")
    expect(sql).toContain('revoke all on function public.department_home_overview(uuid, uuid[]) from public, anon;')
  })
  it('returns the organisms as counts only, never a patient\'s name', () => {
    const sql = readSource('supabase/migrations/20261231602000_department_home_contamination.sql').replace(/^--.*$/gm, '')
    for (const key of ["'patients30'", "'organisms30Count'", "'organisms30'", "'organismsOtherCount'"]) expect(sql).toContain(key)
    expect(sql).toContain("nullif(btrim(pos.organism), '')")
    expect(sql).toContain('row_number() over (order by g.n desc, g.organism)')
    expect(sql).not.toMatch(/latestPositives|last_name|first_name|patient_code/)
    expect(sql).not.toMatch(/\b(insert|update|delete|drop|truncate)\b/i)
  })
})

describe('department_home_overview migration', () => {
  const migration = readSource('supabase/migrations/20261231601000_department_home_overview.sql')
  const sql = migration.replace(/^--.*$/gm, '').toLowerCase()
  const manifest = JSON.parse(readSource('supabase/security-definer-manifest.json'))
  it('is a read-only security definer function with an empty search path', () => {
    expect(sql).toContain('create or replace function public.department_home_overview(p_organization_id uuid, p_department_ids uuid[] default null)')
    expect(sql).toContain('stable')
    expect(sql).toContain('security definer')
    expect(sql).toContain("set search_path to ''")
    expect(sql).not.toMatch(/\b(insert|update|delete|drop|alter|truncate)\b/)
  })
  it('requires a signed-in user without a pending password change, in scope of every department asked for', () => {
    expect(sql).toContain('if auth.uid() is null then')
    expect(sql).toContain('private.password_change_pending()')
    expect(sql).toContain('public.current_user_is_platform_owner() or public.is_org_admin(p_organization_id)')
    expect(sql).toContain('public.current_user_has_department_scope(p_organization_id, v_department)')
    expect(sql).toContain("raise exception 'permission_denied'")
    expect(sql).toContain('private.org_disabled_modules(p_organization_id)')
  })
  it('counts in Athens time and with the definitions of the other homes', () => {
    expect(sql).toContain("(now() at time zone 'europe/athens')::date")
    expect(sql).toContain("r.result_status = 'positive'")
    expect(sql).toContain('public.amr_classifications')
    expect(sql).toContain('s.surveillance_case_id is null and s.surveillance_review_status is null')
    expect(sql).toContain("h.status = 'completed'")
    expect(sql).toContain("'hh-compliance'")
  })
  it('is closed to anonymous callers and open to signed-in users, and declared in the manifest', () => {
    expect(sql).toContain('revoke all on function public.department_home_overview(uuid, uuid[]) from public, anon;')
    expect(sql).toContain('grant execute on function public.department_home_overview(uuid, uuid[]) to authenticated;')
    expect(manifest.functions?.department_home_overview ?? manifest.department_home_overview).toMatchObject({ category: 'rpc', authenticated: true })
  })
})

describe('department_home_overview: roles and resistance (Codex review, 20/11/2026)', () => {
  it('lets only the roles that read the department\'s patients in and takes resistance across all positive results', async () => {
    const { readSource } = await import('./helpers/readSource')
    const sql = readSource('supabase/migrations/20261231601000_department_home_overview.sql')
    expect(sql).toContain("array['department_manager', 'infection_control_lead', 'infection_control_member', 'doctor_reviewer']::public.app_role[]")
    expect(sql).toContain("array_agg(z.c order by case z.c when 'PDR' then 3 when 'XDR' then 2 else 1 end desc)")
    expect(sql).toContain('join public.microbiology_results r on r.id = a.microbiology_result_id')
  })
})
