// @vitest-environment jsdom
// Behavior of staff vaccinations in the Prevention Center and of the bundle
// deviation follow-up, exercised through the rendered UI on the sample demo
// hospital and against a recording Supabase double. Replaces source-text
// assertions that pinned the components' formatting.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'

let profile
vi.mock('../src/core/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: profile.id, email: profile.email }, profile, isAuthenticated: true, isDemoSession: false, loading: false }),
}))

// Simulates a role that may view occupational health but not manage it.
let denyManageOccupationalHealth = false
vi.mock('../src/core/permissions/roles', async importOriginal => {
  const actual = await importOriginal()
  return {
    ...actual,
    can: (role, capability, ...rest) => (denyManageOccupationalHealth && capability === actual.CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH ? false : actual.can(role, capability, ...rest)),
  }
})

let vaccinationRows
vi.mock('../src/features/occupational-health/vaccinationService', () => ({
  loadAllVaccinationsAsync: vi.fn(async () => vaccinationRows),
  createVaccinationsBulkAsync: vi.fn(async () => []),
  updateVaccinationAsync: vi.fn(async () => null),
  deleteVaccinationAsync: vi.fn(async () => null),
}))

const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
const { FeedbackProvider } = await import('../src/core/feedback/FeedbackContext')
const { TenantProvider, useTenant } = await import('../src/core/tenant/TenantContext')
const { NotificationProvider } = await import('../src/core/notifications/NotificationContext')
const { isDemoDataEnvironment } = await import('../src/core/data/dataEnvironment')
const { PreventionPage } = await import('../src/features/prevention/PreventionPage')
const { PreventionRecordPage } = await import('../src/features/prevention/PreventionRecordPage')
const { BundleFollowUpDialog } = await import('../src/features/prevention/BundleFollowUpDialog')
const { loadBundlesLocal, saveBundlesLocal } = await import('../src/features/prevention/preventionStore')
const vaccinationService = await import('../src/features/occupational-health/vaccinationService')

let location
let navigationType
function LocationProbe() {
  location = useLocation()
  navigationType = useNavigationType()
  return null
}

let setReady
function Gate({ children }) {
  const [ready, set] = useState(false)
  setReady = set
  return ready ? children : null
}

async function renderOnDemo(path, element, routePath, seed) {
  let api
  function Capture() { api = useTenant(); return null }
  render(<MemoryRouter initialEntries={[path]}><LanguageProvider><FeedbackProvider><TenantProvider><NotificationProvider><Capture/><LocationProbe/>
    <Gate><Routes><Route path={routePath} element={element}/></Routes></Gate>
  </NotificationProvider></TenantProvider></FeedbackProvider></LanguageProvider></MemoryRouter>)
  await waitFor(() => expect(api?.enterSampleDemo).toBeTypeOf('function'))
  act(() => { api.enterSampleDemo() })
  await waitFor(() => expect(api.isDemo && api.tenant?.id && isDemoDataEnvironment()).toBeTruthy())
  seed?.()
  act(() => { setReady(true) })
  return api
}

const tableRows = () => [...document.querySelectorAll('tbody tr')]
const rowOf = text => tableRows().find(row => within(row).queryByText(text))

async function openVaccinations() {
  await renderOnDemo('/prevention?tab=vaccinations', <PreventionPage/>, '/prevention')
  await waitFor(() => expect(rowOf('Παπαδοπούλου Μαρία')).toBeTruthy(), { timeout: 5000 })
}

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {}
  localStorage.clear(); sessionStorage.clear()
  profile = { id: 'owner-1', isPlatformOwner: true, fullName: 'Platform Owner', isDemo: false }
  denyManageOccupationalHealth = false
  vaccinationRows = [
    { id: 'VAC-1', employeeId: 'EMP-001', vaccine: 'Εποχική γρίπη', dose: '1', date: '2026-09-10', lotNumber: 'L-1', validUntil: '2027-09-10', status: 'complete', clinicalNotes: '' },
    // EMP-004 (Αντωνίου Γεώργιος) is an inactive employee in the demo hospital.
    { id: 'VAC-2', employeeId: 'EMP-004', vaccine: 'Ηπατίτιδα Β', dose: '3', date: '2025-03-02', lotNumber: 'L-2', validUntil: '', status: 'complete', clinicalNotes: '' },
  ]
  vi.clearAllMocks()
})
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear() })

// Rule A1: vaccinations are a native Prevention tab — /prevention?tab=vaccinations
// opens it, selecting a tab writes ?tab=<id> with replace, and the records are
// listed in the registry table with the filter bar and pagination.
describe('staff vaccinations as a native Prevention tab', () => {
  it('opens the vaccinations tab from ?tab=vaccinations and lists the records in the registry', async () => {
    await openVaccinations()
    expect(screen.getByRole('tab', { name: 'Εμβολιασμοί' })).toHaveAttribute('aria-selected', 'true')
    expect(vaccinationService.loadAllVaccinationsAsync).toHaveBeenCalled()
    expect(rowOf('Παπαδοπούλου Μαρία')).toHaveTextContent('Εποχική γρίπη')
    expect(rowOf('Αντωνίου Γεώργιος')).toHaveTextContent('Ηπατίτιδα Β')
    const workspace = document.querySelector('.registry-workspace.prevention-workspace')
    expect(workspace.querySelector('.filter-system')).not.toBeNull()
    expect(within(workspace).getByPlaceholderText('Αναζήτηση εργαζομένου…')).toBeInTheDocument()
    expect(workspace.querySelector('.registry-pagination')).not.toBeNull()
  })

  it('filters the vaccination registry from the filter bar search', async () => {
    await openVaccinations()
    fireEvent.change(screen.getByPlaceholderText('Αναζήτηση εργαζομένου…'), { target: { value: 'Αντωνίου' } })
    await waitFor(() => expect(rowOf('Παπαδοπούλου Μαρία')).toBeUndefined())
    expect(rowOf('Αντωνίου Γεώργιος')).toBeTruthy()
  })

  it('writes the selected tab into the URL, replacing the history entry', async () => {
    await openVaccinations()
    fireEvent.click(screen.getByRole('tab', { name: 'Υγιεινή Χεριών' }))
    await waitFor(() => expect(location.search).toBe('?tab=handHygiene'))
    expect(navigationType).toBe('REPLACE')
    fireEvent.click(screen.getByRole('tab', { name: 'Εμβολιασμοί' }))
    await waitFor(() => expect(location.search).toBe('?tab=vaccinations'))
    expect(navigationType).toBe('REPLACE')
  })
})

// Rule A2: a new vaccination supports individual and bulk entry; in bulk mode
// each employee is one row with the checkbox first; saving calls the bulk
// create service with the selected employees and the Greek toast states the count.
describe('new vaccination: individual and bulk entry', () => {
  async function openNewVaccination() {
    await openVaccinations()
    fireEvent.click(screen.getByRole('button', { name: /Νέα καταχώρηση εμβολιασμού/ }))
    return screen.findByRole('dialog')
  }

  it('offers individual entry with a single employee picker', async () => {
    const dialog = await openNewVaccination()
    const modes = within(dialog).getByRole('group', { name: 'Τρόπος καταχώρησης' })
    expect(within(modes).getByRole('button', { name: /Μεμονωμένα/ })).toBeInTheDocument()
    expect(within(modes).getByRole('button', { name: /Μαζικός εμβολιασμός/ })).toBeInTheDocument()
    expect(within(dialog).getByRole('option', { name: /Παπαδοπούλου Μαρία/ })).toBeInTheDocument()
    expect(dialog.querySelector('.vaccination-employee-row')).toBeNull()
  })

  it('lists each employee as one row with the checkbox first and marks selected rows', async () => {
    const dialog = await openNewVaccination()
    fireEvent.click(within(dialog).getByRole('button', { name: /Μαζικός εμβολιασμός/ }))
    const rows = [...dialog.querySelectorAll('.vaccination-employee-row')]
    expect(rows.length).toBeGreaterThan(1)
    for (const row of rows) {
      expect(row.firstElementChild).toHaveAttribute('type', 'checkbox')
      const copy = row.children[1]
      expect(copy).toHaveClass('vaccination-employee-copy')
      expect(copy.firstElementChild.tagName).toBe('STRONG')
      expect(copy.querySelector('label')).toBeNull()
    }
    const maria = rows.find(row => within(row).queryByText('Παπαδοπούλου Μαρία'))
    expect(maria).not.toHaveClass('selected')
    fireEvent.click(within(maria).getByRole('checkbox'))
    expect(dialog.querySelector('.vaccination-employee-row.selected')).toHaveTextContent('Παπαδοπούλου Μαρία')
  })

  it('saves the bulk entry for the selected employees and reports the count in Greek', async () => {
    const dialog = await openNewVaccination()
    fireEvent.click(within(dialog).getByRole('button', { name: /Μαζικός εμβολιασμός/ }))
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Επιλογή Παπαδοπούλου Μαρία' }))
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Επιλογή Δημητρίου Νικόλαος' }))
    fireEvent.change(dialog.querySelector('.vaccination-fields select'), { target: { value: 'Εποχική γρίπη' } })
    const date = within(dialog).getAllByPlaceholderText('ηη/μμ/εεεε')[0]
    fireEvent.change(date, { target: { value: '01/10/2026' } })
    fireEvent.blur(date)
    fireEvent.click(within(dialog).getByRole('button', { name: /Αποθήκευση 2 εμβολιασμών/ }))
    await waitFor(() => expect(vaccinationService.createVaccinationsBulkAsync).toHaveBeenCalledTimes(1))
    const [, employees, draft] = vaccinationService.createVaccinationsBulkAsync.mock.calls[0]
    expect(employees.map(employee => employee.id).sort()).toEqual(['EMP-001', 'EMP-002'])
    expect(draft).toMatchObject({ vaccine: 'Εποχική γρίπη', date: '2026-10-01' })
    expect(await screen.findByText('Αποθηκεύτηκαν 2 εμβολιασμοί.')).toBeInTheDocument()
  })
})

// Rule A3: viewing an existing record of an inactive/resigned employee still
// shows that employee (the registry passes the employee resolved from the
// unfiltered employee map and the editor prefers it over the active-only list).
describe('vaccination record of an inactive employee', () => {
  it('shows the inactive employee in the record viewer', async () => {
    await openVaccinations()
    fireEvent.click(rowOf('Αντωνίου Γεώργιος'))
    const dialog = await screen.findByRole('dialog')
    const person = dialog.querySelector('.vaccination-record-person')
    expect(within(person).getByText('Αντωνίου Γεώργιος')).toBeInTheDocument()
    expect(person).toHaveTextContent('EMP-004')
  })
})

// Rule A4: the record Edit/Delete actions menu is shown only when canManage is
// true; PreventionPage passes canManage from the capability gating creation.
describe('vaccination record actions follow the manage capability', () => {
  it('offers Edit and Delete to a user who can manage occupational health', async () => {
    await openVaccinations()
    fireEvent.click(rowOf('Παπαδοπούλου Μαρία'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Περισσότερες ενέργειες' }))
    expect(within(dialog).getByRole('button', { name: 'Επεξεργασία' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Διαγραφή' })).toBeInTheDocument()
  })

  it('hides the actions menu (and creation) from a user who may only view', async () => {
    denyManageOccupationalHealth = true
    await openVaccinations()
    expect(screen.queryByRole('button', { name: /Νέα καταχώρηση εμβολιασμού/ })).toBeNull()
    fireEvent.click(rowOf('Παπαδοπούλου Μαρία'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Παπαδοπούλου Μαρία')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Περισσότερες ενέργειες' })).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Επεξεργασία' })).toBeNull()
  })
})

// Rule B1: a bundle record lists a 'Επανέλεγχος' action for every deviation
// (non-compliant item), and it opens BundleFollowUpDialog for that item.
describe('bundle deviation follow-up actions', () => {
  function seedTwoDeviations() {
    const base = loadBundlesLocal().find(row => row.id === 'BND-2602')
    const elements = base.templateSnapshot.rawElements
    const failed = elements.slice(0, 2)
    saveBundlesLocal([{
      ...base,
      id: 'BND-T1',
      answers: Object.fromEntries(elements.map((item, index) => [item.id, index < 2 ? 'no' : 'yes'])),
      findings: failed.map(item => ({ id: item.id, label: item.labelEl, note: '' })),
      failedCount: 2,
      allOrNone: false,
      followUps: {},
    }, ...loadBundlesLocal()])
    return failed.map(item => item.labelEl)
  }

  it('offers a follow-up for every deviation and records it through the dialog', async () => {
    let labels
    await renderOnDemo('/prevention/bundles/BND-T1', <PreventionRecordPage/>, '/prevention/:recordType/:recordId', () => { labels = seedTwoDeviations() })
    await waitFor(() => expect(document.querySelectorAll('.bundle-record-finding')).toHaveLength(2), { timeout: 5000 })
    const findings = [...document.querySelectorAll('.bundle-record-finding')]
    findings.forEach((finding, index) => {
      expect(finding).toHaveTextContent(labels[index])
      expect(within(finding).getByRole('button', { name: 'Επανέλεγχος' })).toBeInTheDocument()
    })
    fireEvent.click(within(findings[1]).getByRole('button', { name: 'Επανέλεγχος' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Επανέλεγχος Bundle')
    expect(dialog).toHaveTextContent(labels[1])
    fireEvent.change(dialog.querySelector('select'), { target: { value: 'resolved' } })
    const date = within(dialog).getByPlaceholderText('ηη/μμ/εεεε')
    fireEvent.change(date, { target: { value: '05/10/2026' } })
    fireEvent.blur(date)
    fireEvent.click(within(dialog).getByRole('button', { name: /Αποθήκευση επανελέγχου/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const reviewed = document.querySelectorAll('.bundle-record-finding')[1]
    expect(reviewed).toHaveTextContent('Διορθώθηκε')
    expect(reviewed).toHaveTextContent('Επανέλεγχος από: Platform Owner')
    expect(within(reviewed).getByRole('button', { name: 'Επεξεργασία επανελέγχου' })).toBeInTheDocument()
    expect(within(document.querySelectorAll('.bundle-record-finding')[0]).getByRole('button', { name: 'Επανέλεγχος' })).toBeInTheDocument()
  })
})

// Rule B2: the follow-up dialog offers resolved/open/not_applicable, requires
// the follow-up date and saves reviewedBy (actor name) and reviewedAt (ISO now)
// together with the status, date and comment.
describe('bundle follow-up dialog', () => {
  function renderDialog(onSave) {
    render(<LanguageProvider><BundleFollowUpDialog item={{ id: 'oral_care', label: 'Στοματική φροντίδα' }} onClose={() => {}} onSave={onSave}/></LanguageProvider>)
    return screen.getByRole('dialog')
  }

  it('offers the three follow-up statuses and requires status and date', () => {
    const dialog = renderDialog(vi.fn())
    const status = dialog.querySelector('select')
    expect([...status.options].map(option => option.value).filter(Boolean)).toEqual(['resolved', 'open', 'not_applicable'])
    expect(within(dialog).getByText('Ημερομηνία επανελέγχου *')).toBeInTheDocument()
    const save = within(dialog).getByRole('button', { name: /Αποθήκευση επανελέγχου/ })
    expect(save).toBeDisabled()
    fireEvent.change(status, { target: { value: 'open' } })
    expect(save).toBeDisabled()
    const date = within(dialog).getByPlaceholderText('ηη/μμ/εεεε')
    fireEvent.change(date, { target: { value: '05/10/2026' } })
    fireEvent.blur(date)
    expect(save).toBeEnabled()
  })

  it('saves status, date and comment with the reviewer and the review time', () => {
    const onSave = vi.fn()
    const dialog = renderDialog(onSave)
    fireEvent.change(dialog.querySelector('select'), { target: { value: 'not_applicable' } })
    const date = within(dialog).getByPlaceholderText('ηη/μμ/εεεε')
    fireEvent.change(date, { target: { value: '05/10/2026' } })
    fireEvent.blur(date)
    fireEvent.change(dialog.querySelector('textarea'), { target: { value: 'Ο ασθενής εξήλθε' } })
    const before = Date.now()
    fireEvent.click(within(dialog).getByRole('button', { name: /Αποθήκευση επανελέγχου/ }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0]
    expect(saved).toMatchObject({ status: 'not_applicable', date: '2026-10-05', comment: 'Ο ασθενής εξήλθε', reviewedBy: 'Platform Owner', reviewedById: 'owner-1' })
    expect(saved.reviewedAt).toBe(new Date(saved.reviewedAt).toISOString())
    expect(Date.parse(saved.reviewedAt)).toBeGreaterThanOrEqual(before - 1000)
    expect(Date.parse(saved.reviewedAt)).toBeLessThanOrEqual(Date.now() + 1000)
  })
})

// Rule B3: follow-ups persist separately from the original bundle answers —
// saveBundleFollowUp writes them under criteria.followUps keeping the answers,
// and loaded records expose followUps (default {}).
describe('bundle follow-up persistence (cloud)', () => {
  let queries
  let stored
  let service
  function builder(table) {
    const query = { table, op: 'select', payload: null, filters: [] }
    queries.push(query)
    const chain = {
      select() { return chain },
      insert(payload) { query.op = 'insert'; query.payload = payload; return chain },
      update(payload) { query.op = 'update'; query.payload = payload; return chain },
      eq(column, value) { query.filters.push(['eq', column, value]); return chain },
      or() { return chain },
      order() { return chain },
      single() { query.single = true; return chain },
      then(resolve, reject) { return Promise.resolve(respond(query)).then(resolve, reject) },
    }
    return chain
  }
  function respond(query) {
    if (query.table === 'prevention_bundle_assessments') {
      if (query.op === 'update') { stored = { ...stored, criteria: query.payload.criteria }; return { data: null, error: null } }
      if (query.single) return { data: { criteria: stored.criteria }, error: null }
      return { data: [stored, { id: 'BND-2', bundle_key: 'VAP', assessment_date: '2026-10-02', criteria: { answers: { a: 'yes' } }, evidence: [], status: 'completed' }], error: null }
    }
    return { data: [], error: null }
  }

  beforeEach(async () => {
    queries = []
    stored = { id: 'BND-1', bundle_key: 'VAP', assessment_date: '2026-10-01', status: 'completed', evidence: [], criteria: { answers: { oral_care: 'no', head_elevation: 'yes' }, answerNotes: { oral_care: 'Χωρίς χλωρεξιδίνη' }, followUps: { head_elevation: { status: 'open' } } } }
    vi.resetModules()
    vi.doMock('../src/core/supabase/client', () => ({
      supabase: { from: table => builder(table), auth: { getUser: async () => ({ data: { user: { id: 'actor-1' } }, error: null }) } },
    }))
    service = await import('../src/features/prevention/bundleCloudService')
  })
  afterEach(() => { vi.doUnmock('../src/core/supabase/client') })

  it('writes the follow-up under criteria.followUps and keeps the original answers', async () => {
    const followUp = { status: 'resolved', date: '2026-10-05', comment: 'OK', reviewedBy: 'Platform Owner', reviewedAt: '2026-10-05T10:00:00.000Z' }
    const saved = await service.saveBundleFollowUp('org-1', 'BND-1', 'oral_care', followUp)
    const [update] = queries.filter(q => q.table === 'prevention_bundle_assessments' && q.op === 'update')
    expect(update.filters).toEqual(expect.arrayContaining([['eq', 'organization_id', 'org-1'], ['eq', 'id', 'BND-1']]))
    expect(update.payload.updated_by).toBe('actor-1')
    expect(update.payload.criteria).toEqual({
      answers: { oral_care: 'no', head_elevation: 'yes' },
      answerNotes: { oral_care: 'Χωρίς χλωρεξιδίνη' },
      followUps: { head_elevation: { status: 'open' }, oral_care: followUp },
    })
    expect(saved.answers).toEqual({ oral_care: 'no', head_elevation: 'yes' })
    expect(saved.followUps).toEqual({ head_elevation: { status: 'open' }, oral_care: followUp })
  })

  it('exposes followUps on loaded records, defaulting to an empty object', async () => {
    const rows = await service.loadBundleAssessments('org-1')
    expect(rows.find(row => row.id === 'BND-1').followUps).toEqual({ head_elevation: { status: 'open' } })
    expect(rows.find(row => row.id === 'BND-2').followUps).toEqual({})
  })
})
