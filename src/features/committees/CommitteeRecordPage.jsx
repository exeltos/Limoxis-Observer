import { useMemo, useState } from 'react'
import { attendanceFor, finalizationBlocker, meetingQuorum } from './committeeMeetingRules'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileClock,
  Paperclip,
  Pencil,
  ShieldCheck,
  Target,
  Trash2,
  Users,
} from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { downloadRecordJson } from '../../core/export/recordExport'
import { Button } from '../../design-system/Button'
import { ActionButton } from '../../design-system/ActionButton'
import { IconButton } from '../../design-system/IconButton'
import { AttachmentField } from '../../design-system/AttachmentField'
import { RouteLoading } from '../../design-system/RouteLoading'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { canForRecord, CAPABILITIES } from '../../core/permissions/roles'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useNotifications } from '../../core/notifications/NotificationContext'
import { createAnnouncement } from '../management/announcementCloudService'
import { useEmployeesData } from '../employees/useEmployeesData'
import { useCommitteesData } from './useCommitteesData'
import { saveCommittees } from './committeeData'
import { archiveCommitteeAsync, updateCommitteeDetailsAsync } from './committeeDetailsService'
import {
  createCommitteeMemberAsync,
  updateCommitteeMemberAsync,
  endCommitteeMemberAsync,
  updateCommitteeFrameworkAsync,
  createCommitteeMeetingAsync,
  saveCommitteeMeetingAsync,
  answerCommitteeMinutesApprovalAsync,
  createCommitteeDecisionAsync,
  updateCommitteeDecisionAsync,
  createCommitteePlanItemAsync,
  updateCommitteePlanItemAsync,
} from './committeeWorkflowService'
import { cancelCommitteeMeetingAsync } from './committeeMeetingLifecycleService'
import { externalMinutesActionAsync } from './committeeExternalApprovalService'
import { fmtDate, createTopic } from './committeeRecordFormat'
import {
  Head,
  Overview,
  Members,
  Meetings,
  Decisions,
  Plan,
  Framework,
  History,
} from './CommitteeRecordSections'
import {
  CommitteeDetailsDialog,
  ReasonDialog,
  MemberDialog,
  NewMeetingDialog,
  MeetingDialog,
  DecisionDialog,
  PlanDialog,
  FrameworkDialog,
} from './CommitteeRecordDialogs'
import './committeeRefinements.css'
import { signalDemoStep } from '../demo/demoScenarioSignals'

export function CommitteeRecordPage() {
  const { committeeId } = useParams()
  const navigate = useNavigate()
  const actor = useAuditActor()
  const { role, membership, tenant, isDemo } = useTenant()
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, notifyError, confirm } = useFeedback()
  const n = useNotifications()
  const { data: rows, setData: setRows, loading, error, reload } = useCommitteesData()
  const { data: employeeRows } = useEmployeesData()
  const [tab, setTab] = useState('overview')
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)

  const recordNavigation = useRecordSequenceNavigation({
    registry: 'committees',
    currentId: committeeId,
    pathForId: id => `/committees/${id}`,
  })
  const record = useMemo(() => rows.find(x => x.id === committeeId) || null, [rows, committeeId])
  const organizationId = tenant?.id || null
  const staff = useMemo(
    () =>
      employeeRows
        .filter(x => x.employmentStatus === 'active')
        .map(x => ({
          id: x.id,
          dbId: x.dbId || null,
          name: `${x.firstName || ''} ${x.lastName || ''}`.trim(),
          department: x.department || '',
          profession: x.profession || '',
          email: x.email || '',
        })),
    [employeeRows],
  )
  const permissionContext = {
    role,
    addOns: membership?.capabilities ?? [],
    customCapabilities: membership?.customCapabilities ?? [],
    organizationId: membership?.organizationId ?? membership?.organization?.id,
    assignments: membership?.assignments ?? [],
  }
  const canDo = cap =>
    record ? canForRecord(cap, { ...record, resourceType: 'committee' }, permissionContext) : false
  const canMembers = canDo(CAPABILITIES.MANAGE_COMMITTEE_MEMBERS)
  const canMeeting = canDo(CAPABILITIES.CREATE_COMMITTEE_MEETING)
  const canMinutes = canDo(CAPABILITIES.EDIT_COMMITTEE_MINUTES)
  const canFinalize = canDo(CAPABILITIES.FINALIZE_COMMITTEE_MINUTES)
  const canDecisions = canDo(CAPABILITIES.MANAGE_COMMITTEE_DECISIONS)
  const canDocuments = canDo(CAPABILITIES.MANAGE_COMMITTEE_DOCUMENTS)
  const canFramework = canDo(CAPABILITIES.CREATE_COMMITTEE)
  const canArchive = canDo(CAPABILITIES.ARCHIVE_COMMITTEE)

  async function execute({ operation, local, success, context = 'save', close = true }) {
    if (busy) return null
    setBusy(true)
    try {
      let result
      if (isDemo) {
        result = local?.()
        if (result) {
          const nextRows = rows.map(x => (x.id === record.id ? result : x))
          setRows(nextRows)
          saveCommittees(nextRows)
        }
      } else {
        result = await operation()
        await reload()
      }
      if (close) setDialog(null)
      if (success) notify(success, 'success', { operation: 'committee_workflow' })
      return result
    } catch (err) {
      notifyError(err, context, { operation: 'committee_workflow' })
      return null
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <RouteLoading />
  if (error)
    return (
      <Page title={en ? 'Committees' : 'Επιτροπές'}>
        <div className="data-access-state error">
          <span>
            {en
              ? 'Committee data could not be loaded.'
              : 'Δεν ήταν δυνατή η φόρτωση των επιτροπών.'}
          </span>
          <Button variant="secondary" onClick={() => reload().catch(() => {})}>
            {en ? 'Retry' : 'Επανάληψη'}
          </Button>
        </div>
      </Page>
    )
  if (!record)
    return (
      <Page title={en ? 'Committees' : 'Επιτροπές'}>
        <div className="inline-empty">
          {en ? 'Committee not found.' : 'Η επιτροπή δεν βρέθηκε.'}
        </div>
      </Page>
    )

  const activeMembers = (record.memberRefs || []).filter(x => x.active !== false)
  const tabs = [
    { id: 'overview', label: en ? 'Overview' : 'Σύνοψη', icon: CheckCircle2 },
    { id: 'members', label: en ? 'Members' : 'Μέλη', icon: Users },
    { id: 'plan', label: en ? 'Annual plan' : 'Ετήσιο σχέδιο', icon: Target },
    { id: 'meetings', label: en ? 'Meetings' : 'Συνεδριάσεις', icon: CalendarDays },
    { id: 'decisions', label: en ? 'Decisions' : 'Αποφάσεις', icon: ClipboardList },
    { id: 'framework', label: en ? 'Framework' : 'Θεσμικό πλαίσιο', icon: ShieldCheck },
    { id: 'documents', label: en ? 'Documents' : 'Έγγραφα', icon: Paperclip },
    { id: 'history', label: en ? 'History' : 'Ιστορικό', icon: FileClock },
  ]

  async function saveDetails(draft) {
    await execute({
      operation: () => updateCommitteeDetailsAsync(organizationId, record, draft),
      local: () => ({ ...record, ...draft, updatedAt: new Date().toISOString() }),
      success: en ? 'Committee details updated.' : 'Τα βασικά στοιχεία της επιτροπής ενημερώθηκαν.',
    })
  }
  async function archiveCommittee() {
    const ok = await confirm({
      title: en ? 'Archive committee' : 'Αρχειοθέτηση επιτροπής',
      message: en
        ? 'The committee will become inactive while its members, meetings, decisions and history remain available. Continue?'
        : 'Η επιτροπή θα γίνει ανενεργή, ενώ τα μέλη, οι συνεδριάσεις, οι αποφάσεις και το ιστορικό της θα διατηρηθούν. Συνέχεια;',
      confirmLabel: en ? 'Archive' : 'Αρχειοθέτηση',
      danger: true,
    })
    if (!ok) return
    const result = await execute({
      operation: () => archiveCommitteeAsync(organizationId, record),
      local: () => ({
        ...record,
        status: 'inactive',
        updatedAt: new Date().toISOString(),
        history: [
          {
            at: new Date().toISOString(),
            actor: actor.name,
            actorId: actor.id,
            action: 'Αρχειοθέτηση επιτροπής',
            reason: record.name,
          },
          ...(record.history || []),
        ],
      }),
      success: en ? 'Committee archived.' : 'Η επιτροπή αρχειοθετήθηκε.',
      close: false,
    })
    if (result) navigate('/committees', { replace: true })
  }
  async function addMember(draft) {
    const person = staff.find(x => x.id === draft.employeeId)
    const manualName = String(draft.manualName || '').trim()
    if (!person && !manualName) return
    const member = {
      id: `CM-${Date.now()}`,
      employeeId: person?.id || '',
      employeeDbId: person?.dbId || null,
      name: person?.name || manualName,
      department: person?.department || '',
      profession: person?.profession || '',
      committeeTitle: draft.committeeTitle || 'Μέλος',
      responsibilities: draft.responsibilities || '',
      voting: draft.voting !== false,
      memberType: draft.memberType || 'regular',
      approvalRequired: Boolean(draft.approvalRequired),
      approvalStatus: draft.approvalRequired ? 'pending' : 'not_required',
      active: true,
      startedAt: new Date().toISOString(),
    }
    await execute({
      operation: () => createCommitteeMemberAsync(organizationId, record, member),
      local: () => ({ ...record, memberRefs: [...(record.memberRefs || []), member] }),
      success: en ? 'Member added.' : 'Το μέλος προστέθηκε.',
    })
  }
  async function editMember(draft) {
    const member = record.memberRefs.find(x => x.id === draft.id)
    if (!member) return
    await execute({
      operation: () => updateCommitteeMemberAsync(organizationId, record, member, draft),
      local: () => ({
        ...record,
        memberRefs: record.memberRefs.map(x => (x.id === member.id ? { ...x, ...draft } : x)),
      }),
      success: en ? 'Member updated.' : 'Το μέλος ενημερώθηκε.',
    })
  }
  function endMember(member) {
    setDialog({ type: 'endMember', value: member })
  }
  async function confirmEndMember(reason) {
    const member = dialog?.value
    if (!member) return
    await execute({
      operation: () => endCommitteeMemberAsync(organizationId, record, member, reason),
      local: () => ({
        ...record,
        memberRefs: record.memberRefs.map(x =>
          x.id === member.id
            ? { ...x, active: false, endedAt: new Date().toISOString(), endReason: reason }
            : x,
        ),
      }),
      success: en ? 'Membership ended.' : 'Η συμμετοχή έληξε.',
    })
  }
  async function notifyUpcomingMeeting(meeting) {
    const recipients = activeMembers
      .map(m => m.userId)
      .filter(Boolean)
      .filter(id => id !== actor.id)
    if (!recipients.length) return
    const linkPath = `/committees/${record.id}`
    const title = en
      ? `New meeting scheduled: ${meeting.title}`
      : `Νέα συνεδρίαση: ${meeting.title}`
    const message = en
      ? `"${record.name}" has scheduled a meeting for ${fmtDate(meeting.date)}${meeting.location ? ` at ${meeting.location}` : ''}.`
      : `Η επιτροπή «${record.name}» προγραμμάτισε συνεδρίαση για ${fmtDate(meeting.date)}${meeting.location ? ` στον χώρο ${meeting.location}` : ''}.`
    const payload = {
      title,
      message,
      priority: 'normal',
      audienceType: 'user',
      audienceValues: recipients,
      requiresAck: false,
      linkPath,
    }
    try {
      if (isDemo) n.addAnnouncement(payload)
      else {
        await createAnnouncement(organizationId, payload)
        await n.reloadAnnouncements()
      }
    } catch {
      /* the meeting itself is already saved; a failed notice is not worth surfacing as an error */
    }
  }
  async function addMeeting(draft) {
    const id = `MTG-${Date.now()}`
    const next = {
      ...draft,
      id,
      status: 'planned',
      topics: draft.topics?.length ? draft.topics : [createTopic()],
      attendanceRecords: attendanceFor(activeMembers),
      quorum: null,
      minutesNo: '',
      generalNotes: '',
      approvalState: 'not_started',
    }
    const result = await execute({
      operation: () => createCommitteeMeetingAsync(organizationId, record, next),
      local: () => ({ ...record, meetings: [next, ...(record.meetings || [])] }),
      success: en ? 'Meeting created.' : 'Η συνεδρίαση δημιουργήθηκε.',
    })
    if (result) {
      setDialog({ type: 'meeting', id })
      signalDemoStep('committee_minutes', 'meeting')
      await notifyUpcomingMeeting(next)
    }
  }
  async function saveMeeting(draft, finalize = false, external = []) {
    const counted = meetingQuorum(draft.attendanceRecords, record.quorumRule)
    const next = { ...draft, quorum: counted.quorum, attendance: counted.attendance }
    const blocker = finalize ? finalizationBlocker(next, counted) : null
    if (blocker) {
      const messages = {
        no_attendance: en
          ? 'Record at least one present member.'
          : 'Καταγράψτε τουλάχιστον ένα παρόν μέλος.',
        no_voting_members: en
          ? 'The committee has no member with a vote, so there can be no quorum. Mark the voting members first.'
          : 'Η επιτροπή δεν έχει μέλη με δικαίωμα ψήφου, οπότε δεν μπορεί να υπάρξει απαρτία. Ορίστε πρώτα τα μέλη με ψήφο.',
        no_quorum: en
          ? 'Required quorum has not been met.'
          : 'Δεν έχει επιτευχθεί η απαιτούμενη απαρτία.',
        topic_without_decision: en
          ? 'Every topic needs a conclusion.'
          : 'Κάθε θέμα χρειάζεται απόφαση / συμπέρασμα.',
      }
      notify(messages[blocker], 'warning')
      return false
    }
    const localStatus = finalize ? 'finalized' : next.status
    const result = await execute({
      operation: () =>
        saveCommitteeMeetingAsync(organizationId, record, next, { finalize, external }),
      local: () => ({
        ...record,
        meetings: record.meetings.map(x =>
          x.id === next.id
            ? {
                ...next,
                status: localStatus,
                finalizedAt: finalize ? new Date().toISOString() : x.finalizedAt,
              }
            : x,
        ),
      }),
      success: finalize
        ? en
          ? 'Minutes submitted/finalized.'
          : 'Τα πρακτικά υποβλήθηκαν / οριστικοποιήθηκαν.'
        : en
          ? 'Meeting saved.'
          : 'Η συνεδρίαση αποθηκεύτηκε.',
      close: finalize,
    })
    if (result) signalDemoStep('committee_minutes', 'minutes')
    return Boolean(result)
  }
  function cancelMeeting(meeting) {
    setDialog({ type: 'cancelMeeting', value: meeting })
  }
  async function confirmCancelMeeting(reason) {
    const meeting = dialog?.value
    if (!meeting) return
    await execute({
      operation: () => cancelCommitteeMeetingAsync(organizationId, record, meeting, reason),
      local: () => ({
        ...record,
        meetings: record.meetings.map(x =>
          x.id === meeting.id
            ? {
                ...x,
                status: 'cancelled',
                cancellationReason: reason,
                cancelledAt: new Date().toISOString(),
                cancelledBy: actor.id,
              }
            : x,
        ),
        history: [
          {
            at: new Date().toISOString(),
            actor: actor.name,
            actorId: actor.id,
            action: 'Ακύρωση συνεδρίασης',
            reason,
          },
          ...(record.history || []),
        ],
      }),
      success: en ? 'Meeting cancelled.' : 'Η συνεδρίαση ακυρώθηκε.',
    })
  }
  async function answerApproval(id, status, comment = '') {
    if (status === 'approved') {
      const ok = await confirm({
        title: en ? 'Approve minutes' : 'Έγκριση πρακτικών',
        message: en
          ? 'Confirm your approval for these minutes.'
          : 'Επιβεβαιώστε την έγκρισή σας για τα πρακτικά.',
        confirmLabel: en ? 'Approve' : 'Έγκριση',
      })
      if (!ok) return
    }
    await execute({
      operation: () => answerCommitteeMinutesApprovalAsync(id, status, comment),
      local: () => record,
      success:
        status === 'approved'
          ? en
            ? 'Minutes approved.'
            : 'Τα πρακτικά εγκρίθηκαν.'
          : en
            ? 'Changes requested.'
            : 'Το αίτημα διορθώσεων καταχωρήθηκε.',
      close: false,
    })
  }
  async function externalAction(id, action) {
    if (action === 'paper') {
      const ok = await confirm({
        title: en ? 'Signature on paper' : 'Υπογραφή σε χαρτί',
        message: en
          ? 'Record that this member signed the printed minutes. The e-mail link stops working.'
          : 'Καταχωρήστε ότι το μέλος υπέγραψε τα έντυπα πρακτικά. Ο σύνδεσμος του email παύει να ισχύει.',
        confirmLabel: en ? 'Record signature' : 'Καταχώρηση υπογραφής',
      })
      if (!ok) return
    }
    await execute({
      operation: () => externalMinutesActionAsync(organizationId, id, action),
      local: () => record,
      success:
        action === 'resend'
          ? en
            ? 'The e-mail was sent again.'
            : 'Το email στάλθηκε ξανά.'
          : en
            ? 'The signature on paper was recorded.'
            : 'Η υπογραφή σε χαρτί καταχωρήθηκε.',
      close: false,
    })
  }
  async function notifyDecisionOwner(decision) {
    if (!decision.ownerId) return
    const linkPath = `/committees/${record.id}`
    const title = en
      ? `New committee action: ${decision.title}`
      : `Νέα ενέργεια επιτροπής: ${decision.title}`
    const message = en
      ? `You were assigned an action in "${record.name}"${decision.dueDate ? ` — due ${fmtDate(decision.dueDate)}` : ''}.`
      : `Σας ανατέθηκε ενέργεια στην επιτροπή «${record.name}»${decision.dueDate ? ` — προθεσμία ${fmtDate(decision.dueDate)}` : ''}.`
    const payload = {
      title,
      message,
      priority: ['high', 'critical'].includes(decision.priority) ? 'high' : 'normal',
      audienceType: 'user',
      audienceValues: [decision.ownerId],
      requiresAck: false,
      linkPath,
    }
    try {
      if (isDemo) n.addAnnouncement(payload)
      else {
        await createAnnouncement(organizationId, payload)
        await n.reloadAnnouncements()
      }
    } catch {
      /* the decision itself is already saved; a failed notice is not worth surfacing as an error */
    }
  }
  async function saveDecision(draft) {
    const editing = Boolean(draft.id)
    const existing = editing ? record.decisions.find(x => x.id === draft.id) : null
    const next = editing ? draft : { ...draft, id: `DEC-${Date.now()}`, status: 'open' }
    const result = await execute({
      operation: () =>
        editing
          ? updateCommitteeDecisionAsync(organizationId, record, existing, draft)
          : createCommitteeDecisionAsync(organizationId, record, next),
      local: () => ({
        ...record,
        decisions: editing
          ? record.decisions.map(x => (x.id === draft.id ? { ...x, ...draft } : x))
          : [next, ...(record.decisions || [])],
      }),
      success: editing
        ? en
          ? 'Decision updated.'
          : 'Η απόφαση ενημερώθηκε.'
        : en
          ? 'Decision created.'
          : 'Η απόφαση καταχωρήθηκε.',
    })
    if (result && draft.ownerId && draft.ownerId !== (existing?.ownerId || null))
      await notifyDecisionOwner(draft)
  }
  async function decisionStatus(item, status) {
    await execute({
      operation: () => updateCommitteeDecisionAsync(organizationId, record, item, { status }),
      local: () => ({
        ...record,
        decisions: record.decisions.map(x => (x.id === item.id ? { ...x, status } : x)),
      }),
      success: en ? 'Status updated.' : 'Η κατάσταση ενημερώθηκε.',
      close: false,
    })
  }
  async function savePlan(draft) {
    const editing = Boolean(draft.id)
    const existing = editing ? record.annualPlan.find(x => x.id === draft.id) : null
    const next = editing
      ? draft
      : { ...draft, id: `OBJ-${Date.now()}`, status: draft.status || 'open' }
    await execute({
      operation: () =>
        editing
          ? updateCommitteePlanItemAsync(organizationId, record, existing, draft)
          : createCommitteePlanItemAsync(organizationId, record, next),
      local: () => ({
        ...record,
        annualPlan: editing
          ? record.annualPlan.map(x => (x.id === draft.id ? { ...x, ...draft } : x))
          : [...(record.annualPlan || []), next],
      }),
      success: editing
        ? en
          ? 'Objective updated.'
          : 'Ο στόχος ενημερώθηκε.'
        : en
          ? 'Objective added.'
          : 'Ο στόχος προστέθηκε.',
    })
  }
  async function removePlan(item) {
    const ok = await confirm({
      title: en ? 'Remove objective' : 'Διαγραφή στόχου',
      message: en
        ? 'The objective will be removed from the active annual plan while the change remains in the audit history. Continue?'
        : 'Ο στόχος θα αφαιρεθεί από το ενεργό ετήσιο σχέδιο, ενώ η αλλαγή θα παραμείνει στο ιστορικό. Θέλετε να συνεχίσετε;',
      confirmLabel: en ? 'Remove' : 'Διαγραφή',
      danger: true,
    })
    if (!ok) return
    await execute({
      operation: () =>
        updateCommitteePlanItemAsync(organizationId, record, item, { status: 'cancelled' }),
      local: () => ({
        ...record,
        annualPlan: record.annualPlan.map(x =>
          x.id === item.id ? { ...x, status: 'cancelled' } : x,
        ),
      }),
      success: en ? 'Objective removed.' : 'Ο στόχος διαγράφηκε.',
      close: false,
    })
  }
  async function saveFramework(draft) {
    await execute({
      operation: () => updateCommitteeFrameworkAsync(organizationId, record, draft),
      local: () => ({ ...record, ...draft }),
      success: en ? 'Framework updated.' : 'Το θεσμικό πλαίσιο ενημερώθηκε.',
    })
  }
  function saveDemoDocuments(files) {
    if (!isDemo) return
    const nextRows = rows.map(x => (x.id === record.id ? { ...x, documents: files } : x))
    setRows(nextRows)
    saveCommittees(nextRows)
  }

  const headerActions = (
    <>
      {tab === 'overview' && (
        <div className="record-actions">
          {canFramework && (
            <IconButton
              tone="edit"
              label={en ? 'Edit committee' : 'Επεξεργασία επιτροπής'}
              disabled={busy}
              onClick={() => setDialog({ type: 'details' })}
            >
              <Pencil size={16} />
            </IconButton>
          )}
          {canArchive && (
            <ActionButton
              tone="danger"
              label={en ? 'Archive committee' : 'Αρχειοθέτηση επιτροπής'}
              disabled={busy}
              onClick={archiveCommittee}
            >
              <Trash2 size={16} />
            </ActionButton>
          )}
        </div>
      )}
      <PrintExportActions onExport={() => downloadRecordJson(record, { filename: record?.id })} />
    </>
  )

  return (
    <Page fill>
      <EntityRecordShell
        avatar={<Users size={19} />}
        eyebrow={record.id}
        title={record.name}
        subtitle={record.shortName || ''}
        status={
          <span className={`status-badge ${record.status === 'active' ? 'active' : ''}`}>
            {record.status === 'active' ? (en ? 'Active' : 'Ενεργή') : en ? 'Inactive' : 'Ανενεργή'}
          </span>
        }
        recordNavigation={recordNavigation}
        onBack={() => navigate('/committees')}
        headerActions={headerActions}
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
      >
        {tab === 'overview' && <Overview record={record} members={activeMembers} en={en} />}
        {tab === 'members' && (
          <Members
            rows={record.memberRefs || []}
            canManage={canMembers && !busy}
            onAdd={() => setDialog({ type: 'member' })}
            onEdit={x => setDialog({ type: 'member', value: x })}
            onEnd={endMember}
            en={en}
          />
        )}
        {tab === 'plan' && (
          <Plan
            rows={(record.annualPlan || []).filter(x => x.status !== 'cancelled')}
            canManage={canDecisions && !busy}
            onAdd={() => setDialog({ type: 'plan' })}
            onEdit={x => setDialog({ type: 'plan', value: x })}
            onDelete={removePlan}
            en={en}
          />
        )}
        {tab === 'meetings' && (
          <Meetings
            rows={record.meetings || []}
            canCreate={canMeeting && !busy}
            canCancel={canMeeting && !busy}
            onAdd={() => setDialog({ type: 'newMeeting' })}
            onOpen={x => setDialog({ type: 'meeting', id: x.id })}
            onCancel={cancelMeeting}
            en={en}
          />
        )}
        {tab === 'decisions' && (
          <Decisions
            rows={record.decisions || []}
            canManage={canDecisions && !busy}
            onAdd={() => setDialog({ type: 'decision' })}
            onEdit={x => setDialog({ type: 'decision', value: x })}
            onStatus={decisionStatus}
            en={en}
          />
        )}
        {tab === 'framework' && (
          <Framework
            record={record}
            canManage={canFramework && !busy}
            onEdit={() => setDialog({ type: 'framework' })}
            en={en}
          />
        )}
        {tab === 'documents' && (
          <section className="record-section">
            <Head
              title={en ? 'Documents & evidence' : 'Έγγραφα & τεκμήρια'}
              subtitle={
                en
                  ? 'Files are stored through the governed attachment service.'
                  : 'Τα αρχεία αποθηκεύονται μέσω της ελεγχόμενης υπηρεσίας συνημμένων.'
              }
            />
            {(record.documents || []).some(x => x.documentCode) && (
              <ul
                className="committee-linked-documents"
                aria-label={en ? 'Linked controlled documents' : 'Συνδεδεμένα ελεγχόμενα έγγραφα'}
              >
                {record.documents
                  .filter(x => x.documentCode)
                  .map(x => (
                    <li key={x.id}>
                      <Link to={`/documents/${x.documentCode}`}>
                        <strong>{x.documentCode}</strong>
                        <span>{x.documentTitle}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
            <AttachmentField
              disabled={!canDocuments}
              value={(record.documents || []).filter(x => !x.documentCode)}
              onChange={saveDemoDocuments}
              organizationId={organizationId}
              entityType="committee_document"
              entityId={record.dbId || record.id}
            />
          </section>
        )}
        {tab === 'history' && <History rows={record.history || []} en={en} />}
      </EntityRecordShell>

      {dialog?.type === 'details' && (
        <CommitteeDetailsDialog
          record={record}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={saveDetails}
          en={en}
        />
      )}
      {dialog?.type === 'member' && (
        <MemberDialog
          staff={staff}
          initial={dialog.value}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={dialog.value ? editMember : addMember}
          en={en}
        />
      )}
      {dialog?.type === 'endMember' && (
        <ReasonDialog
          busy={busy}
          title={en ? 'End membership' : 'Λήξη συμμετοχής'}
          description={
            en
              ? 'The membership will end and remain in the committee history.'
              : 'Η συμμετοχή θα λήξει και θα παραμείνει στο ιστορικό της επιτροπής.'
          }
          label={en ? 'Reason' : 'Αιτιολογία'}
          confirmLabel={en ? 'End membership' : 'Λήξη συμμετοχής'}
          danger
          onClose={() => setDialog(null)}
          onSave={confirmEndMember}
          en={en}
        />
      )}
      {dialog?.type === 'newMeeting' && (
        <NewMeetingDialog busy={busy} onClose={() => setDialog(null)} onSave={addMeeting} en={en} />
      )}
      {dialog?.type === 'meeting' && (
        <MeetingDialog
          key={dialog.id}
          meeting={(record.meetings || []).find(x => x.id === dialog.id)}
          members={activeMembers}
          actorId={actor.id}
          canSave={canMinutes && !busy}
          canFinalize={canFinalize && !busy}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={saveMeeting}
          onApproval={answerApproval}
          onExternalAction={externalAction}
          en={en}
        />
      )}
      {dialog?.type === 'cancelMeeting' && (
        <ReasonDialog
          busy={busy}
          title={en ? 'Cancel meeting' : 'Ακύρωση συνεδρίασης'}
          description={
            en
              ? 'Cancellation is permanent and will be recorded in the committee history.'
              : 'Η ακύρωση είναι οριστική και θα καταγραφεί στο ιστορικό της επιτροπής.'
          }
          label={en ? 'Cancellation reason' : 'Αιτιολογία ακύρωσης'}
          confirmLabel={en ? 'Cancel meeting' : 'Ακύρωση συνεδρίασης'}
          danger
          onClose={() => setDialog(null)}
          onSave={confirmCancelMeeting}
          en={en}
        />
      )}
      {dialog?.type === 'decision' && (
        <DecisionDialog
          initial={dialog.value}
          meetings={record.meetings || []}
          members={activeMembers}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={saveDecision}
          en={en}
        />
      )}
      {dialog?.type === 'plan' && (
        <PlanDialog
          initial={dialog.value}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={savePlan}
          en={en}
        />
      )}
      {dialog?.type === 'framework' && (
        <FrameworkDialog
          record={record}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={saveFramework}
          en={en}
        />
      )}
    </Page>
  )
}
