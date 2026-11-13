import { hospitalToday } from '../../../core/dates/hospitalDate'

// A decision, a participant and a topic of a meeting, the meeting itself and its group,
// as the screens use them (camelCase, from the quality_department_meeting* tables or the Demo).
export interface MeetingDecision { id: string, position?: number, topicId?: string, title: string, ownerLabel: string, dueDate: string, status: string, capaId: string, carriedFrom: string }
export interface MeetingParticipant { id?: string, position?: number, employeeId?: string, name: string, role: string, attended: boolean }
export interface MeetingTopic { id: string, subject: string, discussion: string, conclusion: string }
export interface Meeting {
  id: string
  code: string
  groupId: string
  departmentId: string
  department: string
  departmentEn?: string
  title: string
  kind: string
  meetingDate: string
  periodMonth: string
  agenda: string
  minutes: string
  nextMeetingDate: string
  status: string
  finalizedAt: string | null
  finalizedByLabel: string
  decisions: MeetingDecision[]
  participants: MeetingParticipant[]
  topics?: MeetingTopic[]
  trainingHeld?: boolean
  // The training held for the meeting (training_programs), if one was created from it.
  trainingProgramId?: string
  trainingProgramKey?: string
  trainingTitle?: string
  trainingStatus?: string
}
export interface MeetingGroup { id: string, departmentId: string, department?: string, departmentEn?: string, name: string, frequencyDays: number, durationHours: number | string, managerLabel: string, active: boolean }
// Where a meeting belongs: a meeting, or a department's place in one (id, or name in the Demo).
export interface MeetingPlace { departmentId?: string, department?: string }
// A department as the screens pass it (useDepartments()).
export interface MeetingDepartment { id?: string, name?: string, nameEn?: string }
// A corrective action, as far as a meeting reads it (its source is «DM:<code>#<decision>»).
export interface MeetingCapa { id: string, code?: string, status: string, sourceId?: string | null }
// A management review, as far as the meetings' tab reads it: its code, date and decisions (actions).
export interface ReviewDecisions { code?: string, reviewDate?: string | null, actions?: { status?: string, dueDate?: string | null }[] }
// The training program created for a meeting, as the training screen hands it back (dbId: its row in training_programs).
export interface MeetingTraining { id: string, dbId?: string, title?: string, status?: string }
// useRegisterAccess(): who sees every department, and whether a record is of the member's own.
interface MeetingRegisterAccess { seesAll: boolean, isMember: (record: { departmentId?: string, department?: string }) => boolean }
// Department meetings (Quality Center, phase 5): one meeting of a department,
// the month whose indicators it reviews, its minutes, its decisions and who
// took part. A new meeting carries the open decisions of the department's
// previous one, so nothing decided is lost between meetings.

export const MEETING_KINDS = [
  { value: 'regular', label: ['Τακτική', 'Regular'] },
  { value: 'extraordinary', label: ['Έκτακτη', 'Extraordinary'] },
]
export const DECISION_STATUSES = [
  { value: 'open', label: ['Ανοιχτή', 'Open'] },
  { value: 'done', label: ['Ολοκληρώθηκε', 'Done'] },
  { value: 'cancelled', label: ['Ακυρώθηκε', 'Cancelled'] },
]
export const meetingStatusLabel = (status: string, language = 'el') => (language === 'en' ? { draft: 'Draft', final: 'Final' } : { draft: 'Πρόχειρο', final: 'Οριστικό' } as Record<string, string>)[status] || status
export const decisionStatusLabel = (status: string, language = 'el') => DECISION_STATUSES.find(item => item.value === status)?.label[language === 'en' ? 1 : 0] || status

const today = () => hospitalToday()
export const addDays = (day: string, days: number) => { const date = new Date(`${day}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10) }
// The month before a date, as its first day: a meeting in October reviews September.
export const previousMonth = (day?: string | null) => { const date = new Date(`${String(day || today()).slice(0, 7)}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() - 1); return date.toISOString().slice(0, 10) }

// DM-2026-01, DM-2026-02… numbered within the department.
export function nextMeetingCode(codes: string[] = [], year = new Date().getFullYear()) {
  const prefix = `DM-${year}-`
  const taken = codes.filter(code => String(code).startsWith(prefix)).map(code => Number(String(code).slice(prefix.length)) || 0)
  return `${prefix}${String(Math.max(0, ...taken) + 1).padStart(2, '0')}`
}

// The department's last meeting before `date` (or before the meeting `exceptId`).
export function previousMeeting(meetings: Meeting[] = [], departmentKey: string, date = '9999-12-31', exceptId: string | null = null) {
  return meetings.filter(meeting => meetingDepartmentKey(meeting) === departmentKey && meeting.id !== exceptId && String(meeting.meetingDate) <= String(date)).sort((a, b) => String(b.meetingDate).localeCompare(String(a.meetingDate)))[0] || null
}
export const meetingDepartmentKey = (meeting: MeetingPlace | null | undefined) => meeting?.departmentId || meeting?.department || ''

// A new meeting of a department: a month after its previous one (if it set
// the next date), reviewing the month before, with the previous open decisions.
export function newMeetingFor(department: MeetingDepartment | null | undefined, meetings: Meeting[] = [], day = today(), group: MeetingGroup | null = null): Meeting {
  const key = department?.id || department?.name || ''
  const previous = group ? meetings.filter(meeting => meetingInGroup(meeting, group) && String(meeting.meetingDate) <= String(day)).sort((a, b) => String(b.meetingDate).localeCompare(String(a.meetingDate)))[0] || null : previousMeeting(meetings, key)
  return {
    id: '', code: '', groupId: group?.id || '', departmentId: key, department: department?.name || '', departmentEn: department?.nameEn || department?.name || '',
    title: 'Συνάντηση τμήματος', kind: 'regular', meetingDate: day, periodMonth: previousMonth(day),
    agenda: previous ? 'Εκκρεμότητες της προηγούμενης συνάντησης\nΔείκτες του μήνα\nΣυμβάντα και διορθωτικές ενέργειες\nΆλλα θέματα' : 'Δείκτες του μήνα\nΣυμβάντα και διορθωτικές ενέργειες\nΆλλα θέματα',
    minutes: '', nextMeetingDate: addDays(day, Number(group?.frequencyDays) || 30), status: 'draft', finalizedAt: null, finalizedByLabel: '',
    decisions: [], participants: (previous?.participants || []).map((person: MeetingParticipant) => ({ name: person.name, role: person.role, attended: true })),
  }
}

// The open decisions of a meeting, ready to be followed up in the next one.
export function carriedDecisions(meeting: Meeting | null | undefined) {
  if (!meeting) return []
  return (meeting.decisions || []).filter((decision: MeetingDecision) => decision.status === 'open').map((decision: MeetingDecision) => ({ title: decision.title, ownerLabel: decision.ownerLabel, dueDate: decision.dueDate, status: 'open', capaId: decision.capaId || '', carriedFrom: decision.carriedFrom || meeting.code }))
}

export const openDecisions = (meeting: Meeting) => (meeting.decisions || []).filter((decision: MeetingDecision) => decision.status === 'open')
export const lateDecisions = (meeting: Meeting, day = today()) => openDecisions(meeting).filter((decision: MeetingDecision) => decision.dueDate && decision.dueDate < day)

// The department's last meeting and whether the next one is overdue: one row per department.
export function departmentMeetingStatus(meetings: Meeting[] = [], day = today()) {
  const byDepartment = new Map<string, Meeting>()
  for (const meeting of meetings) {
    const key = meetingDepartmentKey(meeting)
    const current = byDepartment.get(key)
    if (!current || String(meeting.meetingDate) > String(current.meetingDate)) byDepartment.set(key, meeting)
  }
  return [...byDepartment.values()].map(meeting => ({ meeting, overdue: Boolean(meeting.nextMeetingDate && meeting.nextMeetingDate < day) }))
}

// The latest meeting of each department: open decisions of an earlier one were
// carried into it, so open and late decisions are counted on these only.
export const latestMeetings = (meetings: Meeting[] = []) => departmentMeetingStatus(meetings).map(item => item.meeting)

// Who may see and write a meeting: Quality sees every department; a member of
// the department sees and writes its own. `access` is useRegisterAccess().
export function meetingAccess(access: MeetingRegisterAccess, canManageQuality: boolean) {
  const member = (meeting: MeetingPlace | null | undefined) => access.isMember({ departmentId: meeting?.departmentId, department: meeting?.department })
  return {
    canSee: (meeting: MeetingPlace | null | undefined) => access.seesAll || member(meeting),
    canWrite: (meeting: MeetingPlace | null | undefined) => Boolean(meeting) && (canManageQuality || member(meeting)),
    canCreateCapa: () => canManageQuality,
  }
}

// --- Meeting groups --------------------------------------------------------------------
// A department's meeting group («Συναντήσεις ΜΕΘ»): how often the administration wants it to
// meet; its meetings, the last one and when the next is due.

export const MEETING_FREQUENCIES = [7, 14, 30, 60, 90, 180, 365]
export function frequencyLabel(days: number, language = 'el') {
  const en = language === 'en'
  const named = { 7: ['Κάθε εβδομάδα', 'Weekly'], 14: ['Κάθε 2 εβδομάδες', 'Every 2 weeks'], 30: ['Κάθε μήνα', 'Monthly'], 60: ['Κάθε 2 μήνες', 'Every 2 months'], 90: ['Κάθε 3 μήνες', 'Every 3 months'], 180: ['Κάθε 6 μήνες', 'Every 6 months'], 365: ['Κάθε χρόνο', 'Yearly'] }[Number(days)]
  return named ? named[en ? 1 : 0] : (en ? `Every ${days} days` : `Κάθε ${days} ημέρες`)
}
// A meeting is in its group; one recorded before the groups existed is in its department's.
export const meetingInGroup = (meeting: Meeting, group: MeetingGroup) => (meeting.groupId ? meeting.groupId === group.id : Boolean(group.departmentId) && meeting.departmentId === group.departmentId)
export function groupStatus(group: MeetingGroup, meetings: Meeting[] = [], day = today()) {
  const own = meetings.filter(meeting => meetingInGroup(meeting, group)).sort((a, b) => String(b.meetingDate).localeCompare(String(a.meetingDate)))
  const last = own.find(meeting => String(meeting.meetingDate) <= day) || null
  const nextDue = last ? addDays(last.meetingDate, Number(group.frequencyDays) || 90) : null
  // The open decisions are followed on the latest meeting (earlier ones were carried into it).
  const latest = own[0] || null
  return { meetings: own, last, nextDue, overdue: Boolean(group.active !== false && (!last || (nextDue && nextDue < day))), open: latest ? openDecisions(latest) : [], late: latest ? lateDecisions(latest, day) : [], trainings: own.filter(meeting => meeting.trainingHeld) }
}
export const newMeetingGroup = (): MeetingGroup => ({ id: '', departmentId: '', name: '', frequencyDays: 90, durationHours: '', managerLabel: '', active: true })

// The corrective actions opened from a meeting's decisions (their source is «DM:<meeting code>#<decision id>»).
export const meetingCapas = <T extends MeetingCapa>(capas: T[] = [], meeting: Meeting) => capas.filter(capa => String(capa.sourceId || '').startsWith(`DM:${meeting.code}#`))
