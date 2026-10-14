// @vitest-environment jsdom
// The patient registry on the sample demo hospital: honest empty states, and a
// new patient that stays in the list instead of opening its record.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../src/core/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner-1' }, profile: { id: 'owner-1', isPlatformOwner: true, fullName: 'Platform Owner', isDemo: false }, isAuthenticated: true, isDemoSession: false, loading: false }),
}))

const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
const { FeedbackProvider } = await import('../src/core/feedback/FeedbackContext')
const { TenantProvider, useTenant } = await import('../src/core/tenant/TenantContext')
const { PatientsPage } = await import('../src/features/patients/PatientsPage')

async function openRegistry() {
  let api
  function Capture() { api = useTenant(); return null }
  render(<MemoryRouter initialEntries={['/patients']}><LanguageProvider><FeedbackProvider><TenantProvider><Capture/>
    <Routes>
      <Route path="/patients" element={<PatientsPage/>}/>
      <Route path="/patients/:patientId" element={<div>patient record</div>}/>
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

  it('creates a patient from a dialog with × alone and keeps the registry open on it', async () => {
    await openRegistry()
    fireEvent.click(screen.getByRole('button', { name: /Δημιουργία/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByRole('button', { name: 'Ακύρωση' })).not.toBeInTheDocument()
    const inputs = within(dialog).getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: 'PT-TEST-1' } })
    fireEvent.change(inputs[1], { target: { value: 'Δοκιμή' } })
    fireEvent.change(inputs[2], { target: { value: 'Ασθενής' } })
    const admission = within(dialog).getByText(/Ημερομηνία εισαγωγής \*/).closest('label,div').querySelector('input')
    fireEvent.change(admission, { target: { value: '01/10/2026' } })
    fireEvent.blur(admission)
    fireEvent.click(within(dialog).getByRole('button', { name: /Αποθήκευση/ }))
    const row = await waitFor(() => {
      const node = document.querySelector('tr[data-record-id="PT-TEST-1"]')
      expect(node).not.toBeNull()
      return node
    })
    expect(row).toHaveClass('registry-row-returned')
    expect(screen.queryByText('patient record')).not.toBeInTheDocument()
  })
})
