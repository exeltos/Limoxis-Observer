// @vitest-environment jsdom
// The Division Director's home (owner, 12/11/2026): the division's key figures, «Τμήματα που
// εποπτεύω» with the roster pill of next month, what needs attention and the interviews, in Greek
// and English, read only; the role preview picks a division and oversees its departments.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readSource } from './helpers/readSource'

let language = 'el'
vi.mock('../src/core/i18n/LanguageContext', () => ({ useLanguage: () => ({ language, t: key => key }), useOptionalLanguage: () => ({ language }) }))
let profile
vi.mock('../src/core/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: profile.id, email: profile.email }, profile, isAuthenticated: true, isDemoSession: false, loading: false }),
}))
// The home reads the tenant from a fixed object; the preview test uses the real provider.
let mockTenant = null
vi.mock('../src/core/tenant/TenantContext', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, useTenant: () => mockTenant ?? actual.useTenant() }
})
let overview
let interviews
vi.mock('../src/features/division/divisionService', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, loadDivisionOverview: vi.fn(async () => overview), loadDivisionInterviews: vi.fn(async () => interviews) }
})

const { DivisionHome, DivisionDepartmentView } = await import('../src/features/division/DivisionHome')
const { TenantProvider, useTenant } = await import('../src/core/tenant/TenantContext')
const { navigationFor } = await import('../src/app/navigation')
const { CAPABILITIES, ROLES, can } = await import('../src/core/permissions/roles')
const service = await vi.importActual('../src/features/division/divisionService')
const { attentionItems, categoryName, rosterPill } = await import('../src/features/division/divisionModel')
const { configureDataEnvironment } = await import('../src/core/data/dataEnvironment')

const row = (id, fields) => ({ id, name: id, staff: 20, staffOnLeave: 1, staffNew30: 0, rosterNextMonth: 'published', uncoveredNights: 0, pendingRequests: 0, pendingRequestsOver3Days: 0, trainingPct: 92, trainingExpiring30: 0, fluPct: 60, handHygienePct: 85, falls30: 0, pressureUlcers30: 0, incidentsOpen: 0, ...fields })
const departments = [
  row('ΜΕΘ', { staff: 38 }),
  row('Παθολογική', { rosterNextMonth: 'draft', uncoveredNights: 3, pendingRequests: 5, pendingRequestsOver3Days: 2, trainingPct: 70 }),
  row('Ορθοπαιδική', { rosterNextMonth: 'missing', trainingExpiring30: 4, handHygienePct: null }),
]
const fullOverview = () => ({ divisions: [{ id: 'div-1', name: 'Νοσηλευτική Υπηρεσία' }], division: { id: 'div-1', name: 'Νοσηλευτική Υπηρεσία', categories: ['nursing', 'support'] }, nextMonth: '2026-12', departments, totals: service.totalsOf(departments) })

function home(props = {}) {
  return render(<MemoryRouter><DivisionHome {...props} /></MemoryRouter>)
}

beforeEach(() => {
  language = 'el'
  overview = fullOverview()
  interviews = [{ id: 'int-1', candidateId: 'c-1', name: 'Μιχαηλίδου Άννα', position: 'ΤΕ Νοσηλευτική', scheduledAt: '2026-11-14T09:00:00.000Z' }]
  mockTenant = { tenant: { id: 'org-1' }, role: ROLES.DIVISION_DIRECTOR, divisionId: null, selectDivision: vi.fn(), isRolePreview: false, membership: { departmentIds: [] } }
})
afterEach(() => { cleanup(); localStorage.clear(); mockTenant = null })

describe('Division Director home', () => {
  it('shows the division, its four key figures and the departments with next month’s roster pill (Greek)', async () => {
    home()
    expect(await screen.findByText('Μιχαηλίδου Άννα')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Νοσηλευτική Υπηρεσία' })).toBeTruthy()
    // the subtitle: the departments, the categories in Greek (never the raw key) and the month
    const subtitle = screen.getByText(/3 τμήματα · Νοσηλευτικό, Υποστηρικτικό ·/)
    expect(subtitle.textContent).not.toMatch(/nursing|support/)
    for (const label of ['Προσωπικό', 'Βάρδιες Δεκεμβρίου', 'Εκπαίδευση', 'Εμβολιασμός γρίπης']) expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    expect(screen.getByText('1/3')).toBeTruthy()
    const table = screen.getByRole('table')
    for (const header of ['Τμήμα', 'Αιτήματα', 'Γρίπη', 'Υγιεινή χεριών', /Πτώσεις \/ Κατακλίσεις/]) expect(within(table).getByText(header)).toBeTruthy()
    expect(within(table).getByText('Δημοσιευμένο')).toBeTruthy()
    expect(within(table).getByText('Προσχέδιο · 3 νύχτες')).toBeTruthy()
    expect(within(table).getByText('Λείπει')).toBeTruthy()
    expect(within(table).getByText('—')).toBeTruthy()
    // what needs attention: the missing roster first
    expect(screen.getByText('Ορθοπαιδική: λείπει το πρόγραμμα Δεκεμβρίου')).toBeTruthy()
    expect(screen.getByText('Παθολογική: αιτήματα περιμένουν πάνω από 3 ημέρες')).toBeTruthy()
    expect(screen.getByText('Ορθοπαιδική: εκπαιδεύσεις λήγουν σε 30 ημέρες')).toBeTruthy()
  })

  it('reads the same in English', async () => {
    language = 'en'
    home()
    expect(await screen.findByText('Departments I oversee')).toBeTruthy()
    expect(screen.getByText(/3 departments · Nursing, Support ·/)).toBeTruthy()
    for (const label of [/^Staff/, /^December rosters/, /^Training/, /^Flu vaccination/]) expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    expect(within(screen.getByRole('table')).getByText('December roster')).toBeTruthy()
    const table = screen.getByRole('table')
    expect(within(table).getByText('Published')).toBeTruthy()
    expect(within(table).getByText('Draft · 3 nights')).toBeTruthy()
    expect(within(table).getByText('Missing')).toBeTruthy()
    expect(screen.getByText('Upcoming interviews')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/Τμήματα που εποπτεύω|Δημοσιευμένο|Λείπει|Προσωπικό/)
  })

  it('renders no write action for the role', async () => {
    home()
    await screen.findByText('Μιχαηλίδου Άννα')
    const labels = screen.getAllByRole('button').map(button => button.textContent)
    for (const label of labels) expect(label).not.toMatch(/Έγκριση|Απόρριψη|Δημοσίευση|Επεξεργασία|Διαγραφή|Αποθήκευση|Νέ[οα]/)
  })

  it('has friendly empty states: a division without departments, and no division at all', async () => {
    overview = { ...fullOverview(), departments: [], totals: service.totalsOf([]) }
    interviews = []
    home()
    expect(await screen.findByText('Δεν υπάρχουν ακόμα τμήματα στη διεύθυνση')).toBeTruthy()
    expect(screen.getByText('Όλα είναι σε τάξη στα τμήματά σας.')).toBeTruthy()
    expect(await screen.findByText('Δεν έχουν προγραμματιστεί συνεντεύξεις.')).toBeTruthy()
    cleanup()
    overview = { divisions: [], division: null, nextMonth: '2026-12', departments: [], totals: service.totalsOf([]) }
    home()
    expect(await screen.findByText('Δεν σας έχει ανατεθεί ακόμα διεύθυνση')).toBeTruthy()
  })

  it('offers «Διεύθυνση» only to a director of more than one division', async () => {
    home()
    await screen.findByText('Μιχαηλίδου Άννα')
    expect(screen.queryByText('Διεύθυνση')).toBeNull()
    cleanup()
    overview = { ...fullOverview(), divisions: [{ id: 'div-1', name: 'Νοσηλευτική Υπηρεσία' }, { id: 'div-2', name: 'Διεύθυνση Λειτουργιών' }] }
    home()
    expect(await screen.findByText('Διεύθυνση')).toBeTruthy()
  })

  it('opens a department of the division read only', async () => {
    render(<MemoryRouter><DivisionDepartmentView departmentId="Παθολογική" /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Παθολογική' })).toBeTruthy()
    expect(screen.getByText('Νοσηλευτική Υπηρεσία · μόνο ανάγνωση')).toBeTruthy()
    expect(screen.getByText('Προσχέδιο · 3 νύχτες')).toBeTruthy()
    cleanup()
    render(<MemoryRouter><DivisionDepartmentView departmentId="ΤΕΠ" /></MemoryRouter>)
    expect(await screen.findByText('Το τμήμα δεν ανήκει στη διεύθυνσή σας')).toBeTruthy()
  })
})

describe('division model and sample data', () => {
  it('labels categories and roster states, never the raw key', () => {
    for (const key of ['nursing', 'medical', 'paramedical', 'administrative', 'technical', 'support']) {
      expect(categoryName(key, 'el')).not.toBe(key)
      expect(categoryName(key, 'en')).not.toBe(key)
      expect(categoryName(key, 'el')).not.toMatch(/\(/)
    }
    expect(rosterPill({ rosterNextMonth: 'draft', uncoveredNights: 1 }, 'el')).toEqual(['Προσχέδιο · 1 νύχτα', 'warning'])
    expect(rosterPill({ rosterNextMonth: 'draft', uncoveredNights: 0 }, 'en')).toEqual(['Draft', 'info'])
    expect(attentionItems(departments, '2026-12', 'el')[0].tone).toBe('danger')
    expect(service.nextMonthOf('2026-12-03')).toBe('2027-01')
    expect(service.nextMonthOf('2026-11-12')).toBe('2026-12')
  })

  it('the sample hospital shows eight departments of the Nursing Service with realistic figures', async () => {
    configureDataEnvironment({ mode: 'demo', organizationId: 'demo-hospital' })
    try {
      const data = await service.loadDivisionOverview('demo-hospital', null)
      expect(data.division.name).toBe('Νοσηλευτική Υπηρεσία')
      expect(data.departments.map(item => item.name)).toEqual(['ΜΕΘ', 'Παθολογική', 'Χειρουργική', 'Καρδιολογική', 'Ορθοπαιδική', 'Παιδιατρική', 'ΜΕΝΝ', 'Νεφρολογική'])
      expect(data.totals.staff).toBe(226)
      expect(data.totals.trainingPct).toBeGreaterThan(80)
    } finally {
      configureDataEnvironment({ mode: 'production', organizationId: null })
    }
  })
})

describe('role preview: the division picker', () => {
  beforeEach(() => { mockTenant = null; profile = { id: 'owner-1', isPlatformOwner: true, fullName: 'Platform Owner', isDemo: false } })

  it('previews a Division Director over the departments of the chosen division', async () => {
    let api
    function Capture() { api = useTenant(); return null }
    render(<TenantProvider><Capture /></TenantProvider>)
    await waitFor(() => expect(api?.enterSampleDemo).toBeTypeOf('function'))
    act(() => { api.enterSampleDemo() })
    await waitFor(() => expect(api.isDemo).toBe(true))
    act(() => { api.startRolePreview('division_director') })
    // the first sample division until another is chosen
    expect(api.membership.departmentIds).toHaveLength(8)
    expect(api.membership.divisionId).toBe('demo-div-1')
    expect(api.canAccessRecord({ department: 'Παθολογική' })).toBe(true)
    expect(api.canAccessRecord({ department: 'ΤΕΠ' })).toBe(false)
    act(() => { api.updateRolePreviewDivision('demo-div-2', 'Διεύθυνση Λειτουργιών', ['Κουζίνα', 'Αποστείρωση']) })
    expect(api.membership.departmentIds).toEqual(['Κουζίνα', 'Αποστείρωση'])
    expect(api.divisionId).toBe('demo-div-2')
    expect(api.rolePreview.divisionName).toBe('Διεύθυνση Λειτουργιών')
    expect(api.canAccessRecord({ department: 'Παθολογική' })).toBe(false)
    // another role drops the division
    act(() => { api.startRolePreview('quality_manager') })
    expect(api.membership.departmentIds).not.toEqual(['Κουζίνα', 'Αποστείρωση'])
    expect(api.rolePreview.division).toBe('')
  })

  it('the popover has a division select for the role', () => {
    const shell = readSource('src/app/AppShell.jsx')
    expect(shell).toContain("previewNeedsDivision&&<label><span>{t('divisionScope')}</span>")
    expect(shell).toContain('updateRolePreviewDivision(item.id,item.name,item.departmentIds)')
    expect(readSource('src/core/i18n/stringsEl.js')).not.toMatch(/previewSafeHint:'[^']*(UI|backend|Development)/)
  })
})

describe('Division Director: menu and read-only access', () => {
  it('has the division departments, the rosters and the read-only screens in the menu', () => {
    const items = navigationFor({ role: ROLES.DIVISION_DIRECTOR })
    const keys = items.map(item => item.key)
    for (const key of ['dashboard', 'divisionDepartments', 'rosters', 'employees', 'training', 'interviews', 'calendar', 'controls', 'departmentRegisters', 'quality', 'documents', 'library']) expect(keys).toContain(key)
    for (const key of ['management', 'qualityMeasures', 'myDepartment', 'pharmacy', 'occupationalHealth']) expect(keys).not.toContain(key)
    expect(items.find(item => item.key === 'rosters').label).toBe('sidebarNav.divisionRosters')
    expect(items.find(item => item.key === 'divisionDepartments').to).toBe('/division')
    // the other roles keep their labels and menus
    expect(navigationFor({ role: ROLES.DEPARTMENT_MANAGER }).find(item => item.key === 'rosters').label).toBe('sidebarNav.rosters')
    expect(navigationFor({ role: ROLES.QUALITY_MANAGER }).map(item => item.key)).not.toContain('departmentRegisters')
  })

  it('reads and never writes', () => {
    for (const capability of [CAPABILITIES.VIEW_MY_DEPARTMENT, CAPABILITIES.VIEW_STAFF, CAPABILITIES.VIEW_TRAINING, CAPABILITIES.VIEW_CONTROLS, CAPABILITIES.VIEW_QUALITY]) expect(can(ROLES.DIVISION_DIRECTOR, capability)).toBe(true)
    for (const capability of [CAPABILITIES.MANAGE_QUALITY, CAPABILITIES.MANAGE_TRAINING, CAPABILITIES.MANAGE_CONTROLS, CAPABILITIES.MANAGE_STAFF_ADMIN, CAPABILITIES.EXECUTE_CONTROL, CAPABILITIES.CREATE_RECORDS, CAPABILITIES.EDIT_RECORDS, CAPABILITIES.APPROVE_RECORDS, CAPABILITIES.DELETE_RECORDS, CAPABILITIES.MANAGE_INTERVIEWS]) expect(can(ROLES.DIVISION_DIRECTOR, capability)).toBe(false)
    const rosters = readSource('src/features/rosters/RostersPage.jsx')
    expect(rosters).toContain("const overseer = role === ROLES.DIVISION_DIRECTOR")
    expect(rosters).toContain("r.status === 'pending' && canEdit ? (")
    expect(rosters).not.toMatch(/WRITERS = new Set\([^)]*DIVISION_DIRECTOR/)
    const registers = readSource('src/features/registers/registerAccess.js')
    expect(registers).toContain('canRecord: register => !overseer &&')
  })
})
