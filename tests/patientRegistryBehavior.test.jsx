// @vitest-environment jsdom
// The patient registry on the sample demo hospital: honest empty states, and
// New patient on its own page (like New employee) that opens the new record.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'

vi.mock('../src/core/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner-1' }, profile: { id: 'owner-1', isPlatformOwner: true, fullName: 'Platform Owner', isDemo: false }, isAuthenticated: true, isDemoSession: false, loading: false }),
}))

const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
const { FeedbackProvider } = await import('../src/core/feedback/FeedbackContext')
const { TenantProvider, useTenant } = await import('../src/core/tenant/TenantContext')
const { PatientsPage } = await import('../src/features/patients/PatientsPage')
const { PatientCreatePage } = await import('../src/features/patients/PatientCreatePage')
function RecordStub() { return <div>patient record {useParams().patientId}</div> }

async function openRegistry() {
  let api
  function Capture() { api = useTenant(); return null }
  render(<MemoryRouter initialEntries={['/patients']}><LanguageProvider><FeedbackProvider><TenantProvider><Capture/>
    <Routes>
      <Route path="/patients" element={<PatientsPage/>}/>
      <Route path="/patients/new" element={<PatientCreatePage/>}/>
      <Route path="/patients/:patientId" element={<RecordStub/>}/>
    </Routes>
  </TenantProvider></FeedbackProvider></LanguageProvider></MemoryRouter>)
  await waitFor(() => expect(api?.enterSampleDemo).toBeTypeOf('function'))
  act(() => { api.enterSampleDemo() })
  await waitFor(() => expect(document.querySelectorAll('tbody tr').length).toBeGreaterThan(0))
}

afterEach(() => { cleanup(); sessionStorage.clear() })

describe('patient registry', () => {
  it('says nothing matches when the search hides every patient, and hides the pager', async () => {
    await openRegistry()
    fireEvent.change(screen.getByPlaceholderText(/Αναζήτηση/), { target: { value: 'zzzz-no-such-patient' } })
    expect(await screen.findByText('Δεν βρέθηκαν εγγραφές με αυτή την αναζήτηση ή τα φίλτρα')).toBeInTheDocument()
    expect(document.querySelector('.registry-pagination')).toBeNull()
  })

  it('opens New patient as a page and, once saved, the new patient record', async () => {
    await openRegistry()
    fireEvent.click(screen.getByRole('button', { name: /Δημιουργία/ }))
    const page = await waitFor(() => {
      const node = document.querySelector('.patient-create-shell')
      expect(node).not.toBeNull()
      return node
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(page).getByRole('heading', { name: 'Νέος ασθενής' })).toBeInTheDocument()
    expect(within(page).queryByRole('button', { name: 'Ακύρωση' })).not.toBeInTheDocument()
    const inputs = within(page).getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: 'PT-TEST-1' } })
    fireEvent.change(inputs[1], { target: { value: 'Δοκιμή' } })
    fireEvent.change(inputs[2], { target: { value: 'Ασθενής' } })
    const admission = within(page).getByText(/Ημερομηνία εισαγωγής \*/).closest('label,div').querySelector('input')
    fireEvent.change(admission, { target: { value: '01/10/2026' } })
    fireEvent.blur(admission)
    fireEvent.click(within(page).getByRole('button', { name: /Αποθήκευση/ }))
    expect(await screen.findByText('patient record PT-TEST-1')).toBeInTheDocument()
    const { loadPatients } = await import('../src/features/patients/patientsService')
    expect((await loadPatients('demo-hospital', { isDemo: true })).some(p => p.id === 'PT-TEST-1')).toBe(true)
  })
})
