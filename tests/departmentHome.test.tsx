// @vitest-environment jsdom
// «Το τμήμα μου» of the Department Manager (owner, 20/11/2026): five figures, two charts and three
// cards for the manager's department; locked modules are not shown; a hospital reads one RPC
// (department_home_overview) and a failed read never shows the Demo's figures; the Link Nurse keeps
// the previous home.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readSource } from './helpers/readSource'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'
import { monthKeys, monthlyHandHygieneSeries, normalizeDepartmentHome, weekStarts, weeklyPositiveSeries } from '../src/features/dashboard/departmentHomeModel'

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
    const overview = normalizeDepartmentHome({ inpatients: 4, handHygienePct: null, activeSurveillance: null, weeklyPositives: [{ week: '2026-11-16', mdr: 2, other: 1 }], monthlyHandHygiene: [{ month: '2026-11', observations: 5, compliant: 4 }], latestPositives: [{ sampleCode: 'L-1', patientCode: 'P-9', resistance: 'xdr', awaiting: true }] }, '2026-11-20')
    expect(overview.weeklyPositives).toHaveLength(12)
    expect(overview.weeklyPositives.at(-1)).toEqual({ week: '2026-11-16', mdr: 2, other: 1 })
    expect(overview.monthlyHandHygiene.at(-1)).toMatchObject({ pct: 80 })
    expect(overview.activeSurveillance).toBeNull()
    expect(overview.handHygieneTarget).toBe(80)
    expect(overview.latestPositives[0]).toMatchObject({ patient: 'P-9', resistance: 'XDR', awaiting: true })
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
    expect(icu.latestPositives.length).toBeGreaterThan(0)
    expect(icu.latestPositives.length).toBeLessThanOrEqual(5)
    const dates = icu.latestPositives.map(row => row.collectedAt)
    expect([...dates].sort().reverse()).toEqual(dates)
    expect(icu).toMatchObject({ pendingRosterRequests: 2, trainingPct: 94, fluPct: 71 })
    const none = collectDemoDepartmentHome({ department: 'Καμία', now: new Date('2026-08-29T12:00:00+03:00') })
    expect(none).toMatchObject({ inpatients: 0, positives30: 0, handHygienePct: null, latestPositives: [], pendingRosterRequests: 0 })
  })
})

const open = () => render(<MemoryRouter><LanguageProvider><MyDepartmentPage/></LanguageProvider></MemoryRouter>)
const managerTenant = (overrides = {}) => ({
  role: 'department_manager', actualRole: 'department_manager', isDemo: true, tenant: { id: 'demo-hospital', is_demo: true },
  membership: { previewDepartment: 'ΜΕΘ', capabilities: [], customCapabilities: [] },
  moduleEnabled: () => true, canAccessRecord: () => true, ...overrides,
})

describe('«Το τμήμα μου» of the Department Manager', () => {
  it('shows five figures, two charts and three cards, and no roster card', async () => {
    configureDataEnvironment({ mode: 'demo' })
    tenant = managerTenant()
    const { container } = open()
    await waitFor(() => expect(container.querySelectorAll('.dephome-tile')).toHaveLength(5))
    expect([...container.querySelectorAll('.dephome-tile-label')].map(el => el.textContent)).toEqual(['Νοσηλευόμενοι σήμερα', 'Θετικά δείγματα (30 ημ.)', 'Σε επιτήρηση / απομόνωση', 'Υγιεινή χεριών', 'Εκπρόθεσμοι έλεγχοι'])
    expect(container.querySelectorAll('.dephome-chart svg')).toHaveLength(2)
    expect(screen.getByText('Θετικά δείγματα ανά εβδομάδα')).toBeTruthy()
    expect(screen.getByText('Υγιεινή χεριών ανά μήνα')).toBeTruthy()
    expect(container.querySelectorAll('.dephome-cards>.dashboard-card')).toHaveLength(3)
    expect(screen.getByText('Για μένα σήμερα')).toBeTruthy()
    expect(screen.getByText('Τελευταία θετικά')).toBeTruthy()
    expect(screen.getByText('Ανακοινώσεις')).toBeTruthy()
    expect(screen.getByText('Το τμήμα (30 ημ.)')).toBeTruthy()
    expect(container.textContent).not.toContain('Σήμερα στη βάρδια')
    expect(loadOverview).not.toHaveBeenCalled()
  })

  it('hides the figures and charts of locked modules', async () => {
    configureDataEnvironment({ mode: 'demo' })
    tenant = managerTenant({ moduleEnabled: module => !['surveillance', 'prevention', 'quality'].includes(module) })
    const { container } = open()
    await waitFor(() => expect(container.querySelectorAll('.dephome-tile')).toHaveLength(3))
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
    expect(container.querySelectorAll('.dephome-latest-list button')).toHaveLength(0)
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
