import { useEffect, useState } from 'react'
import { attendanceFor } from './committeeMeetingRules'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { ManualDateField } from '../../design-system/ManualDateField'
import { TimeField } from '../../design-system/TimeField'
import { useTenant } from '../../core/tenant/TenantContext'
import { loadIndicatorDefinitions } from '../indicators/indicatorDefinitionService'
import { CommitteeApprovalPanel } from './CommitteeApprovalPanel'
import { membersWithoutAccount } from './committeeExternalApprovalService'
import { ExternalApproversDialog } from './ExternalApproversDialog'
import { fmtDate, statusLabel, createTopic, COMMITTEE_ROLE_OPTIONS } from './committeeRecordFormat'
import { Head } from './CommitteeRecordSections'

// Dialogs opened from the committee record page (CommitteeRecordPage.jsx).
export function CommitteeDetailsDialog({ record, busy, onClose, onSave, en }) {
  const [v, setV] = useState({
    name: record.name || '',
    shortName: record.shortName || '',
    status: record.status || 'active',
    decisionNumber: record.decisionNumber || '',
    termStart: record.termStart || '',
    termEnd: record.termEnd || '',
    meetingFrequency: record.meetingFrequency || 'quarterly',
    quorumRule: record.quorumRule || 'simple_majority',
    notes: record.notes || '',
  })
  const set = (k, x) => setV(s => ({ ...s, [k]: x }))
  const datesValid = !v.termStart || !v.termEnd || new Date(v.termEnd) >= new Date(v.termStart)
  return (
    <ObserverDialog
      width="wide"
      eyebrow={record.id}
      title={en ? 'Edit committee' : 'Επεξεργασία επιτροπής'}
      subtitle={
        en
          ? 'Update the committee identity and operating details.'
          : 'Ενημερώστε τα βασικά και λειτουργικά στοιχεία της επιτροπής.'
      }
      onClose={onClose}
      footer={
        <DialogActions
          onCancel={onClose}
          disabled={busy || !v.name.trim() || !datesValid}
          onSave={() => onSave(v)}
          saveLabel={busy ? (en ? 'Saving…' : 'Αποθήκευση…') : en ? 'Save' : 'Αποθήκευση'}
        />
      }
    >
      <div className="entry-grid compact">
        <label className="entry-span-2">
          <span>{en ? 'Name *' : 'Ονομασία *'}</span>
          <input value={v.name} onChange={e => set('name', e.target.value)} />
        </label>
        <label>
          <span>{en ? 'Short name' : 'Σύντομη ονομασία'}</span>
          <input value={v.shortName} onChange={e => set('shortName', e.target.value)} />
        </label>
        <label>
          <span>{en ? 'Status' : 'Κατάσταση'}</span>
          <select value={v.status} onChange={e => set('status', e.target.value)}>
            <option value="active">{en ? 'Active' : 'Ενεργή'}</option>
            <option value="inactive">{en ? 'Inactive' : 'Ανενεργή'}</option>
          </select>
        </label>
        <label>
          <span>{en ? 'Decision number' : 'Αρ. απόφασης'}</span>
          <input value={v.decisionNumber} onChange={e => set('decisionNumber', e.target.value)} />
        </label>
        <label>
          <span>{en ? 'Meeting frequency' : 'Συχνότητα συνεδριάσεων'}</span>
          <select
            value={v.meetingFrequency}
            onChange={e => set('meetingFrequency', e.target.value)}
          >
            <option value="monthly">{en ? 'Monthly' : 'Μηνιαία'}</option>
            <option value="bimonthly">{en ? 'Every two months' : 'Ανά δίμηνο'}</option>
            <option value="quarterly">{en ? 'Quarterly' : 'Τριμηνιαία'}</option>
            <option value="semiannual">{en ? 'Semiannual' : 'Εξαμηνιαία'}</option>
            <option value="annual">{en ? 'Annual' : 'Ετήσια'}</option>
            <option value="as_needed">{en ? 'As needed' : 'Όποτε απαιτείται'}</option>
          </select>
        </label>
        <ManualDateField
          label={en ? 'Term start' : 'Έναρξη θητείας'}
          value={v.termStart}
          onChange={x => set('termStart', x)}
        />
        <ManualDateField
          label={en ? 'Term end' : 'Λήξη θητείας'}
          value={v.termEnd}
          onChange={x => set('termEnd', x)}
        />
        <label>
          <span>{en ? 'Quorum' : 'Απαρτία'}</span>
          <select value={v.quorumRule} onChange={e => set('quorumRule', e.target.value)}>
            <option value="simple_majority">
              {en ? 'Simple majority' : 'Απλή πλειοψηφία ενεργών μελών'}
            </option>
            <option value="two_thirds">2/3</option>
            <option value="custom">
              {en ? 'According to regulations' : 'Σύμφωνα με τον κανονισμό'}
            </option>
          </select>
        </label>
        <label className="entry-span-2">
          <span>{en ? 'Notes' : 'Σημειώσεις'}</span>
          <textarea rows="3" value={v.notes} onChange={e => set('notes', e.target.value)} />
        </label>
      </div>
      {!datesValid && (
        <div className="committee-validation">
          {en
            ? 'Term end must be after term start.'
            : 'Η λήξη θητείας πρέπει να είναι μετά την έναρξη.'}
        </div>
      )}
    </ObserverDialog>
  )
}

export function ReasonDialog({
  busy,
  title,
  description,
  label,
  confirmLabel,
  danger = false,
  onClose,
  onSave,
  en,
}) {
  const [reason, setReason] = useState('')
  return (
    <ObserverDialog
      width="standard"
      eyebrow={en ? 'Committee governance' : 'Διακυβέρνηση επιτροπής'}
      title={title}
      subtitle={description}
      onClose={onClose}
      footer={
        <DialogActions
          onCancel={onClose}
          disabled={busy || !reason.trim()}
          onSave={() => onSave(reason.trim())}
          saveLabel={busy ? (en ? 'Saving…' : 'Αποθήκευση…') : confirmLabel}
          danger={danger}
        />
      }
    >
      <label className="field">
        <span>{label} *</span>
        <textarea
          autoFocus
          rows="4"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder={en ? 'Enter a clear reason…' : 'Συμπληρώστε σαφή αιτιολογία…'}
        />
      </label>
    </ObserverDialog>
  )
}

export function MemberDialog({ staff, initial, busy, onClose, onSave, en }) {
  const seed = initial
    ? {
        ...initial,
        memberName: initial.name || '',
        manualName: initial.employeeId ? '' : initial.name || '',
      }
    : {
        employeeId: '',
        manualName: '',
        memberName: '',
        committeeTitle: 'Μέλος',
        responsibilities: '',
        memberType: 'regular',
        voting: true,
        approvalRequired: false,
      }
  const [v, setV] = useState(seed)
  const set = (k, x) => setV(s => ({ ...s, [k]: x }))
  const normalize = x =>
    String(x || '')
      .trim()
      .toLocaleLowerCase(en ? 'en' : 'el-GR')
  const writePerson = x =>
    setV(s => {
      const person = staff.find(item => normalize(item.name) === normalize(x))
      return {
        ...s,
        memberName: x,
        employeeId: person?.id || '',
        manualName: person ? '' : x,
        approvalRequired: person ? s.approvalRequired : false,
      }
    })
  const selectedPerson = staff.find(x => x.id === v.employeeId)
  const hasPerson = Boolean(v.memberName?.trim())
  const presetRole = COMMITTEE_ROLE_OPTIONS.some(([value]) => value === v.committeeTitle)
  const roleValue = presetRole ? v.committeeTitle : '__other'
  const selectRole = value => {
    if (value === '__other') {
      if (presetRole) set('committeeTitle', '')
      return
    }
    set('committeeTitle', value)
  }
  return (
    <ObserverDialog
      width="wide"
      eyebrow={en ? 'Committee' : 'Επιτροπή'}
      title={
        initial
          ? en
            ? 'Edit member'
            : 'Επεξεργασία μέλους'
          : en
            ? 'Add member'
            : 'Προσθήκη μέλους'
      }
      subtitle={
        !initial
          ? en
            ? 'Type a name or select an employee from the suggestions.'
            : 'Πληκτρολογήστε ονοματεπώνυμο ή επιλέξτε εργαζόμενο από τις προτάσεις.'
          : undefined
      }
      onClose={onClose}
      footer={
        <DialogActions
          onCancel={onClose}
          disabled={busy || !hasPerson || !v.committeeTitle.trim()}
          onSave={() => onSave(v)}
          saveLabel={busy ? (en ? 'Saving…' : 'Αποθήκευση…') : en ? 'Save' : 'Αποθήκευση'}
        />
      }
    >
      <div className="entry-grid compact committee-member-dialog-grid">
        <label className="committee-member-name-field">
          <span>{en ? 'Full name' : 'Ονοματεπώνυμο'}</span>
          <input
            list="committee-member-staff-options"
            value={v.memberName || ''}
            onChange={e => writePerson(e.target.value)}
            placeholder={en ? 'Type or select a name…' : 'Πληκτρολογήστε ή επιλέξτε ονοματεπώνυμο…'}
            autoComplete="off"
          />
          <datalist id="committee-member-staff-options">
            {staff.map(x => (
              <option key={x.id} value={x.name}>
                {[x.department, x.profession].filter(Boolean).join(' · ')}
              </option>
            ))}
          </datalist>
          {selectedPerson && (
            <small>
              {[selectedPerson.department, selectedPerson.profession, selectedPerson.email]
                .filter(Boolean)
                .join(' · ')}
            </small>
          )}
        </label>
        <label>
          <span>{en ? 'Committee role' : 'Ιδιότητα στην επιτροπή'}</span>
          <select value={roleValue} onChange={e => selectRole(e.target.value)}>
            {COMMITTEE_ROLE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {en ? label : value}
              </option>
            ))}
            <option value="__other">{en ? 'Other…' : 'Άλλο…'}</option>
          </select>
          {roleValue === '__other' && (
            <input
              value={v.committeeTitle || ''}
              onChange={e => set('committeeTitle', e.target.value)}
              placeholder={en ? 'Enter committee role…' : 'Συμπληρώστε ιδιότητα…'}
            />
          )}
        </label>
        <label>
          <span>{en ? 'Member type' : 'Τύπος μέλους'}</span>
          <select value={v.memberType} onChange={e => set('memberType', e.target.value)}>
            <option value="regular">{en ? 'Regular' : 'Τακτικό'}</option>
            <option value="alternate">{en ? 'Alternate' : 'Αναπληρωματικό'}</option>
            <option value="observer">{en ? 'Observer' : 'Παρατηρητής'}</option>
            <option value="advisor">{en ? 'Advisor' : 'Σύμβουλος'}</option>
          </select>
        </label>
        <label className="entry-span-2">
          <span>{en ? 'Responsibilities' : 'Αρμοδιότητες'}</span>
          <textarea
            rows="4"
            value={v.responsibilities}
            onChange={e => set('responsibilities', e.target.value)}
          />
        </label>
        <div className="committee-member-options-row">
          <label className="committee-check-option">
            <input
              type="checkbox"
              checked={v.voting}
              onChange={e => set('voting', e.target.checked)}
            />
            <span>{en ? 'Voting member' : 'Δικαίωμα ψήφου'}</span>
          </label>
          {!initial && (
            <label className="committee-check-option">
              <input
                type="checkbox"
                disabled={!v.employeeId}
                checked={v.approvalRequired}
                onChange={e => set('approvalRequired', e.target.checked)}
              />
              <span>
                {en ? 'Participation approval required' : 'Απαιτείται έγκριση συμμετοχής'}
              </span>
            </label>
          )}
        </div>
      </div>
    </ObserverDialog>
  )
}

export function NewMeetingDialog({ busy, onClose, onSave, en }) {
  const [v, setV] = useState({
    title: '',
    meetingType: 'regular',
    date: '',
    time: '09:00',
    location: '',
    topics: [createTopic()],
  })
  const set = (k, x) => setV(s => ({ ...s, [k]: x }))
  return (
    <ObserverDialog
      width="wide"
      eyebrow={en ? 'Meetings' : 'Συνεδριάσεις'}
      title={en ? 'New meeting' : 'Νέα συνεδρίαση'}
      onClose={onClose}
      footer={
        <DialogActions
          onCancel={onClose}
          disabled={busy || !v.title.trim() || !v.date}
          onSave={() => onSave({ ...v, title: v.title.trim() })}
          saveLabel={
            busy
              ? en
                ? 'Creating…'
                : 'Δημιουργία…'
              : en
                ? 'Create & continue'
                : 'Δημιουργία & συνέχεια'
          }
        />
      }
    >
      <div className="entry-grid compact">
        <label className="entry-span-2">
          <span>{en ? 'Title' : 'Τίτλος'}</span>
          <input value={v.title} onChange={e => set('title', e.target.value)} />
        </label>
        <label>
          <span>{en ? 'Type' : 'Τύπος'}</span>
          <select value={v.meetingType} onChange={e => set('meetingType', e.target.value)}>
            <option value="regular">{en ? 'Regular' : 'Τακτική'}</option>
            <option value="extraordinary">{en ? 'Extraordinary' : 'Έκτακτη'}</option>
          </select>
        </label>
        <ManualDateField
          label={en ? 'Date' : 'Ημερομηνία'}
          value={v.date}
          onChange={x => set('date', x)}
        />
        <TimeField label={en ? 'Time' : 'Ώρα'} value={v.time} onChange={x => set('time', x)} />
        <label>
          <span>{en ? 'Location' : 'Χώρος'}</span>
          <input value={v.location} onChange={e => set('location', e.target.value)} />
        </label>
      </div>
    </ObserverDialog>
  )
}

export function MeetingDialog({
  meeting,
  members,
  actorId,
  canSave,
  canFinalize,
  busy,
  onClose,
  onSave,
  onApproval,
  onExternalAction,
  en,
}) {
  const [externalApprovers, setExternalApprovers] = useState(null)
  const [v, setV] = useState(() =>
    meeting
      ? {
          ...meeting,
          attendanceRecords: attendanceFor(members, meeting.attendanceRecords || []),
          topics: meeting.topics?.length ? meeting.topics : [createTopic()],
        }
      : null,
  )
  if (!meeting || !v) return null
  const set = (k, x) => setV(s => ({ ...s, [k]: x }))
  const attendance = (id, status) =>
    setV(s => ({
      ...s,
      attendanceRecords: s.attendanceRecords.map(x => (x.memberId === id ? { ...x, status } : x)),
    }))
  const topic = (id, k, x) =>
    setV(s => ({ ...s, topics: s.topics.map(t => (t.id === id ? { ...t, [k]: x } : t)) }))
  const removeTopic = id => setV(s => ({ ...s, topics: s.topics.filter(t => t.id !== id) }))
  const latestChangeRequest = (meeting.approvals || []).find(x => x.status === 'rejected')
  const locked = ['finalized', 'approval_pending', 'cancelled'].includes(meeting.status)
  // Present voting members without an account approve by e-mail link or on paper.
  const submit = () => {
    const missing = membersWithoutAccount(v.attendanceRecords, members)
    if (missing.length) setExternalApprovers(missing)
    else onSave(v, true)
  }
  return (
    <ObserverDialog
      className="committee-meeting-dialog"
      width="workspace"
      eyebrow={en ? 'Meeting minutes' : 'Πρακτικά συνεδρίασης'}
      title={meeting.title}
      subtitle={`${fmtDate(meeting.date)} · ${statusLabel(meeting.status, en)}`}
      onClose={onClose}
      footer={
        <>
          {canSave && !locked && (
            <Button variant="secondary" disabled={busy} onClick={() => onSave(v, false)}>
              {en ? 'Save' : 'Αποθήκευση'}
            </Button>
          )}
          {canFinalize && !locked && (
            <Button disabled={busy} onClick={submit}>
              {en ? 'Submit / finalize minutes' : 'Υποβολή / οριστικοποίηση'}
            </Button>
          )}
        </>
      }
    >
      <div className="observer-form-section committee-meeting-meta">
        <div className="entry-grid compact">
          <label>
            <span>{en ? 'Minutes number' : 'Αρ. πρακτικού'}</span>
            <input
              disabled={!canSave || locked}
              value={v.minutesNo || ''}
              onChange={e => set('minutesNo', e.target.value)}
            />
          </label>
          <label>
            <span>{en ? 'Location' : 'Χώρος'}</span>
            <input
              disabled={!canSave || locked}
              value={v.location || ''}
              onChange={e => set('location', e.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="observer-form-section committee-attendance-section">
        <Head title={en ? 'Attendance' : 'Παρουσίες'} />
        <div className="scroll-table committee-attendance-wrap">
          <table className="data-table committee-attendance-table">
            <thead>
              <tr>
                <th>{en ? 'Member' : 'Μέλος'}</th>
                <th>{en ? 'Status' : 'Κατάσταση'}</th>
              </tr>
            </thead>
            <tbody>
              {v.attendanceRecords.map(x => (
                <tr key={x.memberId}>
                  <td>{x.name}</td>
                  <td>
                    <select
                      disabled={!canSave || locked}
                      value={x.status}
                      onChange={e => attendance(x.memberId, e.target.value)}
                    >
                      <option value="not_recorded">—</option>
                      <option value="present">{en ? 'Present' : 'Παρόν'}</option>
                      <option value="absent">{en ? 'Absent' : 'Απόν'}</option>
                      <option value="excused">{en ? 'Excused' : 'Δικαιολογημένο'}</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="observer-form-section committee-topics-section">
        <Head
          title={en ? 'Agenda & conclusions' : 'Θέματα & συμπεράσματα'}
          action={
            canSave &&
            !locked && (
              <Button
                variant="secondary"
                onClick={() => setV(s => ({ ...s, topics: [...s.topics, createTopic()] }))}
              >
                <Plus size={14} />
                {en ? ' Topic' : ' Θέμα'}
              </Button>
            )
          }
        />
        {v.topics.map((t, i) => (
          <div className="committee-topic-card committee-topic-card-compact" key={t.id}>
            <div className="committee-topic-card-head">
              <strong>
                {en ? 'Topic' : 'Θέμα'} {i + 1}
              </strong>
              {canSave && !locked && (
                <IconButton
                  tone="danger"
                  label={en ? 'Delete topic' : 'Διαγραφή θέματος'}
                  onClick={() => removeTopic(t.id)}
                >
                  <Trash2 size={15} />
                </IconButton>
              )}
            </div>
            <div className="committee-topic-fields">
              <label>
                <span>{en ? 'Subject' : 'Θέμα'}</span>
                <input
                  disabled={!canSave || locked}
                  value={t.subject || ''}
                  onChange={e => topic(t.id, 'subject', e.target.value)}
                />
              </label>
              <label>
                <span>{en ? 'Decision / conclusion' : 'Απόφαση / συμπέρασμα'}</span>
                <textarea
                  disabled={!canSave || locked}
                  rows="2"
                  value={t.decision || ''}
                  onChange={e => topic(t.id, 'decision', e.target.value)}
                />
              </label>
            </div>
          </div>
        ))}
        {!v.topics.length && (
          <div className="inline-empty committee-topics-empty">
            {en
              ? 'No topics. Add one only when needed.'
              : 'Δεν υπάρχουν θέματα. Προσθέστε μόνο όσα χρειάζονται.'}
          </div>
        )}
      </div>
      <label className="field committee-general-notes">
        <span>{en ? 'General notes' : 'Γενικές σημειώσεις'}</span>
        <textarea
          disabled={!canSave || locked}
          rows="3"
          value={v.generalNotes || ''}
          onChange={e => set('generalNotes', e.target.value)}
        />
      </label>
      {meeting.status === 'cancelled' && meeting.cancellationReason && (
        <div className="source-truth-note">
          <strong>{en ? 'Meeting cancelled' : 'Η συνεδρίαση ακυρώθηκε'}</strong>
          <p>{meeting.cancellationReason}</p>
        </div>
      )}
      {meeting.status === 'draft' && latestChangeRequest && (
        <div className="source-truth-note">
          <strong>{en ? 'Changes requested' : 'Ζητήθηκαν διορθώσεις στα πρακτικά'}</strong>
          <p>
            {latestChangeRequest.comment ||
              (en
                ? 'Review the requested corrections before resubmitting.'
                : 'Ελέγξτε τις ζητούμενες διορθώσεις πριν από την επανυποβολή.')}
          </p>
        </div>
      )}
      {meeting.status === 'approval_pending' && (
        <>
          <div className="source-truth-note">
            <strong>
              {en ? 'Minutes awaiting approval' : 'Τα πρακτικά βρίσκονται σε έγκριση'}
            </strong>
            <p>
              {en
                ? 'They will be finalized automatically when every required approver accepts.'
                : 'Θα οριστικοποιηθούν αυτόματα όταν εγκρίνουν όλοι οι απαιτούμενοι χρήστες.'}
            </p>
          </div>
          <CommitteeApprovalPanel
            approvals={meeting.approvals || []}
            actorId={actorId}
            busy={busy}
            canManage={canFinalize}
            onApprove={id => onApproval(id, 'approved', '')}
            onRequestChanges={(id, comment) => onApproval(id, 'rejected', comment)}
            onExternalAction={onExternalAction}
            en={en}
          />
        </>
      )}
      {externalApprovers && (
        <ExternalApproversDialog
          approvers={externalApprovers}
          busy={busy}
          en={en}
          onClose={() => setExternalApprovers(null)}
          onSubmit={async choices => {
            const saved = await onSave(v, true, choices)
            if (saved) setExternalApprovers(null)
          }}
        />
      )}
    </ObserverDialog>
  )
}

export function DecisionDialog({ initial, meetings, members = [], busy, onClose, onSave, en }) {
  const matchedMember = initial?.ownerId ? members.find(m => m.userId === initial.ownerId) : null
  const [v, setV] = useState(() => ({
    title: '',
    action: '',
    owner: '',
    ownerId: null,
    dueDate: '',
    priority: 'medium',
    meetingId: '',
    ...initial,
  }))
  const [ownerMode, setOwnerMode] = useState(
    matchedMember ? 'member' : initial?.owner ? 'manual' : 'member',
  )
  const [ownerMemberId, setOwnerMemberId] = useState(matchedMember?.id || '')
  const set = (k, x) => setV(s => ({ ...s, [k]: x }))
  function chooseOwnerMember(memberId) {
    setOwnerMemberId(memberId)
    const member = members.find(m => m.id === memberId)
    setV(s => ({ ...s, ownerId: member?.userId || null, owner: member?.name || '' }))
  }
  return (
    <ObserverDialog
      width="wide"
      title={
        initial
          ? en
            ? 'Edit decision'
            : 'Επεξεργασία απόφασης'
          : en
            ? 'New decision'
            : 'Νέα απόφαση'
      }
      onClose={onClose}
      footer={
        <DialogActions
          onCancel={onClose}
          disabled={busy || !v.title.trim()}
          onSave={() => onSave(v)}
        />
      }
    >
      <div className="entry-grid compact">
        <label className="entry-span-2">
          <span>{en ? 'Title' : 'Τίτλος'}</span>
          <input value={v.title} onChange={e => set('title', e.target.value)} />
        </label>
        <label className="entry-span-2">
          <span>{en ? 'Action' : 'Ενέργεια'}</span>
          <textarea rows="3" value={v.action || ''} onChange={e => set('action', e.target.value)} />
        </label>
        <label>
          <span>{en ? 'Owner' : 'Υπεύθυνος'}</span>
          <select
            value={ownerMode === 'member' ? ownerMemberId : '__manual'}
            onChange={e => {
              if (e.target.value === '__manual') {
                setOwnerMode('manual')
                setOwnerMemberId('')
                set('ownerId', null)
              } else {
                setOwnerMode('member')
                chooseOwnerMember(e.target.value)
              }
            }}
          >
            <option value="">{en ? 'Select member...' : 'Επιλέξτε μέλος...'}</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.committeeTitle ? ` · ${m.committeeTitle}` : ''}
              </option>
            ))}
            <option value="__manual">{en ? 'Other (free text)' : 'Άλλο (ελεύθερο κείμενο)'}</option>
          </select>
          {ownerMode === 'manual' && (
            <input
              value={v.owner || ''}
              onChange={e => set('owner', e.target.value)}
              placeholder={en ? 'Owner name' : 'Όνομα υπευθύνου'}
            />
          )}
          {ownerMode === 'member' && ownerMemberId && !v.ownerId && (
            <small>
              {en
                ? 'This member has no portal account, so they cannot be notified automatically.'
                : 'Αυτό το μέλος δεν έχει λογαριασμό στην πλατφόρμα, οπότε δεν μπορεί να ειδοποιηθεί αυτόματα.'}
            </small>
          )}
        </label>
        <ManualDateField
          label={en ? 'Due date' : 'Προθεσμία'}
          value={v.dueDate || ''}
          onChange={x => set('dueDate', x)}
          optional
        />
        <label>
          <span>{en ? 'Priority' : 'Προτεραιότητα'}</span>
          <select value={v.priority || 'medium'} onChange={e => set('priority', e.target.value)}>
            <option value="low">{en ? 'Low' : 'Χαμηλή'}</option>
            <option value="medium">{en ? 'Medium' : 'Μεσαία'}</option>
            <option value="high">{en ? 'High' : 'Υψηλή'}</option>
            <option value="critical">{en ? 'Critical' : 'Κρίσιμη'}</option>
          </select>
        </label>
        {!initial && (
          <label>
            <span>{en ? 'Meeting' : 'Συνεδρίαση'}</span>
            <select value={v.meetingId || ''} onChange={e => set('meetingId', e.target.value)}>
              <option value="">—</option>
              {meetings.map(x => (
                <option key={x.id} value={x.id}>
                  {fmtDate(x.date)} · {x.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </ObserverDialog>
  )
}

export function PlanDialog({ initial, busy, onClose, onSave, en }) {
  const { tenant } = useTenant()
  const [v, setV] = useState(
    initial
      ? { ...initial, status: initial.status || 'open' }
      : {
          title: '',
          indicator: '',
          baseline: '',
          target: '',
          owner: '',
          dueDate: '',
          status: 'open',
        },
  )
  const [indicatorOptions, setIndicatorOptions] = useState([])
  const set = (k, x) => setV(s => ({ ...s, [k]: x }))
  useEffect(() => {
    let active = true
    if (!tenant?.id) {
      setIndicatorOptions([])
      return () => {
        active = false
      }
    }
    loadIndicatorDefinitions(tenant.id)
      .then(rows => {
        if (active) setIndicatorOptions((rows || []).filter(x => x.status === 'active'))
      })
      .catch(() => {
        if (active) setIndicatorOptions([])
      })
    return () => {
      active = false
    }
  }, [tenant?.id])
  const selectedIndicator =
    indicatorOptions.find(x =>
      [x.titleEl, x.titleEn, x.key].filter(Boolean).includes(v.indicator),
    ) || null
  const selectIndicator = id => {
    const item = indicatorOptions.find(x => x.id === id)
    set('indicator', item ? (en ? item.titleEn || item.titleEl : item.titleEl) : '')
  }
  return (
    <ObserverDialog
      width="wide"
      title={
        initial
          ? en
            ? 'Edit objective'
            : 'Επεξεργασία στόχου'
          : en
            ? 'New objective'
            : 'Νέος στόχος'
      }
      onClose={onClose}
      footer={
        <DialogActions
          onCancel={onClose}
          disabled={busy || !v.title.trim()}
          onSave={() => onSave(v)}
        />
      }
    >
      <div className="entry-grid compact">
        <label className="entry-span-2">
          <span>{en ? 'Objective' : 'Στόχος'}</span>
          <input value={v.title} onChange={e => set('title', e.target.value)} />
        </label>
        <label>
          <span>{en ? 'Linked indicator' : 'Συνδεδεμένος δείκτης'}</span>
          <select
            value={selectedIndicator?.id || ''}
            onChange={e => selectIndicator(e.target.value)}
          >
            <option value="">{en ? 'No indicator' : 'Χωρίς δείκτη'}</option>
            {indicatorOptions.map(item => (
              <option key={item.id} value={item.id}>
                {en ? item.titleEn || item.titleEl : item.titleEl}
              </option>
            ))}
          </select>
          {v.indicator && !selectedIndicator && (
            <small>
              {en
                ? 'The previous free-text value is not linked to an active indicator. Select an indicator or choose No indicator.'
                : 'Η παλιά ελεύθερη τιμή δεν είναι συνδεδεμένη με ενεργό δείκτη. Επιλέξτε δείκτη ή «Χωρίς δείκτη».'}
            </small>
          )}
        </label>
        <label>
          <span>{en ? 'Baseline value' : 'Τιμή βάσης (Baseline)'}</span>
          <input value={v.baseline || ''} onChange={e => set('baseline', e.target.value)} />
        </label>
        <label>
          <span>{en ? 'Target value' : 'Τιμή στόχου'}</span>
          <input value={v.target || ''} onChange={e => set('target', e.target.value)} />
        </label>
        <label>
          <span>{en ? 'Owner' : 'Υπεύθυνος'}</span>
          <input value={v.owner || ''} onChange={e => set('owner', e.target.value)} />
        </label>
        <label>
          <span>{en ? 'Status' : 'Κατάσταση'}</span>
          <select value={v.status || 'open'} onChange={e => set('status', e.target.value)}>
            <option value="open">{en ? 'Open' : 'Ανοιχτός'}</option>
            <option value="in_progress">{en ? 'In progress' : 'Σε εξέλιξη'}</option>
            <option value="completed">{en ? 'Completed' : 'Ολοκληρωμένος'}</option>
          </select>
        </label>
        <ManualDateField
          label={en ? 'Due date' : 'Προθεσμία'}
          value={v.dueDate || ''}
          onChange={x => set('dueDate', x)}
          optional
        />
      </div>
    </ObserverDialog>
  )
}

export function FrameworkDialog({ record, busy, onClose, onSave, en }) {
  const [v, setV] = useState({
    legalBasis: record.legalBasis || '',
    committeeRole: record.committeeRole || '',
    decisionNumber: record.decisionNumber || '',
  })
  const set = (k, x) => setV(s => ({ ...s, [k]: x }))
  return (
    <ObserverDialog
      width="wide"
      title={en ? 'Edit institutional framework' : 'Επεξεργασία θεσμικού πλαισίου'}
      onClose={onClose}
      footer={<DialogActions onCancel={onClose} disabled={busy} onSave={() => onSave(v)} />}
    >
      <div className="entry-grid compact">
        <label>
          <span>{en ? 'Decision number' : 'Αρ. πράξης σύστασης'}</span>
          <input value={v.decisionNumber} onChange={e => set('decisionNumber', e.target.value)} />
        </label>
        <label className="entry-span-2">
          <span>{en ? 'Committee role' : 'Ρόλος επιτροπής'}</span>
          <textarea
            rows="4"
            value={v.committeeRole}
            onChange={e => set('committeeRole', e.target.value)}
          />
        </label>
        <label className="entry-span-2">
          <span>{en ? 'Legal basis' : 'Νομική / θεσμική βάση'}</span>
          <textarea
            rows="4"
            value={v.legalBasis}
            onChange={e => set('legalBasis', e.target.value)}
          />
        </label>
      </div>
    </ObserverDialog>
  )
}
