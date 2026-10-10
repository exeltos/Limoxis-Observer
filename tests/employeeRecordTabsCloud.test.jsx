// @vitest-environment jsdom
// Employee record tabs against the cloud services (mocked), where the demo
// sample data cannot reach: governed attachments, database-linked samples and
// the evaluation workflow round trip.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'

const feedback = { notify: vi.fn(), notifyError: vi.fn(), confirm: vi.fn(async () => true) }
const loadAttachments = vi.fn(async () => [])
const loadEmployeeSurveillanceRecords = vi.fn()
const loadLaboratorySamples = vi.fn()
const loadEvaluationsAsync = vi.fn()
const updateEmployeeEvaluationWorkflowAsync = vi.fn()

vi.mock('../src/core/supabase/client', () => ({ supabase: { rpc: vi.fn(), from: vi.fn(), functions: { invoke: vi.fn() } } }))
vi.mock('../src/core/feedback/FeedbackContext', () => ({ useFeedback: () => feedback, useOptionalFeedback: () => feedback }))
vi.mock('../src/core/tenant/TenantContext', () => ({ useTenant: () => ({ role: 'hospital_admin', membership: { organizationId: 'org-1', capabilities: [] }, tenant: { id: 'org-1' }, isDemo: false }) }))
vi.mock('../src/core/attachments/attachmentService', () => ({
  cloudAttachmentsEnabled: () => true,
  loadAttachments: (...args) => loadAttachments(...args),
  uploadAttachment: vi.fn(),
  updateAttachmentMetadata: vi.fn(),
  deleteAttachment: vi.fn(),
  getAttachmentUrl: vi.fn(),
}))
vi.mock('../src/features/surveillance/employeeSurveillanceCloudService', async original => ({ ...(await original()), loadEmployeeSurveillanceRecords: (...args) => loadEmployeeSurveillanceRecords(...args) }))
vi.mock('../src/features/laboratory/laboratoryCloudService', async original => ({ ...(await original()), loadLaboratorySamples: (...args) => loadLaboratorySamples(...args) }))
vi.mock('../src/features/employees/employeeSubRecordsService', async original => ({
  ...(await original()),
  loadEvaluationsAsync: (...args) => loadEvaluationsAsync(...args),
  updateEmployeeEvaluationWorkflowAsync: (...args) => updateEmployeeEvaluationWorkflowAsync(...args),
}))

const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
const { EmployeeCertificatesTab, EmployeeSurveillanceTab, EmployeeEvaluationsTab } = await import('../src/features/employees/EmployeeRecordTabs')

const employee = { id: 'EMP-101', dbId: 'db-emp-1', organizationId: 'org-1', firstName: 'Άννα', lastName: 'Ιωάννου' }
const fmt = value => (value ? String(value).slice(0, 10) : '—')
const t = key => key
const mount = node => render(<MemoryRouter><LanguageProvider>{node}</LanguageProvider></MemoryRouter>)

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('employee documents (cloud)', () => {
  it('stores documents as governed employee-certificate attachments on the database id', async () => {
    mount(<EmployeeCertificatesTab employee={employee} language="el" organizationId="org-1" canEdit/>)
    await waitFor(() => expect(loadAttachments).toHaveBeenCalled())
    expect(loadAttachments.mock.calls[0]).toEqual(expect.arrayContaining(['employee-certificate', 'db-emp-1']))
    expect(screen.getByRole('heading', { name: 'Έγγραφα & Πιστοποιήσεις' })).toBeInTheDocument()
  })
})

describe('employee surveillance (cloud)', () => {
  it('shows each episode with only the laboratory samples linked to it', async () => {
    loadEmployeeSurveillanceRecords.mockResolvedValue([
      { id: 'ESUR-260901', recordId: 'db-sv-1', employeeDbId: 'db-emp-1', startedAt: '2026-09-01', status: 'active' },
      { id: 'ESUR-260902', recordId: 'db-sv-9', employeeDbId: 'db-other', startedAt: '2026-09-02', status: 'active' },
    ])
    loadLaboratorySamples.mockResolvedValue([
      { id: 'LAB-LINKED-1', employeeSurveillanceId: 'db-sv-1', type: 'nasalSwab', collectedAt: '2026-09-01T08:00:00' },
      { id: 'LAB-OTHER-1', employeeSurveillanceId: 'db-sv-2', type: 'nasalSwab', collectedAt: '2026-09-01T08:00:00' },
    ])
    mount(<EmployeeSurveillanceTab employee={employee} t={t} language="el" fmt={fmt} version={0} onNew={() => {}} organizationId="org-1"/>)
    const row = (await screen.findByText('ESUR-260901')).closest('tr')
    expect(screen.queryByText('ESUR-260902')).not.toBeInTheDocument()
    fireEvent.click(row)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/LAB-LINKED-1/)).toBeInTheDocument()
    expect(within(dialog).queryByText(/LAB-OTHER-1/)).not.toBeInTheDocument()
  })
})

describe('employee evaluations (cloud)', () => {
  it('re-reads the open evaluation from the reloaded list after a workflow action, keeping the evaluator', async () => {
    const evaluation = { id: 'EV-1', source: 'employee_evaluations', type: 'performance', titleEl: 'Αξιολόγηση απόδοσης', titleEn: 'Performance evaluation', period: '2026', date: '2026-09-10', evaluatorName: 'Αικατερίνη Λάμπρου', overallScore: 4.5, criteria: [], status: 'employee_acknowledged' }
    loadEvaluationsAsync.mockResolvedValueOnce([evaluation]).mockResolvedValueOnce([{ ...evaluation, status: 'hr_approved' }])
    updateEmployeeEvaluationWorkflowAsync.mockResolvedValue({ id: 'EV-1', status: 'hr_approved' })
    mount(<EmployeeEvaluationsTab employee={employee} language="el" fmt={fmt} organizationId="org-1" canHrApprove/>)
    fireEvent.click((await screen.findByText('Αξιολόγηση απόδοσης')).closest('tr'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Έγκριση HR' }))
    await waitFor(() => expect(updateEmployeeEvaluationWorkflowAsync).toHaveBeenCalledWith('org-1', 'db-emp-1', 'EV-1', expect.objectContaining({ action: 'hrApprove' })))
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByText('Εγκρίθηκε από HR')).toBeInTheDocument())
    expect(within(screen.getByRole('dialog')).getByText('Αικατερίνη Λάμπρου')).toBeInTheDocument()
    expect(loadEvaluationsAsync).toHaveBeenCalledTimes(2)
  })
})
