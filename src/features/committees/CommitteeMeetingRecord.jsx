import { InactiveEmployeeBadge } from '../../design-system/InactiveEmployeeBadge'
import { useState } from 'react'
import { CalendarDays, ClipboardList, NotebookPen, Plus, Send, Trash2, Users } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { ChoiceField } from '../../design-system/ChoiceField'
import { ExportMenu } from '../../design-system/ExportMenu'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { Field } from '../../design-system/Field'
import { FormGrid } from '../../design-system/FormCard'
import { attendanceFor } from './committeeMeetingRules'
import { compositionLabel, controlTeamName } from './committeeRecordFormat'
import { CommitteeApprovalPanel } from './CommitteeApprovalPanel'
import { membersWithoutAccount } from './committeeExternalApprovalService'
import { ExternalApproversDialog } from './ExternalApproversDialog'
import { fmtDate, statusLabel, createTopic } from './committeeRecordFormat'
import { committeeMinutesReport } from './CommitteeMinutesDocument'
import { printReport } from '../../core/export/reportDocument'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useLibraries } from '../management/useLibraries'

const ATTENDANCE = [
  ['not_recorded', 'Δεν καταγράφηκε', 'Not recorded'],
  ['present', 'Παρών/ούσα', 'Present'],
  ['absent', 'Απών/ούσα', 'Absent'],
  ['excused', 'Δικαιολογημένη απουσία', 'Excused'],
]
// The record shell keeps a `utility` action visible in the header (tone primary: the main one, last).
const HeaderAction = ({ children }) => children
const STATUS_TONE = { finalized: 'active', approval_pending: 'temporary', cancelled: '' }

// A committee meeting and its minutes as a record of its own (opened from the committee's
// «Meetings» tab): the details, the attendance, the topics with their conclusions, and the
// notes with the approval, each on its own tab, instead of one long window.
export function MeetingRecord({ inactiveCodes, meeting, committeeName = '', members, actorId, canSave, canFinalize, busy, onBack, onSave, onApproval, onExternalAction, en }) {
  const [externalApprovers, setExternalApprovers] = useState(null)
  const { notifyError } = useFeedback()
  // Topic suggestions from the hospital's library (Management > Libraries).
  const { libraries } = useLibraries()
  const topicLibrary = libraries.committeeTopics || []
  // A committee with a control team (members marked so) meets as a whole or as the team: the attendance, and so the
  // quorum, is then only the team's.
  const team = members.filter(member => member.inControlTeam)
  const teamName = controlTeamName(committeeName, en)
  // Members who are inactive employees now (they stay in the history of the meeting).
  const inactiveMemberIds = new Set(members.filter(member => inactiveCodes?.has(String(member.employeeId || ''))).map(member => String(member.id)))
  const membersOf = composition => (composition === 'control_team' && team.length ? team : members)
  const [v, setV] = useState(() => ({
    ...meeting,
    composition: meeting.composition === 'control_team' ? 'control_team' : 'plenary',
    attendanceRecords: attendanceFor(membersOf(meeting.composition), meeting.attendanceRecords || []),
    topics: meeting.topics?.length ? meeting.topics : [createTopic()],
  }))
  const latestChangeRequest = (meeting.approvals || []).find(x => x.status === 'rejected')
  const locked = ['finalized', 'approval_pending', 'cancelled'].includes(meeting.status)
  // The approval (or the corrections asked for) is what a pending or returned meeting needs first.
  const [tab, setTab] = useState(meeting.status === 'approval_pending' || (meeting.status === 'draft' && latestChangeRequest) ? 'notes' : 'attendance')
  const editable = canSave && !locked
  const set = (k, x) => setV(s => ({ ...s, [k]: x }))
  const setComposition = composition => setV(s => ({ ...s, composition, attendanceRecords: attendanceFor(membersOf(composition), s.attendanceRecords) }))
  const attendance = (id, status) => setV(s => ({ ...s, attendanceRecords: s.attendanceRecords.map(x => ((x.id || x.memberId) === id ? { ...x, status } : x)) }))
  const topic = (id, k, x) => setV(s => ({ ...s, topics: s.topics.map(t => (t.id === id ? { ...t, [k]: x } : t)) }))
  const removeTopic = id => setV(s => ({ ...s, topics: s.topics.filter(t => t.id !== id) }))
  // Present voting members without an account approve by e-mail link or on paper.
  const submit = () => {
    const missing = membersWithoutAccount(v.attendanceRecords, members)
    if (missing.length) setExternalApprovers(missing)
    else onSave(v, true)
  }
  // The minutes as shown (unsaved edits included), printed on the shared document layout (PDF with real text).
  function exportPdf(pdf) {
    if (!printReport(committeeMinutesReport({ committeeName, minutes: { ...v, approvals: meeting.approvals || [] }, en }), { pdf: pdf === true }))
      notifyError(new Error(en ? 'Allow pop-ups to print.' : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.'), 'export', { operation: 'committee_minutes_pdf' })
  }
  const present = v.attendanceRecords.filter(x => x.status === 'present').length
  const footer = editable && <div className="inline-edit-footer"><Button variant="secondary" className="committee-minutes-save" disabled={busy} onClick={() => onSave(v, false)}>{en ? 'Save' : 'Αποθήκευση'}</Button></div>
  const tabs = [
    { id: 'attendance', label: `${en ? 'Attendance' : 'Παρουσίες'} ${present}/${v.attendanceRecords.length}`, icon: Users },
    { id: 'topics', label: `${en ? 'Topics & decisions' : 'Θέματα & αποφάσεις'} ${v.topics.length}`, icon: ClipboardList },
    { id: 'notes', label: en ? 'Notes & approval' : 'Σημειώσεις & έγκριση', icon: NotebookPen },
  ]
  const headerActions = <div className="row-actions">
    <ExportMenu items={[{ id: 'minutes-print', kind: 'print', label: en ? 'Print the minutes' : 'Εκτύπωση πρακτικού', onClick: () => exportPdf(false) }, { id: 'minutes-pdf', kind: 'pdf', label: en ? 'Minutes as PDF' : 'PDF πρακτικού', onClick: () => exportPdf(true) }]} />
    {canFinalize && !locked && <HeaderAction utility tone="primary"><Button disabled={busy} onClick={submit}><Send size={15} />{en ? 'Submit / finalize minutes' : 'Υποβολή / οριστικοποίηση'}</Button></HeaderAction>}
  </div>

  return <>
    <EntityRecordShell className="committee-meeting-record workspace-fill" avatar={<CalendarDays size={19} />} eyebrow={en ? `Meeting minutes · ${committeeName}` : `Πρακτικά συνεδρίασης · ${committeeName}`} title={meeting.title}
      subtitle={[fmtDate(meeting.date), meeting.time, v.minutesNo && `${en ? 'Minutes' : 'Πρακτικό'} ${v.minutesNo}`, v.location, v.composition === 'control_team' && compositionLabel('control_team', teamName, en)].filter(Boolean).join(' · ')}
      status={<span className={`status-badge ${STATUS_TONE[meeting.status] ?? ''}`.trim()}>{statusLabel(meeting.status, en)}</span>}
      onBack={onBack} backLabel={en ? 'Committee' : 'Επιτροπή'} headerActions={headerActions} tabs={tabs} activeTab={tab} onTabChange={setTab}>
      {tab === 'attendance' && <RecordTabPanel title={en ? 'Attendance' : 'Παρουσίες'} subtitle={en ? 'The quorum is counted from the present voting members.' : 'Η απαρτία μετριέται από τα παρόντα μέλη με ψήφο.'} footer={footer}>
        {(team.length > 0 || v.composition === 'control_team') && <div className="committee-composition">
          <ChoiceField label={en ? 'Who met' : 'Σύνθεση'} disabled={!editable} value={v.composition} onChange={setComposition} options={[{ value: 'plenary', label: compositionLabel('plenary', teamName, en) }, { value: 'control_team', label: compositionLabel('control_team', teamName, en) }]} />
        </div>}
        <div className="scroll-table committee-attendance-wrap">
          <table className="data-table committee-attendance-table">
            <thead><tr><th>{en ? 'Member' : 'Μέλος'}</th><th>{en ? 'Status' : 'Κατάσταση'}</th></tr></thead>
            <tbody>{v.attendanceRecords.map(x => <tr key={x.id || x.memberId} className={inactiveMemberIds.has(String(x.memberId || '')) ? 'inactive-employee-row' : undefined}>
              <td>{x.name}<InactiveEmployeeBadge inactive={inactiveMemberIds.has(String(x.memberId || ''))} /></td>
              <td><SearchableSelect hideLabel label={`${en ? 'Attendance' : 'Παρουσία'}: ${x.name}`} disabled={!editable} value={x.status || 'not_recorded'} onChange={status => status && attendance(x.id || x.memberId, status)} options={ATTENDANCE.map(([value, el, enText]) => ({ value, label: en ? enText : el }))} /></td>
            </tr>)}</tbody>
          </table>
        </div>
      </RecordTabPanel>}
      {tab === 'topics' && <RecordTabPanel title={en ? 'Topics & decisions' : 'Θέματα & αποφάσεις'} footer={footer}
        actions={editable && <Button variant="secondary" onClick={() => setV(s => ({ ...s, topics: [...s.topics, createTopic()] }))}><Plus size={14} />{en ? 'Topic' : 'Θέμα'}</Button>}>
        <div className="committee-topics-section">
          {v.topics.map((t, i) => <div className="committee-topic-card committee-topic-card-compact" key={t.id}>
            <div className="committee-topic-card-head">
              <strong>{en ? 'Topic' : 'Θέμα'} {i + 1}</strong>
              {editable && <IconButton tone="danger" label={en ? 'Delete topic' : 'Διαγραφή θέματος'} onClick={() => removeTopic(t.id)}><Trash2 size={15} /></IconButton>}
            </div>
            <div className="committee-topic-fields">
              <label><span>{en ? 'Subject' : 'Θέμα'}</span><input disabled={!editable} list={topicLibrary.length ? 'committee-topic-library' : undefined} value={t.subject || ''} onChange={e => topic(t.id, 'subject', e.target.value)} /></label>
              <label><span>{en ? 'Decision / conclusion' : 'Απόφαση / συμπέρασμα'}</span><textarea disabled={!editable} rows="2" value={t.decision || ''} onChange={e => topic(t.id, 'decision', e.target.value)} /></label>
            </div>
          </div>)}
          {topicLibrary.length > 0 && <datalist id="committee-topic-library">{topicLibrary.map(item => <option key={item.meta?.id || item.value} value={en ? item.en : item.el} label={item.meta?.category || undefined} />)}</datalist>}
          {!v.topics.length && <div className="inline-empty committee-topics-empty">{en ? 'No topics. Add one only when needed.' : 'Δεν υπάρχουν θέματα. Προσθέστε μόνο όσα χρειάζονται.'}</div>}
        </div>
      </RecordTabPanel>}
      {tab === 'notes' && <RecordTabPanel title={en ? 'Notes & approval' : 'Σημειώσεις & έγκριση'} footer={footer}>
        <div className="committee-meeting-notes">
          {meeting.status === 'cancelled' && meeting.cancellationReason && <div className="source-truth-note"><strong>{en ? 'Meeting cancelled' : 'Η συνεδρίαση ακυρώθηκε'}</strong><p>{meeting.cancellationReason}</p></div>}
          {meeting.status === 'draft' && latestChangeRequest && <div className="source-truth-note"><strong>{en ? 'Changes requested' : 'Ζητήθηκαν διορθώσεις στα πρακτικά'}</strong><p>{latestChangeRequest.comment || (en ? 'Review the requested corrections before resubmitting.' : 'Ελέγξτε τις ζητούμενες διορθώσεις πριν από την επανυποβολή.')}</p></div>}
          <FormGrid columns={2}>
            <Field label={en ? 'Minutes number' : 'Αρ. πρακτικού'}><input disabled={!editable} value={v.minutesNo || ''} onChange={e => set('minutesNo', e.target.value)} /></Field>
            <Field label={en ? 'Location' : 'Χώρος'}><input disabled={!editable} value={v.location || ''} onChange={e => set('location', e.target.value)} /></Field>
          </FormGrid>
          <label className="field committee-general-notes"><span>{en ? 'General notes' : 'Γενικές σημειώσεις'}</span><textarea disabled={!editable} rows="4" value={v.generalNotes || ''} onChange={e => set('generalNotes', e.target.value)} /></label>
          {meeting.status === 'approval_pending' && <>
            <div className="source-truth-note"><strong>{en ? 'Minutes awaiting approval' : 'Τα πρακτικά βρίσκονται σε έγκριση'}</strong><p>{en ? 'They will be finalized automatically when every required approver accepts.' : 'Θα οριστικοποιηθούν αυτόματα όταν εγκρίνουν όλοι οι απαιτούμενοι χρήστες.'}</p></div>
            <CommitteeApprovalPanel approvals={meeting.approvals || []} actorId={actorId} busy={busy} canManage={canFinalize} onApprove={id => onApproval(id, 'approved', '')} onRequestChanges={(id, comment) => onApproval(id, 'rejected', comment)} onExternalAction={onExternalAction} en={en} />
          </>}
        </div>
      </RecordTabPanel>}
    </EntityRecordShell>
    {externalApprovers && <ExternalApproversDialog approvers={externalApprovers} busy={busy} en={en} onClose={() => setExternalApprovers(null)}
      onSubmit={async choices => { const saved = await onSave(v, true, choices); if (saved) setExternalApprovers(null) }} />}
  </>
}
