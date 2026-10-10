// @vitest-environment jsdom
// Behavior of the surveillance flows (employee screening record, new
// surveillance with inline patient creation, environmental registry),
// exercised through the rendered UI rather than the component source.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

let tenantState
vi.mock('../src/core/tenant/TenantContext', () => ({ useTenant: () => tenantState }))
const feedback = { notify: vi.fn(), notifyError: vi.fn(), confirm: vi.fn(async () => true) }
vi.mock('../src/core/feedback/FeedbackContext', () => ({ useFeedback: () => feedback, useOptionalFeedback: () => feedback }))
vi.mock('../src/core/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, profile: { id: 'user-1', fullName: 'Test User' }, isAuthenticated: true }),
}))
const createPatient = vi.fn()
vi.mock('../src/features/patients/patientsService', () => ({ createPatient: (...args) => createPatient(...args) }))
vi.mock('../src/features/management/managementCloudService', () => ({
  loadManagementLibraries: vi.fn(async () => ({})),
  createManagementLibraryItem: vi.fn(),
}))

const { LanguageProvider, translate } = await import('../src/core/i18n/LanguageContext')
const { EmployeeSurveillanceRecordDialog } = await import('../src/features/surveillance/EmployeeSurveillanceRecordDialog')
const { NewSurveillanceFlow } = await import('../src/features/surveillance/NewSurveillanceFlow')
const { EnvironmentalRegistry } = await import('../src/features/surveillance/EnvironmentalSurveillanceFlow')

const t = key => translate(key, 'el')
const fmt = value => String(value || '')

beforeEach(() => {
  localStorage.clear()
  tenantState = { tenant: { id: 'org-1' }, role: 'laboratory', membership: { capabilities: [], customCapabilities: [] }, isDemo: false }
  createPatient.mockReset()
  Object.values(feedback).forEach(fn => fn.mockClear())
})
afterEach(() => { cleanup(); localStorage.clear() })

const record = { id: 'ESUR-2026-0001', recordId: 'rec-1', employeeName: 'Μαρία Παπαδοπούλου', employeeNameEn: 'Maria Papadopoulou', department: 'Χειρουργική', departmentEn: 'Surgery', screeningTypes: ['mrsa'], resultStatus: 'pending', status: 'active' }
// A pending request: has a recordId, is still 'requested', not received, no result.
const pendingSample = { id: 'LAB-EMP-2026-ABC123', recordId: 'lab-rec-1', type: 'surveillance', source: 'nasalSwab', status: 'requested', receivedAt: null, finalizedAt: null, result: null, employeeSurveillanceId: 'rec-1' }

function openRecord({ language = 'el', samples = [pendingSample] } = {}) {
  render(<LanguageProvider><EmployeeSurveillanceRecordDialog organizationId="org-1" record={record} samples={samples} canManage t={t} language={language} fmt={fmt} onClose={() => {}}/></LanguageProvider>)
  return screen.getByText(/LE-ABC123/).closest('.employee-sample-row')
}
const requestMenu = row => within(row).queryByRole('button', { name: /Ενέργειες αιτήματος εργαστηρίου|Laboratory request actions/ })

// Rule 1a: requested materials are shown by their labels, never by their stored ids.
describe('employee screening record: laboratory request materials', () => {
  it('shows a nasal swab request as "Ρινικό επίχρισμα" in Greek', () => {
    const row = openRecord()
    expect(row).toHaveTextContent('Ρινικό επίχρισμα')
    expect(row).not.toHaveTextContent('nasalSwab')
  })

  it('shows a nasal swab request as "Nasal swab" in English', () => {
    const row = openRecord({ language: 'en' })
    expect(row).toHaveTextContent('Nasal swab')
    expect(row).not.toHaveTextContent('nasalSwab')
  })
})

// Rule 1b: laboratory request actions are offered to lab managers only outside
// demo, and only while the request is still editable.
describe('employee screening record: laboratory request actions', () => {
  it('offers edit/cancel/delete for an editable request outside demo', () => {
    const row = openRecord()
    fireEvent.click(requestMenu(row))
    const items = screen.getAllByRole('menuitem').map(item => item.textContent.trim())
    expect(items).toEqual(expect.arrayContaining(['Επεξεργασία αιτήματος', 'Ακύρωση αιτήματος', 'Διαγραφή αιτήματος']))
  })

  it.each(['laboratory', 'hospital_admin'])('hides the actions in a demo tenant even for %s', role => {
    tenantState = { ...tenantState, role, isDemo: true }
    const row = openRecord()
    expect(requestMenu(row)).toBeNull()
    expect(screen.queryByText('Επεξεργασία αιτήματος')).toBeNull()
  })

  it('hides the actions once the laboratory has received the request', () => {
    const row = openRecord({ samples: [{ ...pendingSample, status: 'received', receivedAt: '2026-10-01T10:00:00Z' }] })
    expect(requestMenu(row)).toBeNull()
  })
})

// Rule 2: inline patient creation requires a patient code outside demo (and trims
// it); in demo the code may be left empty.
describe('new surveillance: inline patient creation', () => {
  const departments = [{ id: 'dep-1', el: 'Παθολογική', en: 'Internal medicine' }]
  function fillNewPatient({ code } = {}) {
    const onCreate = vi.fn(async () => ({ id: 'SURV-1' }))
    render(<LanguageProvider><NewSurveillanceFlow departments={departments} onClose={() => {}} onCreate={onCreate}/></LanguageProvider>)
    fireEvent.click(screen.getByRole('button', { name: t('newPatient') }))
    if (code !== undefined) fireEvent.change(screen.getByLabelText(t('patientId')), { target: { value: code } })
    fireEvent.change(screen.getByLabelText(t('firstName')), { target: { value: 'Γιώργος' } })
    fireEvent.change(screen.getByLabelText(t('lastName')), { target: { value: 'Νικολάου' } })
    fireEvent.change(screen.getByLabelText(t('department')), { target: { value: 'dep-1' } })
    fireEvent.change(screen.getByLabelText(t('surveillanceReason')), { target: { value: 'Πυρετός' } })
    fireEvent.click(screen.getByRole('button', { name: 'Έναρξη επιτήρησης' }))
    return onCreate
  }
  const createdPatientResult = { record: { id: 'PT-9', name: 'Γιώργος Νικολάου', department: 'Παθολογική', departmentEn: 'Internal medicine' }, list: [] }

  it('does not create the patient without a code outside demo', async () => {
    const onCreate = fillNewPatient()
    await waitFor(() => expect(feedback.notify).toHaveBeenCalledWith(expect.any(String), 'warning'))
    expect(createPatient).not.toHaveBeenCalled()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('creates the patient with the trimmed code outside demo', async () => {
    createPatient.mockResolvedValue(createdPatientResult)
    const onCreate = fillNewPatient({ code: '  PT-9  ' })
    await waitFor(() => expect(onCreate).toHaveBeenCalled())
    expect(createPatient).toHaveBeenCalledTimes(1)
    expect(createPatient.mock.calls[0][2]).toMatchObject({ patientCode: 'PT-9', firstName: 'Γιώργος', lastName: 'Νικολάου', department: 'Παθολογική' })
  })

  it('allows a missing code in demo', async () => {
    tenantState = { ...tenantState, isDemo: true }
    createPatient.mockResolvedValue(createdPatientResult)
    const onCreate = fillNewPatient()
    await waitFor(() => expect(onCreate).toHaveBeenCalled())
    expect(screen.queryByLabelText(t('patientId'))).toBeNull()
    expect(createPatient.mock.calls[0][2].patientCode).toBeUndefined()
  })
})

// Rule 3: the registry highlights the row the user returned from and opens rows by code.
describe('environmental registry', () => {
  const rows = [
    { code: 'ENV-001', type: 'surface', department: 'ΜΕΘ', departmentEn: 'ICU', location: 'Θάλαμος 1', point: 'Κομοδίνο', collectedAt: '2026-10-01', status: 'requested' },
    { code: 'ENV-002', type: 'water', department: 'ΜΕΘ', departmentEn: 'ICU', location: 'Θάλαμος 2', point: 'Βρύση', collectedAt: '2026-10-02', status: 'completed' },
  ]
  const rowFor = code => screen.getByText(code).closest('tr')

  it('marks only the highlighted row as returned and opens rows by code', () => {
    const onOpenSample = vi.fn()
    render(<LanguageProvider><EnvironmentalRegistry rows={rows} t={t} language="el" fmt={fmt} onOpenSample={onOpenSample} highlightId="ENV-002"/></LanguageProvider>)
    expect(rowFor('ENV-002')).toHaveClass('registry-row-clickable', 'registry-row-returned')
    expect(rowFor('ENV-001')).toHaveClass('registry-row-clickable')
    expect(rowFor('ENV-001')).not.toHaveClass('registry-row-returned')
    fireEvent.click(rowFor('ENV-001'))
    expect(onOpenSample).toHaveBeenCalledWith('ENV-001')
  })
})
