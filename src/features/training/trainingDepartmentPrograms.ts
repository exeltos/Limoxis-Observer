// «Εκπαίδευση τμήματος» and the programme's read-only page (owner, 21/11/2026). Pure functions, so the screens and the
// tests agree:
// - trainingProgramPageMode: /training/<programKey> opens the editor for those who manage training, a read-only page
//   for everyone else, and the list when the programme is not there.
// - The Department Manager creates and manages «Ενδοτμηματική» training for his own department only
//   (canCreateDepartmentTraining, canManageDepartmentProgram); the database checks the same in
//   training_department_save_program / _set_participants / _cancel_program (20261231608000).
// - departmentParticipants: the department's people in a programme (names only for the Department Manager and the
//   Division Director: canSeeDepartmentNames).
import { foldSearch } from '../../core/i18n/searchMatch'
import { computedAssignmentStatus, type TrainingState } from './trainingData'
import { inTrainingDepartment, type TrainingDepartment, type TrainingPendingPerson } from './trainingMyView'
import type { TrainingAssignment, TrainingEmployee, TrainingProgram, TrainingProgramDraft } from './trainingTypes'

export const DEPARTMENT_TRAINING_KIND = 'intra_department'
export type TrainingProgramPageMode = 'editor' | 'readonly' | 'list'

export function trainingProgramPageMode({ canManage, found }: { canManage: boolean, found: boolean }): TrainingProgramPageMode {
  if (!found) return 'list'
  return canManage ? 'editor' : 'readonly'
}

// The programme's organising department: the department id it carries (a hospital), or its organiser's name (the Demo
// and the programmes of the training office, whose «Υπεύθυνος / διοργανωτής» is a department).
export function programInDepartment(program: Pick<TrainingProgram, 'organizerDepartmentId' | 'owner'>, department: TrainingDepartment | null) {
  if (!department) return false
  if (program.organizerDepartmentId && program.organizerDepartmentId === department.id) return true
  return inTrainingDepartment({ departmentName: program.owner }, department)
}

const DEPARTMENT_MANAGER = 'department_manager'
// «Νέα εκπαίδευση τμήματος»: only the Department Manager (not the training office: it has «Νέο πρόγραμμα»), with a department.
export function canCreateDepartmentTraining(role: string | null | undefined, canManageTraining: boolean, ownDepartment: TrainingDepartment | null) {
  return role === DEPARTMENT_MANAGER && !canManageTraining && Boolean(ownDepartment)
}

// Edit, participants and cancel: a department programme (created by a Department Manager) of his own department,
// while it is neither completed nor cancelled.
export function canManageDepartmentProgram(role: string | null | undefined, program: Pick<TrainingProgram, 'departmentManaged' | 'status' | 'organizerDepartmentId' | 'owner'>, ownDepartment: TrainingDepartment | null) {
  if (role !== DEPARTMENT_MANAGER || !program.departmentManaged) return false
  if (program.status === 'completed' || program.status === 'cancelled') return false
  return programInDepartment(program, ownDepartment)
}

// The form's start: the type fixed to «Ενδοτμηματική», the audience and the organiser the department, no knowledge test.
export function departmentTrainingDraft(department: TrainingDepartment, language = 'el'): TrainingProgramDraft {
  const name = language === 'en' && department.nameEn ? department.nameEn : department.name
  return { title: '', category: 'clinical', method: 'in_person', owner: department.name, trainer: '', audience: name, deliveryKind: DEPARTMENT_TRAINING_KIND, startTime: '', durationHours: '', location: '', status: 'active', startDate: '', dueDate: '', validMonths: '12', requiresAssessment: false, passScore: '', description: '' }
}
export function departmentTrainingIsValid(draft: TrainingProgramDraft | null | undefined) {
  return Boolean(draft?.title?.trim() && draft?.trainer?.trim() && draft?.dueDate && (!draft.startDate || draft.dueDate >= draft.startDate))
}

// The department's active staff, the only people the Department Manager can add.
export function departmentEmployees(employees: TrainingEmployee[], department: TrainingDepartment | null) {
  if (!department) return []
  return employees.filter(employee => (!employee.employmentStatus || String(employee.employmentStatus).toLowerCase() === 'active')
    && inTrainingDepartment({ departmentId: employee.departmentId || null, departmentName: employee.department }, department))
}

const day = (value: unknown) => String(value || '').slice(0, 10)
// The department's assignments of a programme (the cancelled left out).
export function departmentAssignments(records: Pick<TrainingState, 'assignments'>, programId: string, department: TrainingDepartment | null): TrainingAssignment[] {
  if (!department) return []
  return (records.assignments || []).filter(row => row.programId === programId && row.status !== 'cancelled'
    && inTrainingDepartment({ departmentId: row.departmentId || null, departmentName: row.department }, department))
}

export interface TrainingDepartmentPerson extends TrainingPendingPerson { assignmentId: string, started: boolean }
// Everyone of the department in the programme: who has not completed first (by deadline), then who completed.
export function departmentParticipants(records: Pick<TrainingState, 'assignments'>, programId: string, department: TrainingDepartment | null, today: string): TrainingDepartmentPerson[] {
  return departmentAssignments(records, programId, department)
    .map(row => ({ id: row.id, assignmentId: row.id, name: row.employeeName || '', status: computedAssignmentStatus(row, new Date(`${today}T12:00:00`)), dueDate: day(row.dueDate),
      started: Boolean(row.status !== 'assigned' || row.attendanceResponse === 'confirmed' || row.feedbackSubmittedAt || row.completionConfirmedAt) }))
    .sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed') || (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.name.localeCompare(b.name))
}

// The user's own department among the hospital's (as «Του τμήματός μου»): the department scope, or a hospital-wide
// role's membership department; matched by id or by name.
type MembershipView = { departmentName?: string | null, departmentNames?: unknown, departmentIds?: (string | null)[] | null } | null | undefined
export function ownDepartmentKeys(scope: { all: boolean, departments: string[] }, membership: MembershipView) {
  const names = scope.all ? [membership?.departmentName, ...(Array.isArray(membership?.departmentNames) ? membership.departmentNames as string[] : [])] : scope.departments
  return [...new Set([...names.map(name => foldSearch(name).trim()).filter(Boolean), ...(membership?.departmentIds || []).filter(Boolean).map(String)])]
}
export function findOwnDepartment(departments: TrainingDepartment[], keys: string[]) {
  return departments.find(item => keys.includes(item.id) || keys.includes(foldSearch(item.name).trim()) || Boolean(item.nameEn && keys.includes(foldSearch(item.nameEn).trim()))) || null
}
