// The home of the Department User and the Link Nurse (owner, 20/11/2026): four figures (the department's overdue
// controls and cultures, today's tasks, the user's own certificates that expire, the department's patients in isolation
// as a number only), then «Για μένα σήμερα» with «Οι εκπαιδεύσεις μου», the department's next 7 days and the
// announcements. Pure functions over the calendar's events and training records, so the screen and the tests agree.
import type { CalendarEvent, CalendarSources } from '../calendar/calendarEvents'
import { addDay, isOwnCalendarEvent, nextDaysGroups, type CalendarGroup, type CalendarScope } from '../calendar/calendarView'

type Own = Pick<CalendarScope, 'userId' | 'employeeId'>
type Training = NonNullable<CalendarSources['training']>
type Certificate = NonNullable<Training['certificates']>[number]

// «Για σήμερα»: the tasks of «Για μένα σήμερα» that are today's work (controls due today, samples, isolation reassessments).
export const TODAY_TASK_KEYS = ['controlsDueToday', 'pendingSamples', 'isolationReviewsDue']
export function todayTaskCount(todo: { key: string, count: number | null }[]) {
  return todo.filter(item => TODAY_TASK_KEYS.includes(item.key)).reduce((sum, item) => sum + (Number(item.count) || 0), 0)
}

// «Εκπρόθεσμα του τμήματος»: the department's overdue controls and culture samplings (the events already scoped).
export function departmentOverdueCount(events: CalendarEvent[]) {
  return events.filter(event => (event.kind === 'controls' || event.kind === 'cultures') && event.state === 'overdue').length
}

const isOwn = (row: { userId?: string | null, employeeId?: string | null }, own: Own) => Boolean((own.userId && row.userId === own.userId) || (own.employeeId && row.employeeId === own.employeeId))
const ownAssignments = (training: Training | null | undefined, own: Own) => (training?.assignments || []).filter(row => isOwn(row, own))
// A certificate is the user's when it names them, or when it closes one of their assignments.
function ownCertificates(training: Training | null | undefined, own: Own) {
  const mine = new Set(ownAssignments(training, own).map(row => row.id))
  return (training?.certificates || []).filter(row => row.validUntil && (isOwn(row, own) || (row.assignmentId && mine.has(row.assignmentId))))
}

// «Τα πιστοποιητικά μου»: the user's certificates that expire within 90 days, and those already expired.
export function ownCertificatesDue(training: Training | null | undefined, own: Own, today: string, days = 90) {
  const until = addDay(today, days)
  const due = ownCertificates(training, own).filter(row => String(row.validUntil) <= until)
  return { count: due.length, expired: due.filter(row => String(row.validUntil) < today).length }
}

// «Οι εκπαιδεύσεις μου»: one line per programme of the user — overdue, due, a certificate expired or expiring (90 days), or done.
export type OwnTrainingStatus = 'overdue' | 'expired' | 'due' | 'expiring' | 'completed'
export interface OwnTraining { id: string, title: string, status: OwnTrainingStatus, date: string, path: string }
const STATUS_ORDER: OwnTrainingStatus[] = ['overdue', 'expired', 'due', 'expiring', 'completed']
export function ownTrainings(training: Training | null | undefined, own: Own, today: string, limit = 4): OwnTraining[] {
  const programs = new Map((training?.programs || []).map(program => [program.id, program]))
  const certificates = ownCertificates(training, own)
  const until = addDay(today, 90)
  const rows: OwnTraining[] = []
  const certificateLine = (certificate: Certificate) => {
    const day = String(certificate.validUntil)
    return day < today ? { status: 'expired' as const, date: day } : day <= until ? { status: 'expiring' as const, date: day } : null
  }
  for (const assignment of ownAssignments(training, own)) {
    const program = assignment.programId ? programs.get(assignment.programId) : undefined
    if (assignment.status === 'cancelled' || program?.status === 'cancelled') continue
    const certificate = certificates.find(row => row.assignmentId === assignment.id)
    const title = program?.title || certificate?.title || ''
    const path = program ? `/training/${program.id}` : '/my-profile'
    if (!title) continue
    const expiry = certificate ? certificateLine(certificate) : null
    if (expiry) rows.push({ id: assignment.id, title, path, ...expiry })
    else if (assignment.status !== 'completed') rows.push({ id: assignment.id, title, path, status: assignment.dueDate && assignment.dueDate < today ? 'overdue' : 'due', date: assignment.dueDate || '' })
    else rows.push({ id: assignment.id, title, path, status: 'completed', date: assignment.completedDate || '' })
  }
  // A certificate of the user without an assignment of theirs in the list (an older one).
  for (const certificate of certificates) {
    if (rows.some(row => row.id === certificate.assignmentId)) continue
    const expiry = certificateLine(certificate)
    if (expiry) rows.push({ id: certificate.id, title: certificate.title, path: '/my-profile', ...expiry })
  }
  const rank = (row: OwnTraining) => STATUS_ORDER.indexOf(row.status)
  // The work first (by date); the completed ones last, the latest first.
  return rows.sort((a, b) => rank(a) - rank(b) || (a.status === 'completed' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date))).slice(0, limit)
}

// «Επόμενες 7 ημέρες στο τμήμα»: the calendar's coming week (the events already scoped), each line marked when it is the user's own.
export function departmentWeek(events: CalendarEvent[], own: Own, today: string, days = 7): Array<{ group: CalendarGroup, own: boolean }> {
  return nextDaysGroups(events, today, days).map(group => ({ group, own: group.items.some(item => isOwnCalendarEvent(item, own)) }))
}
