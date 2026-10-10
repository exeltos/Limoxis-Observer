// @vitest-environment jsdom
// Behavior of the committee record page, exercised through the rendered UI
// (demo mode, so actions apply locally without a database).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { useState } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'

const notifications = { addAnnouncement: vi.fn(), reloadAnnouncements: vi.fn() }
const feedback = { notify: vi.fn(), notifyError: vi.fn(), confirm: vi.fn(async () => true) }
let tenant
let rows
let indicators
let cloudAttachments
const uploadAttachment = vi.fn(async (organizationId, entityType, entityId, file) => ({ id: 'ATT-1', name: file.name, category: 'other' }))

vi.mock('../src/core/supabase/client', () => ({ supabase: { rpc: vi.fn(), from: vi.fn(), functions: { invoke: vi.fn() } } }))
vi.mock('../src/core/tenant/TenantContext', () => ({ useTenant: () => tenant }))
vi.mock('../src/core/feedback/FeedbackContext', () => ({ useFeedback: () => feedback, useOptionalFeedback: () => feedback }))
vi.mock('../src/core/notifications/NotificationContext', () => ({ useNotifications: () => notifications }))
vi.mock('../src/core/audit/useAuditActor', () => ({ useAuditActor: () => ({ id: 'u-actor', name: 'Actor' }) }))
vi.mock('../src/core/navigation/useRecordSequenceNavigation', () => ({ useRecordSequenceNavigation: () => null }))
vi.mock('../src/features/employees/useEmployeesData', () => ({ useEmployeesData: () => ({ data: [] }) }))
vi.mock('../src/features/committees/committeeData', () => ({ saveCommittees: vi.fn() }))
vi.mock('../src/features/indicators/indicatorDefinitionService', () => ({ loadIndicatorDefinitions: vi.fn(async () => indicators) }))
vi.mock('../src/core/attachments/attachmentService', () => ({
  cloudAttachmentsEnabled: () => cloudAttachments,
  loadAttachments: vi.fn(async () => []),
  uploadAttachment: (...args) => uploadAttachment(...args),
  updateAttachmentMetadata: vi.fn(async (id, meta) => ({ id, name: 'protocol.pdf', ...meta })),
  deleteAttachment: vi.fn(),
  getAttachmentUrl: vi.fn(),
}))
vi.mock('../src/features/committees/useCommitteesData', () => ({
  useCommitteesData: () => {
    const [data, setData] = useState(rows)
    return { data, setData, loading: false, error: null, reload: vi.fn() }
  },
}))

const { CommitteeRecordPage } = await import('../src/features/committees/CommitteeRecordPage')
const { MeetingDialog } = await import('../src/features/committees/CommitteeRecordDialogs')
const { saveCommittees } = await import('../src/features/committees/committeeData')

const ROLE = 'infection_control_lead'
const members = [
  { id: 'CM-1', name: 'Άννα Παππά', committeeTitle: 'Πρόεδρος', userId: 'u-anna', active: true, voting: true },
  { id: 'CM-2', name: 'Βασίλης Νίκου', committeeTitle: 'Μέλος', userId: 'u-vasilis', active: true, voting: true },
  { id: 'CM-3', name: 'Γιώργος Χωρίς Λογαριασμό', committeeTitle: 'Μέλος', active: true, voting: true },
]
const meeting = (over = {}) => ({ id: 'MTG-1', title: 'Μηνιαία συνεδρίαση', date: '2026-10-20', time: '09:00', status: 'planned', topics: [{ id: 'T1', subject: 'Πρώτο θέμα' }, { id: 'T2', subject: 'Δεύτερο θέμα' }], attendanceRecords: [], approvals: [], ...over })
const committee = (over = {}) => ({
  id: 'COM-001', name: 'Επιτροπή Νοσοκομειακών Λοιμώξεων', shortName: 'ΕΝΛ', status: 'active', organizationId: 'org-1',
  memberRefs: members, meetings: [], annualPlan: [], history: [], documents: [],
  decisions: [{ id: 'DEC-1', title: 'Screening KPC', action: 'Εβδομαδιαίο screening', status: 'in_progress', owner: 'Άννα Παππά', ownerId: 'u-anna', dueDate: '2026-11-01', priority: 'medium' }],
  ...over,
})

function openPage() {
  return render(<LanguageProvider><MemoryRouter initialEntries={['/committees/COM-001']}><Routes><Route path="/committees/:committeeId" element={<CommitteeRecordPage/>}/></Routes></MemoryRouter></LanguageProvider>)
}
const openTab = name => fireEvent.click(screen.getByRole('tab', { name: new RegExp(name) }))
const dialog = () => screen.getByRole('dialog')

beforeEach(() => {
  tenant = { role: ROLE, membership: { organizationId: 'org-1', capabilities: [], customCapabilities: [] }, tenant: { id: 'org-1' }, isDemo: true }
  rows = [committee()]
  indicators = []
  cloudAttachments = false
  vi.spyOn(window, 'prompt').mockImplementation(() => null)
})
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks() })

describe('committee record: members', () => {
  it('offers the governed committee roles plus a free-text Other option', () => {
    openPage(); openTab('Μέλη')
    fireEvent.click(screen.getByRole('button', { name: /Προσθήκη μέλους/ }))
    const roleSelect = within(dialog()).getAllByRole('combobox').find(select => within(select).queryByRole('option', { name: 'Πρόεδρος' }))
    const options = within(roleSelect).getAllByRole('option').map(option => option.textContent)
    expect(options).toEqual(expect.arrayContaining(['Πρόεδρος', 'Αντιπρόεδρος', 'Γραμματέας', 'Συντονιστής', 'Μέλος', 'Αναπληρωματικό μέλος', 'Εισηγητής', 'Σύμβουλος', 'Παρατηρητής', 'Άλλο…']))
  })

  it('ends a membership through a reason dialog, never a browser prompt', async () => {
    openPage(); openTab('Μέλη')
    fireEvent.click(screen.getAllByRole('button', { name: /Ενέργειες/ })[0])
    fireEvent.click(await screen.findByRole('menuitem', { name: /Λήξη συμμετοχής/ }))
    expect(screen.getByRole('dialog', { name: /Λήξη συμμετοχής/ })).toBeInTheDocument()
    expect(window.prompt).not.toHaveBeenCalled()
  })
})

describe('committee record: institutional framework', () => {
  it('lets a role with create-committee rights edit the framework', () => {
    openPage(); openTab('Θεσμικό πλαίσιο')
    fireEvent.click(screen.getByRole('button', { name: /Ενέργειες/ }))
    expect(screen.getByRole('menuitem', { name: /Επεξεργασία θεσμικού πλαισίου/ })).toBeInTheDocument()
  })

  it('keeps framework edits away from the committee secretariat', () => {
    tenant = { ...tenant, role: 'committee_secretariat' }
    openPage(); openTab('Θεσμικό πλαίσιο')
    expect(screen.queryByRole('button', { name: /Ενέργειες/ })).not.toBeInTheDocument()
  })
})

describe('committee record: decisions', () => {
  it('lists decisions with their status and no local search or filters', () => {
    openPage(); openTab('Αποφάσεις')
    expect(screen.getByText('Screening KPC')).toBeInTheDocument()
    expect(screen.getByText('Σε εξέλιξη')).toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/Αναζήτηση/)).not.toBeInTheDocument()
  })

  it('assigns a committee member as owner and notifies only that member', async () => {
    openPage(); openTab('Αποφάσεις')
    fireEvent.click(screen.getByRole('button', { name: /Νέα απόφαση/ }))
    const form = dialog()
    fireEvent.change(within(form).getAllByRole('textbox')[0], { target: { value: 'Νέα ενέργεια' } })
    const ownerSelect = within(form).getAllByRole('combobox').find(select => within(select).queryByRole('option', { name: /Άλλο \(ελεύθερο κείμενο\)/ }))
    fireEvent.change(ownerSelect, { target: { value: 'CM-2' } })
    fireEvent.click(within(form).getByRole('button', { name: /Αποθήκευση|Δημιουργία/ }))
    await waitFor(() => expect(notifications.addAnnouncement).toHaveBeenCalledTimes(1))
    expect(notifications.addAnnouncement).toHaveBeenCalledWith(expect.objectContaining({ audienceType: 'user', audienceValues: ['u-vasilis'], linkPath: '/committees/COM-001' }))
  })

  it('offers free-text ownership for people outside the committee', () => {
    openPage(); openTab('Αποφάσεις')
    fireEvent.click(screen.getByRole('button', { name: /Νέα απόφαση/ }))
    const ownerSelect = within(dialog()).getAllByRole('combobox').find(select => within(select).queryByRole('option', { name: /Άλλο \(ελεύθερο κείμενο\)/ }))
    expect(within(ownerSelect).getAllByRole('option').map(option => option.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Άννα Παππά'), expect.stringContaining('Βασίλης Νίκου')]))
  })
})

describe('committee record: annual plan', () => {
  it('links objectives to an active indicator or to none', async () => {
    indicators = [{ id: 'IND-1', titleEl: 'Επίπτωση CLABSI', status: 'active' }, { id: 'IND-2', titleEl: 'Παλιός δείκτης', status: 'retired' }]
    openPage(); openTab('Ετήσιο σχέδιο')
    fireEvent.click(screen.getByRole('button', { name: /Νέος στόχος/ }))
    const indicatorSelect = within(dialog()).getAllByRole('combobox').find(select => within(select).queryByRole('option', { name: 'Χωρίς δείκτη' }))
    await waitFor(() => expect(within(indicatorSelect).getByRole('option', { name: 'Επίπτωση CLABSI' })).toBeInTheDocument())
    expect(within(indicatorSelect).queryByRole('option', { name: 'Παλιός δείκτης' })).not.toBeInTheDocument()
  })
})

describe('committee record: meetings', () => {
  it('opens the created meeting and notifies members who have an account', async () => {
    openPage(); openTab('Συνεδριάσεις')
    fireEvent.click(screen.getByRole('button', { name: /Νέα συνεδρίαση/ }))
    const form = dialog()
    fireEvent.change(within(form).getAllByRole('textbox')[0], { target: { value: 'Έκτακτη συνεδρίαση' } })
    const date = within(form).getByPlaceholderText('ηη/μμ/εεεε')
    fireEvent.change(date, { target: { value: '25/10/2026' } })
    fireEvent.blur(date)
    fireEvent.click(within(form).getByRole('button', { name: /Δημιουργία & συνέχεια/ }))
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent('Πρακτικά συνεδρίασης'))
    expect(dialog()).toHaveTextContent('Έκτακτη συνεδρίαση')
    expect(notifications.addAnnouncement).toHaveBeenCalledWith(expect.objectContaining({ audienceType: 'user', audienceValues: ['u-anna', 'u-vasilis'] }))
  })

  it('closes only from the header and lets an accidental agenda topic be removed', () => {
    rows = [committee({ meetings: [meeting()] })]
    openPage(); openTab('Συνεδριάσεις')
    fireEvent.click(screen.getByText('Μηνιαία συνεδρίαση'))
    const minutes = dialog()
    expect(within(minutes).getAllByRole('button', { name: 'Κλείσιμο' })).toHaveLength(1)
    expect(within(minutes).getByDisplayValue('Δεύτερο θέμα')).toBeInTheDocument()
    fireEvent.click(within(minutes).getAllByRole('button', { name: 'Διαγραφή θέματος' })[1])
    expect(within(minutes).queryByDisplayValue('Δεύτερο θέμα')).not.toBeInTheDocument()
    expect(within(minutes).getByDisplayValue('Πρώτο θέμα')).toBeInTheDocument()
  })

  it('cancels a meeting through a governed reason dialog', () => {
    rows = [committee({ meetings: [meeting()] })]
    openPage(); openTab('Συνεδριάσεις')
    fireEvent.click(screen.getByRole('button', { name: /Ενέργειες/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Ακύρωση συνεδρίασης/ }))
    expect(screen.getByRole('dialog', { name: /Ακύρωση συνεδρίασης/ })).toBeInTheDocument()
  })

  it('locks the minutes of a cancelled meeting', () => {
    rows = [committee({ meetings: [meeting({ status: 'cancelled', cancellationReason: 'Έλλειψη απαρτίας' })] })]
    openPage(); openTab('Συνεδριάσεις')
    fireEvent.click(screen.getByText('Μηνιαία συνεδρίαση'))
    expect(within(dialog()).getByDisplayValue('Πρώτο θέμα')).toBeDisabled()
    expect(within(dialog()).queryByRole('button', { name: 'Διαγραφή θέματος' })).not.toBeInTheDocument()
  })

  it('shows the requested corrections when minutes return to draft', () => {
    rows = [committee({ meetings: [meeting({ status: 'draft', approvals: [{ id: 'AP-1', status: 'rejected', comment: 'Λάθος ημερομηνία στο θέμα 1' }] })] })]
    openPage(); openTab('Συνεδριάσεις')
    fireEvent.click(screen.getByText('Μηνιαία συνεδρίαση'))
    expect(within(dialog()).getByText('Ζητήθηκαν διορθώσεις στα πρακτικά')).toBeInTheDocument()
    expect(within(dialog()).getByText('Λάθος ημερομηνία στο θέμα 1')).toBeInTheDocument()
  })

  it('sends a change request with its comment from the shared approval panel', async () => {
    const onApproval = vi.fn()
    const pending = meeting({ status: 'approval_pending', approvals: [{ id: 'AP-1', status: 'pending', approverId: 'u-actor', approverName: 'Actor' }] })
    render(<LanguageProvider><MeetingDialog meeting={pending} members={members} actorId="u-actor" canSave canFinalize busy={false} onClose={() => {}} onSave={() => {}} onApproval={onApproval} onExternalAction={() => {}} en={false}/></LanguageProvider>)
    fireEvent.click(screen.getByRole('button', { name: /Αίτημα διορθώσεων/ }))
    fireEvent.change(await screen.findByPlaceholderText('Περιγράψτε τις απαιτούμενες διορθώσεις…'), { target: { value: 'Συμπληρώστε το θέμα 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Αποστολή αιτήματος' }))
    await waitFor(() => expect(onApproval).toHaveBeenCalledWith('AP-1', 'rejected', 'Συμπληρώστε το θέμα 2'))
  })
})

describe('committee record: documents', () => {
  const pdf = () => new File(['%PDF'], 'protocol.pdf', { type: 'application/pdf' })
  async function addFile() {
    fireEvent.click(await screen.findByRole('button', { name: /Προσθήκη επισύναψης/ }))
    const picker = dialog().querySelector('input[type="file"]')
    fireEvent.change(picker, { target: { files: [pdf()] } })
    const save = within(dialog()).getByRole('button', { name: 'Αποθήκευση' })
    await waitFor(() => expect(save).toBeEnabled())
    fireEvent.click(save)
  }

  it('links controlled documents and lists only the other files as attachments', () => {
    rows = [committee({ documents: [{ id: 'DOC-1', name: 'Κανονισμός λειτουργίας.pdf' }, { id: 'DOC-2', documentCode: 'POL-01', documentTitle: 'Πολιτική υγιεινής χεριών' }] })]
    openPage(); openTab('Έγγραφα')
    const linked = screen.getByRole('list', { name: 'Συνδεδεμένα ελεγχόμενα έγγραφα' })
    expect(within(linked).getByRole('link')).toHaveAttribute('href', '/documents/POL-01')
    expect(within(linked).queryByText('Κανονισμός λειτουργίας.pdf')).not.toBeInTheDocument()
    expect(screen.getByText('Κανονισμός λειτουργίας.pdf')).toBeInTheDocument()
  })

  it('keeps files added in demo with the committee', async () => {
    openPage(); openTab('Έγγραφα')
    await addFile()
    await waitFor(() => expect(saveCommittees).toHaveBeenCalled())
    expect(saveCommittees.mock.lastCall[0][0].documents).toEqual([expect.objectContaining({ name: 'protocol.pdf' })])
    expect(uploadAttachment).not.toHaveBeenCalled()
  })

  it('uploads files through the governed attachment service outside demo', async () => {
    tenant = { ...tenant, isDemo: false }
    cloudAttachments = true
    rows = [committee({ dbId: 'db-committee-1' })]
    openPage(); openTab('Έγγραφα')
    await addFile()
    expect(uploadAttachment).toHaveBeenCalledWith('org-1', 'committee_document', 'db-committee-1', expect.any(File), expect.anything())
    expect(saveCommittees).not.toHaveBeenCalled()
  })
})

describe('committee record: layout', () => {
  it('uses the compact meeting layout with an attendance block that does not scroll sideways', () => {
    rows = [committee({ meetings: [meeting()] })]
    openPage(); openTab('Συνεδριάσεις')
    fireEvent.click(screen.getByText('Μηνιαία συνεδρίαση'))
    expect(dialog()).toHaveClass('committee-meeting-dialog')
    expect(dialog().querySelector('.committee-attendance-wrap')).not.toBeNull()
    expect(dialog().querySelectorAll('.committee-topic-card-compact')).toHaveLength(2)
  })

  it('styles the decisions section through the shared committee-decisions class', () => {
    openPage(); openTab('Αποφάσεις')
    expect(document.querySelector('.record-section.committee-decisions')).not.toBeNull()
  })
})
