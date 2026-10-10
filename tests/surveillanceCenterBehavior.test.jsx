// @vitest-environment jsdom
// The Surveillance Center on the sample Demo hospital, driven through the UI:
// one row per patient, the opened row marked on return, and the creation
// chooser leading to the shared new-surveillance flow.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'

let profile
vi.mock('../src/core/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: profile.id, email: profile.email }, profile, isAuthenticated: true, isDemoSession: false, loading: false }),
}))

const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
const { FeedbackProvider } = await import('../src/core/feedback/FeedbackContext')
const { TenantProvider, useTenant } = await import('../src/core/tenant/TenantContext')
const { NotificationProvider } = await import('../src/core/notifications/NotificationContext')
const { SurveillanceCanonicalPage } = await import('../src/features/surveillance/SurveillanceCanonicalPage')

function CaseRecord() {
  const navigate = useNavigate()
  return <button type="button" onClick={() => navigate(-1)}>Πίσω στη λίστα</button>
}

async function openCenter() {
  let api
  function Capture() { api = useTenant(); return null }
  render(<MemoryRouter initialEntries={['/surveillance']}><LanguageProvider><FeedbackProvider><TenantProvider><NotificationProvider><Capture/>
    <Routes>
      <Route path="/surveillance" element={<SurveillanceCanonicalPage/>}/>
      <Route path="/surveillance/:caseId" element={<CaseRecord/>}/>
    </Routes>
  </NotificationProvider></TenantProvider></FeedbackProvider></LanguageProvider></MemoryRouter>)
  await waitFor(() => expect(api?.enterSampleDemo).toBeTypeOf('function'))
  act(() => { api.enterSampleDemo() })
  await waitFor(() => expect(rowOf('Ελένη Παπαδοπούλου').length).toBeGreaterThan(0), { timeout: 5000 })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 200)) })
  await waitFor(() => expect(rowOf('Ελένη Παπαδοπούλου').length).toBeGreaterThan(0), { timeout: 5000 })
}
const patientRows = () => [...document.querySelectorAll('tbody tr')]
const rowOf = name => patientRows().filter(row => within(row).queryByText(name))

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {}
  localStorage.clear(); sessionStorage.clear()
  profile = { id: 'owner-1', isPlatformOwner: true, fullName: 'Platform Owner', isDemo: false }
})
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear() })

describe('Surveillance Center registry', () => {
  it('lists each patient once, summarising their episodes', async () => {
    await openCenter()
    await waitFor(() => expect(rowOf('Ελένη Παπαδοπούλου')).toHaveLength(1))
    const rows = rowOf('Ελένη Παπαδοπούλου')
    expect(rows[0]).toHaveTextContent('2 επιτηρήσεις')
    expect(rows[0]).toHaveTextContent('1 ενεργή')
  })

  it('marks the opened patient when the user comes back, keeping the row clickable', async () => {
    await openCenter()
    fireEvent.click(rowOf('Ελένη Παπαδοπούλου')[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Πίσω στη λίστα' }))
    await waitFor(() => expect(rowOf('Ελένη Παπαδοπούλου')[0]).toHaveClass('registry-row-returned'))
    expect(rowOf('Ελένη Παπαδοπούλου')[0]).toHaveClass('clickable-row')
    expect(rowOf('Νικόλαος Γεωργίου')[0]).not.toHaveClass('registry-row-returned')
  })

  it('starts a patient surveillance from the creation chooser with the shared flow', async () => {
    await openCenter()
    fireEvent.click(screen.getByRole('button', { name: /Δημιουργία/ }))
    const chooser = await screen.findByRole('dialog')
    expect(within(chooser).getByRole('button', { name: /Εργαζόμενος/ })).toBeInTheDocument()
    expect(within(chooser).getByRole('button', { name: /Περιβαλλοντική επιτήρηση/ })).toBeInTheDocument()
    fireEvent.click(within(chooser).getByRole('button', { name: /Ασθενής/ }))
    const flow = await screen.findByRole('dialog')
    expect(within(flow).getByText('Νέα επιτήρηση')).toBeInTheDocument()
    expect(within(flow).getAllByText('Επιλογή ασθενούς').length).toBeGreaterThan(0)
  })
})
