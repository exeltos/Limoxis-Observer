// «Εκπαίδευση» for the departments that do not manage training (owner, 20/11/2026): «Οι δικές μου» is one line per
// programme of the user (the latest assignment, «3 φορές · τελευταία …» when repeated), with the same «mine» as the
// user's home (userHomeModel: the account in a hospital, the sample data's own employee in the Demo). «Του τμήματός μου»
// and «Όλο το νοσοκομείο» list programmes, never employees (hospitalProgramRows below).
// Pure functions over the training records, so the screen and the tests agree.
import { addDay, audienceIncludes, type CalendarScope } from '../calendar/calendarView'
import { isOwn, ownCertificatesDue } from '../dashboard/userHomeModel'
import { foldSearch, matchesSearch } from '../../core/i18n/searchMatch'
import { computedAssignmentStatus, type TrainingState } from './trainingData'
import type { TrainingAssignment, TrainingCertificate, TrainingProgram } from './trainingTypes'

export type TrainingMyScope = 'mine' | 'department' | 'hospital'
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

// The one small button of a row (owner, 20/11/2026). «Οι δικές μου»: «Έναρξη» for a training not started yet,
// «Συνέχεια» for one in progress (the attendance or the evaluation already begun), and, once submitted, the
// certificate's «Λήψη» or, without a certificate, «Αποτέλεσμα» — all on the learner's page (training-access).
// Another person's row (mine=false): only the certificate's «Λήψη»: nobody opens another person's training.
export type TrainingRowAction = 'start' | 'continue' | 'result' | 'certificate' | null
export function trainingRowAction(row: Pick<TrainingMyRow, 'assignment' | 'status' | 'certificate'>, mine: boolean): TrainingRowAction {
  const assignment = row.assignment
  const submitted = Boolean(assignment.feedbackSubmittedAt || assignment.completionConfirmedAt || row.status === 'completed')
  if (row.certificate && (submitted || !mine)) return 'certificate'
  if (!mine) return null
  if (submitted) return 'result'
  return assignment.status === 'in_progress' || assignment.attendanceResponse === 'confirmed' || assignment.attendance ? 'continue' : 'start'
}


// The programmes (owner, 20/11/2026: «δεν θέλω να βλέπω εργαζόμενους αλλά εκπαιδεύσεις»): one line per programme (the
// cancelled ones left out), never a list of employees. «Του τμήματός μου» and the «Τμήμα» filter keep the programmes that
// concern a department: its audience names the department or the whole hospital (audienceIncludes, as the calendar), or
// at least one of the department's people was assigned. «Συμμετοχή τμήματος» counts only numbers (completed of assigned);
// «Εγώ» is the user's own part: the own training's button, «Ολοκληρώθηκε», a request waiting or rejected, or «Αίτηση».
export type TrainingProgramState = 'in_progress' | 'planned' | 'completed'
export type TrainingProgramFilter = 'current' | 'planned' | 'completed' | 'all'
export interface TrainingDepartment { id: string, name: string, nameEn?: string }
// How many of a department were assigned a programme and how many completed it (no names): the database's
// training_program_participation in a hospital, the sample data's assignments in the Demo.
export interface TrainingParticipation { programId: string, departmentId: string | null, departmentName: string, assigned: number, completed: number }
export type TrainingRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled'
export interface TrainingParticipationRequest {
  id: string
  programId: string
  programTitle: string
  requesterUserId: string | null
  employeeId: string | null
  requesterName: string
  department: string
  departmentId: string | null
  note: string
  status: TrainingRequestStatus
  decisionReason: string
  decidedAt: string
  createdAt: string
  assignmentId: string | null
}
export interface TrainingProgramRow {
  id: string
  program: TrainingProgram
  title: string
  trainer: string
  audience: string
  startDate: string
  dueDate: string
  state: TrainingProgramState
  own: TrainingMyRow | null
  participation: { assigned: number, completed: number } | null
  request: TrainingParticipationRequest | null
}

// An active programme that has not started yet is still «Προγραμματισμένο».
export function programState(program: Pick<TrainingProgram, 'status' | 'startDate'>, today: string): TrainingProgramState {
  if (program.status === 'completed') return 'completed'
  return program.status === 'planned' || day(program.startDate) > today ? 'planned' : 'in_progress'
}

// The ones running first (the nearest end first), then the planned (the nearest start first), then the completed (the latest first).
const stateOrder: Record<TrainingProgramState, number> = { in_progress: 0, planned: 1, completed: 2 }
function sortProgramRows(rows: TrainingProgramRow[]) {
  return rows.sort((a, b) => stateOrder[a.state] - stateOrder[b.state]
    || (a.state === 'completed' ? (b.dueDate || b.startDate).localeCompare(a.dueDate || a.startDate) : a.state === 'planned' ? (a.startDate || a.dueDate || '9999').localeCompare(b.startDate || b.dueDate || '9999') : (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
    || a.title.localeCompare(b.title))
}

// The sample data's figures: the assignments, per programme and department.
export function participationFromAssignments(records: Pick<Records, 'programs' | 'assignments'>): TrainingParticipation[] {
  const groups = new Map<string, TrainingParticipation>()
  for (const row of usable(records as Records)) {
    const key = `${row.programId}|${row.departmentId || ''}|${foldSearch(row.department).trim()}`
    const item = groups.get(key) || { programId: String(row.programId || ''), departmentId: row.departmentId || null, departmentName: row.department || '', assigned: 0, completed: 0 }
    item.assigned += 1
    if (row.status === 'completed') item.completed += 1
    groups.set(key, item)
  }
  return [...groups.values()]
}

// A row of a department: the same department id, or the same name (the sample data and rows without an id).
export function inTrainingDepartment(row: { departmentId?: string | null, departmentName?: string | null }, department: TrainingDepartment) {
  if (row.departmentId && row.departmentId === department.id) return true
  const name = foldSearch(row.departmentName).trim()
  return Boolean(name) && [department.name, department.nameEn].some(value => foldSearch(value).trim() === name)
}

export function programConcernsDepartment(program: Pick<TrainingProgram, 'id' | 'audience'>, department: TrainingDepartment, participation: TrainingParticipation[]) {
  return audienceIncludes(program.audience, [department.name, department.nameEn || ''].filter(Boolean))
    || participation.some(row => row.programId === program.id && row.assigned > 0 && inTrainingDepartment(row, department))
}

// Completed of assigned for the department (or the whole hospital without one); null when nobody was assigned.
export function programParticipation(programId: string, participation: TrainingParticipation[], department: TrainingDepartment | null = null) {
  const rows = participation.filter(row => row.programId === programId && (!department || inTrainingDepartment(row, department)))
  const assigned = rows.reduce((sum, row) => sum + row.assigned, 0)
  return assigned ? { assigned, completed: rows.reduce((sum, row) => sum + row.completed, 0) } : null
}

// The user's own request: the account in a hospital, the sample data's own employee in the Demo.
export const isOwnRequest = (request: Pick<TrainingParticipationRequest, 'requesterUserId' | 'employeeId'>, own: Own) =>
  Boolean((own.userId && request.requesterUserId === own.userId) || (own.employeeId && request.employeeId === own.employeeId))
// The latest of the user's requests for a programme (a withdrawn one is as if it was never made).
export function latestOwnRequest(requests: TrainingParticipationRequest[], programId: string, own: Own) {
  return requests.filter(request => request.programId === programId && request.status !== 'cancelled' && isOwnRequest(request, own))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null
}

export interface TrainingProgramOptions { department?: TrainingDepartment | null, participation?: TrainingParticipation[] | null, requests?: TrainingParticipationRequest[] }
// The programmes of the hospital, or of a department, with the user's own latest assignment and request.
export function hospitalProgramRows(records: Records, own: Own, today: string, { department = null, participation = null, requests = [] }: TrainingProgramOptions = {}): TrainingProgramRow[] {
  const mine = new Map(ownTrainingRows(records, own, today).map(row => [String(row.assignment.programId || ''), row]))
  const counts = participation || participationFromAssignments(records)
  return sortProgramRows(records.programs.filter(program => program.status !== 'cancelled' && (!department || programConcernsDepartment(program, department, counts))).map(program => ({
    id: program.id, program, title: program.title || '', trainer: program.trainer || program.owner || '', audience: program.audience || '',
    startDate: day(program.startDate), dueDate: day(program.dueDate), state: programState(program, today), own: mine.get(String(program.id)) || null,
    participation: programParticipation(program.id, counts, department), request: latestOwnRequest(requests, program.id, own),
  })))
}

// «Εγώ»: the own training's button while it is open, «Ολοκληρώθηκε», the request waiting or rejected, or «Αίτηση
// συμμετοχής» for a programme still running or planned; nothing for a completed programme the user did not attend.
export type TrainingMeState = 'action' | 'completed' | 'pending' | 'rejected' | 'request' | null
export function trainingMeState(row: Pick<TrainingProgramRow, 'own' | 'request' | 'state'>): TrainingMeState {
  if (row.own) return row.own.status === 'completed' ? 'completed' : 'action'
  if (row.request?.status === 'pending') return 'pending'
  if (row.request?.status === 'rejected') return 'rejected'
  return row.state === 'completed' ? null : 'request'
}

// The «Κατάσταση» filter, the «Κατηγορία» filter and the search (title, trainer, audience and the labels the screen shows).
export function filterProgramRows(rows: TrainingProgramRow[], filter: TrainingProgramFilter, query = '', labelsOf: (row: TrainingProgramRow) => string[] = () => [], category = 'all') {
  const wanted: Record<TrainingProgramFilter, TrainingProgramState | null> = { current: 'in_progress', planned: 'planned', completed: 'completed', all: null }
  return rows.filter(row => (!wanted[filter] || row.state === wanted[filter]) && (category === 'all' || row.program.category === category)
    && matchesSearch(query, [row.title, row.trainer, row.audience, ...labelsOf(row)]))
}
export function programStatusCounts(rows: TrainingProgramRow[]) {
  return { current: rows.filter(row => row.state === 'in_progress').length, planned: rows.filter(row => row.state === 'planned').length, completed: rows.filter(row => row.state === 'completed').length, all: rows.length }
}

export interface TrainingProgramTiles { current: number, planned: number, nextStart: string, pending: number, requests: number, rejected: number }
// The four figures: running, planned (with the next start), still to complete in the running ones (the department's,
// or the hospital's without a department), the user's requests waiting (and the rejected ones).
export function programTiles(rows: TrainingProgramRow[], today: string, requests: TrainingParticipationRequest[] = [], own: Own | null = null): TrainingProgramTiles {
  const planned = rows.filter(row => row.state === 'planned')
  const ownRequests = own ? requests.filter(request => isOwnRequest(request, own)) : []
  return {
    current: rows.filter(row => row.state === 'in_progress').length, planned: planned.length,
    nextStart: planned.map(row => row.startDate).filter(date => date && date >= today).sort()[0] || '',
    pending: rows.filter(row => row.state === 'in_progress' && row.participation).reduce((sum, row) => sum + row.participation!.assigned - row.participation!.completed, 0),
    requests: ownRequests.filter(request => request.status === 'pending').length, rejected: ownRequests.filter(request => request.status === 'rejected').length,
  }
}

// The names (owner, 20/11/2026): only the Department Manager (and the Division Director), only for a department of
// their own, and only who has not completed the programme. Nobody else sees a name on this screen; the database keeps
// the assignments a role reads to its department anyway.
const NAME_ROLES = new Set(['department_manager', 'division_director'])
export function canSeeDepartmentNames(role: string | null | undefined, department: TrainingDepartment | null, ownDepartments: string[]) {
  if (!NAME_ROLES.has(String(role)) || !department) return false
  return ownDepartments.includes(department.id) || [department.name, department.nameEn].some(name => name && ownDepartments.includes(foldSearch(name).trim()))
}
export interface TrainingPendingPerson { id: string, name: string, status: string, dueDate: string }
export function departmentPendingPeople(records: Records, programId: string, department: TrainingDepartment, today: string): TrainingPendingPerson[] {
  return usable(records).filter(row => row.programId === programId && inTrainingDepartment({ departmentId: row.departmentId, departmentName: row.department }, department))
    .map(row => ({ id: row.id, name: row.employeeName || '', status: computedAssignmentStatus(row, new Date(`${today}T12:00:00`)), dueDate: day(row.dueDate) }))
    .filter(row => row.status !== 'completed')
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.name.localeCompare(b.name))
}
