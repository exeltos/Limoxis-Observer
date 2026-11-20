// «Εκπαίδευση» for the departments that do not manage training (owner, 20/11/2026): the Department User and the Link
// Nurse see «Οι δικές μου» (one line per programme, the latest assignment, «3 φορές · τελευταία …» when repeated), the
// Department Manager «Όλο το τμήμα» (one line per assignment, with the employee). Four figures over the list, the same
// «mine» as the user's home (userHomeModel: the account in a hospital, the sample data's own employee in the Demo).
// Pure functions over the training records, so the screen and the tests agree.
import { addDay, type CalendarScope } from '../calendar/calendarView'
import { isOwn, ownCertificatesDue } from '../dashboard/userHomeModel'
import { foldSearch } from '../../core/i18n/searchMatch'
import { computedAssignmentStatus, type TrainingState } from './trainingData'
import type { TrainingAssignment, TrainingCertificate, TrainingProgram } from './trainingTypes'

export type TrainingMyScope = 'mine' | 'department'
export type TrainingMyStatus = 'open' | 'completed' | 'all'
export type CertificateState = 'none' | 'valid' | 'expiring' | 'expired'
export type ResultKind = 'score' | 'review' | 'done' | 'none'
type Own = Pick<CalendarScope, 'userId' | 'employeeId'>
type Records = Pick<TrainingState, 'programs' | 'assignments' | 'certificates'>

export interface TrainingMyRow {
  id: string
  assignment: TrainingAssignment
  program: TrainingProgram | null
  title: string
  status: string
  dueDate: string
  completedDate: string
  employeeName: string
  department: string
  // «Οι δικές μου»: how many times the programme was assigned, and the date of the latest one.
  times: number
  lastDate: string
  result: ResultKind
  score: number | null
  certificate: TrainingCertificate | null
  certificateState: CertificateState
}

const day = (value: unknown) => String(value || '').slice(0, 10)
const doneDate = (row: TrainingAssignment) => day(row.completedDate || row.completedAt || row.completionConfirmedAt)
// The latest assignment is the one assigned last; without an assignment date, the later deadline or completion.
const latestFirst = (a: TrainingAssignment, b: TrainingAssignment) => day(b.assignedDate).localeCompare(day(a.assignedDate)) || (doneDate(b) || day(b.dueDate)).localeCompare(doneDate(a) || day(a.dueDate))

// A certificate: expired, expiring within 90 days, valid, or none.
export function certificateState(certificate: Pick<TrainingCertificate, 'validUntil'> | null | undefined, today: string, days = 90): CertificateState {
  if (!certificate) return 'none'
  const until = day(certificate.validUntil)
  if (!until) return 'valid'
  return until < today ? 'expired' : until <= addDay(today, days) ? 'expiring' : 'valid'
}

function rowOf(assignment: TrainingAssignment, records: Records, today: string, group: TrainingAssignment[] = [assignment]): TrainingMyRow {
  const program = records.programs.find(item => item.id === assignment.programId) || null
  const certificate = (records.certificates || []).find(item => (assignment.certificateId && item.id === assignment.certificateId) || item.assignmentId === assignment.id) || null
  const status = computedAssignmentStatus(assignment, new Date(`${today}T12:00:00`))
  const result: ResultKind = assignment.assessmentReviewStatus === 'pending' ? 'review' : assignment.score != null ? 'score' : status === 'completed' ? 'done' : 'none'
  return {
    id: assignment.id, assignment, program, title: program?.title || certificate?.title || String(assignment.programId || ''), status,
    dueDate: day(assignment.dueDate), completedDate: doneDate(assignment), employeeName: assignment.employeeName || '', department: assignment.department || '',
    times: group.length, lastDate: doneDate(assignment) || day(assignment.dueDate) || day(assignment.assignedDate),
    result, score: assignment.score ?? null, certificate, certificateState: certificateState(certificate, today),
  }
}

// What is still to do first (by deadline, the overdue ones before), then the completed ones, the latest first.
function sortRows(rows: TrainingMyRow[]) {
  const open = (row: TrainingMyRow) => row.status !== 'completed'
  return rows.sort((a, b) => Number(open(b)) - Number(open(a)) || (open(a) ? (a.dueDate || '9999').localeCompare(b.dueDate || '9999') : b.completedDate.localeCompare(a.completedDate)) || a.title.localeCompare(b.title) || a.employeeName.localeCompare(b.employeeName))
}

const usable = (records: Records) => {
  const cancelled = new Set(records.programs.filter(program => program.status === 'cancelled').map(program => program.id))
  return (records.assignments || []).filter(row => row.status !== 'cancelled' && !cancelled.has(row.programId as string))
}

// «Οι δικές μου»: the user's assignments, one line per programme (its latest assignment).
export function ownTrainingRows(records: Records, own: Own, today: string): TrainingMyRow[] {
  const groups = new Map<string, TrainingAssignment[]>()
  for (const row of usable(records).filter(row => isOwn(row, own))) {
    const key = String(row.programId || row.id)
    groups.set(key, [...(groups.get(key) || []), row])
  }
  return sortRows([...groups.values()].map(group => { const sorted = [...group].sort(latestFirst); return rowOf(sorted[0], records, today, sorted) }))
}

// «Όλο το τμήμα»: one line per assignment. The database keeps a department's people to its department; the sample data
// has no such rule, so there the department's names (the calendar's scope, already folded) keep it.
export function departmentTrainingRows(records: Records, today: string, departments: string[] | null = null): TrainingMyRow[] {
  const inDepartment = (row: TrainingAssignment) => !departments || departments.includes(foldSearch(row.department).trim())
  return sortRows(usable(records).filter(inDepartment).map(row => rowOf(row, records, today)))
}

export function filterTrainingRows(rows: TrainingMyRow[], status: TrainingMyStatus) {
  return status === 'all' ? rows : rows.filter(row => status === 'completed' ? row.status === 'completed' : row.status !== 'completed')
}
export function trainingStatusCounts(rows: TrainingMyRow[]) {
  const completed = rows.filter(row => row.status === 'completed').length
  return { open: rows.length - completed, completed, all: rows.length }
}

export interface TrainingMyTiles { open: number, nextDue: string, overdue: number, completedYear: number, certificates: { count: number, expired: number } }
// The four figures: still to do (with the nearest deadline), overdue, completed in the last year, certificates that expire
// within 90 days or have expired. «Οι δικές μου» counts the user's certificates as the home does.
export function trainingTiles(rows: TrainingMyRow[], today: string, mine: { records: Records, own: Own } | null = null): TrainingMyTiles {
  const open = rows.filter(row => row.status !== 'completed')
  const nextDue = open.map(row => row.dueDate).filter(date => date && date >= today).sort()[0] || ''
  const yearAgo = addDay(today, -365)
  // A renewed training's older certificate has done its work: one certificate per person and programme, the latest one.
  const latest = new Map<string, TrainingMyRow>()
  for (const row of rows.filter(row => row.certificate)) {
    const key = `${row.assignment.userId || row.assignment.employeeId || row.employeeName}|${row.assignment.programId || row.id}`
    const kept = latest.get(key)
    if (!kept || latestFirst(row.assignment, kept.assignment) < 0) latest.set(key, row)
  }
  const due = [...latest.values()].filter(row => row.certificateState === 'expiring' || row.certificateState === 'expired')
  return {
    open: open.length, nextDue, overdue: open.filter(row => row.status === 'overdue').length,
    completedYear: rows.filter(row => row.status === 'completed' && row.completedDate >= yearAgo).length,
    certificates: mine ? ownCertificatesDue(mine.records, mine.own, today) : { count: due.length, expired: due.filter(row => row.certificateState === 'expired').length },
  }
}
