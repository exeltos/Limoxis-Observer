// @vitest-environment jsdom
// The interviews list and record in demo mode (data kept in the browser).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'

const feedback = { notify: vi.fn(), notifyError: vi.fn(), confirm: vi.fn(async () => true) }
const tenant = { tenant: { id: 'demo-hospital' }, role: 'hr_office', actualRole: 'hr_office', isRolePreview: false, isDemo: true, membership: { capabilities: [], customCapabilities: [] } }
vi.mock('../src/core/supabase/client', () => ({ supabase: { rpc: vi.fn(), from: vi.fn(), functions: { invoke: vi.fn() } } }))
vi.mock('../src/core/tenant/TenantContext', () => ({ useTenant: () => tenant }))
vi.mock('../src/core/feedback/FeedbackContext', () => ({ useFeedback: () => feedback, useOptionalFeedback: () => feedback }))
vi.mock('../src/core/audit/useAuditActor', () => ({ useAuditActor: () => ({ id: 'u-hr', name: 'Γραφείο Προσωπικού' }) }))
vi.mock('../src/features/employees/useEmployeesData', () => ({ useEmployeesData: () => ({ data: [{ id: 'EMP-1', firstName: 'Μαρία', lastName: 'Παπαδοπούλου', department: 'Χειρουργική' }] }) }))

const { InterviewsPage } = await import('../src/features/interviews/InterviewsPage')
const { InterviewRecordPage } = await import('../src/features/interviews/InterviewRecordPage')

const renderAt = path => render(<LanguageProvider><MemoryRouter initialEntries={[path]}><Routes>
  <Route path="/interviews" element={<InterviewsPage />} />
  <Route path="/interviews/:candidateId" element={<InterviewRecordPage />} />
</Routes></MemoryRouter></LanguageProvider>)

describe('Interviews screens (demo)', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); configureDataEnvironment({ mode: 'demo', demoAccountId: `interviews-ui-${Math.random()}` }) })
  afterEach(cleanup)

  it('shows the pipeline cards, the open applications and filters by status', async () => {
    renderAt('/interviews')
    expect(await screen.findByText('Κωνσταντίνου Δήμητρα')).toBeInTheDocument()
    expect(screen.queryByText('Παππά Χριστίνα')).not.toBeInTheDocument()
    // The closed applications are one choice of «Filters».
    fireEvent.click(screen.getByRole('button', { name: /Φίλτρα/ }))
    fireEvent.change(screen.getByLabelText('Κατάσταση'), { target: { value: 'rejected' } })
    expect(await screen.findByText('Παππά Χριστίνα')).toBeInTheDocument()
    // No cards above the list: the steps that ask for something are counted in the status choices.
    expect(screen.queryByText('Επόμενες συνεντεύξεις')).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Νέα αίτηση \(\d+\)/ })).toBeInTheDocument()
  })

  it('opens an application as one screen: details, CV, notes and the three answers', async () => {
    renderAt('/interviews/demo-cand-3')
    expect(await screen.findByRole('heading', { name: 'Μιχαηλίδου Άννα' })).toBeInTheDocument()
    // Education, languages and previous employers are on the same screen.
    expect(screen.getByText('Νοσηλευτική Πανεπιστημίου Θεσσαλίας')).toBeInTheDocument()
    expect(screen.getByText('Γενικό Νοσοκομείο (παράδειγμα)')).toBeInTheDocument()
    // One screen: the application, the notes of the discussion and the three answers.
    expect(screen.getByText('Σημειώσεις συζήτησης')).toBeInTheDocument()
    for (const name of ['Πρόσληψη', 'Αναμονή', 'Απόρριψη']) expect(screen.getByRole('button', { name })).toBeInTheDocument()
  })

  it('offers «Hire» for an application decided for hiring', async () => {
    renderAt('/interviews/demo-cand-5')
    expect(await screen.findByRole('heading', { name: 'Αθανασίου Ελένη' })).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /Πρόσληψη/ })[0])
    await waitFor(() => expect(screen.getByText('Νέος εργαζόμενος από την αίτηση')).toBeInTheDocument())
  })
})
