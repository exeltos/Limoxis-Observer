import { InactiveEmployeeBadge } from '../../../design-system/InactiveEmployeeBadge'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { qualityStatusTone } from '../qualityVocabulary'
import { CheckSquare2, ClipboardList, GraduationCap, MessagesSquare, Paperclip, Plus, Trash2, Users } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { EntityRecordShell } from '../../../design-system/EntityRecordShell'
import { RecordTabPanel } from '../../../design-system/RecordTabPanel'
import { ExportMenu } from '../../../design-system/ExportMenu'
import { FormCard, FormGrid } from '../../../design-system/FormCard'
import { Field } from '../../../design-system/Field'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { SearchableSelect } from '../../../design-system/SearchableSelect'
import { LocationAutocompleteField } from '../../../design-system/LocationAutocompleteField'
import { Button } from '../../../design-system/Button'
import { SaveButton } from '../../../design-system/SaveButton'
import { IconButton } from '../../../design-system/IconButton'
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
import { loadQualityRecords } from '../qualityService'
import { useEmployeesData } from '../../employees/useEmployeesData'
import { DocumentsWorkspace } from '../../../design-system/DocumentsWorkspace'
import type { AttachmentFile } from '../../../design-system/AttachmentField'
import { ModeSwitch } from '../../../design-system/ModeSwitch'
import { isDemoDataEnvironment } from '../../../core/data/dataEnvironment'
import { deleteMeeting, saveMeeting } from './meetingService'
import { MEETING_KINDS, addDays, decisionStatusLabel, newMeetingFor, previousMonth, type Meeting, type MeetingDecision, type MeetingParticipant, type MeetingTopic } from './meetingModel'
import type { ReactNode } from 'react'
import type { AnyRecord } from '../../../types/featureTypes'
import '../quality.css'
import { TableSkeleton } from '../../../design-system/LoadingSkeleton'

const escapeHtml = (text: unknown) => String(text ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[char])

// The minutes as a Word document: who, the month's indicators as written, the discussion, the decisions.
function downloadMinutes(meeting: Meeting, organizationName: string) {
  const paragraphs = (text: unknown) => String(text || '').split(/\n+/).filter(Boolean).map(line => `<p>${escapeHtml(line)}</p>`).join('')
  const present = meeting.participants.filter(person => person.attended !== false).map(person => escapeHtml(person.name)).join(', ')
  const absent = meeting.participants.filter(person => person.attended === false).map(person => escapeHtml(person.name)).join(', ')
  const decisions = meeting.decisions.length ? `<h2>Αποφάσεις</h2><table border="1" cellpadding="4" cellspacing="0"><tr><th>Α/Α</th><th>Απόφαση</th><th>Υπεύθυνος</th><th>Προθεσμία</th><th>Κατάσταση</th></tr>${meeting.decisions.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.ownerLabel)}</td><td>${formatDay(item.dueDate, 'el')}</td><td>${decisionStatusLabel(item.status, 'el')}</td></tr>`).join('')}</table>` : ''
  const topics = (meeting.topics || []).map((item: MeetingTopic, index: number) => `<p><b>${index + 1}. ${escapeHtml(item.subject)}</b></p>${item.discussion ? `<p>${escapeHtml(item.discussion)}</p>` : ''}${item.conclusion ? `<p><i>Συμπέρασμα:</i> ${escapeHtml(item.conclusion)}</p>` : ''}`).join('')
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
const withTopics = (meeting: Meeting): OpenMeeting => ({ ...meeting, topics: meeting.topics?.length ? meeting.topics : String(meeting.agenda || '').split(/\n+/).map(line => line.trim()).filter(Boolean).map(subject => ({ id: newId('dmt'), subject, discussion: '', conclusion: '' })) })
const trainingStatusText = (status: string, en: boolean) => ({ completed: en ? 'Training done' : 'Η εκπαίδευση έγινε', cancelled: en ? 'Training cancelled' : 'Η εκπαίδευση ακυρώθηκε' })[status] || (en ? 'Training created' : 'Η εκπαίδευση δημιουργήθηκε')

// The profession as the people register keeps it («190 ΝΟΣΗΛΕΥΤΗΣ/ΤΡΙΑ 2ΕΤΟΥΣ»): without the code and the years.
// Topics and decisions get an id at once, so a decision can point to the topic it came out of.
// The record shell keeps a `utility` action visible in the header (tone primary: the main one, last).
// The open meeting always has its topics (withTopics).
type OpenMeeting = Meeting & { topics: MeetingTopic[] }
const HeaderAction = ({ children }: { children?: ReactNode; tone?: string; utility?: boolean }) => children
const newId = (prefix: string) => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`)
const cleanRole = (text: unknown) => String(text || '').replace(/^\s*\d+\s*/, '').replace(/\s+\d+\s*(ΕΤΟΥΣ|ΕΤΩΝ|ΕΤΙΑΣ)\s*$/i, '').trim()

// One department meeting: when, topics and conclusions, decisions (carried from the previous one), who attended, a training held,
// the decisions (with those carried from the previous meeting) and who took part.
export function MeetingRecordPage() {
  const { meetingId } = useParams()
  const isNew = meetingId === 'new'
  const location = useLocation()
  const navigate = useNavigate()
  const { language, t } = useLanguage()
  const en = language === 'en'
  const { notify, confirm } = useFeedback()
  const { tenant, role, membership } = useTenant()
  const canCreateTraining = can(role, CAPABILITIES.MANAGE_TRAINING, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  const { user, profile } = useAuth()
  const { goBack, goTo } = useContextualNavigation('/meetings?tab=departments')
  const list = useMeetings()
  const { departments, loading: departmentsLoading }: { departments: AnyRecord[], loading: boolean } = useDepartments()
  // Topics from the hospital's library (Management > Libraries > Committee and meeting topics).
  const { libraries }: { libraries: AnyRecord } = useLibraries()
  const topicOptions = useMemo(() => libraryOptions(libraries.committeeTopics || [], language).map(option => ({ ...option, description: [option.description, (libraries.committeeTopics || []).find((item: AnyRecord) => item.value === option.value)?.meta?.category].filter(Boolean).join(' · ') || undefined })), [libraries.committeeTopics, language])
  const topicLabels = useMemo(() => topicOptions.map(option => option.label), [topicOptions])
  const [meeting, setMeetingValue] = useState<OpenMeeting | null | false>(null)
  // Every change after the load works on the open meeting (null while loading, false when not found).
  const setMeeting = setMeetingValue as (next: OpenMeeting | false | ((current: OpenMeeting) => OpenMeeting)) => void
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
  }, [list.loading, list.meetings, list.all, meetingId, isNew, meeting, ownDepartments, departmentsLoading, location.state, en, setMeeting])

  // The attendance: the department's active employees, each present or absent.
  const { data: employees }: { data: AnyRecord[] | null | undefined } = useEmployeesData()
  const staff = useMemo(() => (meeting ? (employees || []).filter(employee => (employee.employmentStatus || 'active') === 'active' && ((meeting.departmentId && employee.departmentId === meeting.departmentId) || (employee.department && employee.department === meeting.department))) : []).map(employee => ({ employeeId: employee.dbId || employee.id, name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(), role: cleanRole(employee.position || employee.profession) })), [employees, meeting])
  const employeeById = useMemo(() => new Map((employees || []).map(employee => [employee.dbId || employee.id, employee])), [employees])
  const [documents, setDocuments] = useState<AttachmentFile[]>([])
  // The corrective actions opened from decisions of department meetings.
  const [capas, setCapas] = useState<AnyRecord[]>([])
  useEffect(() => { let active = true; loadQualityRecords('capas', tenant?.id).then(rows => { if (active) setCapas((rows || []).filter((row: AnyRecord) => String(row.sourceId || '').startsWith('DM:'))) }).catch(() => { if (active) setCapas([]) }); return () => { active = false } }, [tenant?.id])
  useEffect(() => {
    // A new meeting starts with every active employee of the department present; the head marks who was absent.
    if (!isNew || !meeting || meeting.staffFilled || !staff.length) return
    setMeeting(current => ({ ...current, staffFilled: true, participants: staff.map(person => ({ ...person, attended: true })) }))
  }, [isNew, meeting, staff, setMeeting])
  if (list.loading || meeting === null) return <Page fill><TableSkeleton/></Page>
  if (meeting === false) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Meeting not found' : 'Η συνάντηση δεν βρέθηκε'}</strong></div></Page>

  const canWrite = isNew ? ownDepartments.length > 0 : list.access.canWrite(meeting)
  const locked = !canWrite
  const set = (next: Partial<Meeting>) => setMeeting(current => ({ ...current, ...next }))
  const setDecision = (index: number, next: Partial<MeetingDecision>) => setMeeting(current => ({ ...current, decisions: current.decisions.map((item, position) => (position === index ? { ...item, ...next } : item)) }))
  const setTopic = (index: number, next: Partial<MeetingTopic>) => setMeeting(current => ({ ...current, topics: current.topics.map((item, position) => (position === index ? { ...item, ...next } : item)) }))
  const addTopic = (subject: string) => setMeeting(current => ({ ...current, topics: [...current.topics, { id: newId('dmt'), subject, discussion: '', conclusion: '' }] }))
  // A decision comes out of a topic («Decision» on the topic), when the topic has one.
  const addDecision = (topicId: string) => setMeeting(current => ({ ...current, decisions: [...current.decisions, { id: newId('dmd'), topicId, title: '', ownerLabel: '', dueDate: '', status: 'open', capaId: '', carriedFrom: '' }] }))
  // The training held at the meeting: a new programme, filled in from the meeting; it is linked back when saved.
  // The people present become the programme's participants; the meeting is saved first so nothing typed is lost.
  async function createTraining() {
    if (!meeting) return
    if (!locked && !(await save())) return
    const attendees = meeting.participants.filter(person => person.attended !== false && String(person.name).trim()).map(person => { const employee = employeeById.get(person.employeeId); return { employeeCode: employee?.id || '', name: person.name, department: employee?.department || meeting.department, departmentId: employee?.departmentId || meeting.departmentId || null, email: employee?.email || '' } })
    goTo('/training/new', { tab, state: { trainingDraft: { title: meeting.topics.map(topic => topic.subject).filter(Boolean)[0] || '', audience: meeting.department, deliveryKind: 'intra_department', startDate: meeting.meetingDate, dueDate: meeting.meetingDate, description: en ? `Held at the ${meeting.department} meeting ${meeting.code} (${formatDay(meeting.meetingDate, 'en')}).` : `Έγινε στη συνάντηση ${meeting.code} του τμήματος ${meeting.department} (${formatDay(meeting.meetingDate, 'el')}).` }, meetingTraining: { meetingId: meeting.id, attendees } } })
  }
  const setPerson = (index: number, next: Partial<MeetingParticipant>) => setMeeting(current => ({ ...current, participants: current.participants.map((item, position) => (position === index ? { ...item, ...next } : item)) }))
  const chooseDepartment = (id: string) => { const department = ownDepartments.find(item => (item.id || item.name) === id); if (department) setMeeting(current => withTopics({ ...newMeetingFor(department, list.all, current.meetingDate), meetingDate: current.meetingDate })) }

  async function remove() {
    if (!meeting) return
    const ok = await confirm({ title: en ? 'Delete meeting' : 'Διαγραφή συνάντησης', message: en ? 'The meeting is deleted with its topics, decisions and attendance. A linked training or corrective action stays.' : 'Διαγράφεται η συνάντηση με τα θέματα, τις αποφάσεις και τις παρουσίες της. Η εκπαίδευση ή η διορθωτική ενέργεια που συνδέθηκε μένει.', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })
    if (!ok) return
    try { await deleteMeeting(tenant?.id, meeting.id); list.reload(); notify(en ? 'Meeting deleted.' : 'Η συνάντηση διαγράφηκε.', 'success'); goBack() } catch (error) { console.error(error); notify(en ? 'The meeting could not be deleted.' : 'Δεν ήταν δυνατή η διαγραφή της συνάντησης.', 'error') }
  }
  async function save(nextStatus?: string) {
    if (!meeting) return false
    if (!meeting.departmentId) { notify(en ? 'Choose the department first.' : 'Επιλέξτε πρώτα το τμήμα.', 'error'); return }
    setSaving(true)
    try {
      const topics = meeting.topics.filter(item => String(item.subject).trim())
      const next = { ...meeting, topics, agenda: topics.map(item => item.subject.trim()).join('\n'), decisions: meeting.decisions.filter(item => String(item.title).trim()), participants: meeting.participants.filter(item => String(item.name).trim()), status: nextStatus || meeting.status, ...(nextStatus === 'final' ? { finalizedAt: new Date().toISOString(), finalizedByLabel: auditActorFromAuth({ profile, user }).name } : nextStatus === 'draft' ? { finalizedAt: null, finalizedByLabel: '' } : {}) }
      const saved = (await saveMeeting(tenant?.id, next)) as Meeting
      notify(en ? 'Meeting saved.' : 'Η συνάντηση αποθηκεύτηκε.', 'success')
      list.reload()
      if (isNew) navigate(`/meetings/${saved.id}`, { replace: true, state: location.state })
      else setMeeting(withTopics(structuredClone(saved)))
      return true
    } catch (error) { console.error(error); notify(en ? 'The meeting could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση της συνάντησης.', 'error'); return false } finally { setSaving(false) }
  }
  function openCapa(decision: MeetingDecision) {
    if (!meeting) return
    goTo('/quality/capas/new', { tab, state: { qualitySource: { source: 'other', sourceId: `DM:${meeting.code}#${decision.id}`, departmentId: meeting.departmentId, department: meeting.department, departmentEn: meeting.departmentEn, title: decision.title, description: en ? `Decision of the ${meeting.department} meeting ${meeting.code} (${formatDay(meeting.meetingDate, 'en')}).` : `Απόφαση της συνάντησης ${meeting.code} του τμήματος ${meeting.department} (${formatDay(meeting.meetingDate, 'el')}).` } } })
  }

  // «Present 6 of 7 · Absent: M. Xytsa»: the head sees at a glance who was missing.
  const presentCount = meeting.participants.filter(person => person.attended !== false).length
  const absentNames = meeting.participants.filter(person => person.attended === false).map(person => person.name).filter(Boolean)
  const attendanceSummary = meeting.participants.length ? `${en ? `Present ${presentCount} of ${meeting.participants.length}` : `Παρόντες ${presentCount} από ${meeting.participants.length}`}${absentNames.length ? ` · ${en ? 'Absent' : 'Απόντες'}: ${absentNames.slice(0, 4).join(', ')}${absentNames.length > 4 ? ` +${absentNames.length - 4}` : ''}` : ''}` : (en ? 'Who attended the meeting.' : 'Ποιοι παρευρέθηκαν στη συνάντηση.')
  const missingStaff = staff.filter(person => !meeting.participants.some(item => (item.employeeId && item.employeeId === person.employeeId) || String(item.name).trim().toLowerCase() === person.name.toLowerCase()))
  const tabs = [
    { id: 'details', label: en ? 'Details' : 'Στοιχεία', icon: ClipboardList },
    { id: 'topics', label: en ? `Topics ${meeting.topics.length}` : `Θέματα ${meeting.topics.length}`, icon: MessagesSquare },
    { id: 'people', label: `${en ? 'Attendance' : 'Παρουσίες'} ${meeting.participants.filter(person => person.attended !== false).length}/${meeting.participants.length}`, icon: Users },
    ...(isNew ? [] : [{ id: 'files', label: en ? 'Files' : 'Αρχεία', icon: Paperclip }]),
  ]
  const footer = <div className="inline-edit-footer">
    {!locked && <SaveButton loading={saving} disabled={saving} onClick={() => save()}>{en ? 'Save' : 'Αποθήκευση'}</SaveButton>}
  </div>

  // The corrective actions opened from this meeting's decisions (their source is «DM:<code>#<decision id>»).
  const capaOf = (item: MeetingDecision) => capas.find(capa => capa.sourceId === `DM:${meeting.code}#${item.id}`)
  // One decision: its text and, if there was one, the corrective action (opening it, or going to it).
  const decisionRow = (item: MeetingDecision, index: number) => {
    const capa = capaOf(item)
    const capaButton = capa
      ? <Button variant="secondary" onClick={() => goTo(`/quality/capas/${capa.id}`, { tab })}><CheckSquare2 size={15} />{en ? 'Corrective action' : 'Διορθωτική ενέργεια'} {capa.code || ''}<StatusBadge tone={qualityStatusTone(capa.status)}>{t(capa.status)}</StatusBadge></Button>
      : !isNew && item.title && list.access.canCreateCapa() && <Button variant="secondary" onClick={() => openCapa(item)}><CheckSquare2 size={15} />{en ? 'Corrective action' : 'Διορθωτική ενέργεια'}</Button>
    return <div key={item.id || index} className="meeting-decision">
      <label className="field"><span className="field-label lo-field-label">{en ? 'Decision' : 'Απόφαση'}</span><input value={item.title} disabled={locked} onChange={event => setDecision(index, { title: event.target.value })} /></label>
      <span className="meeting-decision-tools">{capaButton}{!locked && <IconButton label={en ? 'Remove the decision' : 'Αφαίρεση απόφασης'} onClick={() => set({ decisions: meeting.decisions.filter((_, position) => position !== index) })}><Trash2 size={15} /></IconButton>}</span>
    </div>
  }
  const looseDecisions = meeting.decisions.map((item, index) => ({ item, index })).filter(({ item }) => !meeting.topics.some(topic => topic.id && topic.id === item.topicId))
  return <Page fill><EntityRecordShell className="quality-record-shell review-record-shell workspace-fill" avatar={<Users size={19} />} eyebrow={meeting.code || (en ? 'New' : 'Νέα')} title={`${meeting.title}${meeting.department ? ` · ${en ? meeting.departmentEn : meeting.department}` : ''}`} subtitle={formatDay(meeting.meetingDate, language)} headerActions={<>{!locked && <HeaderAction utility tone="primary"><Button onClick={() => { setTab('topics'); addTopic('') }}><Plus size={15} />{en ? 'Topic' : 'Θέμα'}</Button></HeaderAction>}{!isNew && <ExportMenu onWord={() => downloadMinutes(meeting, tenant?.name || '')} />}{!isNew && !locked && <IconButton tone="danger" label={en ? 'Delete meeting' : 'Διαγραφή συνάντησης'} onClick={remove}><Trash2 size={16} /></IconButton>}</>} tabs={tabs} activeTab={tab} onTabChange={setTab} onBack={goBack}>
    {tab === 'details' && <RecordTabPanel className="review-minutes" title={en ? 'Details' : 'Στοιχεία'} footer={footer}>
      <div className="lo-form-cards">
        <FormCard wide title={en ? 'Meeting' : 'Συνάντηση'}>
          <FormGrid columns={3}>
            {isNew ? <SearchableSelect label={en ? 'Department *' : 'Τμήμα *'} value={meeting.departmentId} options={ownDepartments.map(item => ({ value: item.id || item.name, label: en ? item.nameEn || item.name : item.name }))} onChange={chooseDepartment} placeholder={en ? 'Choose the department' : 'Επιλέξτε τμήμα'} emptyLabel={en ? 'No match' : 'Δεν βρέθηκε'} clearLabel="" />
              : <Field label={en ? 'Department' : 'Τμήμα'}><input value={(en ? meeting.departmentEn : meeting.department) || ''} disabled /></Field>}
            <ManualDateField label={en ? 'Date' : 'Ημερομηνία'} value={meeting.meetingDate} disabled={locked} onChange={value => set({ meetingDate: value, periodMonth: value ? previousMonth(value) : meeting.periodMonth, nextMeetingDate: value ? addDays(value, 30) : meeting.nextMeetingDate })} />
            {locked ? <Field label={en ? 'Kind' : 'Είδος'}><input value={MEETING_KINDS.find(item => item.value === meeting.kind)?.label[en ? 1 : 0] || ''} disabled /></Field>
              : <ChoiceField label={en ? 'Kind' : 'Είδος'} value={meeting.kind} options={MEETING_KINDS.map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))} onChange={value => set({ kind: value })} />}
          </FormGrid>
        </FormCard>
        <FormCard wide icon={GraduationCap} title={en ? 'Training' : 'Εκπαίδευση'}>
          <ChoiceField label={en ? 'Was a training held during the meeting?' : 'Έγινε εκπαίδευση στη συνάντηση;'} value={meeting.trainingHeld ? 'yes' : 'no'} disabled={locked || Boolean(meeting.trainingProgramId)} options={[{ value: 'no', label: en ? 'No' : 'Όχι' }, { value: 'yes', label: en ? 'Yes' : 'Ναι' }]} onChange={value => set({ trainingHeld: value === 'yes' })} />
          {meeting.trainingHeld && <div className="meeting-training">
            {meeting.trainingProgramId
              ? <><div><strong>{meeting.trainingTitle || (en ? 'Training' : 'Εκπαίδευση')}</strong><small>{trainingStatusText(meeting.trainingStatus, en)}</small></div>{meeting.trainingProgramKey && <Button variant="secondary" onClick={() => goTo(`/training/${meeting.trainingProgramKey}`, { tab })}><GraduationCap size={15} />{en ? 'Open the training' : 'Άνοιγμα εκπαίδευσης'}</Button>}</>
              : <><span className="meeting-training-hint">{isNew ? (en ? 'Save the meeting first, then create the training.' : 'Αποθηκεύστε πρώτα τη συνάντηση και μετά δημιουργήστε την εκπαίδευση.') : (en ? 'No training is linked to this meeting yet.' : 'Δεν έχει συνδεθεί ακόμη εκπαίδευση με τη συνάντηση.')}</span>{!isNew && canCreateTraining && <Button variant="secondary" onClick={createTraining}><GraduationCap size={15} />{en ? 'Create the training' : 'Δημιουργία εκπαίδευσης'}</Button>}</>}
          </div>}
        </FormCard>
      </div>
    </RecordTabPanel>}
    {tab === 'topics' && <RecordTabPanel className="review-minutes" title={en ? 'Topics' : 'Θέματα'} subtitle={en ? 'The topic of the meeting; if a decision was taken, add it (and a corrective action when there was one).' : 'Το θέμα της συνάντησης· αν πάρθηκε απόφαση, προσθέστε την (και διορθωτική ενέργεια όταν υπήρξε).'} footer={footer}>
      <div className="meeting-topics">
        {meeting.topics.map((topic, index) => { const own = meeting.decisions.map((item, at) => ({ item, at })).filter(({ item }) => topic.id && item.topicId === topic.id); return <div key={topic.id || index} className="meeting-topic-card">
          <div className="meeting-topic-head">
            <LocationAutocompleteField className="meeting-topic-subject" label={`${en ? 'Topic' : 'Θέμα'} ${index + 1}`} value={topic.subject} disabled={locked} options={topicLabels} onChange={subject => setTopic(index, { subject })} />
            {!locked && <span className="meeting-topic-tools">{!own.length && String(topic.subject).trim() && <Button variant="secondary" onClick={() => addDecision(topic.id)}><Plus size={15} />{en ? 'Decision' : 'Απόφαση'}</Button>}<IconButton tone="danger" label={en ? 'Delete topic' : 'Διαγραφή θέματος'} onClick={() => set({ topics: meeting.topics.filter((_, position) => position !== index) })}><Trash2 size={15} /></IconButton></span>}
          </div>
          {own.map(({ item, at }) => decisionRow(item, at))}
        </div> })}
        {!meeting.topics.length && <div className="inline-empty">{en ? 'No topics yet.' : 'Δεν υπάρχουν θέματα ακόμη.'}</div>}
        {looseDecisions.length > 0 && <div className="meeting-topic-card meeting-loose-decisions">
          <div className="meeting-topic-head"><strong>{en ? 'Other decisions' : 'Άλλες αποφάσεις'}</strong></div>
          {looseDecisions.map(({ item, index }) => decisionRow(item, index))}
        </div>}
      </div>
    </RecordTabPanel>}
    {tab === 'people' && <RecordTabPanel title={en ? 'Attendance' : 'Παρουσίες'} subtitle={attendanceSummary}
      actions={!locked && meeting.participants.length > 0 && <div className="row-actions">{missingStaff.length > 0 && <Button variant="secondary" onClick={() => set({ participants: [...meeting.participants, ...missingStaff.map(person => ({ ...person, attended: false }))] })}><Users size={15} />{en ? `Add the department’s employees (${missingStaff.length})` : `Προσθήκη εργαζομένων τμήματος (${missingStaff.length})`}</Button>}<Button variant="secondary" onClick={() => set({ participants: [...meeting.participants, { name: '', role: '', attended: true }] })}><Plus size={15} />{en ? 'Other person' : 'Άλλος συμμετέχων'}</Button></div>} footer={footer}>
      {meeting.participants.length === 0
        ? <div className="meeting-attendance-empty">
          <strong>{en ? 'No attendance has been recorded' : 'Δεν έχουν καταχωριστεί παρουσίες'}</strong>
          {!locked && staff.length > 0 && <><p>{en ? 'The department’s active employees come in as present; mark who was absent.' : 'Οι ενεργοί εργαζόμενοι του τμήματος μπαίνουν ως παρόντες· σημειώστε ποιοι ήταν απόντες.'}</p><Button onClick={() => set({ participants: staff.map(person => ({ ...person, attended: true })) })}><Users size={15} />{en ? `Record attendance (${staff.length})` : `Καταχώριση παρουσιών (${staff.length})`}</Button></>}
          {!locked && !staff.length && <p>{en ? 'The department has no active employees in the people register.' : 'Το τμήμα δεν έχει ενεργούς εργαζόμενους στο μητρώο προσωπικού.'}</p>}
        </div>
        : <RegistryTable sortable={false} className="quality-table meeting-attendance-table" rows={meeting.participants} rowKey={(person, index) => person.id || person.employeeId || index}
          columns={[{ key: 'name', label: en ? 'Name' : 'Ονοματεπώνυμο' }, { key: 'role', label: en ? 'Role' : 'Ιδιότητα' }, { key: 'attended', label: en ? 'Attendance' : 'Παρουσία' }]}
          renderRow={(person, index) => { const former = person.employeeId && employeeById.get(person.employeeId) && employeeById.get(person.employeeId)?.employmentStatus && employeeById.get(person.employeeId)?.employmentStatus === 'inactive'; return <>
            <td>{person.employeeId || locked ? <strong>{person.name}</strong> : <input aria-label={en ? 'Name' : 'Ονοματεπώνυμο'} value={person.name} placeholder={en ? 'Name' : 'Ονοματεπώνυμο'} onChange={event => setPerson(index, { name: event.target.value })} />}<InactiveEmployeeBadge inactive={Boolean(former)} /></td>
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
