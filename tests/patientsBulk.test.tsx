// @vitest-environment jsdom
// «Ασθενείς», several at once (owner, 20/11/2026): the roles that decide tick the patients with a positive sample
// awaiting a decision and act on all those samples from the same bar as «Προς έλεγχο».
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReviewSample } from '../src/features/surveillance/surveillanceListTypes'

// One `t` for every render: the page reloads when it changes.
const t = (key: string) => key
vi.mock('../src/core/i18n/LanguageContext', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/core/i18n/LanguageContext')>()
  return { ...actual, useLanguage: () => ({ language: 'el', t }), useOptionalLanguage: () => ({ language: 'el' }) }
})
const notify = vi.fn()
const feedback = { notify, notifyError: vi.fn() }
vi.mock('../src/core/feedback/FeedbackContext', () => ({ useFeedback: () => feedback, useOptionalFeedback: () => feedback }))
let mockTenant: Record<string, unknown>
vi.mock('../src/core/tenant/TenantContext', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/core/tenant/TenantContext')>()
  return { ...actual, useTenant: () => mockTenant, useOptionalTenant: () => mockTenant }
})
const actor = { id: 'u-1', name: 'Test' }
vi.mock('../src/core/audit/useAuditActor', () => ({ useAuditActor: () => actor }))

const uuid = (n: number) => `3f1c2b7a-9d4e-4c1a-8b2f-00000000000${n}`
const patients = [1, 2, 3, 4].map(n => ({ id: `PT-${n}`, recordId: uuid(n), name: `Ασθενής ${n}`, nameEn: `Patient ${n}`, department: 'ΜΕΘ', departmentEn: 'ICU', admissionDate: `2026-11-0${n}`, status: 'active', hasAdmission: true }))
vi.mock('../src/features/patients/patientsService', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/features/patients/patientsService')>()
  return { ...actual, loadPatients: vi.fn(async () => patients) }
})
const loadFlags = vi.fn(async () => ({}))
vi.mock('../src/features/patients/patientInfectionFlagsService', () => ({ loadPatientInfectionFlags: () => loadFlags() }))
vi.mock('../src/features/clinical-scales/patientRiskFlagsService', () => ({ loadLatestPatientRiskFlags: vi.fn(async () => ({})) }))

// Patient 1 has two samples awaiting a decision, patient 3 one (by the patient record, as the laboratory list keeps it).
const sample = (id: string, n: number): ReviewSample & { subjectId: string, subjectType: string } => ({ id, recordId: `r-${id}`, subjectId: uuid(n), subjectType: 'patient', patientId: `PT-${n}`, patient: `Ασθενής ${n}`, department: 'ΜΕΘ', type: 'bloodCulture', organism: 'Klebsiella pneumoniae', collectedAt: `2026-11-1${n}T08:00:00Z` })
let pendingRows: ReviewSample[]
const review = vi.fn(async () => true)
const reload = vi.fn(async () => undefined)
const none: ReviewSample[] = []
vi.mock('../src/features/laboratory/hooks/useSamplesAwaitingReview', () => ({ useSamplesAwaitingReview: ({ enabled = true } = {}) => ({ rows: enabled ? pendingRows : none, loading: false, error: null, reload, review, repository: { review } }) }))
const createCase = vi.fn(async () => ({ id: 'case-1' }))
vi.mock('../src/features/surveillance/clinicalRepository', () => ({ createClinicalRepository: () => ({ createCase }) }))
vi.mock('../src/features/surveillance/sampleReviewBulk', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/features/surveillance/sampleReviewBulk')>()
  return { ...actual, openEpisodesFor: vi.fn(actual.openEpisodesFor), decideAll: vi.fn(actual.decideAll), groupSamplesByPatient: vi.fn(actual.groupSamplesByPatient) }
})

const { PatientsPage } = await import('../src/features/patients/PatientsPage')
const bulk = await import('../src/features/surveillance/sampleReviewBulk')
const { ROLES } = await import('../src/core/permissions/roles')

const tenantFor = (role: string) => ({ tenant: { id: 'org-1' }, isDemo: false, role, actualRole: role, membership: { capabilities: [], customCapabilities: [] }, canAccessRecord: () => true })
async function page() {
  render(<MemoryRouter><PatientsPage /></MemoryRouter>)
  await screen.findByText('Ασθενής 4')
}
const tickOf = (name: string) => screen.queryByRole('checkbox', { name: new RegExp(`^Επιλογή: ${name} ·`) })

beforeEach(() => {
  pendingRows = [sample('LAB-1', 1), sample('LAB-2', 1), sample('LAB-3', 3)]
  mockTenant = tenantFor(ROLES.INFECTION_CONTROL_LEAD)
  vi.clearAllMocks()
  sessionStorage.clear()
})
afterEach(() => { cleanup() })

describe('pendingSamplesByPatient', () => {
  it('finds the patient by the patient record, else by the code (demo)', () => {
    const demo = { id: 'LAB-9', patientId: 'PT-2', patient: 'Ασθενής 2' } as ReviewSample
    const pending = bulk.pendingSamplesByPatient([...pendingRows, demo, { id: 'LAB-0', patientId: 'PT-404' } as ReviewSample], patients)
    expect([...pending].map(([code, list]) => [code, list.map(item => item.id)])).toEqual([['PT-1', ['LAB-1', 'LAB-2']], ['PT-3', ['LAB-3']], ['PT-2', ['LAB-9']]])
  })
})

describe('Patients: several at once', () => {
  it('ticks only the patients with a sample awaiting a decision', async () => {
    await page()
    expect(tickOf('Ασθενής 1')).not.toBeNull()
    expect(tickOf('Ασθενής 3')).not.toBeNull()
    expect(tickOf('Ασθενής 2')).toBeNull()
    expect(tickOf('Ασθενής 4')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Επιλεγμένοι ασθενείς' })).toBeNull()
  })

  it('the header tick selects every filtered patient with pending samples', async () => {
    await page()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Επιλογή όλης της λίστας' }))
    const bar = screen.getByRole('region', { name: 'Επιλεγμένοι ασθενείς' })
    expect(within(bar).getByText(/^2 επιλεγμένα/)).toBeTruthy()
    expect((tickOf('Ασθενής 1') as HTMLInputElement).checked).toBe(true)
    expect((tickOf('Ασθενής 3') as HTMLInputElement).checked).toBe(true)
  })

  it('opens one episode per ticked patient with all of their pending samples', async () => {
    await page()
    fireEvent.click(tickOf('Ασθενής 1')!)
    fireEvent.click(tickOf('Ασθενής 3')!)
    fireEvent.click(screen.getByRole('button', { name: /Άνοιγμα επεισοδίων/ }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Άνοιξαν 2 επεισόδια.', 'success'))
    expect(vi.mocked(bulk.groupSamplesByPatient).mock.calls[0][0].map(item => item.id).sort()).toEqual(['LAB-1', 'LAB-2', 'LAB-3'])
    expect(createCase).toHaveBeenCalledTimes(2)
    expect(review).toHaveBeenCalledTimes(3)
    expect(review).toHaveBeenCalledWith(expect.objectContaining({ id: 'LAB-2' }), { status: 'episode_opened', caseId: 'case-1' })
    expect(reload).toHaveBeenCalled()
    expect(loadFlags).toHaveBeenCalledTimes(2)
  })

  it('records «No surveillance needed» with one reason for all pending samples of the ticked patients', async () => {
    await page()
    fireEvent.click(tickOf('Ασθενής 1')!)
    fireEvent.click(screen.getByRole('button', { name: 'Δεν χρειάζεται επιτήρηση' }))
    fireEvent.click(await screen.findByText('Επιμόλυνση'))
    fireEvent.click(screen.getByRole('button', { name: /Αποθήκευση/ }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('2 δείγματα καταχωρίστηκαν ως «Δεν χρειάζεται επιτήρηση».', 'success'))
    const [samples, decision] = vi.mocked(bulk.decideAll).mock.calls[0]
    expect(samples.map(item => item.id)).toEqual(['LAB-1', 'LAB-2'])
    expect(decision).toEqual({ status: 'no_surveillance_needed', reason: 'contamination', note: '' })
  })

  it('shows no ticks to a role without the right to decide', async () => {
    mockTenant = tenantFor(ROLES.DEPARTMENT_MANAGER)
    await page()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })
})
