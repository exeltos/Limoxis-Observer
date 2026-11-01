import { supabase } from '../../../core/supabase/client'
import { isDemoDataEnvironment } from '../../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../../core/preview/ownerPreview'
import { loadSnapshot, saveSnapshot } from '../../../core/data/repository'
import { addDays, nextMeetingCode, previousMonth } from './meetingModel'

// Department meetings (20261107100000_quality_department_meetings.sql): one row
// per meeting, per decision and per participant. The database lets a
// department read and write only its own meetings.

const isLocal = () => isDemoDataEnvironment() || isOwnerPreview()
const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
const localId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const must = ({ data, error }) => { if (error) throw error; return data }
const LOCAL_KEY = 'quality_local_department_meetings'
const LOCAL_GROUPS_KEY = 'quality_local_department_meeting_groups'

// --- Demo -------------------------------------------------------------------------

function demoMeetings() {
  const day = new Date().toISOString().slice(0, 10)
  const nicu = { departmentId: 'Νεογνολογική / ΜΕΝΝ', department: 'Νεογνολογική / ΜΕΝΝ', departmentEn: 'Neonatal / NICU', groupId: 'dmg-nicu' }
  const icu = { departmentId: 'ΜΕΘ', department: 'ΜΕΘ', departmentEn: 'ICU', groupId: 'dmg-icu' }
  const team = [{ name: 'Διευθυντής ΜΕΝΝ', role: 'Διευθυντής', attended: true }, { name: 'Προϊσταμένη ΜΕΝΝ', role: 'Προϊσταμένη', attended: true }, { name: 'Υπεύθυνος Ποιότητας', role: 'Ποιότητα', attended: true }]
  const first = addDays(day, -45), second = addDays(day, -14), icuDay = addDays(day, -40)
  return [
    { id: 'dm-demo-1', code: `DM-${first.slice(0, 4)}-01`, ...nicu, title: 'Μηνιαία συνάντηση ΜΕΝΝ', kind: 'regular', meetingDate: first, periodMonth: previousMonth(first), agenda: 'Δείκτες του μήνα\nΣυμβάντα και διορθωτικές ενέργειες', minutes: 'Συζητήθηκε η αύξηση της μέσης διάρκειας νοσηλείας και ο χαμηλός αποκλειστικός μητρικός θηλασμός.', nextMeetingDate: addDays(first, 30), status: 'final', finalizedAt: `${first}T14:00:00Z`, finalizedByLabel: 'Διευθυντής ΜΕΝΝ',
      decisions: [{ id: 'dmd-1', position: 0, title: 'Πρόγραμμα στήριξης θηλασμού με τη μαία του τμήματος', ownerLabel: 'Προϊσταμένη ΜΕΝΝ', dueDate: addDays(first, 40), status: 'open', capaId: '', carriedFrom: '' }, { id: 'dmd-2', position: 1, title: 'Ανασκόπηση κριτηρίων εξιτηρίου', ownerLabel: 'Διευθυντής ΜΕΝΝ', dueDate: addDays(first, 20), status: 'done', capaId: '', carriedFrom: '' }],
      participants: team.map((person, position) => ({ ...person, id: `dmp-1-${position}`, position })) },
    { id: 'dm-demo-2', code: `DM-${second.slice(0, 4)}-02`, ...nicu, title: 'Μηνιαία συνάντηση ΜΕΝΝ', kind: 'regular', meetingDate: second, periodMonth: previousMonth(second), agenda: 'Εκκρεμότητες της προηγούμενης συνάντησης\nΔείκτες του μήνα\nΆλλα θέματα', minutes: '', nextMeetingDate: addDays(second, 30), status: 'draft', finalizedAt: null, finalizedByLabel: '',
      decisions: [{ id: 'dmd-3', position: 0, title: 'Πρόγραμμα στήριξης θηλασμού με τη μαία του τμήματος', ownerLabel: 'Προϊσταμένη ΜΕΝΝ', dueDate: addDays(first, 40), status: 'open', capaId: '', carriedFrom: `DM-${first.slice(0, 4)}-01` }],
      participants: team.map((person, position) => ({ ...person, id: `dmp-2-${position}`, position })) },
    { id: 'dm-demo-3', code: `DM-${icuDay.slice(0, 4)}-01`, ...icu, title: 'Συνάντηση ΜΕΘ', kind: 'regular', meetingDate: icuDay, periodMonth: previousMonth(icuDay), agenda: 'Δείκτες λοιμώξεων\nΣυμβάντα', minutes: 'Η συμμόρφωση στην υγιεινή χεριών παραμένει κάτω από τον στόχο.', nextMeetingDate: addDays(icuDay, 30), status: 'final', finalizedAt: `${icuDay}T13:00:00Z`, finalizedByLabel: 'Διευθυντής ΜΕΘ',
      topics: [{ id: 'dmt-3-1', subject: 'Δείκτες λοιμώξεων', discussion: 'Αύξηση CLABSI τον μήνα που πέρασε· δύο περιστατικά σε νέο προσωπικό.', conclusion: 'Επανεκπαίδευση στη φροντίδα κεντρικών γραμμών.' }, { id: 'dmt-3-2', subject: 'Συμβάντα', discussion: '', conclusion: '' }],
      trainings: [{ id: 'dmtr-3-1', topic: 'Φροντίδα κεντρικών φλεβικών γραμμών (CLABSI bundle)', audience: 'Νέο νοσηλευτικό προσωπικό', dueDate: addDays(icuDay, 30), programId: '', programKey: '', programStatus: '' }],
      decisions: [{ id: 'dmd-4', position: 0, title: 'Επανεκπαίδευση στις 5 Στιγμές για το νέο προσωπικό', ownerLabel: 'Link Nurse ΜΕΘ', dueDate: addDays(icuDay, 21), status: 'open', capaId: '', carriedFrom: '' }],
      participants: [{ id: 'dmp-3-0', position: 0, name: 'Διευθυντής ΜΕΘ', role: 'Διευθυντής', attended: true }, { id: 'dmp-3-1', position: 1, name: 'Link Nurse ΜΕΘ', role: 'Link Nurse', attended: true }] },
    // Earlier ICU meetings, as the imported ones look: one with attendance linked to the employees (one has since left), one final without attendance.
    { id: 'dm-demo-4', code: 'DM-2026-02', ...icu, title: 'Συνάντηση ΜΕΘ', kind: 'regular', meetingDate: addDays(day, -150), periodMonth: previousMonth(addDays(day, -150)), agenda: 'Υγιεινή χεριών', minutes: '', nextMeetingDate: addDays(day, -60), status: 'final', finalizedAt: `${addDays(day, -150)}T10:00:00.000Z`, finalizedByLabel: 'Υπεύθυνος Ποιότητας',
      topics: [{ id: 'dmt-4-1', subject: 'Υγιεινή χεριών', discussion: '', conclusion: '' }], trainings: [], decisions: [],
      participants: [{ id: 'dmp-4-0', position: 0, employeeId: 'EMP-001', name: 'Μαρία Παπαδοπούλου', role: '', attended: true }, { id: 'dmp-4-1', position: 1, employeeId: 'EMP-004', name: 'Αλέξανδρος Γεωργίου', role: '', attended: true }, { id: 'dmp-4-2', position: 2, employeeId: '', name: 'Μικροβιολόγος εργαστηρίου', role: 'Μικροβιολόγος', attended: false }] },
    { id: 'dm-demo-5', code: 'DM-2026-03', ...icu, title: 'Συνάντηση ΜΕΘ', kind: 'regular', meetingDate: addDays(day, -230), periodMonth: previousMonth(addDays(day, -230)), agenda: 'Ωράριο', minutes: '', nextMeetingDate: addDays(day, -150), status: 'final', finalizedAt: `${addDays(day, -230)}T10:00:00.000Z`, finalizedByLabel: 'Υπεύθυνος Ποιότητας',
      topics: [{ id: 'dmt-5-1', subject: 'Ωράριο', discussion: '', conclusion: '' }], trainings: [], decisions: [], participants: [] }
  ]
}

// The demo's meeting groups: one per department that meets, defined by Quality.
const demoGroups = () => [
  { id: 'dmg-nicu', departmentId: 'Νεογνολογική / ΜΕΝΝ', department: 'Νεογνολογική / ΜΕΝΝ', departmentEn: 'Neonatal / NICU', name: 'Συναντήσεις ΜΕΝΝ', frequencyDays: 30, durationHours: 1, managerLabel: 'Προϊσταμένη ΜΕΝΝ', active: true },
  { id: 'dmg-icu', departmentId: 'ΜΕΘ', department: 'ΜΕΘ', departmentEn: 'ICU', name: 'Συναντήσεις ΜΕΘ', frequencyDays: 90, durationHours: 1, managerLabel: 'Προϊσταμένη ΜΕΘ', active: true },
]
function localGroups() {
  const rows = loadSnapshot(LOCAL_GROUPS_KEY, null)
  if (Array.isArray(rows)) return rows
  const initial = demoGroups()
  saveSnapshot(LOCAL_GROUPS_KEY, initial)
  return initial
}

function local() {
  const rows = loadSnapshot(LOCAL_KEY, null)
  if (Array.isArray(rows)) return rows
  const initial = demoMeetings()
  saveSnapshot(LOCAL_KEY, initial)
  return initial
}

// --- Cloud --------------------------------------------------------------------------

const toMeeting = (row, decisions = [], participants = [], departments = new Map(), topics = [], trainings = []) => ({
  id: row.id, groupId: row.group_id || '', code: row.code, departmentId: row.department_id, department: departments.get(row.department_id)?.name || '', departmentEn: departments.get(row.department_id)?.nameEn || departments.get(row.department_id)?.name || '',
  title: row.title, kind: row.kind, meetingDate: row.meeting_date, periodMonth: row.period_month || '', agenda: row.agenda || '', minutes: row.minutes || '', nextMeetingDate: row.next_meeting_date || '', status: row.status, finalizedAt: row.finalized_at, finalizedByLabel: row.finalized_by_label || '',
  decisions: decisions.sort((a, b) => a.position - b.position).map(item => ({ id: item.id, position: item.position, title: item.title, ownerLabel: item.owner_label || '', dueDate: item.due_date || '', status: item.status, capaId: item.capa_id || '', carriedFrom: item.carried_from || '' })),
  participants: participants.sort((a, b) => a.position - b.position).map(item => ({ id: item.id, position: item.position, employeeId: item.employee_id || '', name: item.name, role: item.role || '', attended: item.attended })),
  topics: topics.sort((a, b) => a.position - b.position).map(item => ({ id: item.id, subject: item.subject, discussion: item.discussion || '', conclusion: item.conclusion || '' })),
  trainings: trainings.sort((a, b) => a.position - b.position).map(item => ({ id: item.id, topic: item.topic, audience: item.audience || '', dueDate: item.due_date || '', programId: item.training_program_id || '', programKey: item.program?.program_key || '', programStatus: item.program?.status || '' })),
})

async function departmentNames(organizationId) {
  const rows = must(await supabase.from('departments').select('id,name').eq('organization_id', organizationId)) || []
  return new Map(rows.map(row => [row.id, { name: row.name, nameEn: row.name }]))
}

// The meetings the user may see: the database returns only their department's,
// unless they see the whole Quality Center.
export async function loadMeetings(organizationId) {
  if (isLocal()) return local()
  // The meetings with their decisions and participants embedded, beside the
  // department names: one round trip instead of two in a row.
  const [rows, departments] = await Promise.all([
    supabase.from('quality_department_meetings').select('*,decisions:quality_department_meeting_decisions(*),participants:quality_department_meeting_participants(*),topics:quality_department_meeting_topics(*),trainings:quality_department_meeting_trainings(*,program:training_programs(program_key,status))').eq('organization_id', organizationId).order('meeting_date', { ascending: false }).then(must),
    departmentNames(organizationId),
  ])
  return (rows || []).map(({ decisions, participants, topics, trainings, ...row }) => toMeeting(row, decisions || [], participants || [], departments, topics || [], trainings || []))
}

// Saves the meeting and replaces its decisions and participants.
export async function saveMeeting(organizationId, meeting) {
  const year = Number(String(meeting.meetingDate).slice(0, 4)) || new Date().getFullYear()
  if (isLocal()) {
    const rows = local()
    const sameDepartment = rows.filter(row => row.departmentId === meeting.departmentId).map(row => row.code)
    const next = { ...meeting, code: meeting.code || nextMeetingCode(sameDepartment, year), id: meeting.id || localId('dm'), decisions: meeting.decisions.map((decision, position) => ({ ...decision, id: decision.id || localId('dmd'), position })), participants: meeting.participants.map((person, position) => ({ ...person, id: person.id || localId('dmp'), position })), topics: (meeting.topics || []).map(topic => ({ ...topic, id: topic.id || localId('dmt') })), trainings: (meeting.trainings || []).map(item => ({ ...item, id: item.id || localId('dmtr') })) }
    saveSnapshot(LOCAL_KEY, meeting.id ? rows.map(row => (row.id === meeting.id ? next : row)) : [next, ...rows])
    return next
  }
  const head = { organization_id: organizationId, group_id: isUuid(meeting.groupId) ? meeting.groupId : null, department_id: meeting.departmentId, title: meeting.title, kind: meeting.kind || 'regular', meeting_date: meeting.meetingDate, period_month: meeting.periodMonth || null, agenda: meeting.agenda || null, minutes: meeting.minutes || null, next_meeting_date: meeting.nextMeetingDate || null, status: meeting.status, finalized_at: meeting.finalizedAt || null, finalized_by_label: meeting.finalizedByLabel || null }
  let id = isUuid(meeting.id) ? meeting.id : null
  if (id) must(await supabase.from('quality_department_meetings').update(head).eq('id', id))
  else {
    const codes = must(await supabase.from('quality_department_meetings').select('code').eq('organization_id', organizationId).eq('department_id', meeting.departmentId)) || []
    id = must(await supabase.from('quality_department_meetings').insert({ ...head, code: nextMeetingCode(codes.map(row => row.code), year) }).select('id').single()).id
  }
  const base = { organization_id: organizationId, meeting_id: id }
  for (const table of ['quality_department_meeting_decisions', 'quality_department_meeting_participants']) must(await supabase.from(table).delete().eq('meeting_id', id))
  if (meeting.decisions.length) must(await supabase.from('quality_department_meeting_decisions').insert(meeting.decisions.map((decision, position) => ({ ...base, position, title: decision.title, owner_label: decision.ownerLabel || null, due_date: decision.dueDate || null, status: decision.status || 'open', capa_id: isUuid(decision.capaId) ? decision.capaId : null, carried_from: decision.carriedFrom || null }))))
  // Topics and training needs keep their ids (a FileMaker topic, a training linked to its programme).
  const topics = (meeting.topics || []).filter(topic => String(topic.subject || '').trim())
  const trainings = (meeting.trainings || []).filter(item => String(item.topic || '').trim())
  for (const table of ['quality_department_meeting_topics', 'quality_department_meeting_trainings']) must(await supabase.from(table).delete().eq('meeting_id', id))
  if (topics.length) must(await supabase.from('quality_department_meeting_topics').insert(topics.map((topic, position) => ({ ...base, ...(isUuid(topic.id) ? { id: topic.id } : {}), position, subject: String(topic.subject).trim(), discussion: topic.discussion || null, conclusion: topic.conclusion || null }))))
  if (trainings.length) must(await supabase.from('quality_department_meeting_trainings').insert(trainings.map((item, position) => ({ ...base, ...(isUuid(item.id) ? { id: item.id } : {}), position, topic: String(item.topic).trim(), audience: item.audience || null, due_date: item.dueDate || null, training_program_id: isUuid(item.programId) ? item.programId : null }))))
  if (meeting.participants.length) must(await supabase.from('quality_department_meeting_participants').insert(meeting.participants.map((person, position) => ({ ...base, position, employee_id: isUuid(person.employeeId) ? person.employeeId : null, name: person.name, role: person.role || null, attended: person.attended !== false }))))
  return (await loadMeetings(organizationId)).find(row => row.id === id)
}

// A training created from a meeting is linked back to the meeting's training need.
export async function linkMeetingTraining(organizationId, { meetingId, trainingId }, program) {
  if (isLocal()) {
    const rows = local()
    saveSnapshot(LOCAL_KEY, rows.map(row => (row.id !== meetingId ? row : { ...row, trainings: (row.trainings || []).map(item => (item.id === trainingId ? { ...item, programId: program.dbId || '', programKey: program.id, programStatus: program.status || 'active' } : item)) })))
    return
  }
  if (!isUuid(trainingId) || !isUuid(program.dbId)) return
  must(await supabase.from('quality_department_meeting_trainings').update({ training_program_id: program.dbId }).eq('id', trainingId).eq('organization_id', organizationId))
}

// --- Meeting groups ------------------------------------------------------------------

const toGroup = (row, departments = new Map()) => ({
  id: row.id, departmentId: row.department_id || '', department: departments.get(row.department_id)?.name || '', departmentEn: departments.get(row.department_id)?.nameEn || departments.get(row.department_id)?.name || '',
  name: row.name, frequencyDays: row.frequency_days, durationHours: row.duration_hours == null ? '' : Number(row.duration_hours), managerLabel: row.manager_label || '', active: row.active !== false,
})

// The groups the user may see: the database returns only their department's, unless they see the whole Quality Center.
export async function loadMeetingGroups(organizationId) {
  if (isLocal()) return localGroups()
  const [rows, departments] = await Promise.all([
    supabase.from('quality_department_meeting_groups').select('*').eq('organization_id', organizationId).order('name').then(must),
    departmentNames(organizationId),
  ])
  return (rows || []).map(row => toGroup(row, departments))
}

// Quality defines a group: its department, name, how often it meets.
export async function saveMeetingGroup(organizationId, group) {
  const days = Math.min(730, Math.max(1, Number(group.frequencyDays) || 90))
  if (isLocal()) {
    const rows = localGroups()
    const next = { ...group, frequencyDays: days, id: group.id || localId('dmg') }
    saveSnapshot(LOCAL_GROUPS_KEY, group.id ? rows.map(row => (row.id === group.id ? next : row)) : [...rows, next])
    return next
  }
  const row = { organization_id: organizationId, department_id: isUuid(group.departmentId) ? group.departmentId : null, name: String(group.name || '').trim(), frequency_days: days, duration_hours: Number(group.durationHours) > 0 ? Number(group.durationHours) : null, manager_label: group.managerLabel || null, active: group.active !== false }
  if (isUuid(group.id)) return toGroup(must(await supabase.from('quality_department_meeting_groups').update(row).eq('id', group.id).eq('organization_id', organizationId).select('*').single()))
  return toGroup(must(await supabase.from('quality_department_meeting_groups').insert(row).select('*').single()))
}
