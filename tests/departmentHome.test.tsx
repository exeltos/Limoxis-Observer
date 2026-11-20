// @vitest-environment jsdom
// «Το τμήμα μου» of the Department Manager (owner, 20/11/2026): four figures, two charts and three
// cards for the manager's department (the middle one: the department's register, or its incidents); locked modules are not shown; a hospital reads one RPC
// (department_home_overview) and a failed read never shows the Demo's figures; the Link Nurse has the
// user's home (userHome.test.tsx). The figures, charts, organisms and register follow a period (Μήνας | Τρίμηνο | Εξάμηνο | Έτος)
// with its comparison (the previous period or the same period last year).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readSource } from './helpers/readSource'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'
import { bucketStarts, bucketedPositives, departmentHomeWindow, monthKeys, monthlyHandHygieneSeries, normalizeDepartmentHome, organismSummary, periodRangeLabel, windowSubtitle } from '../src/features/dashboard/departmentHomeModel'
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

describe('the period of the department home', () => {
  it('is the current month against the previous one by default, a quarter by weeks and a year by months', () => {
    const month = departmentHomeWindow('month', '2026-11-20')
    expect(month).toMatchObject({ bucket: 'week', period: { from: '2026-11-01', to: '2026-11-30' }, compare: { from: '2026-10-01', to: '2026-10-31' } })
    const quarter = departmentHomeWindow('quarter', '2026-11-20', 'previous')
    expect(quarter).toMatchObject({ bucket: 'week', period: { from: '2026-10-01', to: '2026-12-31' }, compare: { from: '2026-07-01', to: '2026-09-30' } })
    const year = departmentHomeWindow('year', '2026-11-20', 'lastYear')
    expect(year).toMatchObject({ bucket: 'month', period: { from: '2026-01-01', to: '2026-12-31' }, compare: { from: '2025-01-01', to: '2025-12-31' } })
    expect(departmentHomeWindow('half', '2026-03-02').bucket).toBe('month')
    expect(periodRangeLabel(quarter.period, 'el')).toBe('Οκτ–Δεκ 2026')
    expect(windowSubtitle(quarter, 'el')).toBe('Τρίμηνο Οκτ–Δεκ 2026 σε σύγκριση με Ιούλ–Σεπ 2026')
    expect(windowSubtitle(year, 'en')).toBe('Year 2026 compared with 2025')
  })
  it('counts weeks from the Monday of the first day, or the months of the period', () => {
    const weeks = bucketStarts('2026-11-01', '2026-11-30', 'week')
    expect(weeks).toEqual(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30'])
    expect(weeks.every(day => new Date(`${day}T00:00:00Z`).getUTCDay() === 1)).toBe(true)
    expect(bucketStarts('2026-07-01', '2026-12-31', 'month')).toEqual(['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01'])
  })
  it('puts each positive sample of the period in its bucket, MDR/XDR apart from the others', () => {
    const rows = bucketedPositives([
      { day: '2026-11-16', mdr: true }, { day: '2026-11-20', mdr: false }, { day: '2026-11-22', mdr: false },
      { day: '2026-11-01', mdr: false }, { day: '2026-10-31', mdr: true },
    ], '2026-11-01', '2026-11-30', 'week')
    expect(rows[3]).toEqual({ start: '2026-11-16', mdr: 1, other: 2 })
    expect(rows[0]).toEqual({ start: '2026-10-26', mdr: 0, other: 1 })
    expect(rows.reduce((sum, row) => sum + row.mdr + row.other, 0)).toBe(4)
    const months = bucketedPositives([{ day: '2026-02-03', mdr: true }, { day: '2025-12-31', mdr: false }], '2026-01-01', '2026-12-31', 'month')
    expect(months).toHaveLength(12)
    expect(months[1]).toEqual({ start: '2026-02-01', mdr: 1, other: 0 })
  })
  it('adds hand hygiene up by month, with no percentage for a month without observations', () => {
    expect(monthKeys('2026-01-10')).toEqual(['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01'])
    const rows = monthlyHandHygieneSeries([
      { day: '2026-11-03', observations: 10, compliant: 8 }, { day: '2026-11-12', observations: 10, compliant: 9 },
      { day: '2026-09-01', observations: 4, compliant: 4 }, { day: '2026-04-01', observations: 9, compliant: 1 },
    ], '2026-11-30')
    expect(rows.map(row => row.month)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'])
    expect(rows.at(-1)).toMatchObject({ observations: 20, compliant: 17, pct: 85 })
    expect(rows[3].pct).toBe(100)
    expect(rows[4].pct).toBeNull()
  })
  it('fills the buckets and months the database left out and keeps null for locked modules', () => {
    const window = departmentHomeWindow('month', '2026-11-20')
    const overview = normalizeDepartmentHome({ inpatients: 4, handHygienePct: null, newSurveillance: null, compare: { positives: 3, lateControls: 1 }, positivesSeries: [{ start: '2026-11-16', mdr: 2, other: 1 }], monthlyHandHygiene: [{ month: '2026-11', observations: 5, compliant: 4 }], monthlyHandHygieneCompare: [{ month: '2026-10', observations: 4, compliant: 4 }], organisms: [{ organism: ' Klebsiella pneumoniae ', count: 3, mdr: 2, compareCount: 1 }, { organism: '', count: 1, mdr: 0 }], organismsOtherCount: 2, patients: 3 }, window)
    expect(overview.positivesSeries).toHaveLength(6)
    expect(overview.positivesSeries[3]).toEqual({ start: '2026-11-16', mdr: 2, other: 1 })
    expect(overview.positivesCompareSeries.map(row => row.start)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'])
    expect(overview.monthlyHandHygiene.at(-1)).toMatchObject({ month: '2026-11', pct: 80 })
    expect(overview.monthlyHandHygieneCompare.at(-1)).toMatchObject({ month: '2026-10', pct: 100 })
    expect(overview.newSurveillance).toBeNull()
    expect(overview.compare).toMatchObject({ positives: 3, lateControls: 1, handHygienePct: null })
    expect(overview.handHygieneTarget).toBe(80)
    expect(overview.organisms).toEqual([{ organism: 'Klebsiella pneumoniae', count: 3, mdr: 2, compareCount: 1 }])
    expect(overview).toMatchObject({ organismsOtherCount: 2, patients: 3, organismsCount: null, from: '2026-11-01', compareTo: '2026-10-31' })
    expect(overview).not.toHaveProperty('latestPositives')
  })
  it('counts the organisms of the positives: distinct patients and kinds, the 4 most frequent with the comparison and the rest together', () => {
    const summary = organismSummary([
      { patient: 'p1', organism: 'Klebsiella pneumoniae', mdr: true }, { patient: 'p2', organism: 'Klebsiella pneumoniae ', mdr: false },
      { patient: 'p2', organism: 'Acinetobacter baumannii', mdr: true }, { patient: 'p3', organism: 'Escherichia coli', mdr: false },
      { patient: 'p4', organism: 'Pseudomonas aeruginosa', mdr: false }, { patient: 'p5', organism: 'Candida albicans', mdr: false },
      { patient: 'p5', organism: 'Serratia marcescens', mdr: false }, { patient: 'p6', organism: null, mdr: false },
    ], [{ organism: 'Klebsiella pneumoniae' }, { organism: 'Escherichia coli' }, { organism: 'Escherichia coli' }, { organism: 'Proteus mirabilis' }])
    expect(summary).toEqual({
      patients: 6, organismsCount: 6, organismsOtherCount: 2, compareOrganismsCount: 3,
      organisms: [{ organism: 'Klebsiella pneumoniae', count: 2, mdr: 1, compareCount: 1 }, { organism: 'Acinetobacter baumannii', count: 1, mdr: 1, compareCount: 0 }, { organism: 'Candida albicans', count: 1, mdr: 0, compareCount: 0 }, { organism: 'Escherichia coli', count: 1, mdr: 0, compareCount: 2 }],
    })
  })
})

describe('the Demo department home', () => {
  it('counts the ICU from the sample records the other Demo screens show', () => {
    configureDataEnvironment({ mode: 'demo' })
    const now = new Date('2026-08-29T12:00:00+03:00')
    const icu = collectDemoDepartmentHome({ department: 'ΜΕΘ', now, window: departmentHomeWindow('month', '2026-08-29') })
    expect(icu.inpatients).toBeGreaterThan(0)
    expect(icu.positives).toBeGreaterThan(0)
    expect(icu.positivesMdr).toBeLessThanOrEqual(icu.positives)
    expect(icu.positivesAwaiting).toBeLessThanOrEqual(icu.positives)
    expect(icu.positivesSeries.reduce((sum, row) => sum + row.mdr + row.other, 0)).toBe(icu.positives)
    expect(icu.positivesSeries).toHaveLength(bucketStarts('2026-08-01', '2026-08-31', 'week').length)
    expect(icu.monthlyHandHygiene).toHaveLength(6)
    expect(icu.monthlyHandHygieneCompare.at(-1)?.month).toBe('2026-07')
    expect(icu.handHygienePct).toBeGreaterThan(0)
    expect(icu.organisms.length).toBeGreaterThan(0)
    expect(icu.organisms.length).toBeLessThanOrEqual(4)
    expect(icu.organisms.reduce((sum, row) => sum + row.count, 0) + icu.organismsOtherCount).toBeLessThanOrEqual(icu.positives)
    expect(icu.organisms.map(row => row.count)).toEqual([...icu.organisms.map(row => row.count)].sort((a, b) => b - a))
    expect(icu.patients).toBeGreaterThan(0)
    expect(icu.patients).toBeLessThanOrEqual(icu.positives)
    expect(icu.newSurveillance).toBeGreaterThan(0)
    expect(icu.lateControls).toBeGreaterThanOrEqual(0)
    expect(icu.compare.positives).toBeGreaterThanOrEqual(0)
    expect(JSON.stringify(icu)).not.toMatch(/"patient"|sampleCode/)
    expect(icu).toMatchObject({ pendingRosterRequests: 2, trainingPct: 94, fluPct: 71 })
    // A year against the year before: the same records, counted by month.
    const year = collectDemoDepartmentHome({ department: 'ΜΕΘ', now, window: departmentHomeWindow('year', '2026-08-29', 'lastYear') })
    expect(year.positivesSeries).toHaveLength(12)
    expect(year.positives).toBeGreaterThanOrEqual(icu.positives)
    expect(year.compare.positives).toBeGreaterThan(0)
    expect(year.positivesCompareSeries.reduce((sum, row) => sum + row.mdr + row.other, 0)).toBe(year.compare.positives)
    const none = collectDemoDepartmentHome({ department: 'Καμία', now })
    expect(none).toMatchObject({ inpatients: 0, positives: 0, handHygienePct: null, organisms: [], patients: 0, organismsCount: 0, pendingRosterRequests: 0, lateControls: 0 })
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
    expect([...container.querySelectorAll('.dephome-tile-label')].map(el => el.textContent)).toEqual(['Θετικά δείγματα', 'Νέα επεισόδια / απομονώσεις', 'Υγιεινή χεριών', 'Έλεγχοι εκτός χρόνου'])
    expect(container.querySelectorAll('.dephome-tile')[3].querySelector('.dephome-tile-detail')?.textContent).toMatch(/^σήμερα: \d+ εκπρόθεσμ/)
    // The period on the title's line: the current month against the previous one.
    expect([...container.querySelectorAll('.dephome-period .dephome-period-kind button')].map(el => el.textContent)).toEqual(['Μήνας', 'Τρίμηνο', 'Εξάμηνο', 'Έτος'])
    expect(container.querySelector('.dephome-period .dephome-period-kind button.active')?.textContent).toBe('Μήνας')
    expect(container.querySelector('.page-header p')?.textContent).toMatch(/σε σύγκριση με/)
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
    expect(container.textContent).not.toContain('Νέα επεισόδια / απομονώσεις')
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
    expect(loadOverview).toHaveBeenCalledWith('org-1', ['dep-1'], expect.objectContaining({ kind: 'month', choice: 'previous', bucket: 'week' }))
    expect(container.querySelectorAll('.dephome-focus-list li')).toHaveLength(0)
    expect(container.querySelector('.dephome-tile-value')?.textContent).toBe('—')
  })

  it('gives the Link Nurse the user\'s home, not the manager\'s (owner, 20/11/2026)', async () => {
    configureDataEnvironment({ mode: 'demo' })
    tenant = managerTenant({ role: 'link_nurse', actualRole: 'link_nurse' })
    const { container } = open()
    await waitFor(() => expect(screen.getByText('Για μένα σήμερα')).toBeTruthy())
    expect(container.querySelector('.dephome')).toBeNull()
    expect(container.querySelector('.userhome')).not.toBeNull()
    expect(screen.getByText('Ενημερώσεις & ανακοινώσεις')).toBeTruthy()
  })
})

describe('the period of «Το τμήμα μου» (owner, 20/11/2026)', () => {
  it('reads the hospital again for a year against last year, by month', async () => {
    configureDataEnvironment({ mode: 'production' })
    loadOverview.mockResolvedValue(null)
    tenant = managerTenant({ isDemo: false, tenant: { id: 'org-1' }, membership: { departmentIds: ['dep-1'], departmentName: 'Χειρουργική', capabilities: [], customCapabilities: [] } })
    const { container } = open()
    await waitFor(() => expect(loadOverview).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('radio', { name: 'Έτος' }))
    await waitFor(() => expect(loadOverview).toHaveBeenLastCalledWith('org-1', ['dep-1'], expect.objectContaining({ kind: 'year', bucket: 'month' })))
    const year = loadOverview.mock.calls.at(-1)[2]
    expect(year.period.from.slice(5)).toBe('01-01')
    expect(year.compare.from).toBe(`${Number(year.period.from.slice(0, 4)) - 1}-01-01`)
    fireEvent.click(screen.getByRole('button', { name: 'Προηγούμενη περίοδος' }))
    await waitFor(() => expect(loadOverview.mock.calls.at(-1)[2].period.from).toBe(`${Number(year.period.from.slice(0, 4)) - 1}-01-01`))
    expect(container.querySelector('.page-header p')?.textContent).toMatch(/^Έτος \d{4} σε σύγκριση με \d{4}$/)
    expect(screen.getByText('Θετικά δείγματα ανά μήνα')).toBeTruthy()
  })

  it('shows each tile\'s change from the comparison period, coloured by meaning', async () => {
    configureDataEnvironment({ mode: 'production' })
    loadOverview.mockImplementation(async (_org, _ids, window) => normalizeDepartmentHome({
      positives: 11, positivesMdr: 4, newSurveillance: 6, newIsolation: 3, handHygienePct: 87, handHygieneObservations: 46, lateControls: 8, overdueControls: 8,
      compare: { positives: 8, newSurveillance: 7, newIsolation: 3, handHygienePct: 82, lateControls: 6 },
    }, window))
    tenant = managerTenant({ isDemo: false, tenant: { id: 'org-1' }, membership: { departmentIds: ['dep-1'], departmentName: 'Χειρουργική', capabilities: [], customCapabilities: [] } })
    const { container } = open()
    await waitFor(() => expect(container.querySelectorAll('.dephome-tile-change')).toHaveLength(4))
    const changes = [...container.querySelectorAll('.dephome-tile-change')].map(el => [el.textContent?.trim(), el.className])
    expect(changes[0]).toEqual(['▲ +3 (+38%)', 'dephome-tile-change is-worse'])
    expect(changes[1]).toEqual(['▼ −1', 'dephome-tile-change is-better'])
    expect(changes[2]).toEqual(['▲ +5 μον.', 'dephome-tile-change is-better'])
    expect(changes[3]).toEqual(['▲ +2', 'dephome-tile-change is-worse'])
    expect(container.querySelectorAll('.dephome-tile-detail')[3].textContent).toBe('σήμερα: 8 εκπρόθεσμοι')
  })
})

describe('the register or incidents card (owner, 20/11/2026)', () => {
  it('shows the ICU register\'s main indicators for the period, worst first, in four lines that never scroll', async () => {
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
    // A year: the hand hygiene chart shows its 12 months.
    fireEvent.click(screen.getByRole('radio', { name: 'Έτος' }))
    await waitFor(() => expect(container.querySelectorAll('.dephome-cards .dephome-chart svg text.viz-axis').length).toBeGreaterThanOrEqual(12))
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
      expect(after.positives).toBe(before.positives)
      expect(after.positivesMdr).toBe(before.positivesMdr)
      expect(after.positivesSeries).toEqual(before.positivesSeries)
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

describe('department_home_overview with a period (owner, 20/11/2026)', () => {
  const migration = readSource('supabase/migrations/20261231603000_department_home_period.sql')
  const sql = migration.replace(/^--.*$/gm, '')
  it('is a new function beside the old one (no drop) and opens the new one to signed-in users only', () => {
    expect(sql).not.toContain('drop function')
    expect(sql).toContain("create or replace function public.department_home_period_overview(p_organization_id uuid, p_department_ids uuid[] default null, p_from date default null, p_to date default null, p_compare_from date default null, p_compare_to date default null, p_bucket text default 'week')")
    expect(sql).toContain('revoke all on function public.department_home_period_overview(uuid, uuid[], date, date, date, date, text) from public, anon;')
    expect(sql).toContain('grant execute on function public.department_home_period_overview(uuid, uuid[], date, date, date, date, text) to authenticated;')
    expect(sql).toContain('security definer')
    expect(sql).toContain("set search_path to ''")
    expect(sql).not.toMatch(/\b(insert|update|delete|truncate)\b/i)
  })
  it('keeps the roles, the department scope, the resistance, the contamination rule and the module gates', () => {
    expect(sql).toContain("array['department_manager', 'infection_control_lead', 'infection_control_member', 'doctor_reviewer']::public.app_role[]")
    expect(sql).toContain('public.current_user_has_department_scope(p_organization_id, v_department)')
    expect(sql).toContain('private.password_change_pending()')
    expect(sql).toContain("array_agg(z.c order by case z.c when 'PDR' then 3 when 'XDR' then 2 else 1 end desc)")
    expect(sql).toContain("and coalesce(res.organism, '') !~* '(επιμόλυνση|επιμολυνση|contaminat|3\\s+είδ|3\\s+ειδ)'")
    for (const module of ['laboratory', 'surveillance', 'prevention', 'controls', 'training', 'occupational_health', 'quality']) expect(sql).toContain(`'${module}' = any (v_disabled)`)
    expect(sql).toContain("(now() at time zone 'Europe/Athens')::date")
  })
  it('returns both periods, the buckets, the organisms with their comparison, and today\'s figures, never a name', () => {
    for (const key of ["'positives'", "'compare'", "'positivesSeries'", "'positivesCompareSeries'", "'monthlyHandHygiene'", "'monthlyHandHygieneCompare'", "'organisms'", "'compareCount'", "'newSurveillance'", "'newIsolation'", "'lateControls'", "'overdueControls'", "'reassessmentsDueToday'", "'pendingRosterRequests'", "'trainingExpiring30'", "'falls30'"]) expect(sql).toContain(key)
    expect(sql).toContain('public.control_adherence_counts(p_organization_id')
    expect(sql).toContain("v_from := coalesce(p_from, date_trunc('month', v_today::timestamp)::date);")
    expect(sql).toContain("raise exception 'INVALID_PERIOD'")
    expect(sql).not.toMatch(/latestPositives|last_name|first_name|patient_code|sample_code',/)
  })
})

describe('«Χωρίς σύγκριση» (owner, 20/11/2026)', () => {
  it('offers no comparison and drops the comparison from the subtitle', async () => {
    const model = await import('../src/features/dashboard/departmentHomeModel')
    expect(model.COMPARE_CHOICES).toContain('none')
    const window = model.departmentHomeWindow('quarter', '2026-11-20', 'none')
    expect(window.choice).toBe('none')
    expect(model.windowSubtitleParts(window, 'el').compare).toBe('')
    expect(model.windowSubtitle(window, 'el')).not.toContain('σύγκριση')
  })
})
