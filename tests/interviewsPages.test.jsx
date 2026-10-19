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

  it('shows the pipeline counters, the open applications and filters by a counter', async () => {
    renderAt('/interviews')
    expect(await screen.findByText('Κωνσταντίνου Δήμητρα')).toBeInTheDocument()
    expect(screen.queryByText('Παππά Χριστίνα')).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByText('Απορρίφθηκε')[0].closest('[role="button"]'))
    expect(await screen.findByText('Παππά Χριστίνα')).toBeInTheDocument()
    expect(screen.getByText('Επόμενες συνεντεύξεις')).toBeInTheDocument()
  })

  it('opens an application with its tabs and records an evaluation', async () => {
    renderAt('/interviews/demo-cand-3')
    expect(await screen.findByRole('heading', { name: 'Μιχαηλίδου Άννα' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Εκπαίδευση & γλώσσες/ }))
    expect(screen.getByText('Νοσηλευτική Πανεπιστημίου Θεσσαλίας')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Προϋπηρεσία/ }))
    expect(screen.getByText('Γενικό Νοσοκομείο (παράδειγμα)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Συνεντεύξεις/ }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Αξιολόγηση' })[0])
    expect(await screen.findByText('Βαθμολογία ανά κριτήριο')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Απόφαση/ }))
  })

  it('offers «Hire» for an application decided for hiring', async () => {
    renderAt('/interviews/demo-cand-5')
    expect(await screen.findByRole('heading', { name: 'Αθανασίου Ελένη' })).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /Πρόσληψη/ })[0])
    await waitFor(() => expect(screen.getByText('Νέος εργαζόμενος από την αίτηση')).toBeInTheDocument())
  })
})
