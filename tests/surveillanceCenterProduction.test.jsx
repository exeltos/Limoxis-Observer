// @vitest-environment jsdom
// The Surveillance Center of a production organization: each data domain loads
// on its own (a failing one is reported and leaves the others), nothing falls
// back to the Demo datasets, cancelled episodes stay hidden by default, and
// employee surveillance is offered only to roles allowed to see staff health.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'

let tenantState
const notifyError = vi.fn()
const service = { cases: vi.fn(), employees: vi.fn(), samples: vi.fn(), departments: vi.fn() }

vi.mock('../src/core/supabase/client', () => ({ supabase: { rpc: vi.fn(), from: vi.fn(), functions: { invoke: vi.fn() } } }))
vi.mock('../src/core/auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-1' }, profile: { fullName: 'Χρήστης' } }) }))
vi.mock('../src/core/tenant/TenantContext', () => ({ useTenant: () => tenantState }))
// One feedback object, as the real provider gives: effects depending on it must not re-run each render.
const feedback = { notify: vi.fn(), notifyError, confirm: vi.fn(async () => true) }
vi.mock('../src/core/feedback/FeedbackContext', () => ({ useFeedback: () => feedback, useOptionalFeedback: () => null }))
vi.mock('../src/features/patients/patientsService', () => ({ loadPatients: vi.fn(async () => []) }))
vi.mock('../src/features/management/departmentsService', () => ({ loadDepartments: (...args) => service.departments(...args) }))
vi.mock('../src/features/surveillance/clinicalCloudService', async (importOriginal) => ({ ...(await importOriginal()), loadClinicalCases: (...args) => service.cases(...args) }))
vi.mock('../src/features/surveillance/employeeSurveillanceCloudService', async (importOriginal) => ({ ...(await importOriginal()), loadEmployeeSurveillanceRecords: (...args) => service.employees(...args) }))
vi.mock('../src/features/laboratory/laboratoryCloudService', async (importOriginal) => ({ ...(await importOriginal()), loadLaboratorySamples: (...args) => service.samples(...args) }))
// The registry the real hook keeps: the same rows from render to render.
const laboratoryRegistry = { rows: [], createSample: vi.fn() }
vi.mock('../src/features/laboratory/hooks/useLaboratoryRegistry', () => ({ useLaboratoryRegistry: () => laboratoryRegistry }))

const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
const { SurveillanceCanonicalPage } = await import('../src/features/surveillance/SurveillanceCanonicalPage')

const episode = (id, patient, status, over = {}) => ({ id, patient, patientEn: patient, patientId: `PT-${id}`, patientRecordId: `rec-${patient}`, department: 'ΜΕΘ', departmentEn: 'ICU', status, startedAt: '2026-10-01', reviewDue: '2026-12-01', samples: [], ...over })

function setTenant(role, { sensitive = false, custom = [] } = {}) {
  tenantState = { tenant: { id: 'org-1', name: 'Νοσοκομείο' }, isDemo: false, role, actualRole: role, membership: { capabilities: [], customCapabilities: custom }, memberships: [], canAccessRecord: () => true, canSeeSensitiveEmployeeHealth: sensitive }
}
function openCenter() {
  render(<MemoryRouter><LanguageProvider><SurveillanceCanonicalPage/></LanguageProvider></MemoryRouter>)
}
const tabNames = () => screen.getAllByRole('tab').map(tab => tab.textContent.trim())

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {}
  sessionStorage.clear(); notifyError.mockReset()
  service.cases.mockResolvedValue([episode('1', 'Άννα Αλεξίου', 'active'), episode('2', 'Βασίλης Βλάχος', 'cancelled')])
  service.employees.mockResolvedValue([])
  service.samples.mockResolvedValue([])
  service.departments.mockResolvedValue([])
  setTenant('infection_control_lead')
})
afterEach(() => { cleanup(); sessionStorage.clear() })

describe('loading a production organization', () => {
  it('loads every domain for the organization and reports a failing one without blocking the others', async () => {
    const failure = new Error('employees down')
    service.employees.mockRejectedValue(failure)
    openCenter()
    await waitFor(() => expect(screen.getByText('Άννα Αλεξίου')).toBeInTheDocument())
    for (const load of Object.values(service)) expect(load).toHaveBeenCalledWith('org-1')
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(failure, 'load', { operation: 'surveillance_canonical_load' }))
  })

  it('shows an empty registry, never the Demo patients, when the episodes cannot be loaded', async () => {
    service.cases.mockRejectedValue(new Error('cases down'))
    openCenter()
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect(document.querySelectorAll('tbody tr td strong')).toHaveLength(0)
    expect(screen.queryByText('Ελένη Παπαδοπούλου')).not.toBeInTheDocument()
  })

  it('hides cancelled episodes unless they are filtered for', async () => {
    openCenter()
    await waitFor(() => expect(screen.getByText('Άννα Αλεξίου')).toBeInTheDocument())
    expect(screen.queryByText('Βασίλης Βλάχος')).not.toBeInTheDocument()
  })
})

describe('employee surveillance access', () => {
  it('is offered to infection control and to roles allowed to see staff health', async () => {
    openCenter()
    await waitFor(() => expect(screen.getByText('Άννα Αλεξίου')).toBeInTheDocument())
    expect(tabNames()).toContain('Εργαζόμενοι')
    cleanup()
    setTenant('link_nurse', { sensitive: true })
    openCenter()
    await waitFor(() => expect(screen.getByText('Άννα Αλεξίου')).toBeInTheDocument())
    expect(tabNames()).toContain('Εργαζόμενοι')
  })

  // A custom role can grant surveillance creation without staff-health access.
  it('is neither listed nor started for a link nurse without staff-health access', async () => {
    setTenant('link_nurse', { custom: ['create_surveillance'] })
    openCenter()
    await waitFor(() => expect(screen.getByText('Άννα Αλεξίου')).toBeInTheDocument())
    expect(tabNames()).not.toContain('Εργαζόμενοι')
    fireEvent.click(screen.getByRole('button', { name: /Δημιουργία/ }))
    const chooser = await screen.findByRole('dialog')
    fireEvent.click(within(chooser).getByRole('button', { name: /Εργαζόμενος/ }))
    expect(screen.getByRole('dialog')).toBe(chooser)
  })

  it('is not listed for a department manager', async () => {
    setTenant('department_manager')
    openCenter()
    await waitFor(() => expect(screen.getByText('Άννα Αλεξίου')).toBeInTheDocument())
    expect(tabNames()).not.toContain('Εργαζόμενοι')
  })
})
