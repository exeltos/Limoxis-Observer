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

// --- Demo -------------------------------------------------------------------------

function demoMeetings() {
  const day = new Date().toISOString().slice(0, 10)
  const nicu = { departmentId: 'Νεογνολογική / ΜΕΝΝ', department: 'Νεογνολογική / ΜΕΝΝ', departmentEn: 'Neonatal / NICU' }
  const icu = { departmentId: 'ΜΕΘ', department: 'ΜΕΘ', departmentEn: 'ICU' }
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
      decisions: [{ id: 'dmd-4', position: 0, title: 'Επανεκπαίδευση στα 5 Moments για το νέο προσωπικό', ownerLabel: 'Link Nurse ΜΕΘ', dueDate: addDays(icuDay, 21), status: 'open', capaId: '', carriedFrom: '' }],
      participants: [{ id: 'dmp-3-0', position: 0, name: 'Διευθυντής ΜΕΘ', role: 'Διευθυντής', attended: true }, { id: 'dmp-3-1', position: 1, name: 'Link Nurse ΜΕΘ', role: 'Link Nurse', attended: true }] },
  ]
}

function local() {
  const rows = loadSnapshot(LOCAL_KEY, null)
  if (Array.isArray(rows)) return rows
  const initial = demoMeetings()
  saveSnapshot(LOCAL_KEY, initial)
  return initial
}

// --- Cloud --------------------------------------------------------------------------

const toMeeting = (row, decisions = [], participants = [], departments = new Map()) => ({
  id: row.id, code: row.code, departmentId: row.department_id, department: departments.get(row.department_id)?.name || '', departmentEn: departments.get(row.department_id)?.nameEn || departments.get(row.department_id)?.name || '',
  title: row.title, kind: row.kind, meetingDate: row.meeting_date, periodMonth: row.period_month || '', agenda: row.agenda || '', minutes: row.minutes || '', nextMeetingDate: row.next_meeting_date || '', status: row.status, finalizedAt: row.finalized_at, finalizedByLabel: row.finalized_by_label || '',
  decisions: decisions.sort((a, b) => a.position - b.position).map(item => ({ id: item.id, position: item.position, title: item.title, ownerLabel: item.owner_label || '', dueDate: item.due_date || '', status: item.status, capaId: item.capa_id || '', carriedFrom: item.carried_from || '' })),
  participants: participants.sort((a, b) => a.position - b.position).map(item => ({ id: item.id, position: item.position, name: item.name, role: item.role || '', attended: item.attended })),
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
    supabase.from('quality_department_meetings').select('*,decisions:quality_department_meeting_decisions(*),participants:quality_department_meeting_participants(*)').eq('organization_id', organizationId).order('meeting_date', { ascending: false }).then(must),
    departmentNames(organizationId),
  ])
  return (rows || []).map(({ decisions, participants, ...row }) => toMeeting(row, decisions || [], participants || [], departments))
}

// Saves the meeting and replaces its decisions and participants.
export async function saveMeeting(organizationId, meeting) {
  const year = Number(String(meeting.meetingDate).slice(0, 4)) || new Date().getFullYear()
  if (isLocal()) {
    const rows = local()
    const sameDepartment = rows.filter(row => row.departmentId === meeting.departmentId).map(row => row.code)
    const next = { ...meeting, code: meeting.code || nextMeetingCode(sameDepartment, year), id: meeting.id || localId('dm'), decisions: meeting.decisions.map((decision, position) => ({ ...decision, id: decision.id || localId('dmd'), position })), participants: meeting.participants.map((person, position) => ({ ...person, id: person.id || localId('dmp'), position })) }
    saveSnapshot(LOCAL_KEY, meeting.id ? rows.map(row => (row.id === meeting.id ? next : row)) : [next, ...rows])
    return next
  }
  const head = { organization_id: organizationId, department_id: meeting.departmentId, title: meeting.title, kind: meeting.kind || 'regular', meeting_date: meeting.meetingDate, period_month: meeting.periodMonth || null, agenda: meeting.agenda || null, minutes: meeting.minutes || null, next_meeting_date: meeting.nextMeetingDate || null, status: meeting.status, finalized_at: meeting.finalizedAt || null, finalized_by_label: meeting.finalizedByLabel || null }
  let id = isUuid(meeting.id) ? meeting.id : null
  if (id) must(await supabase.from('quality_department_meetings').update(head).eq('id', id))
  else {
    const codes = must(await supabase.from('quality_department_meetings').select('code').eq('organization_id', organizationId).eq('department_id', meeting.departmentId)) || []
    id = must(await supabase.from('quality_department_meetings').insert({ ...head, code: nextMeetingCode(codes.map(row => row.code), year) }).select('id').single()).id
  }
  const base = { organization_id: organizationId, meeting_id: id }
  for (const table of ['quality_department_meeting_decisions', 'quality_department_meeting_participants']) must(await supabase.from(table).delete().eq('meeting_id', id))
  if (meeting.decisions.length) must(await supabase.from('quality_department_meeting_decisions').insert(meeting.decisions.map((decision, position) => ({ ...base, position, title: decision.title, owner_label: decision.ownerLabel || null, due_date: decision.dueDate || null, status: decision.status || 'open', capa_id: isUuid(decision.capaId) ? decision.capaId : null, carried_from: decision.carriedFrom || null }))))
  if (meeting.participants.length) must(await supabase.from('quality_department_meeting_participants').insert(meeting.participants.map((person, position) => ({ ...base, position, name: person.name, role: person.role || null, attended: person.attended !== false }))))
  return (await loadMeetings(organizationId)).find(row => row.id === id)
}
