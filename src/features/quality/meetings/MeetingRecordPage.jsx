import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, CheckSquare2, ClipboardList, Gauge, ListChecks, Plus, RotateCcw, Sparkles, Trash2, Users } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { EntityRecordShell } from '../../../design-system/EntityRecordShell'
import { RecordTabPanel } from '../../../design-system/RecordTabPanel'
import { PrintExportActions } from '../../../design-system/PrintExportActions'
import { FormCard, FormGrid } from '../../../design-system/FormCard'
import { Field } from '../../../design-system/Field'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { MonthField } from '../../../design-system/MonthField'
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
import { useAuth } from '../../../core/auth/AuthContext'
import { auditActorFromAuth } from '../../../core/audit/actor'
import { formatDay } from '../../../core/i18n/formatDay'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { useDepartments } from '../../management/useLibraries'
import { loadEntries, loadRegisters } from '../../registers/registerService'
import { indicatorReport, periodOf, textOf } from '../../registers/registerEngine'
import { formatIndicatorValue, indicatorStatusLabel, indicatorStatusTone } from '../../registers/registerText'
import { useMeetings } from './MeetingsPanel'
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
  const html = `<html><head><meta charset="utf-8"><title>${escapeHtml(meeting.title)}</title><style>body{font-family:Calibri,Arial;font-size:11pt}h1{font-size:16pt}h2{font-size:12pt;margin-top:14pt}table{border-collapse:collapse;width:100%}</style></head><body>
<h1>${escapeHtml(meeting.title)} · ${escapeHtml(meeting.department)}</h1><p><b>Πρακτικό συνάντησης τμήματος</b> ${escapeHtml(meeting.code)} · ${escapeHtml(organizationName || '')}</p>
<p>Ημερομηνία ${formatDay(meeting.meetingDate, 'el')} &nbsp;|&nbsp; Δείκτες ${escapeHtml(monthLabel(meeting.periodMonth, 'el'))} &nbsp;|&nbsp; Επόμενη συνάντηση ${formatDay(meeting.nextMeetingDate, 'el')}</p>
<p><b>Παρόντες</b> ${present || '—'}${absent ? `<br><b>Απόντες</b> ${absent}` : ''}</p>
<h2>Θέματα</h2>${paragraphs(meeting.agenda)}<h2>Συζήτηση</h2>${paragraphs(meeting.minutes)}${decisions}</body></html>`
  const url = URL.createObjectURL(new Blob(['\ufeff', html], { type: 'application/msword' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${meeting.code || 'Synantisi'}_${meeting.meetingDate}.doc`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const monthLabel = (day, language) => (day ? new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'el-GR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${String(day).slice(0, 7)}-01T00:00:00Z`)) : '')

// The department's register indicators for the month the meeting reviews,
// read from its registers; one click writes them into the minutes.
function useDepartmentIndicators(organizationId, meeting) {
  const [rows, setRows] = useState(null)
  const key = meeting?.departmentId, dept = meeting?.department, month = meeting?.periodMonth
  useEffect(() => {
    let active = true
    if (!key || !month) { setRows([]); return () => { active = false } }
    setRows(null)
    ;(async () => {
      const registers = (await loadRegisters(organizationId).catch(() => [])).filter(register => register.status === 'active' && (register.departmentId === key || register.department === dept))
      const period = periodOf('month', `${String(month).slice(0, 7)}-01`)
      const result = []
      for (const register of registers) {
        const entries = await loadEntries(organizationId, register.id, { register }).catch(() => [])
        for (const row of indicatorReport(register, entries, period)) result.push({ register, ...row })
      }
      if (active) setRows(result)
    })()
    return () => { active = false }
  }, [organizationId, key, dept, month])
  return rows
}

// One department meeting: when, which month's indicators, agenda and minutes,
// the decisions (with those carried from the previous meeting) and who took part.
export function MeetingRecordPage() {
  const { meetingId } = useParams()
  const isNew = meetingId === 'new'
  const location = useLocation()
  const navigate = useNavigate()
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { tenant } = useTenant()
  const { user, profile } = useAuth()
  const { goBack } = useContextualNavigation('/quality')
  const list = useMeetings()
  const { departments, loading: departmentsLoading } = useDepartments()
  const [meeting, setMeeting] = useState(null)
  const [tab, setTab] = useState('minutes')
  const [saving, setSaving] = useState(false)
  // Departments the user may hold a meeting for: all of them for Quality, their own otherwise.
  const ownDepartments = useMemo(() => departments.filter(department => list.seesAll || list.canManage || list.access.canSee({ departmentId: department.id || department.name, department: department.name })), [departments, list.seesAll, list.canManage, list.access])

  useEffect(() => {
    if (list.loading || meeting) return
    if (!isNew) { const found = list.meetings.find(row => row.id === meetingId || row.code === meetingId); setMeeting(found ? structuredClone(found) : false); return }
    const wanted = location.state?.department
    const department = ownDepartments.find(item => item.name === wanted || item.id === wanted) || (ownDepartments.length === 1 ? ownDepartments[0] : null)
    if (department || ownDepartments.length || !departmentsLoading) setMeeting(department ? newMeetingFor(department, list.all) : { ...newMeetingFor(null, list.all), departmentId: '' })
  }, [list.loading, list.meetings, list.all, meetingId, isNew, meeting, ownDepartments, departmentsLoading, location.state])

  const indicators = useDepartmentIndicators(tenant?.id, meeting || null)
  if (list.loading || meeting === null) return <Page fill><div className="inline-empty">{en ? 'Loading…' : 'Φόρτωση…'}</div></Page>
  if (meeting === false) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Meeting not found' : 'Η συνάντηση δεν βρέθηκε'}</strong></div></Page>

  const canWrite = isNew ? ownDepartments.length > 0 : list.access.canWrite(meeting)
  const locked = !canWrite
  const set = next => setMeeting(current => ({ ...current, ...next }))
  const setDecision = (index, next) => setMeeting(current => ({ ...current, decisions: current.decisions.map((item, position) => (position === index ? { ...item, ...next } : item)) }))
  const setPerson = (index, next) => setMeeting(current => ({ ...current, participants: current.participants.map((item, position) => (position === index ? { ...item, ...next } : item)) }))
  const chooseDepartment = id => { const department = ownDepartments.find(item => (item.id || item.name) === id); if (department) setMeeting(current => ({ ...newMeetingFor(department, list.all, current.meetingDate), meetingDate: current.meetingDate })) }

  async function save(nextStatus) {
    if (!meeting.departmentId) { notify(en ? 'Choose the department first.' : 'Επιλέξτε πρώτα το τμήμα.', 'error'); return }
    setSaving(true)
    try {
      const next = { ...meeting, decisions: meeting.decisions.filter(item => String(item.title).trim()), participants: meeting.participants.filter(item => String(item.name).trim()), status: nextStatus || meeting.status, ...(nextStatus === 'final' ? { finalizedAt: new Date().toISOString(), finalizedByLabel: auditActorFromAuth({ profile, user }).name } : nextStatus === 'draft' ? { finalizedAt: null, finalizedByLabel: '' } : {}) }
      const saved = await saveMeeting(tenant?.id, next)
      notify(nextStatus === 'final' ? (en ? 'The minutes are final.' : 'Το πρακτικό οριστικοποιήθηκε.') : (en ? 'Meeting saved.' : 'Η συνάντηση αποθηκεύτηκε.'), 'success')
      list.reload()
      if (isNew) navigate(`/meetings/${saved.id}`, { replace: true, state: location.state })
      else setMeeting(structuredClone(saved))
    } catch (error) { console.error(error); notify(en ? 'The meeting could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση της συνάντησης.', 'error') } finally { setSaving(false) }
  }
  function openCapa(decision) {
    navigate('/quality/capas/new', { state: { qualitySource: { source: 'other', sourceId: `DM:${meeting.code || 'new'}`, departmentId: meeting.departmentId, department: meeting.department, departmentEn: meeting.departmentEn, title: decision.title, dueDate: decision.dueDate, description: en ? `Decision of the ${meeting.department} meeting ${meeting.code} (${formatDay(meeting.meetingDate, 'en')}).` : `Απόφαση της συνάντησης ${meeting.code} του τμήματος ${meeting.department} (${formatDay(meeting.meetingDate, 'el')}).` } } })
  }
  const indicatorLines = (indicators || []).filter(row => row.current.value != null).map(row => `${textOf(row.indicator, language)}: ${formatIndicatorValue(row.current.value, row.indicator, language)}${row.indicator.target != null ? ` (${en ? 'target' : 'στόχος'} ${formatIndicatorValue(row.indicator.target, row.indicator, language)})` : ''}${row.current.status ? ` · ${indicatorStatusLabel(row.current.status, language)}` : ''}`)
  const carried = meeting.decisions.filter(item => item.carriedFrom)
  const tabs = [
    { id: 'minutes', label: en ? 'Minutes' : 'Πρακτικό', icon: ClipboardList },
    { id: 'decisions', label: en ? `Decisions ${meeting.decisions.length}` : `Αποφάσεις ${meeting.decisions.length}`, icon: ListChecks },
    { id: 'people', label: en ? `Participants ${meeting.participants.length}` : `Συμμετέχοντες ${meeting.participants.length}`, icon: Users },
  ]
  const footer = <div className="inline-edit-footer">
    <Button variant="secondary" onClick={goBack}>{en ? 'Close' : 'Κλείσιμο'}</Button>
    {!locked && <SaveButton loading={saving} disabled={saving} onClick={() => save()}>{en ? 'Save' : 'Αποθήκευση'}</SaveButton>}
    {!locked && !isNew && <Button disabled={saving || !String(meeting.minutes).trim()} title={!String(meeting.minutes).trim() ? (en ? 'Write the minutes first' : 'Γράψτε πρώτα το πρακτικό') : undefined} onClick={() => save('final')}><CheckCircle2 size={15} />{en ? 'Finalize' : 'Οριστικοποίηση'}</Button>}
    {list.access.canReopen(meeting) && <Button variant="secondary" disabled={saving} onClick={() => save('draft')}><RotateCcw size={15} />{en ? 'Back to draft' : 'Επαναφορά σε πρόχειρο'}</Button>}
  </div>

  return <Page fill><EntityRecordShell className="quality-record-shell review-record-shell workspace-fill" avatar={<Users size={19} />} eyebrow={meeting.code || (en ? 'New' : 'Νέα')} title={`${meeting.title}${meeting.department ? ` · ${en ? meeting.departmentEn : meeting.department}` : ''}`} subtitle={[formatDay(meeting.meetingDate, language), meeting.periodMonth && `${en ? 'indicators of' : 'δείκτες'} ${monthLabel(meeting.periodMonth, language)}`].filter(Boolean).join(' · ')} status={<StatusBadge tone={meeting.status === 'final' ? 'success' : 'info'}>{meetingStatusLabel(meeting.status, language)}</StatusBadge>} headerActions={!isNew && <PrintExportActions showPrint={false} onExport={() => downloadMinutes(meeting, tenant?.name)} />} tabs={tabs} activeTab={tab} onTabChange={setTab} onBack={goBack}>
    {tab === 'minutes' && <RecordTabPanel className="review-minutes" title={en ? 'Minutes' : 'Πρακτικό'} subtitle={meeting.status === 'final' ? (en ? `Final · ${meeting.finalizedByLabel} · ${formatDay(meeting.finalizedAt, 'en')}` : `Οριστικό · ${meeting.finalizedByLabel} · ${formatDay(meeting.finalizedAt, 'el')}`) : (en ? 'The month’s indicators come from the department’s registers.' : 'Οι δείκτες του μήνα έρχονται από τα μητρώα του τμήματος.')} footer={footer}>
      <div className="lo-form-cards">
        <FormCard wide title={en ? 'Meeting' : 'Συνάντηση'}>
          <FormGrid columns={4}>
            {isNew ? <SearchableSelect label={en ? 'Department *' : 'Τμήμα *'} value={meeting.departmentId} options={ownDepartments.map(item => ({ value: item.id || item.name, label: en ? item.nameEn || item.name : item.name }))} onChange={chooseDepartment} placeholder={en ? 'Choose the department' : 'Επιλέξτε τμήμα'} emptyLabel={en ? 'No match' : 'Δεν βρέθηκε'} clearLabel="" />
              : <Field label={en ? 'Department' : 'Τμήμα'}><input value={(en ? meeting.departmentEn : meeting.department) || ''} disabled /></Field>}
            <ManualDateField label={en ? 'Date' : 'Ημερομηνία'} value={meeting.meetingDate} disabled={locked} onChange={value => set({ meetingDate: value, periodMonth: value ? previousMonth(value) : meeting.periodMonth, nextMeetingDate: value ? addDays(value, 30) : meeting.nextMeetingDate })} />
            <MonthField label={en ? 'Indicators of' : 'Δείκτες του μήνα'} value={String(meeting.periodMonth || '').slice(0, 7)} disabled={locked} onChange={value => set({ periodMonth: value ? `${value}-01` : '' })} />
            <ManualDateField label={en ? 'Next meeting' : 'Επόμενη συνάντηση'} value={meeting.nextMeetingDate} disabled={locked} onChange={value => set({ nextMeetingDate: value })} />
          </FormGrid>
          <FormGrid columns={2}>
            <Field label={en ? 'Title' : 'Τίτλος'}><input value={meeting.title} disabled={locked} onChange={event => set({ title: event.target.value })} /></Field>
            {locked ? <Field label={en ? 'Kind' : 'Είδος'}><input value={MEETING_KINDS.find(item => item.value === meeting.kind)?.label[en ? 1 : 0] || ''} disabled /></Field>
              : <ChoiceField label={en ? 'Kind' : 'Είδος'} value={meeting.kind} options={MEETING_KINDS.map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))} onChange={value => set({ kind: value })} />}
          </FormGrid>
          <Field label={en ? 'Agenda' : 'Θέματα'}><textarea rows={3} value={meeting.agenda} disabled={locked} onChange={event => set({ agenda: event.target.value })} /></Field>
        </FormCard>
        <FormCard wide icon={Gauge} title={en ? `Indicators · ${monthLabel(meeting.periodMonth, 'en')}` : `Δείκτες · ${monthLabel(meeting.periodMonth, 'el')}`} hint={indicators && !indicators.length ? (en ? 'The department has no register with indicators.' : 'Το τμήμα δεν έχει μητρώο με δείκτες.') : undefined}>
          {indicators === null ? <div className="inline-empty">{en ? 'Loading…' : 'Φόρτωση…'}</div> : indicators.length > 0 && <>
            <RegistryTable className="quality-table meeting-indicators" rows={indicators} rowKey={row => `${row.register.id}:${row.indicator.id}`}
              columns={[{ key: 'indicator', label: en ? 'Indicator' : 'Δείκτης' }, { key: 'value', label: en ? 'Value' : 'Τιμή' }, { key: 'previous', label: en ? 'Previous month' : 'Προηγ. μήνας' }, { key: 'target', label: en ? 'Target' : 'Στόχος' }, { key: 'status', label: en ? 'Status' : 'Κατάσταση' }]}
              renderRow={row => <>
                <td>{textOf(row.indicator, language)}<small>{en ? row.register.nameEn : row.register.name}</small></td>
                <td><strong>{formatIndicatorValue(row.current.value, row.indicator, language) || '—'}</strong></td>
                <td>{formatIndicatorValue(row.previous?.value, row.indicator, language) || '—'}</td>
                <td>{row.indicator.target != null ? formatIndicatorValue(row.indicator.target, row.indicator, language) : '—'}</td>
                <td>{row.current.status ? <StatusBadge tone={indicatorStatusTone(row.current.status)}>{indicatorStatusLabel(row.current.status, language)}</StatusBadge> : '—'}</td>
              </>} />
            {!locked && indicatorLines.length > 0 && <Button variant="secondary" onClick={() => set({ minutes: [meeting.minutes, `${en ? 'Indicators of' : 'Δείκτες'} ${monthLabel(meeting.periodMonth, language)}:`, ...indicatorLines].filter(Boolean).join('\n') })}><Sparkles size={15} />{en ? 'Write them into the minutes' : 'Οι δείκτες στο πρακτικό'}</Button>}
          </>}
        </FormCard>
        {carried.length > 0 && <FormCard wide icon={ListChecks} title={en ? 'Open from the previous meeting' : 'Εκκρεμότητες προηγούμενης συνάντησης'} hint={en ? 'Mark them in «Decisions».' : 'Ενημερώστε τες στις «Αποφάσεις».'}>
          <ul className="meeting-carried">{carried.map((item, index) => <li key={index}><StatusBadge tone={item.status === 'done' ? 'success' : 'info'}>{decisionStatusLabel(item.status, language)}</StatusBadge><span>{item.title}</span><small>{[item.ownerLabel, item.dueDate && formatDay(item.dueDate, language), item.carriedFrom].filter(Boolean).join(' · ')}</small></li>)}</ul>
        </FormCard>}
        <FormCard wide title={en ? 'Discussion' : 'Συζήτηση'}>
          {locked ? <div className="review-text">{String(meeting.minutes || '').split(/\n+/).filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}{!String(meeting.minutes || '').trim() && <p className="review-text-empty">—</p>}</div>
            : <Field label={en ? 'What was discussed' : 'Τι συζητήθηκε'}><textarea rows={8} value={meeting.minutes} onChange={event => set({ minutes: event.target.value })} /></Field>}
        </FormCard>
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
    {tab === 'people' && <RecordTabPanel title={en ? 'Participants' : 'Συμμετέχοντες'} actions={!locked && <Button variant="secondary" onClick={() => set({ participants: [...meeting.participants, { name: '', role: '', attended: true }] })}><Plus size={15} />{en ? 'Participant' : 'Συμμετέχων'}</Button>} footer={footer}>
      <div className="review-actions">{meeting.participants.map((person, index) => <div key={person.id || index} className="review-action-row meeting-person-row">
        <Field label={en ? 'Name' : 'Ονοματεπώνυμο'}><input value={person.name} disabled={locked} onChange={event => setPerson(index, { name: event.target.value })} /></Field>
        <Field label={en ? 'Role' : 'Ιδιότητα'}><input value={person.role} disabled={locked} onChange={event => setPerson(index, { role: event.target.value })} /></Field>
        {locked ? <Field label={en ? 'Attended' : 'Παρουσία'}><input value={person.attended === false ? (en ? 'Absent' : 'Απών') : (en ? 'Present' : 'Παρών')} disabled /></Field> : <ChoiceField label={en ? 'Attended' : 'Παρουσία'} value={person.attended === false ? 'no' : 'yes'} options={[{ value: 'yes', label: en ? 'Present' : 'Παρών' }, { value: 'no', label: en ? 'Absent' : 'Απών' }]} onChange={value => setPerson(index, { attended: value === 'yes' })} />}
        {!locked && <span className="review-action-tools"><IconButton label={en ? 'Remove' : 'Αφαίρεση'} onClick={() => set({ participants: meeting.participants.filter((_, position) => position !== index) })}><Trash2 size={15} /></IconButton></span>}
      </div>)}{!meeting.participants.length && <div className="inline-empty">{en ? 'No participants yet.' : 'Δεν υπάρχουν συμμετέχοντες ακόμη.'}</div>}</div>
    </RecordTabPanel>}
  </EntityRecordShell></Page>
}
