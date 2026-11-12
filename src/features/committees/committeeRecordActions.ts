import { attendanceFor, finalizationBlocker, meetingQuorum } from './committeeMeetingRules'
import { createAnnouncement } from '../management/announcementCloudService'
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
import { rolesFromTitle } from './committeeMemberRoles'
import { signalDemoStep } from '../demo/demoScenarioSignals'
import type { NavigateFunction } from 'react-router-dom'
import type { AuditActor } from '../../core/audit/actor'
import type { FeedbackContextValue } from '../../core/feedback/feedbackTypes'
import type { NotificationContextValue } from '../../core/notifications/notificationTypes'
import type { AnyRecord } from '../../types/featureTypes'

// One save of the record: production runs `operation`, Demo `local` (the changed committee).
export interface CommitteeStep {
  operation: () => Promise<unknown>
  local?: () => AnyRecord
  success?: string
  context?: string
  close?: boolean
}
// The dialog open over the record, with the row it is about.
export type CommitteeDialog = { type: string, value?: AnyRecord } | null
export interface CommitteeRecordContext {
  record: AnyRecord
  rows: AnyRecord[]
  setRows: (rows: AnyRecord[]) => void
  execute: (step: CommitteeStep) => Promise<unknown>
  en: boolean
  organizationId: string | null
  actor: AuditActor
  staff: AnyRecord[]
  activeMembers: AnyRecord[]
  dialog: CommitteeDialog
  setDialog: (dialog: CommitteeDialog) => void
  confirm: FeedbackContextValue['confirm']
  notify: FeedbackContextValue['notify']
  navigate: NavigateFunction
  isDemo: boolean
  n: NotificationContextValue
  openMeeting: (id: string) => void
}

// What the committee record does (members, meetings, minutes, decisions, plan, framework):
// built by CommitteeRecordPage on each render, once the committee is loaded, from the page's
// state. Demo keeps the change in the session list (execute → local), production saves it.
export function committeeRecordActions(ctx: CommitteeRecordContext) {
  const { record, rows, setRows, execute, en, organizationId, actor, staff, activeMembers, dialog, setDialog, confirm, notify, navigate, isDemo, n, openMeeting } = ctx
  async function saveDetails(draft: AnyRecord) {
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
    if (result) navigate('/meetings', { replace: true })
  }
  async function addMember(draft: AnyRecord) {
    const person = staff.find(x => x.id === draft.employeeId)
    const manualName = String(draft.manualName || '').trim()
    if (!person && !manualName) return
    const member = {
      id: `CM-${Date.now()}`,
      employeeId: person?.id || '',
      employeeDbId: person?.dbId || null,
      name: person?.name || manualName,
      // A name typed by hand matches no employee: the member is outside the staff.
      external: !person,
      department: person?.department || '',
      profession: person?.profession || '',
      committeeTitle: draft.committeeTitle || 'Μέλος',
      roles: draft.roles?.length ? draft.roles : rolesFromTitle(draft.committeeTitle),
      specialty: draft.specialty || '',
      responsibilities: draft.responsibilities || '',
      voting: draft.voting !== false,
      inControlTeam: draft.inControlTeam === true,
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
  async function editMember(draft: AnyRecord) {
    const member = record.memberRefs.find((x: AnyRecord) => x.id === draft.id)
    if (!member) return
    await execute({
      operation: () => updateCommitteeMemberAsync(organizationId, record, member, draft),
      local: () => ({
        ...record,
        memberRefs: record.memberRefs.map((x: AnyRecord) => (x.id === member.id ? { ...x, ...draft } : x)),
      }),
      success: en ? 'Member updated.' : 'Το μέλος ενημερώθηκε.',
    })
  }
  function endMember(member: AnyRecord) {
    setDialog({ type: 'endMember', value: member })
  }
  async function confirmEndMember(reason: string) {
    const member = dialog?.value
    if (!member) return
    await execute({
      operation: () => endCommitteeMemberAsync(organizationId, record, member, reason),
      local: () => ({
        ...record,
        memberRefs: record.memberRefs.map((x: AnyRecord) =>
          x.id === member.id
            ? { ...x, active: false, endedAt: new Date().toISOString(), endReason: reason }
            : x,
        ),
      }),
      success: en ? 'Membership ended.' : 'Η συμμετοχή έληξε.',
    })
  }
  async function notifyUpcomingMeeting(meeting: AnyRecord) {
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
        await createAnnouncement(organizationId as string, payload)
        await n.reloadAnnouncements()
      }
    } catch {
      /* the meeting itself is already saved; a failed notice is not worth surfacing as an error */
    }
  }
  async function addMeeting(draft: AnyRecord) {
    const id = `MTG-${Date.now()}`
    const next = {
      ...draft,
      id,
      status: 'planned',
      topics: draft.topics?.length ? draft.topics : [createTopic()],
      attendanceRecords: attendanceFor(draft.composition === 'control_team' && activeMembers.some(member => member.inControlTeam) ? activeMembers.filter(member => member.inControlTeam) : activeMembers),
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
      openMeeting(id)
      signalDemoStep('committee_minutes', 'meeting')
      await notifyUpcomingMeeting(next)
    }
  }
  async function saveMeeting(draft: AnyRecord, finalize = false, external: AnyRecord[] = []) {
    const counted = meetingQuorum(draft.attendanceRecords, record.quorumRule)
    const next: AnyRecord = { ...draft, quorum: counted.quorum, attendance: counted.attendance }
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
        meetings: record.meetings.map((x: AnyRecord) =>
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
  function cancelMeeting(meeting: AnyRecord) {
    setDialog({ type: 'cancelMeeting', value: meeting })
  }
  async function confirmCancelMeeting(reason: string) {
    const meeting = dialog?.value
    if (!meeting) return
    await execute({
      operation: () => cancelCommitteeMeetingAsync(organizationId, record, meeting, reason),
      local: () => ({
        ...record,
        meetings: record.meetings.map((x: AnyRecord) =>
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
  async function answerApproval(id: string, status: string, comment = '') {
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
  async function externalAction(id: string, action: string) {
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
  async function notifyDecisionOwner(decision: AnyRecord) {
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
        await createAnnouncement(organizationId as string, payload)
        await n.reloadAnnouncements()
      }
    } catch {
      /* the decision itself is already saved; a failed notice is not worth surfacing as an error */
    }
  }
  async function saveDecision(draft: AnyRecord) {
    const editing = Boolean(draft.id)
    const existing = editing ? record.decisions.find((x: AnyRecord) => x.id === draft.id) : null
    const next = editing ? draft : { ...draft, id: `DEC-${Date.now()}`, status: 'open' }
    const result = await execute({
      operation: () =>
        editing
          ? updateCommitteeDecisionAsync(organizationId, record, existing, draft)
          : createCommitteeDecisionAsync(organizationId, record, next),
      local: () => ({
        ...record,
        decisions: editing
          ? record.decisions.map((x: AnyRecord) => (x.id === draft.id ? { ...x, ...draft } : x))
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
  async function decisionStatus(item: AnyRecord, status: string) {
    await execute({
      operation: () => updateCommitteeDecisionAsync(organizationId, record, item, { status }),
      local: () => ({
        ...record,
        decisions: record.decisions.map((x: AnyRecord) => (x.id === item.id ? { ...x, status } : x)),
      }),
      success: en ? 'Status updated.' : 'Η κατάσταση ενημερώθηκε.',
      close: false,
    })
  }
  async function savePlan(draft: AnyRecord) {
    const editing = Boolean(draft.id)
    const existing = editing ? record.annualPlan.find((x: AnyRecord) => x.id === draft.id) : null
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
          ? record.annualPlan.map((x: AnyRecord) => (x.id === draft.id ? { ...x, ...draft } : x))
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
  async function removePlan(item: AnyRecord) {
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
        annualPlan: record.annualPlan.map((x: AnyRecord) =>
          x.id === item.id ? { ...x, status: 'cancelled' } : x,
        ),
      }),
      success: en ? 'Objective removed.' : 'Ο στόχος διαγράφηκε.',
      close: false,
    })
  }
  async function saveFramework(draft: AnyRecord) {
    await execute({
      operation: () => updateCommitteeFrameworkAsync(organizationId, record, draft),
      local: () => ({ ...record, ...draft }),
      success: en ? 'Framework updated.' : 'Το θεσμικό πλαίσιο ενημερώθηκε.',
    })
  }
  function saveDemoDocuments(files: AnyRecord[]) {
    if (!isDemo) return
    const nextRows = rows.map((x: AnyRecord) => (x.id === record.id ? { ...x, documents: files } : x))
    setRows(nextRows)
    saveCommittees(nextRows)
  }
  return { saveDetails, archiveCommittee, addMember, editMember, endMember, confirmEndMember, addMeeting, saveMeeting, cancelMeeting, confirmCancelMeeting, answerApproval, externalAction, saveDecision, decisionStatus, savePlan, removePlan, saveFramework, saveDemoDocuments }
}
