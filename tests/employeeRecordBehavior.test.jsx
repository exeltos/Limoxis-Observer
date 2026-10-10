// @vitest-environment jsdom
// Behavior of the employee record, exercised through the rendered UI on the
// sample demo hospital.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

let profile
vi.mock('../src/core/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: profile.id, email: profile.email }, profile, isAuthenticated: true, isDemoSession: false, loading: false }),
}))

const { LanguageProvider, loadLanguage } = await import('../src/core/i18n/LanguageContext')
const { FeedbackProvider } = await import('../src/core/feedback/FeedbackContext')
const { TenantProvider, useTenant } = await import('../src/core/tenant/TenantContext')
const { NotificationProvider } = await import('../src/core/notifications/NotificationContext')
const { EmployeeRecordPage } = await import('../src/features/employees/EmployeeRecordPage')

function TrainingTarget() {
  const location = useLocation()
  return <pre data-testid="training-target">{JSON.stringify({ path: location.pathname, state: location.state })}</pre>
}

async function openEmployee({ path = '/employees/EMP-001', selfMode = false, previewRole = null } = {}) {
  let api
  function Capture() { api = useTenant(); return null }
  render(<MemoryRouter initialEntries={[path]}><LanguageProvider><FeedbackProvider><TenantProvider><NotificationProvider><Capture/>
    <Routes>
      <Route path="/employees/:employeeId" element={<EmployeeRecordPage/>}/>
      <Route path="/my-profile" element={<EmployeeRecordPage selfMode/>}/>
      <Route path="/training/*" element={<TrainingTarget/>}/>
    </Routes>
  </NotificationProvider></TenantProvider></FeedbackProvider></LanguageProvider></MemoryRouter>)
  await waitFor(() => expect(api?.enterSampleDemo).toBeTypeOf('function'))
  act(() => { api.enterSampleDemo() })
  if (previewRole) {
    await waitFor(() => expect(api.isDemo).toBe(true))
    act(() => { api.startRolePreview(previewRole) })
  }
  await waitFor(() => expect(screen.queryAllByRole('tab').length).toBeGreaterThan(0), { timeout: 5000 })
  return selfMode ? api : api
}
const body = () => document.querySelector('.entity-record-body')
const openRow = async text => fireEvent.click((await within(body()).findByText(text)).closest('tr'))
const openTab = name => fireEvent.click(screen.getByRole('tab', { name: new RegExp(name) }))
const tabNames = () => screen.getAllByRole('tab').map(tab => tab.textContent.trim())

beforeEach(() => {
  localStorage.clear()
  profile = { id: 'owner-1', isPlatformOwner: true, fullName: 'Platform Owner', isDemo: false }
})
afterEach(() => { cleanup(); localStorage.clear() })

describe('employee record tabs', () => {
  it('groups visits, vaccinations and exposure incidents under the occupational health tab', async () => {
    await openEmployee()
    openTab('Ιατρός Εργασίας')
    const sections = within(body()).getByRole('tablist', { name: 'Ιατρός Εργασίας' })
    expect(within(sections).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Επισκέψεις', 'Εμβολιασμοί', 'Περιστατικά έκθεσης'])
    expect(await within(body()).findByText('Τύπος επίσκεψης')).toBeInTheDocument()
    for (const section of ['Εμβολιασμοί', 'Περιστατικά έκθεσης']) {
      fireEvent.click(within(sections).getByRole('tab', { name: section }))
      expect(within(sections).getByRole('tab', { name: section })).toHaveAttribute('aria-selected', 'true')
      await waitFor(() => expect(body().querySelector('.record-section')).not.toBeNull())
    }
    expect(within(body()).queryByRole('button', { name: /Νέ(ο|α) περιστατικ|Καταχώριση/ })).not.toBeInTheDocument()
  })

  it('hides occupational health from a role without occupational access', async () => {
    await openEmployee({ previewRole: 'hr_office' })
    await waitFor(() => expect(tabNames()).not.toContain('Ιατρός Εργασίας'))
    expect(tabNames()).toContain('Στοιχεία')
  })

  it('offers the demo departments when editing the employee', async () => {
    await openEmployee()
    fireEvent.click(await screen.findByRole('button', { name: 'Ενέργειες εργαζομένου' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Επεξεργασία εργαζομένου' }))
    const department = within(body()).getByText('Τμήμα').closest('.detail-field').querySelector('select')
    expect(within(department).getAllByRole('option').map(option => option.textContent)).toEqual(expect.arrayContaining(['ΜΕΘ', 'Παθολογική', 'Νεογνολογική / ΜΕΝΝ']))
  })
})

describe('employee surveillance', () => {
  it('starts surveillance with the shared flow and opens episodes in the shared record dialog with their samples', async () => {
    await openEmployee()
    openTab('Επιτήρηση')
    fireEvent.click(within(body()).getByRole('button', { name: /Νέα επιτήρηση/ }))
    const flow = (await screen.findByRole('heading', { name: 'Νέα επιτήρηση εργαζομένων' })).closest('.employee-surveillance-entry')
    expect(flow).not.toBeNull()
    cleanup()
    await openEmployee()
    openTab('Επιτήρηση')
    await openRow('ESUR-260801')
    const record = await screen.findByRole('dialog')
    expect(within(record).getAllByText(/LAB-/).length).toBeGreaterThan(0)
  })
})

describe('training and evaluations', () => {
  it('opens a training programme and returns to the same employee training tab', async () => {
    await openEmployee()
    openTab('Εκπαίδευση')
    await openRow('Ασφαλής διαχείριση αιχμηρών')
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Άνοιγμα εκπαίδευσης' }))
    const target = JSON.parse((await screen.findByTestId('training-target')).textContent)
    expect(target.path).toMatch(/^\/training\//)
    expect(target.state.limoxisFrom).toEqual(expect.objectContaining({ pathname: '/employees/EMP-001', tab: 'training' }))
  })

  it('shows a knowledge assessment from Training with its questionnaire review', async () => {
    await openEmployee()
    openTab('Αξιολογήσεις')
    await openRow('Αξιολόγηση γνώσεων · Ασφαλής διαχείριση αιχμηρών')
    const dialog = await screen.findByRole('dialog')
    expect(dialog.querySelector('.training-assessment-review')).not.toBeNull()
  })

  it('translates the performance criteria for English', async () => {
    await loadLanguage('en')
    localStorage.setItem('limoxis.language', 'en')
    await openEmployee()
    fireEvent.click(screen.getByRole('tab', { name: /Evaluations/ }))
    fireEvent.click((await within(body()).findAllByText('Performance evaluation'))[0].closest('tr'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Professional competence')).toBeInTheDocument()
    expect(within(dialog).queryByText(/Επαγγελματική επάρκεια/)).not.toBeInTheDocument()
  })
})

describe('documents and history', () => {
  it('keeps documents and certifications in the shared documents workspace', async () => {
    await openEmployee()
    openTab('Έγγραφα')
    expect(within(body()).getByRole('heading', { name: 'Έγγραφα & Πιστοποιήσεις' })).toBeInTheDocument()
    expect(within(body()).getByText(/BLS — BLS-2025-001.pdf/)).toBeInTheDocument()
    expect(within(body()).getByRole('button', { name: /Προσθήκη εγγράφου/ })).toBeInTheDocument()
  })

  it('lists the audit history as a paged registry with changes and user', async () => {
    await openEmployee()
    openTab('Ιστορικό')
    await waitFor(() => expect(within(body()).getByText('Μεταβολές')).toBeInTheDocument())
    expect(within(body()).getByText('Χρήστης')).toBeInTheDocument()
    expect(body().querySelector('.scroll-table table')).not.toBeNull()
    expect(body().querySelector('.registry-pagination')).toHaveTextContent('1–3 από 3')
  })
})

describe('my profile', () => {
  it('resolves the signed-in user to their employee record and shows it read-only', async () => {
    profile = { ...profile, email: 'm.papadopoulou@example.org' }
    await openEmployee({ path: '/my-profile', selfMode: true })
    await waitFor(() => expect(screen.getByText('Η προσωπική σας καρτέλα είναι μόνο για προβολή')).toBeInTheDocument())
    expect(screen.getAllByText(/Παπαδοπούλου/).length).toBeGreaterThan(0)
    expect(tabNames()).toContain('Ιατρός Εργασίας')
    openTab('Επιτήρηση')
    expect(within(body()).queryByRole('button', { name: /Νέα επιτήρηση/ })).not.toBeInTheDocument()
  })
})
