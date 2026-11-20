// @vitest-environment jsdom
// The home of the Department User and the Link Nurse (owner, 20/11/2026): four figures (the department's overdue controls
// and cultures, today's tasks, the user's own certificates within 90 days, the department's patients in isolation as a
// number only), then «Για μένα σήμερα» with «Οι εκπαιδεύσεις μου», «Επόμενες 7 ημέρες στο τμήμα» (own items tagged) and
// the announcements. The Department Manager keeps «Το τμήμα μου». The isolation count of a hospital is one database read.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readSource } from './helpers/readSource'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'
import { hospitalToday } from '../src/core/dates/hospitalDate'
import { addDay } from '../src/features/calendar/calendarView'
import { departmentOverdueCount, ownCertificatesDue, ownTrainings, todayTaskCount } from '../src/features/dashboard/userHomeModel'

const today = '2026-11-20'
const training = {
  programs: [
    { id: 'P1', title: 'Υγιεινή χεριών', status: 'active', dueDate: '2026-11-10', audience: 'Κλινικό προσωπικό' },
    { id: 'P2', title: 'ΜΑΠ', status: 'active', dueDate: '2026-12-15', audience: 'ΜΕΘ' },
    { id: 'P3', title: 'Αιχμηρά', status: 'completed', dueDate: '2026-06-30', audience: 'Όλο το προσωπικό' },
    { id: 'P4', title: 'CLABSI', status: 'completed', dueDate: '2026-04-30', audience: 'ΜΕΘ' },
  ],
  assignments: [
    { id: 'A1', programId: 'P1', status: 'assigned', userId: 'u-me', dueDate: '2026-11-10' },
    { id: 'A2', programId: 'P2', status: 'in_progress', userId: 'u-me', dueDate: '2026-12-15' },
    { id: 'A3', programId: 'P3', status: 'completed', userId: 'u-me', completedDate: '2026-06-18' },
    { id: 'A4', programId: 'P4', status: 'completed', userId: 'u-me', completedDate: '2026-04-22' },
    { id: 'A5', programId: 'P2', status: 'assigned', userId: 'u-other', dueDate: '2026-11-01', employeeName: 'Συνάδελφος' },
  ],
  certificates: [
    { id: 'C3', assignmentId: 'A3', title: 'Αιχμηρά', validUntil: '2028-06-18' },
    { id: 'C4', assignmentId: 'A4', title: 'CLABSI', validUntil: '2026-12-22' },
    { id: 'C5', assignmentId: 'A5', title: 'ΜΑΠ', validUntil: '2026-11-25' },
  ],
}
const own = { userId: 'u-me', employeeId: null }

describe('the user home model', () => {
  it('lists the user\'s own trainings, the work first, never a colleague\'s', () => {
    expect(ownTrainings(training, own, today).map(row => [row.title, row.status])).toEqual([['Υγιεινή χεριών', 'overdue'], ['ΜΑΠ', 'due'], ['CLABSI', 'expiring'], ['Αιχμηρά', 'completed']])
    expect(ownTrainings(training, own, today, 2)).toHaveLength(2)
    expect(ownTrainings(training, { userId: null, employeeId: null }, today)).toEqual([])
  })
  it('counts the user\'s own certificates that expire within 90 days', () => {
    expect(ownCertificatesDue(training, own, today)).toEqual({ count: 1, expired: 0 })
    expect(ownCertificatesDue(training, own, '2026-12-30')).toEqual({ count: 1, expired: 1 })
  })
  it('counts today\'s tasks and the department\'s overdue controls and cultures', () => {
    expect(todayTaskCount([{ key: 'controlsDueToday', count: 2 }, { key: 'pendingSamples', count: 3 }, { key: 'overdueControls', count: 9 }, { key: 'selfAssessmentsOpen', count: 1 }])).toBe(5)
    const ev = (kind: string, state: string) => ({ id: `${kind}${state}`, date: today, kind, title: 'T', state })
    expect(departmentOverdueCount([ev('controls', 'overdue'), ev('cultures', 'overdue'), ev('training', 'overdue'), ev('controls', 'due')])).toBe(2)
  })
})

let tenant
let sources
vi.mock('../src/core/tenant/TenantContext', () => ({ useTenant: () => tenant }))
vi.mock('../src/core/notifications/NotificationContext', () => ({
  useNotifications: () => ({ operational: [{ id: 'LIVE-department_user-controlsDueToday', title: 'Έλεγχοι για σήμερα', count: 2, to: '/controls?due=today' }, { id: 'LIVE-department_user-pendingSamples', title: 'Εκκρεμή δείγματα τμήματος', count: 1, to: '/laboratory' }], visibleAnnouncements: [], notificationItems: [], unreadCount: 0, markRead: () => {}, markAllRead: () => {} }),
}))
vi.mock('../src/features/quality/review/QualityObjectives', () => ({ useObjectives: () => ({ objectives: [] }) }))
vi.mock('../src/features/calendar/useCalendarSources', () => ({ calendarKindsFor: () => ['controls', 'cultures', 'training', 'committees'], useCalendarSources: (_id, _kinds, _language, { enabled }) => enabled ? sources : null }))
vi.mock('../src/features/laboratory/hooks/useSamplesAwaitingReview', () => ({ useSamplesAwaitingReview: () => ({ rows: [], loading: false }) }))
vi.mock('../src/features/dashboard/dashboardCloudService', () => ({ loadDashboardMetrics: async () => ({}), readStoredDashboardMetrics: async () => null }))
const isolation = vi.fn()
vi.mock('../src/features/dashboard/userHomeService', () => ({ loadDepartmentIsolationCount: (...args) => isolation(...args) }))

const { MyDepartmentPage } = await import('../src/features/workspaces/MyDepartmentPage')
const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
vi.setConfig({ testTimeout: 20000 })
afterEach(() => { cleanup(); configureDataEnvironment({ mode: 'production' }); isolation.mockReset() })

const day = hospitalToday()
const userTenant = (overrides = {}) => ({
  role: 'department_user', actualRole: 'department_user', isDemo: false, isRolePreview: false, tenant: { id: 'org-1' },
  membership: { departmentIds: ['dep-icu'], departmentName: 'ΜΕΘ', departmentNames: ['ΜΕΘ'], capabilities: [], customCapabilities: [] },
  moduleEnabled: () => true, canAccessRecord: () => true, ...overrides,
})
const open = () => render(<MemoryRouter><LanguageProvider><MyDepartmentPage/></LanguageProvider></MemoryRouter>)

describe('the home of the Department User', () => {
  it('shows the four figures and the three columns, scoped to the department by name', async () => {
    isolation.mockResolvedValue(4)
    sources = {
      controls: [
        { id: 'C1', title: 'Ψυγείο φαρμάκων', category: 'equipment', assignments: { 'ΜΕΘ': { nextDueAt: `${addDay(day, -2)}T08:00:00Z`, frequency: { kind: 'weekly' } }, 'Χειρουργική': { nextDueAt: `${addDay(day, -3)}T08:00:00Z`, frequency: { kind: 'weekly' } } } },
        { id: 'C2', title: 'Καρότσι επειγόντων', category: 'equipment', assignments: { 'ΜΕΘ': { nextDueAt: `${addDay(day, 2)}T08:00:00Z`, frequency: { kind: 'monthly' } } } },
      ],
      training: { programs: [{ id: 'P1', title: 'Υγιεινή χεριών', status: 'active', dueDate: addDay(day, 3), audience: 'Όλο το προσωπικό' }], assignments: [{ id: 'A1', programId: 'P1', status: 'assigned', userId: null, employeeName: 'Συνάδελφος', department: 'ΜΕΘ', dueDate: addDay(day, 3) }], certificates: [{ id: 'X', assignmentId: 'A1', title: 'Παλιό', validUntil: addDay(day, 4) }] },
      suppliers: [{ id: 'S1', name: 'Προμηθευτής', status: 'active', nextEvaluation: addDay(day, 1) }],
    }
    tenant = userTenant()
    const { container } = open()
    await waitFor(() => expect(container.querySelectorAll('.userhome .dephome-tile')).toHaveLength(4))
    const tiles = [...container.querySelectorAll('.dephome-tile')]
    expect(tiles.map(el => el.querySelector('.dephome-tile-label')?.textContent)).toEqual(['Εκπρόθεσμα του τμήματος', 'Για σήμερα', 'Τα πιστοποιητικά μου', 'Σε απομόνωση τώρα'])
    await waitFor(() => expect(tiles[3].querySelector('.dephome-tile-value')?.textContent).toBe('4'))
    // The ICU's overdue control only (not Surgery's); today's tasks from «Για μένα σήμερα»; no certificate of a colleague.
    expect(tiles[0].querySelector('.dephome-tile-value')?.textContent).toBe('1')
    expect(tiles[0].className).toContain('is-danger')
    expect(tiles[1].querySelector('.dephome-tile-value')?.textContent).toBe('3')
    expect(tiles[2].querySelector('.dephome-tile-value')?.textContent).toBe('0')
    expect(isolation).toHaveBeenCalledWith('org-1')
    const week = container.querySelector('.userhome-week-card') as HTMLElement
    expect(within(week).getByText('Επόμενες 7 ημέρες στο τμήμα')).toBeTruthy()
    expect(week.textContent).toContain('Καρότσι επειγόντων')
    expect(week.textContent).toContain('Υγιεινή χεριών')
    // No supplier (no department) and no colleague's certificate expiry.
    expect(week.textContent).not.toContain('Προμηθευτής')
    expect(week.textContent).not.toContain('Παλιό')
    expect(within(week).getByText('Ημερολόγιο τμήματος')).toBeTruthy()
    expect(screen.getByText('Για μένα σήμερα')).toBeTruthy()
    expect(screen.getByText('Οι εκπαιδεύσεις μου')).toBeTruthy()
    expect(screen.getByText('Ενημερώσεις & ανακοινώσεις')).toBeTruthy()
  })

  it('hides the isolation figure when Surveillance is locked and never reads it then', async () => {
    sources = { controls: [], training: null }
    tenant = userTenant({ moduleEnabled: (module: string) => module !== 'surveillance' })
    const { container } = open()
    await waitFor(() => expect(container.querySelectorAll('.userhome .dephome-tile')).toHaveLength(3))
    expect(container.textContent).not.toContain('Σε απομόνωση τώρα')
    expect(isolation).not.toHaveBeenCalled()
  })

  it('counts the Demo\'s sample department without reading the database', async () => {
    configureDataEnvironment({ mode: 'demo' })
    sources = { controls: [], training: null }
    tenant = userTenant({ isDemo: true, tenant: { id: 'demo-hospital', is_demo: true }, membership: { departmentIds: [], previewDepartment: 'ΜΕΘ', capabilities: [], customCapabilities: [] } })
    const { container } = open()
    await waitFor(() => expect(container.querySelectorAll('.userhome .dephome-tile')).toHaveLength(4))
    expect(container.querySelectorAll('.dephome-tile-value')[3].textContent).toMatch(/^\d+$/)
    expect(isolation).not.toHaveBeenCalled()
  })

  it('opens a training record when its section is open', () => {
    expect(readSource('src/features/dashboard/UserHome.tsx')).toContain('disabled={!canOpen(sectionPath(row.path))}')
  })
  it('keeps «Το τμήμα μου» for the Department Manager', () => {
    const page = readSource('src/features/workspaces/MyDepartmentPage.tsx')
    expect(page).toContain('const userHome=role===ROLES.DEPARTMENT_USER||role===ROLES.LINK_NURSE')
  })
})

describe('the isolation count in the database', () => {
  const sql = readSource('supabase/migrations/20261231604000_department_isolation_count.sql')
  it('counts only the caller\'s own departments, for department roles, and returns a number only', () => {
    expect(sql).toContain('security definer')
    expect(sql).toContain("set search_path to ''")
    expect(sql).toContain("array['department_manager', 'department_user', 'link_nurse']::public.app_role[]")
    expect(sql).toContain('om.user_id = auth.uid()')
    expect(sql).toContain('x.organization_id = p_organization_id')
    expect(sql).toContain('returns integer')
    expect(sql).toContain('count(distinct x.patient_id)')
    expect(sql).not.toMatch(/\b(drop|revoke|delete)\b/i)
  })
})
