import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarClock, ClipboardList, MessagesSquare, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { EntityRecordShell } from '../../../design-system/EntityRecordShell'
import { RecordTabPanel } from '../../../design-system/RecordTabPanel'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { DetailFields } from '../../../design-system/DetailList'
import { OverflowMenu } from '../../../design-system/OverflowMenu'
import { IconButton } from '../../../design-system/IconButton'
import { ObserverDialog, DialogActions } from '../../../design-system/ObserverDialog'
import { FormGrid } from '../../../design-system/FormCard'
import { Field } from '../../../design-system/Field'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { SearchableSelect } from '../../../design-system/SearchableSelect'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { formatDay } from '../../../core/i18n/formatDay'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { useDepartments, type LibraryDepartment } from '../../management/useLibraries'
import { useMeetingGroups } from './MeetingsPanel'
import { deleteMeetingGroup, saveMeetingGroup } from './meetingService'
import { MEETING_FREQUENCIES, frequencyLabel, groupStatus, meetingCapas, newMeetingGroup, type Meeting, type MeetingCapa, type MeetingGroup, type MeetingParticipant, type MeetingTopic } from './meetingModel'
import type { ReactNode } from 'react'
import { loadQualityRecords } from '../qualityService'
import '../quality.css'
import { TableSkeleton } from '../../../design-system/LoadingSkeleton'
import { hospitalToday } from '../../../core/dates/hospitalDate'

const HeaderAction = ({ children }: { children?: ReactNode; tone?: string; utility?: boolean }) => children
const yesNo = (value: unknown, en: boolean) => (value ? (en ? 'Yes' : 'Ναι') : '—')
const kindLabel = (kind: string, en: boolean) => (kind === 'extraordinary' ? (en ? 'Extraordinary' : 'Έκτακτη') : (en ? 'Regular' : 'Τακτική'))
const presentOf = (meeting: Meeting) => (meeting.participants || []).filter((person: MeetingParticipant) => person.attended !== false).length

// Quality defines a department's meeting group: which department, how often it meets, who leads it.
export function MeetingGroupDialog({ initial, departments, saving, onClose, onSave, language }: { initial: Partial<MeetingGroup>, departments: LibraryDepartment[], saving: boolean, onClose: () => void, onSave: (group: MeetingGroup) => void, language: string }) {
  const en = language === 'en'
  const [v, setV] = useState(() => ({ ...newMeetingGroup(), ...initial }))
  const set = (next: Partial<MeetingGroup>) => setV(current => ({ ...current, ...next }))
  const chooseDepartment = (id: string) => { const department = departments.find(item => (item.id || item.name) === id); set({ departmentId: id || '', department: department?.name || '', name: v.name || (department ? `${en ? 'Meetings' : 'Συναντήσεις'} ${department.name}` : '') }) }
  const frequencies = MEETING_FREQUENCIES.includes(Number(v.frequencyDays)) ? MEETING_FREQUENCIES : [...MEETING_FREQUENCIES, Number(v.frequencyDays)].sort((a, b) => a - b)
  return <ObserverDialog title={v.id ? (en ? 'Meeting group' : 'Ομάδα συναντήσεων') : (en ? 'New meeting department' : 'Νέο τμήμα συναντήσεων')} subtitle={en ? 'How often the department meets, as the administration set it.' : 'Πόσο συχνά συναντάται το τμήμα, όπως το όρισε η διοίκηση.'} onClose={onClose}
    footer={<DialogActions onSave={() => onSave(v)} saveLabel={en ? 'Save' : 'Αποθήκευση'} disabled={saving || !String(v.name).trim() || !v.departmentId} />}>
    <FormGrid columns={2}>
      <SearchableSelect label={en ? 'Department *' : 'Τμήμα *'} value={v.departmentId} options={departments.map(item => ({ value: item.id || item.name, label: en ? item.nameEn || item.name : item.name }))} onChange={chooseDepartment} placeholder={en ? 'Choose the department' : 'Επιλέξτε τμήμα'} emptyLabel={en ? 'No match' : 'Δεν βρέθηκε'} clearLabel={en ? 'Clear' : 'Καθαρισμός'} />
      <Field label={en ? 'Name *' : 'Όνομα *'}><input value={v.name} onChange={event => set({ name: event.target.value })} /></Field>
      <ChoiceField label={en ? 'Meets' : 'Συχνότητα'} value={Number(v.frequencyDays)} options={frequencies.map(days => ({ value: days, label: frequencyLabel(days, language) }))} onChange={value => set({ frequencyDays: Number(value) })} />
      <Field label={en ? 'Duration (hours)' : 'Διάρκεια (ώρες)'}><input type="number" min="0.5" step="0.5" value={v.durationHours} onChange={event => set({ durationHours: event.target.value })} /></Field>
      <Field label={en ? 'Led by' : 'Υπεύθυνος'}><input value={v.managerLabel} placeholder={en ? 'e.g. the head nurse' : 'π.χ. ο/η Προϊστάμενος/η'} onChange={event => set({ managerLabel: event.target.value })} /></Field>
      <ChoiceField label={en ? 'Status' : 'Κατάσταση'} value={v.active === false ? 'no' : 'yes'} options={[{ value: 'yes', label: en ? 'Active' : 'Ενεργή' }, { value: 'no', label: en ? 'Inactive' : 'Ανενεργή' }]} onChange={value => set({ active: value === 'yes' })} />
    </FormGrid>
  </ObserverDialog>
}

// The groups: one row per department, with how often it meets and when the next meeting is due.
export function MeetingGroupsList({ data, onOpen, language }: { data: ReturnType<typeof useMeetingGroups>, onOpen: (group: MeetingGroup) => void, language: string }) {
  const en = language === 'en'
  const today = hospitalToday()
  const rows = useMemo(() => data.groups.map(group => ({ group, status: groupStatus(group, data.meetings.meetings, today) })), [data.groups, data.meetings.meetings, today])
  return <>
    <RegistryTable className="quality-table" rows={rows} rowKey={row => row.group.id} error={data.error} onRetry={data.reload}
      columns={[{ key: 'group', label: en ? 'Department' : 'Τμήμα' }, { key: 'frequency', label: en ? 'Meets' : 'Συχνότητα' }, { key: 'last', label: en ? 'Last meeting' : 'Τελευταία' }, { key: 'next', label: en ? 'Next due' : 'Επόμενη' }, { key: 'meetings', label: en ? 'Meetings' : 'Συναντήσεις' }]}
      emptyTitle={en ? 'No meeting groups' : 'Δεν υπάρχουν ομάδες συναντήσεων'} emptyText={en ? 'Quality defines one group per department, with how often it meets.' : 'Η Ποιότητα ορίζει μία ομάδα ανά τμήμα, με τη συχνότητα των συναντήσεών του.'}
      rowProps={row => ({ className: 'registry-row-clickable', tabIndex: 0, onClick: () => onOpen(row.group), onKeyDown: event => { if (event.key === 'Enter') onOpen(row.group) } })}
      renderRow={({ group, status }) => <>
        <td><strong>{group.name}</strong><small>{(en ? group.departmentEn : group.department) || (en ? 'No department' : 'Χωρίς τμήμα')}{group.active === false ? ` · ${en ? 'inactive' : 'ανενεργή'}` : ''}</small></td>
        <td>{frequencyLabel(group.frequencyDays, language)}</td>
        <td className="nowrap-cell">{status.last ? formatDay(status.last.meetingDate, language) : '—'}</td>
        <td className={`nowrap-cell${status.overdue ? ' quality-overdue' : ''}`}>{status.nextDue ? formatDay(status.nextDue, language) : (en ? 'Not held yet' : 'Δεν έχει γίνει')}{status.overdue && status.nextDue && <small>{en ? 'Overdue' : 'Εκπρόθεσμη'}</small>}</td>
        <td>{status.meetings.length}</td>
      </>} />
  </>
}

// One department's meeting group: its summary, its meetings (regular and extraordinary), the
// decisions still open and the training that came up. `groupId` given by the department's own page.
export function MeetingGroupPage({ groupId: ownGroupId = null, home = '/meetings?tab=departments' }: { groupId?: string | null, home?: string } = {}) {
  const params = useParams()
  const groupId = ownGroupId || params.groupId
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, confirm } = useFeedback()
  const { tenant } = useTenant()
  const { goTo, goBack, restored } = useContextualNavigation(home)
  const data = useMeetingGroups()
  const { departments } = useDepartments()
  const [tab, setTab] = useState(restored?.tab || 'meetings')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  // The corrective actions opened from the meetings' decisions.
  const [capas, setCapas] = useState<MeetingCapa[]>([])
  useEffect(() => { let active = true; loadQualityRecords('capas', tenant?.id).then(rows => { if (active) setCapas((rows || []).filter((row: MeetingCapa) => String(row.sourceId || '').startsWith('DM:'))) }).catch(() => { if (active) setCapas([]) }); return () => { active = false } }, [tenant?.id])
  const group = data.groups.find(item => item.id === groupId) || null
  const today = hospitalToday()
  if (data.loading && !group) return <Page fill><TableSkeleton/></Page>
  if (!group) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Meeting group not found' : 'Η ομάδα συναντήσεων δεν βρέθηκε'}</strong></div></Page>
  const status = groupStatus(group, data.meetings.meetings, today)
  const canWrite = data.canManage || data.meetings.access.canSee({ departmentId: group.departmentId, department: group.department })
  const openMeeting = (meeting: Meeting) => goTo(`/meetings/${meeting.id}`, { tab })
  // What was said in the group's meetings, newest first: each topic with what was discussed and concluded.
  const topicRows = status.meetings.flatMap(meeting => (meeting.topics || []).map((topic: MeetingTopic) => ({ ...topic, meeting })))
  const newMeeting = (kind: string) => goTo('/meetings/new', { tab: 'meetings', state: { group, kind } })
  async function saveGroup(next: MeetingGroup) {
    setSaving(true)
    try { await saveMeetingGroup(tenant?.id, next); notify(en ? 'Group saved.' : 'Η ομάδα αποθηκεύτηκε.', 'success'); setEditing(false); data.reload() } catch (error) { console.error(error); notify(en ? 'The group could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση της ομάδας.', 'error') } finally { setSaving(false) }
  }
  async function removeGroup() {
    if (status.meetings.length) { notify(en ? `The department has ${status.meetings.length} meetings: delete them first, or deactivate the department.` : `Το τμήμα έχει ${status.meetings.length} συναντήσεις: διαγράψτε τες πρώτα ή κάντε το τμήμα ανενεργό.`, 'error'); return }
    const ok = await confirm({ title: en ? 'Delete department' : 'Διαγραφή τμήματος', message: en ? 'The department is removed from the meetings.' : 'Το τμήμα αφαιρείται από τις συναντήσεις.', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })
    if (!ok || !group) return
    try { await deleteMeetingGroup(tenant?.id, group.id); data.reload(); notify(en ? 'Deleted.' : 'Διαγράφηκε.', 'success'); goBack() } catch (error) { console.error(error); notify(en ? 'The department could not be deleted.' : 'Δεν ήταν δυνατή η διαγραφή.', 'error') }
  }
  const tabs = [
    { id: 'summary', label: en ? 'Summary' : 'Σύνοψη', icon: CalendarClock },
    { id: 'meetings', label: `${en ? 'Meetings' : 'Συναντήσεις'} ${status.meetings.length}`, icon: Users },
    { id: 'topics', label: `${en ? 'Topics' : 'Θέματα'} ${topicRows.length}`, icon: MessagesSquare },
  ]
  const headerActions = <div className="row-actions">
    {data.canManage && <IconButton tone="edit" label={en ? 'Edit the group' : 'Επεξεργασία ομάδας'} onClick={() => setEditing(true)}><Pencil size={16} /></IconButton>}
    {data.canManage && !ownGroupId && <IconButton tone="danger" label={en ? 'Delete department' : 'Διαγραφή τμήματος'} onClick={removeGroup}><Trash2 size={16} /></IconButton>}
    {canWrite && group.active !== false && <HeaderAction utility tone="primary"><OverflowMenu label={en ? 'New meeting' : 'Νέα συνάντηση'} width={220} triggerTone="primary" trigger={<><Plus size={16} aria-hidden="true" />{en ? 'New meeting' : 'Νέα συνάντηση'}</>}
      items={[{ id: 'regular', label: en ? 'Regular meeting' : 'Τακτική συνάντηση', icon: CalendarClock, onClick: () => newMeeting('regular') }, { id: 'extraordinary', label: en ? 'Extraordinary meeting' : 'Έκτακτη συνάντηση', icon: ClipboardList, onClick: () => newMeeting('extraordinary') }]} /></HeaderAction>}
  </div>
  return <Page fill><EntityRecordShell className="quality-record-shell meeting-group-record workspace-fill" avatar={<Users size={19} />} eyebrow={(en ? group.departmentEn : group.department) || (en ? 'Meeting group' : 'Ομάδα συναντήσεων')} title={group.name}
    subtitle={[frequencyLabel(group.frequencyDays, language), group.managerLabel].filter(Boolean).join(' · ')}
    status={status.overdue ? <StatusBadge tone="danger">{status.last ? (en ? 'Meeting overdue' : 'Εκπρόθεσμη συνάντηση') : (en ? 'No meeting yet' : 'Καμία συνάντηση')}</StatusBadge> : group.active === false ? <StatusBadge tone="neutral">{en ? 'Inactive' : 'Ανενεργή'}</StatusBadge> : null}
    headerActions={headerActions} tabs={tabs} activeTab={tab} onTabChange={setTab} onBack={ownGroupId ? undefined : goBack}>
    {tab === 'summary' && <RecordTabPanel title={en ? 'Summary' : 'Σύνοψη'}>
      <div className="meeting-group-summary"><DetailFields fields={[
        { label: en ? 'Department' : 'Τμήμα', value: (en ? group.departmentEn : group.department) || '—' },
        { label: en ? 'Meets' : 'Συχνότητα', value: frequencyLabel(group.frequencyDays, language) },
        { label: en ? 'Duration' : 'Διάρκεια', value: group.durationHours ? `${String(group.durationHours).replace('.', en ? '.' : ',')} ${en ? 'h' : Number(group.durationHours) === 1 ? 'ώρα' : 'ώρες'}` : '—' },
        { label: en ? 'Led by' : 'Υπεύθυνος', value: group.managerLabel || '—' },
        { label: en ? 'Last meeting' : 'Τελευταία συνάντηση', value: status.last ? `${formatDay(status.last.meetingDate, language)} · ${status.last.code}` : (en ? 'None yet' : 'Καμία ακόμη') },
        { label: en ? 'Next due' : 'Επόμενη οφειλόμενη', value: status.nextDue ? <span className={status.overdue ? 'quality-overdue-text' : ''}>{formatDay(status.nextDue, language)}{status.overdue ? ` · ${en ? 'overdue' : 'εκπρόθεσμη'}` : ''}</span> : (en ? 'With the first meeting' : 'Με την πρώτη συνάντηση') },
      ]} /></div>
    </RecordTabPanel>}
    {tab === 'meetings' && <RecordTabPanel title={en ? 'Meetings' : 'Συναντήσεις'} subtitle={en ? 'Regular meetings as often as set, and extraordinary ones when needed.' : 'Τακτικές με τη συχνότητα που ορίστηκε, και έκτακτες όταν χρειαστεί.'}>
      <RegistryTable className="quality-table" rows={status.meetings} rowKey={meeting => meeting.id}
        columns={[{ key: 'code', label: en ? 'Meeting' : 'Συνάντηση' }, { key: 'date', label: en ? 'Date' : 'Ημερομηνία' }, { key: 'topics', label: en ? 'Topics' : 'Θέματα' }, { key: 'present', label: en ? 'Present' : 'Παρόντες' }, { key: 'decision', label: en ? 'Decision' : 'Απόφαση' }, { key: 'capa', label: en ? 'Corrective action' : 'Διορθωτική ενέργεια' }, { key: 'training', label: en ? 'Training' : 'Εκπαίδευση' }]}
        emptyTitle={en ? 'No meetings yet' : 'Δεν υπάρχουν συναντήσεις ακόμη'} emptyText={en ? 'Start with «New meeting».' : 'Ξεκινήστε με τη «Νέα συνάντηση».'}
        rowProps={meeting => ({ className: 'registry-row-clickable', tabIndex: 0, onClick: () => openMeeting(meeting), onKeyDown: event => { if (event.key === 'Enter') openMeeting(meeting) } })}
        renderRow={meeting => <>
          <td><strong>{meeting.code || '—'}</strong><small>{kindLabel(meeting.kind, en)}</small></td>
          <td className="nowrap-cell">{formatDay(meeting.meetingDate, language)}</td>
          <td>{(meeting.topics || []).length || String(meeting.agenda || '').split(/\n+/).filter(Boolean).length}</td>
          <td>{presentOf(meeting)}{(meeting.participants || []).length ? ` / ${meeting.participants.length}` : ''}</td>
          <td>{yesNo(meeting.decisions.length > 0, en)}</td>
          <td>{yesNo(meetingCapas(capas, meeting).length > 0, en)}</td>
          <td>{meeting.trainingProgramKey ? <button type="button" className="meeting-link" onClick={event => { event.stopPropagation(); goTo(`/training/${meeting.trainingProgramKey}`, { tab }) }}>{en ? 'Yes · open' : 'Ναι · άνοιγμα'}</button> : yesNo(meeting.trainingHeld, en)}</td>
        </>} />
    </RecordTabPanel>}
    {tab === 'topics' && <RecordTabPanel title={en ? 'Topics' : 'Θέματα'} subtitle={en ? 'The topics of the meetings, with the decision taken and the corrective action, if any.' : 'Τα θέματα των συναντήσεων, με την απόφαση που πάρθηκε και τη διορθωτική ενέργεια, αν υπήρξε.'}>
      <RegistryTable className="quality-table" sortable={false} rows={topicRows} rowKey={(topic, index) => topic.id || index}
        columns={[{ key: 'subject', label: en ? 'Topic' : 'Θέμα' }, { key: 'decision', label: en ? 'Decision' : 'Απόφαση' }, { key: 'capa', label: en ? 'Corrective action' : 'Διορθωτική ενέργεια' }, { key: 'meeting', label: en ? 'Meeting' : 'Συνάντηση' }]}
        emptyTitle={en ? 'No topics yet' : 'Δεν υπάρχουν θέματα ακόμη'}
        rowProps={topic => ({ className: 'registry-row-clickable', tabIndex: 0, onClick: () => openMeeting(topic.meeting), onKeyDown: event => { if (event.key === 'Enter') openMeeting(topic.meeting) } })}
        renderRow={topic => { const decisions = topic.meeting.decisions.filter(item => topic.id && item.topicId === topic.id); const capa = decisions.map(item => capas.find(entry => entry.sourceId === `DM:${topic.meeting.code}#${item.id}`)).find(Boolean); return <>
          <td className="meeting-wrap-cell"><strong>{topic.subject}</strong></td>
          <td className="meeting-wrap-cell">{decisions.map(item => item.title).filter(Boolean).join(' · ') || '—'}</td>
          <td>{capa ? <button type="button" className="meeting-link" onClick={event => { event.stopPropagation(); goTo(`/quality/capas/${capa.id}`, { tab }) }}>{capa.code || (en ? 'Open' : 'Άνοιγμα')}</button> : '—'}</td>
          <td className="nowrap-cell">{formatDay(topic.meeting.meetingDate, language)}<small>{topic.meeting.code}</small></td>
        </> }} />
    </RecordTabPanel>}
    {editing && <MeetingGroupDialog initial={group} departments={departments} saving={saving} onClose={() => setEditing(false)} onSave={saveGroup} language={language} />}
  </EntityRecordShell></Page>
}
