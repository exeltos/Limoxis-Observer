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
export const meetingStatusLabel = (status, language = 'el') => (language === 'en' ? { draft: 'Draft', final: 'Final' } : { draft: 'Πρόχειρο', final: 'Οριστικό' })[status] || status
export const decisionStatusLabel = (status, language = 'el') => DECISION_STATUSES.find(item => item.value === status)?.label[language === 'en' ? 1 : 0] || status

const today = () => new Date().toISOString().slice(0, 10)
export const addDays = (day, days) => { const date = new Date(`${day}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10) }
// The month before a date, as its first day: a meeting in October reviews September.
export const previousMonth = day => { const date = new Date(`${String(day || today()).slice(0, 7)}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() - 1); return date.toISOString().slice(0, 10) }

// DM-2026-01, DM-2026-02… numbered within the department.
export function nextMeetingCode(codes = [], year = new Date().getFullYear()) {
  const prefix = `DM-${year}-`
  const taken = codes.filter(code => String(code).startsWith(prefix)).map(code => Number(String(code).slice(prefix.length)) || 0)
  return `${prefix}${String(Math.max(0, ...taken) + 1).padStart(2, '0')}`
}

// The department's last meeting before `date` (or before the meeting `exceptId`).
export function previousMeeting(meetings = [], departmentKey, date = '9999-12-31', exceptId = null) {
  return meetings.filter(meeting => meetingDepartmentKey(meeting) === departmentKey && meeting.id !== exceptId && String(meeting.meetingDate) <= String(date)).sort((a, b) => String(b.meetingDate).localeCompare(String(a.meetingDate)))[0] || null
}
export const meetingDepartmentKey = meeting => meeting?.departmentId || meeting?.department || ''

// A new meeting of a department: a month after its previous one (if it set
// the next date), reviewing the month before, with the previous open decisions.
export function newMeetingFor(department, meetings = [], day = today()) {
  const key = department?.id || department?.name || ''
  const previous = previousMeeting(meetings, key)
  return {
    id: '', code: '', departmentId: key, department: department?.name || '', departmentEn: department?.nameEn || department?.name || '',
    title: 'Συνάντηση τμήματος', kind: 'regular', meetingDate: day, periodMonth: previousMonth(day),
    agenda: previous ? 'Εκκρεμότητες της προηγούμενης συνάντησης\nΔείκτες του μήνα\nΣυμβάντα και διορθωτικές ενέργειες\nΆλλα θέματα' : 'Δείκτες του μήνα\nΣυμβάντα και διορθωτικές ενέργειες\nΆλλα θέματα',
    minutes: '', nextMeetingDate: addDays(day, 30), status: 'draft', finalizedAt: null, finalizedByLabel: '',
    decisions: carriedDecisions(previous), participants: (previous?.participants || []).map(person => ({ name: person.name, role: person.role, attended: true })),
  }
}

// The open decisions of a meeting, ready to be followed up in the next one.
export function carriedDecisions(meeting) {
  if (!meeting) return []
  return (meeting.decisions || []).filter(decision => decision.status === 'open').map(decision => ({ title: decision.title, ownerLabel: decision.ownerLabel, dueDate: decision.dueDate, status: 'open', capaId: decision.capaId || '', carriedFrom: decision.carriedFrom || meeting.code }))
}

export const openDecisions = meeting => (meeting.decisions || []).filter(decision => decision.status === 'open')
export const lateDecisions = (meeting, day = today()) => openDecisions(meeting).filter(decision => decision.dueDate && decision.dueDate < day)

// The department's last meeting and whether the next one is overdue: one row per department.
export function departmentMeetingStatus(meetings = [], day = today()) {
  const byDepartment = new Map()
  for (const meeting of meetings) {
    const key = meetingDepartmentKey(meeting)
    const current = byDepartment.get(key)
    if (!current || String(meeting.meetingDate) > String(current.meetingDate)) byDepartment.set(key, meeting)
  }
  return [...byDepartment.values()].map(meeting => ({ meeting, overdue: Boolean(meeting.nextMeetingDate && meeting.nextMeetingDate < day) }))
}

// The latest meeting of each department: open decisions of an earlier one were
// carried into it, so open and late decisions are counted on these only.
export const latestMeetings = (meetings = []) => departmentMeetingStatus(meetings).map(item => item.meeting)

// Who may see and write a meeting: Quality sees every department; a member of
// the department sees and writes its own. `access` is useRegisterAccess().
export function meetingAccess(access, canManageQuality) {
  const member = meeting => access.isMember({ departmentId: meeting?.departmentId, department: meeting?.department })
  return {
    canSee: meeting => access.seesAll || member(meeting),
    canWrite: meeting => Boolean(meeting) && meeting.status !== 'final' && (canManageQuality || member(meeting)),
    canReopen: meeting => Boolean(meeting) && meeting.status === 'final' && canManageQuality,
    canCreateCapa: () => canManageQuality,
  }
}
