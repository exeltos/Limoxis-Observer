import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, CheckSquare2, ClipboardList, GraduationCap, ListChecks, MessagesSquare, Paperclip, Plus, RotateCcw, Trash2, Users } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { EntityRecordShell } from '../../../design-system/EntityRecordShell'
import { RecordTabPanel } from '../../../design-system/RecordTabPanel'
import { ExportMenu } from '../../../design-system/ExportMenu'
import { FormCard, FormGrid } from '../../../design-system/FormCard'
import { Field } from '../../../design-system/Field'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { SearchableSelect } from '../../../design-system/SearchableSelect'
import { Button } from '../../../design-system/Button'
import { SaveButton } from '../../../design-system/SaveButton'
import { IconButton } from '../../../design-system/IconButton'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { can, CAPABILITIES } from '../../../core/permissions/roles'
import { useAuth } from '../../../core/auth/AuthContext'
import { auditActorFromAuth } from '../../../core/audit/actor'
import { formatDay } from '../../../core/i18n/formatDay'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { libraryOptions, useDepartments, useLibraries } from '../../management/useLibraries'
import { useMeetings } from './MeetingsPanel'
import { useEmployeesData } from '../../employees/useEmployeesData'
import { DocumentsWorkspace } from '../../../design-system/DocumentsWorkspace'
import { ModeSwitch } from '../../../design-system/ModeSwitch'
import { isDemoDataEnvironment } from '../../../core/data/dataEnvironment'
import { saveMeeting } from './meetingService'
import { DECISION_STATUSES, MEETING_KINDS, addDays, decisionStatusLabel, meetingStatusLabel, newMeetingFor, previousMonth } from './meetingModel'
import '../quality.css'

const escapeHtml = text => String(text ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char])

// The minutes as a Word document: who, the month's indicators as written, the discussion, the decisions.
function downloadMinutes(meeting, organizationName) {
  const paragraphs = text => String(text || '').split(/\n+/).filter(Boolean).map(line => `<p>${escapeHtml(line)}</p>`).join('')
  const present = meeting.participants.filter(person => person.attended !== false).map(person => escapeHtml(person.name)).join(', ')
  const absent = meeting.participants.filter(person => person.attended === false).map(person => escapeHtml(person.name)).join(', ')
  const decisions = meeting.decisions.length ? `<h2>Αποφάσεις</h2><table border="1" cellpadding="4" cellspacing="0"><tr><th>Α/Α</th><th>Απόφαση</th><th>Υπεύθυνος</th><th>Προθεσμία</th><th>Κατάσταση</th></tr>${meeting.decisions.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.ownerLabel)}</td><td>${formatDay(item.dueDate, 'el')}</td><td>${decisionStatusLabel(item.status, 'el')}</td></tr>`).join('')}</table>` : ''
  const topics = (meeting.topics || []).map((item, index) => `<p><b>${index + 1}. ${escapeHtml(item.subject)}</b></p>${item.discussion ? `<p>${escapeHtml(item.discussion)}</p>` : ''}${item.conclusion ? `<p><i>Συμπέρασμα:</i> ${escapeHtml(item.conclusion)}</p>` : ''}`).join('')
  const training = meeting.trainingHeld ? `<h2>Εκπαίδευση</h2><p>Έγινε εκπαίδευση στη συνάντηση${meeting.trainingTitle ? `: ${escapeHtml(meeting.trainingTitle)}` : ''}.</p>` : ''
  const html = `<html><head><meta charset="utf-8"><title>${escapeHtml(meeting.title)}</title><style>body{font-family:Calibri,Arial;font-size:11pt}h1{font-size:16pt}h2{font-size:12pt;margin-top:14pt}table{border-collapse:collapse;width:100%}</style></head><body>
<h1>${escapeHtml(meeting.title)} · ${escapeHtml(meeting.department)}</h1><p><b>Πρακτικό συνάντησης τμήματος</b> ${escapeHtml(meeting.code)} · ${escapeHtml(organizationName || '')}</p>
<p>Ημερομηνία ${formatDay(meeting.meetingDate, 'el')} &nbsp;|&nbsp; Επόμενη συνάντηση ${formatDay(meeting.nextMeetingDate, 'el')}</p>
<p><b>Παρόντες</b> ${present || '—'}${absent ? `<br><b>Απόντες</b> ${absent}` : ''}</p>
<h2>Θέματα</h2>${topics || paragraphs(meeting.agenda)}${String(meeting.minutes || '').trim() ? `<h2>Λοιπές σημειώσεις</h2>${paragraphs(meeting.minutes)}` : ''}${decisions}${training}</body></html>`
  const url = URL.createObjectURL(new Blob(['\ufeff', html], { type: 'application/msword' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${meeting.code || 'Synantisi'}_${meeting.meetingDate}.doc`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Earlier meetings kept their topics as lines of the agenda: they open as topics.
const withTopics = meeting => ({ ...meeting, topics: meeting.topics?.length ? meeting.topics : String(meeting.agenda || '').split(/\n+/).map(line => line.trim()).filter(Boolean).map(subject => ({ subject, discussion: '', conclusion: '' })) })
const trainingStatusText = (status, en) => ({ completed: en ? 'Training done' : 'Η εκπαίδευση έγινε', cancelled: en ? 'Training cancelled' : 'Η εκπαίδευση ακυρώθηκε' })[status] || (en ? 'Training created' : 'Η εκπαίδευση δημιουργήθηκε')

// The profession as the people register keeps it («190 ΝΟΣΗΛΕΥΤΗΣ/ΤΡΙΑ 2ΕΤΟΥΣ»): without the code and the years.
const cleanRole = text => String(text || '').replace(/^\s*\d+\s*/, '').replace(/\s+\d+\s*(ΕΤΟΥΣ|ΕΤΩΝ|ΕΤΙΑΣ)\s*$/i, '').trim()

// One department meeting: when, topics and conclusions, decisions (carried from the previous one), who attended, a training held,
// the decisions (with those carried from the previous meeting) and who took part.
export function MeetingRecordPage() {
  const { meetingId } = useParams()
  const isNew = meetingId === 'new'
  const location = useLocation()
  const navigate = useNavigate()
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { tenant, role, membership } = useTenant()
  const canCreateTraining = can(role, CAPABILITIES.MANAGE_TRAINING, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  const { user, profile } = useAuth()
  const { goBack } = useContextualNavigation('/meetings?tab=departments')
  const list = useMeetings()
  const { departments, loading: departmentsLoading } = useDepartments()
  // Topics from the hospital's library (Management > Libraries > Committee and meeting topics).
  const { libraries } = useLibraries()
  const topicOptions = useMemo(() => libraryOptions(libraries.committeeTopics || [], language).map(option => ({ ...option, description: [option.description, (libraries.committeeTopics || []).find(item => item.value === option.value)?.meta?.category].filter(Boolean).join(' · ') || undefined })), [libraries.committeeTopics, language])
  const [meeting, setMeeting] = useState(null)
  const [tab, setTab] = useState('details')
  const [saving, setSaving] = useState(false)
  // Departments the user may hold a meeting for: all of them for Quality, their own otherwise.
  const ownDepartments = useMemo(() => departments.filter(department => list.seesAll || list.canManage || list.access.canSee({ departmentId: department.id || department.name, department: department.name })), [departments, list.seesAll, list.canManage, list.access])

  useEffect(() => {
    if (list.loading || meeting) return
    if (!isNew) { const found = list.meetings.find(row => row.id === meetingId || row.code === meetingId); setMeeting(found ? withTopics(structuredClone(found)) : false); return }
    // From a meeting group: its department, its frequency, regular or extraordinary.
    const group = location.state?.group || null
    if (group) {
      const department = ownDepartments.find(item => (item.id || item.name) === group.departmentId) || { id: group.departmentId, name: group.department, nameEn: group.departmentEn }
      const kind = location.state?.kind === 'extraordinary' ? 'extraordinary' : 'regular'
      setMeeting(withTopics({ ...newMeetingFor(department, list.all, undefined, group), kind, title: kind === 'extraordinary' ? (en ? 'Extraordinary meeting' : 'Έκτακτη συνάντηση') : (en ? 'Regular meeting' : 'Τακτική συνάντηση') }))
      return
    }
    const wanted = location.state?.department
    const department = ownDepartments.find(item => item.name === wanted || item.id === wanted) || (ownDepartments.length === 1 ? ownDepartments[0] : null)
    if (department || ownDepartments.length || !departmentsLoading) setMeeting(withTopics(department ? newMeetingFor(department, list.all) : { ...newMeetingFor(null, list.all), departmentId: '' }))
  }, [list.loading, list.meetings, list.all, meetingId, isNew, meeting, ownDepartments, departmentsLoading, location.state, en])

  // The attendance: the department's active employees, each present or absent.
  const { data: employees } = useEmployeesData()
  const staff = useMemo(() => (meeting ? (employees || []).filter(employee => (employee.employmentStatus || 'active') === 'active' && ((meeting.departmentId && employee.departmentId === meeting.departmentId) || (employee.department && employee.department === meeting.department))) : []).map(employee => ({ employeeId: employee.dbId || employee.id, name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(), role: cleanRole(employee.position || employee.profession) })), [employees, meeting])
  const employeeById = useMemo(() => new Map((employees || []).map(employee => [employee.dbId || employee.id, employee])), [employees])
  const [documents, setDocuments] = useState([])
  useEffect(() => {
    // A new meeting starts with every active employee of the department present; the head marks who was absent.
    if (!isNew || !meeting || meeting.staffFilled || !staff.length) return
    setMeeting(current => ({ ...current, staffFilled: true, participants: staff.map(person => ({ ...person, attended: true })) }))
  }, [isNew, meeting, staff])
  if (list.loading || meeting === null) return <Page fill><div className="inline-empty">{en ? 'Loading…' : 'Φόρτωση…'}</div></Page>
  if (meeting === false) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Meeting not found' : 'Η συνάντηση δεν βρέθηκε'}</strong></div></Page>

  const canWrite = isNew ? ownDepartments.length > 0 : list.access.canWrite(meeting)
  const locked = !canWrite
  const set = next => setMeeting(current => ({ ...current, ...next }))
  const setDecision = (index, next) => setMeeting(current => ({ ...current, decisions: current.decisions.map((item, position) => (position === index ? { ...item, ...next } : item)) }))
  const setTopic = (index, next) => setMeeting(current => ({ ...current, topics: current.topics.map((item, position) => (position === index ? { ...item, ...next } : item)) }))
  const addTopic = subject => setMeeting(current => ({ ...current, topics: [...current.topics, { subject, discussion: '', conclusion: '' }] }))
  // The training held at the meeting: a new programme, filled in from the meeting; it is linked back when saved.
  // The people present become the programme's participants; the meeting is saved first so nothing typed is lost.
  async function createTraining() {
    if (!locked && !(await save())) return
    const attendees = meeting.participants.filter(person => person.attended !== false && String(person.name).trim()).map(person => { const employee = employeeById.get(person.employeeId); return { employeeCode: employee?.id || '', name: person.name, department: employee?.department || meeting.department, departmentId: employee?.departmentId || meeting.departmentId || null, email: employee?.email || '' } })
    navigate('/training/new', { state: { trainingDraft: { title: meeting.topics.map(topic => topic.subject).filter(Boolean)[0] || '', audience: meeting.department, deliveryKind: 'intra_department', startDate: meeting.meetingDate, dueDate: meeting.meetingDate, description: en ? `Held at the ${meeting.department} meeting ${meeting.code} (${formatDay(meeting.meetingDate, 'en')}).` : `Έγινε στη συνάντηση ${meeting.code} του τμήματος ${meeting.department} (${formatDay(meeting.meetingDate, 'el')}).` }, meetingTraining: { meetingId: meeting.id, attendees } } })
  }
  const setPerson = (index, next) => setMeeting(current => ({ ...current, participants: current.participants.map((item, position) => (position === index ? { ...item, ...next } : item)) }))
  const chooseDepartment = id => { const department = ownDepartments.find(item => (item.id || item.name) === id); if (department) setMeeting(current => ({ ...newMeetingFor(department, list.all, current.meetingDate), meetingDate: current.meetingDate })) }

  async function save(nextStatus) {
    if (!meeting.departmentId) { notify(en ? 'Choose the department first.' : 'Επιλέξτε πρώτα το τμήμα.', 'error'); return }
    setSaving(true)
    try {
      const topics = meeting.topics.filter(item => String(item.subject).trim())
      const next = { ...meeting, topics, agenda: topics.map(item => item.subject.trim()).join('\n'), decisions: meeting.decisions.filter(item => String(item.title).trim()), participants: meeting.participants.filter(item => String(item.name).trim()), status: nextStatus || meeting.status, ...(nextStatus === 'final' ? { finalizedAt: new Date().toISOString(), finalizedByLabel: auditActorFromAuth({ profile, user }).name } : nextStatus === 'draft' ? { finalizedAt: null, finalizedByLabel: '' } : {}) }
      const saved = await saveMeeting(tenant?.id, next)
      notify(nextStatus === 'final' ? (en ? 'The minutes are final.' : 'Το πρακτικό οριστικοποιήθηκε.') : (en ? 'Meeting saved.' : 'Η συνάντηση αποθηκεύτηκε.'), 'success')
      list.reload()
      if (isNew) navigate(`/meetings/${saved.id}`, { replace: true, state: location.state })
      else setMeeting(withTopics(structuredClone(saved)))
      return true
    } catch (error) { console.error(error); notify(en ? 'The meeting could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση της συνάντησης.', 'error'); return false } finally { setSaving(false) }
  }
  function openCapa(decision) {
    navigate('/quality/capas/new', { state: { qualitySource: { source: 'other', sourceId: `DM:${meeting.code || 'new'}`, departmentId: meeting.departmentId, department: meeting.department, departmentEn: meeting.departmentEn, title: decision.title, dueDate: decision.dueDate, description: en ? `Decision of the ${meeting.department} meeting ${meeting.code} (${formatDay(meeting.meetingDate, 'en')}).` : `Απόφαση της συνάντησης ${meeting.code} του τμήματος ${meeting.department} (${formatDay(meeting.meetingDate, 'el')}).` } } })
  }
  const carried = meeting.decisions.filter(item => item.carriedFrom)
  // «Present 6 of 7 · Absent: M. Xytsa»: the head sees at a glance who was missing.
  const presentCount = meeting.participants.filter(person => person.attended !== false).length
  const absentNames = meeting.participants.filter(person => person.attended === false).map(person => person.name).filter(Boolean)
  const attendanceSummary = meeting.participants.length ? `${en ? `Present ${presentCount} of ${meeting.participants.length}` : `Παρόντες ${presentCount} από ${meeting.participants.length}`}${absentNames.length ? ` · ${en ? 'Absent' : 'Απόντες'}: ${absentNames.slice(0, 4).join(', ')}${absentNames.length > 4 ? ` +${absentNames.length - 4}` : ''}` : ''}` : (en ? 'Who attended the meeting.' : 'Ποιοι παρευρέθηκαν στη συνάντηση.')
  const missingStaff = staff.filter(person => !meeting.participants.some(item => (item.employeeId && item.employeeId === person.employeeId) || String(item.name).trim().toLowerCase() === person.name.toLowerCase()))
  const hasMinutes = Boolean(String(meeting.minutes).trim()) || meeting.topics.some(item => String(item.subject).trim())
  const tabs = [
    { id: 'details', label: en ? 'Details' : 'Στοιχεία', icon: ClipboardList },
    { id: 'topics', label: en ? `Topics ${meeting.topics.length}` : `Θέματα ${meeting.topics.length}`, icon: MessagesSquare },
    { id: 'decisions', label: en ? `Decisions ${meeting.decisions.length}` : `Αποφάσεις ${meeting.decisions.length}`, icon: ListChecks },
    { id: 'people', label: `${en ? 'Attendance' : 'Παρουσίες'} ${meeting.participants.filter(person => person.attended !== false).length}/${meeting.participants.length}`, icon: Users },
    ...(isNew ? [] : [{ id: 'files', label: en ? 'Files' : 'Αρχεία', icon: Paperclip }]),
  ]
  const footer = <div className="inline-edit-footer">
    
    {!locked && <SaveButton loading={saving} disabled={saving} onClick={() => save()}>{en ? 'Save' : 'Αποθήκευση'}</SaveButton>}
    {!locked && !isNew && <Button disabled={saving || !hasMinutes} title={!hasMinutes ? (en ? 'Write the topics first' : 'Γράψτε πρώτα τα θέματα') : undefined} onClick={() => save('final')}><CheckCircle2 size={15} />{en ? 'Finalize' : 'Οριστικοποίηση'}</Button>}
    {list.access.canReopen(meeting) && <Button variant="secondary" disabled={saving} onClick={() => save('draft')}><RotateCcw size={15} />{en ? 'Back to draft' : 'Επαναφορά σε πρόχειρο'}</Button>}
  </div>

  return <Page fill><EntityRecordShell className="quality-record-shell review-record-shell workspace-fill" avatar={<Users size={19} />} eyebrow={meeting.code || (en ? 'New' : 'Νέα')} title={`${meeting.title}${meeting.department ? ` · ${en ? meeting.departmentEn : meeting.department}` : ''}`} subtitle={formatDay(meeting.meetingDate, language)} status={<StatusBadge tone={meeting.status === 'final' ? 'success' : 'info'}>{meetingStatusLabel(meeting.status, language)}</StatusBadge>} headerActions={!isNew && <ExportMenu onWord={() => downloadMinutes(meeting, tenant?.name)} />} tabs={tabs} activeTab={tab} onTabChange={setTab} onBack={goBack}>
    {tab === 'details' && <RecordTabPanel className="review-minutes" title={en ? 'Details' : 'Στοιχεία'} subtitle={meeting.status === 'final' ? (en ? `Final · ${meeting.finalizedByLabel} · ${formatDay(meeting.finalizedAt, 'en')}` : `Οριστικό · ${meeting.finalizedByLabel} · ${formatDay(meeting.finalizedAt, 'el')}`) : undefined} footer={footer}>
      <div className="lo-form-cards">
        <FormCard wide title={en ? 'Meeting' : 'Συνάντηση'}>
          <FormGrid columns={3}>
            {isNew ? <SearchableSelect label={en ? 'Department *' : 'Τμήμα *'} value={meeting.departmentId} options={ownDepartments.map(item => ({ value: item.id || item.name, label: en ? item.nameEn || item.name : item.name }))} onChange={chooseDepartment} placeholder={en ? 'Choose the department' : 'Επιλέξτε τμήμα'} emptyLabel={en ? 'No match' : 'Δεν βρέθηκε'} clearLabel="" />
              : <Field label={en ? 'Department' : 'Τμήμα'}><input value={(en ? meeting.departmentEn : meeting.department) || ''} disabled /></Field>}
            <ManualDateField label={en ? 'Date' : 'Ημερομηνία'} value={meeting.meetingDate} disabled={locked} onChange={value => set({ meetingDate: value, periodMonth: value ? previousMonth(value) : meeting.periodMonth, nextMeetingDate: value ? addDays(value, 30) : meeting.nextMeetingDate })} />
            <ManualDateField label={en ? 'Next meeting' : 'Επόμενη συνάντηση'} value={meeting.nextMeetingDate} disabled={locked} onChange={value => set({ nextMeetingDate: value })} />
          </FormGrid>
          <FormGrid columns={2}>
            <Field label={en ? 'Title' : 'Τίτλος'}><input value={meeting.title} disabled={locked} onChange={event => set({ title: event.target.value })} /></Field>
            {locked ? <Field label={en ? 'Kind' : 'Είδος'}><input value={MEETING_KINDS.find(item => item.value === meeting.kind)?.label[en ? 1 : 0] || ''} disabled /></Field>
              : <ChoiceField label={en ? 'Kind' : 'Είδος'} value={meeting.kind} options={MEETING_KINDS.map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))} onChange={value => set({ kind: value })} />}
          </FormGrid>
        </FormCard>
        <FormCard wide icon={GraduationCap} title={en ? 'Training' : 'Εκπαίδευση'}>
          <ChoiceField label={en ? 'Was a training held during the meeting?' : 'Έγινε εκπαίδευση στη συνάντηση;'} value={meeting.trainingHeld ? 'yes' : 'no'} disabled={locked || Boolean(meeting.trainingProgramId)} options={[{ value: 'no', label: en ? 'No' : 'Όχι' }, { value: 'yes', label: en ? 'Yes' : 'Ναι' }]} onChange={value => set({ trainingHeld: value === 'yes' })} />
          {meeting.trainingHeld && <div className="meeting-training">
            {meeting.trainingProgramId
              ? <><div><strong>{meeting.trainingTitle || (en ? 'Training' : 'Εκπαίδευση')}</strong><small>{trainingStatusText(meeting.trainingStatus, en)}</small></div>{meeting.trainingProgramKey && <Button variant="secondary" onClick={() => navigate(`/training/${meeting.trainingProgramKey}`)}><GraduationCap size={15} />{en ? 'Open the training' : 'Άνοιγμα εκπαίδευσης'}</Button>}</>
              : <><span className="meeting-training-hint">{isNew ? (en ? 'Save the meeting first, then create the training.' : 'Αποθηκεύστε πρώτα τη συνάντηση και μετά δημιουργήστε την εκπαίδευση.') : (en ? 'No training is linked to this meeting yet.' : 'Δεν έχει συνδεθεί ακόμη εκπαίδευση με τη συνάντηση.')}</span>{!isNew && canCreateTraining && <Button variant="secondary" onClick={createTraining}><GraduationCap size={15} />{en ? 'Create the training' : 'Δημιουργία εκπαίδευσης'}</Button>}</>}
          </div>}
        </FormCard>
        {carried.length > 0 && <FormCard wide icon={ListChecks} title={en ? 'Open from the previous meeting' : 'Εκκρεμότητες προηγούμενης συνάντησης'} hint={en ? 'Mark them in «Decisions».' : 'Ενημερώστε τες στις «Αποφάσεις».'}>
          <ul className="meeting-carried">{carried.map((item, index) => <li key={index}><StatusBadge tone={item.status === 'done' ? 'success' : 'info'}>{decisionStatusLabel(item.status, language)}</StatusBadge><span>{item.title}</span><small>{[item.ownerLabel, item.dueDate && formatDay(item.dueDate, language), item.carriedFrom].filter(Boolean).join(' · ')}</small></li>)}</ul>
        </FormCard>}
      </div>
    </RecordTabPanel>}
    {tab === 'topics' && <RecordTabPanel className="review-minutes" title={en ? 'Topics' : 'Θέματα'} subtitle={en ? 'Each topic with what was discussed and what was concluded.' : 'Κάθε θέμα με ό,τι συζητήθηκε και το συμπέρασμα.'} actions={!locked && <Button variant="secondary" onClick={() => addTopic('')}><Plus size={15} />{en ? 'Topic' : 'Θέμα'}</Button>} footer={footer}>
      <div className="meeting-topics">
        {meeting.topics.map((topic, index) => <div key={topic.id || index} className="meeting-topic-card">
          <div className="meeting-topic-head"><strong>{en ? 'Topic' : 'Θέμα'} {index + 1}</strong>{!locked && <IconButton tone="danger" label={en ? 'Delete topic' : 'Διαγραφή θέματος'} onClick={() => set({ topics: meeting.topics.filter((_, position) => position !== index) })}><Trash2 size={15} /></IconButton>}</div>
          <Field label={en ? 'Topic' : 'Θέμα'}><input value={topic.subject} disabled={locked} onChange={event => setTopic(index, { subject: event.target.value })} /></Field>
          <FormGrid columns={2}>
            <Field label={en ? 'What was discussed' : 'Τι συζητήθηκε'}><textarea rows={2} value={topic.discussion} disabled={locked} onChange={event => setTopic(index, { discussion: event.target.value })} /></Field>
            <Field label={en ? 'Conclusion' : 'Συμπέρασμα'}><textarea rows={2} value={topic.conclusion} disabled={locked} onChange={event => setTopic(index, { conclusion: event.target.value })} /></Field>
          </FormGrid>
        </div>)}
        {!meeting.topics.length && <div className="inline-empty">{en ? 'No topics yet.' : 'Δεν υπάρχουν θέματα ακόμη.'}</div>}
          {!locked && topicOptions.length > 0 && <SearchableSelect label={en ? 'Add a topic from the library' : 'Προσθήκη θέματος από τη βιβλιοθήκη'} value="" options={topicOptions} onChange={value => { const item = (libraries.committeeTopics || []).find(entry => entry.value === value); if (item) addTopic(en ? item.en : item.el) }} placeholder={en ? 'Choose a topic' : 'Επιλέξτε θέμα'} />}
        <Field label={en ? 'Other notes' : 'Λοιπές σημειώσεις'}><textarea rows={3} value={meeting.minutes} disabled={locked} onChange={event => set({ minutes: event.target.value })} /></Field>
      </div>
    </RecordTabPanel>}
    {tab === 'decisions' && <RecordTabPanel title={en ? 'Decisions' : 'Αποφάσεις'} subtitle={en ? 'Open decisions of the previous meeting are carried here.' : 'Οι ανοιχτές αποφάσεις της προηγούμενης συνάντησης μεταφέρονται εδώ.'} actions={!locked && <Button variant="secondary" onClick={() => set({ decisions: [...meeting.decisions, { title: '', ownerLabel: '', dueDate: '', status: 'open', capaId: '', carriedFrom: '' }] })}><Plus size={15} />{en ? 'Decision' : 'Απόφαση'}</Button>} footer={footer}>
      {locked ? <RegistryTable className="review-decisions-table" rows={meeting.decisions} rowKey={(item, index) => item.id || index}
        columns={[{ key: 'n', label: '#' }, { key: 'title', label: en ? 'Decision' : 'Απόφαση' }, { key: 'owner', label: en ? 'Owner' : 'Υπεύθυνος' }, { key: 'due', label: en ? 'Due' : 'Προθεσμία' }, { key: 'status', label: en ? 'Status' : 'Κατάσταση' }, { key: 'capa', label: '', ariaLabel: en ? 'Corrective action' : 'Διορθωτική ενέργεια' }]}
        renderRow={(item, index) => <>
          <td>{index + 1}</td>
          <td className="review-decision-title">{item.title}{item.carriedFrom && <small>{en ? `From ${item.carriedFrom}` : `Από ${item.carriedFrom}`}</small>}</td>
          <td>{item.ownerLabel || '—'}</td>
          <td className="nowrap-cell">{formatDay(item.dueDate, language) || '—'}</td>
          <td><StatusBadge tone={item.status === 'done' ? 'success' : item.status === 'cancelled' ? 'neutral' : 'info'}>{decisionStatusLabel(item.status, language)}</StatusBadge></td>
          <td>{item.status === 'open' && list.access.canCreateCapa() && <Button variant="secondary" onClick={() => openCapa(item)}><CheckSquare2 size={15} />{en ? 'Corrective action' : 'Διορθωτική ενέργεια'}</Button>}</td>
        </>} emptyTitle={en ? 'No decisions' : 'Δεν υπάρχουν αποφάσεις'} />
        : <div className="review-actions">{meeting.decisions.map((item, index) => <div key={item.id || index} className="review-action-row">
          <Field label={`${index + 1}. ${en ? 'Decision' : 'Απόφαση'}${item.carriedFrom ? ` · ${en ? 'from' : 'από'} ${item.carriedFrom}` : ''}`}><textarea rows={1} value={item.title} onChange={event => setDecision(index, { title: event.target.value })} /></Field>
          <Field label={en ? 'Owner' : 'Υπεύθυνος'}><input value={item.ownerLabel} onChange={event => setDecision(index, { ownerLabel: event.target.value })} /></Field>
          <ManualDateField label={en ? 'Due' : 'Προθεσμία'} value={item.dueDate} onChange={value => setDecision(index, { dueDate: value })} />
          <ChoiceField label={en ? 'Status' : 'Κατάσταση'} value={item.status} options={DECISION_STATUSES.map(status => ({ value: status.value, label: status.label[en ? 1 : 0] }))} onChange={value => setDecision(index, { status: value })} />
          <span className="review-action-tools">{item.title && item.status === 'open' && list.access.canCreateCapa() && <Button variant="secondary" onClick={() => openCapa(item)}>{en ? 'Corrective action' : 'Διορθωτική ενέργεια'}</Button>}<IconButton label={en ? 'Remove' : 'Αφαίρεση'} onClick={() => set({ decisions: meeting.decisions.filter((_, position) => position !== index) })}><Trash2 size={15} /></IconButton></span>
        </div>)}{!meeting.decisions.length && <div className="inline-empty">{en ? 'No decisions yet.' : 'Δεν υπάρχουν αποφάσεις ακόμη.'}</div>}</div>}
    </RecordTabPanel>}
    {tab === 'people' && <RecordTabPanel title={en ? 'Attendance' : 'Παρουσίες'} subtitle={attendanceSummary}
      actions={!locked && meeting.participants.length > 0 && <div className="row-actions">{missingStaff.length > 0 && <Button variant="secondary" onClick={() => set({ participants: [...meeting.participants, ...missingStaff.map(person => ({ ...person, attended: false }))] })}><Users size={15} />{en ? `Add the department’s employees (${missingStaff.length})` : `Προσθήκη εργαζομένων τμήματος (${missingStaff.length})`}</Button>}<Button variant="secondary" onClick={() => set({ participants: [...meeting.participants, { name: '', role: '', attended: true }] })}><Plus size={15} />{en ? 'Other person' : 'Άλλος συμμετέχων'}</Button></div>} footer={footer}>
      {meeting.participants.length === 0
        ? <div className="meeting-attendance-empty">
          <strong>{en ? 'No attendance has been recorded' : 'Δεν έχουν καταχωριστεί παρουσίες'}</strong>
          {!locked && staff.length > 0 && <><p>{en ? 'The department’s active employees come in as present; mark who was absent.' : 'Οι ενεργοί εργαζόμενοι του τμήματος μπαίνουν ως παρόντες· σημειώστε ποιοι ήταν απόντες.'}</p><Button onClick={() => set({ participants: staff.map(person => ({ ...person, attended: true })) })}><Users size={15} />{en ? `Record attendance (${staff.length})` : `Καταχώριση παρουσιών (${staff.length})`}</Button></>}
          {!locked && !staff.length && <p>{en ? 'The department has no active employees in the people register.' : 'Το τμήμα δεν έχει ενεργούς εργαζόμενους στο μητρώο προσωπικού.'}</p>}
          {locked && list.access.canReopen(meeting) && <><p>{en ? 'The minutes are final. Take them back to draft to record who attended.' : 'Το πρακτικό είναι οριστικό. Επαναφέρετέ το σε πρόχειρο για να καταχωρίσετε ποιοι παρευρέθηκαν.'}</p><Button variant="secondary" disabled={saving} onClick={() => save('draft')}><RotateCcw size={15} />{en ? 'Back to draft' : 'Επαναφορά σε πρόχειρο'}</Button></>}
        </div>
        : <RegistryTable sortable={false} className="quality-table meeting-attendance-table" rows={meeting.participants} rowKey={(person, index) => person.id || person.employeeId || index}
          columns={[{ key: 'name', label: en ? 'Name' : 'Ονοματεπώνυμο' }, { key: 'role', label: en ? 'Role' : 'Ιδιότητα' }, { key: 'attended', label: en ? 'Attendance' : 'Παρουσία' }]}
          renderRow={(person, index) => { const former = person.employeeId && employeeById.get(person.employeeId) && employeeById.get(person.employeeId).employmentStatus && employeeById.get(person.employeeId).employmentStatus !== 'active'; return <>
            <td>{person.employeeId || locked ? <strong>{person.name}</strong> : <input aria-label={en ? 'Name' : 'Ονοματεπώνυμο'} value={person.name} placeholder={en ? 'Name' : 'Ονοματεπώνυμο'} onChange={event => setPerson(index, { name: event.target.value })} />}{former && <small>{en ? 'Former employee' : 'Πρώην εργαζόμενος'}</small>}</td>
            <td>{person.employeeId || locked ? (person.role || cleanRole(employeeById.get(person.employeeId)?.position || employeeById.get(person.employeeId)?.profession) || '—') : <input aria-label={en ? 'Role' : 'Ιδιότητα'} value={person.role} onChange={event => setPerson(index, { role: event.target.value })} />}</td>
            <td className="meeting-attendance-cell">
              <ModeSwitch ariaLabel={`${en ? 'Attendance' : 'Παρουσία'}: ${person.name}`} disabled={locked} value={person.attended === false ? 'no' : 'yes'} options={[{ value: 'yes', label: en ? 'Present' : 'Παρών' }, { value: 'no', label: en ? 'Absent' : 'Απών' }]} onChange={value => setPerson(index, { attended: value === 'yes' })} />
              {!locked && !person.employeeId && <IconButton size="sm" label={en ? 'Remove' : 'Αφαίρεση'} onClick={() => set({ participants: meeting.participants.filter((_, position) => position !== index) })}><Trash2 size={14} /></IconButton>}
            </td>
          </> }} />}
    </RecordTabPanel>}
    {tab === 'files' && !isNew && <RecordTabPanel title={en ? 'Files' : 'Αρχεία'}>
      <div className="meeting-files"><DocumentsWorkspace disabled={locked && !list.canManage} organizationId={isDemoDataEnvironment() ? null : tenant?.id} entityType="quality_department_meeting" entityId={meeting.id} subtitle={en ? 'Files of the meeting: the signed minutes, presentations, attendance sheets.' : 'Τα αρχεία της συνάντησης: υπογεγραμμένο πρακτικό, παρουσιάσεις, κατάσταση παρόντων.'} value={documents} onChange={setDocuments} /></div>
    </RecordTabPanel>}
  </EntityRecordShell></Page>
}
