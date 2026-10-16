// @vitest-environment jsdom
// Surveillance Center list and creation flows on the sample Demo hospital, driven
// through the UI: environmental results outside limits need action (with a
// re-sampling for the same point), employees have a status column, the employee
// creation dialog keeps its footer outside the scrolling body and names the chosen
// employee, and the new patient surveillance picks the patient by typing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

let profile
vi.mock('../src/core/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: profile.id, email: profile.email },
    profile,
    isAuthenticated: true,
    isDemoSession: false,
    loading: false,
  }),
}))

const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
const { FeedbackProvider } = await import('../src/core/feedback/FeedbackContext')
const { TenantProvider, useTenant } = await import('../src/core/tenant/TenantContext')
const { NotificationProvider } = await import('../src/core/notifications/NotificationContext')
const { SurveillanceCanonicalPage } =
  await import('../src/features/surveillance/SurveillanceCanonicalPage')
const { employeeSurveillanceRecords } =
  await import('../src/features/surveillance/employeeSurveillanceData')
const { laboratorySamples } = await import('../src/features/laboratory/laboratoryDemoData')

function SampleRecord() {
  return <p>Καρτέλα δείγματος</p>
}

async function openCenter() {
  let api
  function Capture() {
    api = useTenant()
    return null
  }
  render(
    <MemoryRouter initialEntries={['/surveillance']}>
      <LanguageProvider>
        <FeedbackProvider>
          <TenantProvider>
            <NotificationProvider>
              <Capture />
              <Routes>
                <Route path="/surveillance" element={<SurveillanceCanonicalPage />} />
                <Route path="/surveillance/environment/:id" element={<SampleRecord />} />
              </Routes>
            </NotificationProvider>
          </TenantProvider>
        </FeedbackProvider>
      </LanguageProvider>
    </MemoryRouter>,
  )
  await waitFor(() => expect(api?.enterSampleDemo).toBeTypeOf('function'))
  act(() => {
    api.enterSampleDemo()
  })
  await waitFor(() => expect(screen.getAllByText('Ελένη Παπαδοπούλου').length).toBeGreaterThan(0), {
    timeout: 5000,
  })
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 200))
  })
  return api
}
const openTab = async name => {
  fireEvent.click(screen.getByRole('tab', { name }))
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 50))
  })
}
const rowOf = text => screen.getByText(text).closest('tr')
const statusCell = row => row.querySelector('td:last-child')
const metric = label => screen.getByText(label).closest('.metric-card')
const openCreation = async subject => {
  fireEvent.click(screen.getByRole('button', { name: /Δημιουργία/ }))
  const chooser = await screen.findByRole('dialog')
  fireEvent.click(within(chooser).getByRole('button', { name: subject }))
}

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {}
  localStorage.clear()
  sessionStorage.clear()
  profile = { id: 'owner-1', isPlatformOwner: true, fullName: 'Platform Owner', isDemo: false }
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

describe('Environment tab: results outside limits', () => {
  it('shows an out-of-limit result as needing action, not as completed', async () => {
    await openCenter()
    await openTab(/Περιβάλλον/)
    const row = rowOf('ENV-260824-003')
    expect(row).toHaveTextContent('Εκτός αποδεκτών ορίων')
    const badge = within(statusCell(row)).getByText('Χρειάζεται ενέργεια')
    expect(badge).toHaveClass('status-badge', 'warning')
    expect(statusCell(row)).not.toHaveTextContent('Ολοκληρώθηκε')
    // A result within limits stays completed.
    expect(statusCell(rowOf('ENV-260826-001'))).toHaveTextContent('Ολοκληρώθηκε')
  })

  it('gives in-progress samples an info tone instead of the success tone', async () => {
    await openCenter()
    await openTab(/Περιβάλλον/)
    const badge = within(statusCell(rowOf('ENV-260828-004'))).getByText('Σε επεξεργασία')
    expect(badge).toHaveClass('info')
    expect(badge).not.toHaveClass('active')
  })

  it('counts the rows needing action in the critical findings tile', async () => {
    await openCenter()
    await openTab(/Περιβάλλον/)
    const needingAction = screen.getAllByText('Χρειάζεται ενέργεια').length
    expect(needingAction).toBeGreaterThan(0)
    expect(metric('Κρίσιμα ευρήματα')).toHaveTextContent(String(needingAction))
  })

  it('starts a re-sampling of the same point from the row, without opening the sample', async () => {
    await openCenter()
    await openTab(/Περιβάλλον/)
    const row = rowOf('ENV-260824-003')
    fireEvent.click(within(row).getByRole('button', { name: /Επαναδειγματοληψία/ }))
    expect(screen.queryByText('Καρτέλα δείγματος')).toBeNull()
    expect(await screen.findByText('Επαναδειγματοληψία σημείου')).toBeInTheDocument()
    // Location, point and method are searchable lists that keep the earlier sample's values.
    expect(screen.getByRole('combobox', { name: 'Χώρος / περιοχή' })).toHaveValue('Παθολογική')
    expect(screen.getByRole('combobox', { name: 'Σημείο δειγματοληψίας' })).toHaveValue('Ντους θαλάμου 12')
    expect(screen.getByRole('combobox', { name: 'Μέθοδος δειγματοληψίας' })).toHaveValue('Νερό ντους')
    expect(screen.getByLabelText('Σημειώσεις')).toHaveValue('Επαναδειγματοληψία για ENV-260824-003')
  })

  it('offers no re-sampling for results within limits', async () => {
    await openCenter()
    await openTab(/Περιβάλλον/)
    expect(within(rowOf('ENV-260826-001')).queryByRole('button')).toBeNull()
  })
})

describe('Employees tab: status column', () => {
  const record = {
    id: 'ESUR-TEST-1',
    subjectType: 'employee',
    employeeId: 'EMP-008',
    employeeName: 'Σταθάτου Δήμητρα',
    employeeNameEn: 'Dimitra Stathatou',
    department: 'Ποιότητα',
    departmentEn: 'Quality',
    startedAt: '2026-09-20',
    screeningTypes: ['nasalSwab'],
    status: 'active',
    sampleIds: ['LAB-EMP-TEST-1'],
    timeline: [],
  }
  const sample = {
    id: 'LAB-EMP-TEST-1',
    subjectType: 'employee',
    type: 'employeeScreening',
    employeeSurveillanceCase: 'ESUR-TEST-1',
    status: 'completed',
    result: 'positive',
    resultStatus: 'validated',
    finalizedAt: '2026-09-22T10:00:00+03:00',
  }
  beforeEach(() => {
    employeeSurveillanceRecords.push(record)
    laboratorySamples.push(sample)
  })
  afterEach(() => {
    employeeSurveillanceRecords.splice(employeeSurveillanceRecords.indexOf(record), 1)
    laboratorySamples.splice(laboratorySamples.indexOf(sample), 1)
  })

  it('shows a status for each employee surveillance, like the other tabs', async () => {
    await openCenter()
    await openTab(/Εργαζόμενοι/)
    expect(screen.getByRole('columnheader', { name: 'Κατάσταση' })).toBeInTheDocument()
    expect(statusCell(rowOf('Παπαδοπούλου Μαρία'))).toHaveTextContent('Ενεργός')
    expect(statusCell(rowOf('Κωνσταντίνου Ελένη'))).toHaveTextContent('Ολοκληρώθηκε')
  })

  it('marks a positive screening without follow-up as needing follow-up', async () => {
    await openCenter()
    await openTab(/Εργαζόμενοι/)
    const badge = within(statusCell(rowOf('Σταθάτου Δήμητρα'))).getByText(
      'Χρειάζεται παρακολούθηση',
    )
    expect(badge).toHaveClass('warning')
  })
})

describe('New employee surveillance dialog', () => {
  it('keeps the footer actions outside the scrolling body', async () => {
    await openCenter()
    await openCreation(/Εργαζόμενος/)
    const create = await screen.findByRole('button', { name: 'Δημιουργία επιτήρησης' })
    const body = document.querySelector('.employee-surveillance-body')
    expect(body).not.toBeNull()
    expect(within(body).getByText('Τύπος ελέγχου')).toBeInTheDocument()
    expect(body.contains(create)).toBe(false)
    // The dialog closes with its × alone: no separate «Ακύρωση».
    expect(screen.queryByRole('button', { name: 'Ακύρωση' })).toBeNull()
  })

  it('picks one or more employees from a single multi-select, with no individual/bulk switch', async () => {
    await openCenter()
    await openCreation(/Εργαζόμενος/)
    const field = await screen.findByRole('button', { name: 'Εργαζόμενοι' })
    expect(screen.queryByRole('button', { name: /Μαζική επιτήρηση/ })).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(field).toHaveTextContent('Επιλέξτε εργαζόμενους')
    const create = screen.getByRole('button', { name: 'Δημιουργία επιτήρησης' })
    expect(create).toBeDisabled()
    fireEvent.click(field)
    fireEvent.click(await screen.findByRole('option', { name: /Παπαδοπούλου Μαρία/ }))
    expect(field).toHaveTextContent('Παπαδοπούλου Μαρία')
    expect(create).toBeEnabled()
    fireEvent.click(screen.getByRole('option', { name: /Δημητρίου Νικόλαος/ }))
    expect(screen.getByRole('option', { name: /Δημητρίου Νικόλαος/ })).toHaveAttribute('aria-selected', 'true')
    expect(field).toHaveTextContent('Δημητρίου Νικόλαος')
    fireEvent.click(screen.getByRole('button', { name: 'Επιλογή όλων' }))
    expect(field).toHaveTextContent(/επιλεγμένοι εργαζόμενοι/)
  })
})

describe('New patient surveillance: searchable patient picker', () => {
  const patientPicker = () => screen.getByRole('combobox', { name: 'Ασθενής' })

  it('filters patients by name as the user types and picks one with the keyboard', async () => {
    await openCenter()
    await openCreation(/Ασθενής/)
    const input = await screen.findByRole('combobox', { name: 'Ασθενής' })
    fireEvent.change(input, { target: { value: 'παπαδοπ' } })
    const list = screen.getByRole('listbox', { name: 'Ασθενής' })
    expect(within(list).getByRole('option', { name: /Ελένη Παπαδοπούλου/ })).toBeInTheDocument()
    expect(within(list).queryByRole('option', { name: /Νικόλαος Γεωργίου/ })).toBeNull()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(patientPicker()).toHaveValue('Ελένη Παπαδοπούλου · PT-260184')
    expect(patientPicker()).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.getByText(/Ελένη Παπαδοπούλου · PT-260184/, { selector: 'p' }),
    ).toBeInTheDocument()
  })

  it('filters patients by patient code and picks one with the mouse', async () => {
    await openCenter()
    await openCreation(/Ασθενής/)
    const input = await screen.findByRole('combobox', { name: 'Ασθενής' })
    fireEvent.change(input, { target: { value: 'pt-260179' } })
    const options = within(screen.getByRole('listbox', { name: 'Ασθενής' })).getAllByRole('option')
    expect(options).toHaveLength(1)
    fireEvent.click(options[0])
    expect(patientPicker()).toHaveValue('Νικόλαος Γεωργίου · PT-260179')
  })

  it('says when no patient matches and Escape restores the previous text', async () => {
    await openCenter()
    await openCreation(/Ασθενής/)
    const input = await screen.findByRole('combobox', { name: 'Ασθενής' })
    fireEvent.change(input, { target: { value: 'zzzz' } })
    expect(screen.getByText('Δεν βρέθηκαν ασθενείς')).toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input).toHaveValue('')
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('English labels', () => {
  it('labels the picker and the needs-action status in English', async () => {
    localStorage.setItem('limoxis.language', 'en')
    await act(async () => {
      await (await import('../src/core/i18n/LanguageContext')).loadLanguage('en')
    })
    let api
    function Capture() {
      api = useTenant()
      return null
    }
    render(
      <MemoryRouter initialEntries={['/surveillance']}>
        <LanguageProvider>
          <FeedbackProvider>
            <TenantProvider>
              <NotificationProvider>
                <Capture />
                <Routes>
                  <Route path="/surveillance" element={<SurveillanceCanonicalPage />} />
                </Routes>
              </NotificationProvider>
            </TenantProvider>
          </FeedbackProvider>
        </LanguageProvider>
      </MemoryRouter>,
    )
    await waitFor(() => expect(api?.enterSampleDemo).toBeTypeOf('function'))
    act(() => {
      api.enterSampleDemo()
    })
    await waitFor(
      () => expect(screen.getByRole('tab', { name: /Environment/ })).toBeInTheDocument(),
      {
        timeout: 5000,
      },
    )
    await openTab(/Environment/)
    await waitFor(() => expect(rowOf('ENV-260824-003')).toHaveTextContent('Action needed'))
    expect(
      within(rowOf('ENV-260824-003')).getByRole('button', { name: /Re-sample/ }),
    ).toBeInTheDocument()
    await openTab(/Employees/)
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Create/ }))
    const chooser = await screen.findByRole('dialog')
    fireEvent.click(within(chooser).getByRole('button', { name: /^Patient/ }))
    expect(await screen.findByRole('combobox', { name: 'Patient' })).toBeInTheDocument()
  })
})

describe('empty surveillance lists', () => {
  const environmental = () => laboratorySamples.filter(x => x.subjectType === 'environment')
  let removed = []
  afterEach(() => {
    laboratorySamples.push(...removed)
    removed = []
  })
  const emptyEnvironment = () => {
    removed = environmental()
    for (const sample of removed) laboratorySamples.splice(laboratorySamples.indexOf(sample), 1)
  }

  it('says nothing matches when the search hides every record', async () => {
    await openCenter()
    fireEvent.change(screen.getByPlaceholderText('Αναζήτηση'), { target: { value: 'zzz-κανένας' } })
    expect(
      await screen.findByText('Δεν βρέθηκαν εγγραφές με αυτή την αναζήτηση ή τα φίλτρα'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Δεν υπάρχουν επιτηρήσεις ασθενών')).toBeNull()
  })

  it('invites the first record only from those who can create one', async () => {
    emptyEnvironment()
    const api = await openCenter()
    await openTab(/Περιβάλλον/)
    expect(
      await screen.findByText('Δεν υπάρχουν καταγραφές περιβαλλοντικής επιτήρησης'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Πατήστε «Δημιουργία»/)).toBeInTheDocument()
    act(() => {
      api.startRolePreview('infection_control_member')
    })
    await waitFor(() => expect(screen.queryByText(/Πατήστε «Δημιουργία»/)).toBeNull())
    expect(
      screen.getByText('Δεν υπάρχουν καταγραφές περιβαλλοντικής επιτήρησης'),
    ).toBeInTheDocument()
  })
})
