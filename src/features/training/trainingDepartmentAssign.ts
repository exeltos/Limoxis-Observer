import type { TrainingAssignment, TrainingEmployee } from './trainingTypes'

// «Ανάθεση σε τμήματα» (owner, 21/11/2026): the training office assigns a programme to one or more departments, or to
// the whole hospital. Every ACTIVE employee of those departments becomes a participant; whoever already participates
// is not added twice. With «Και όσοι προστεθούν αργότερα στα τμήματα» the departments are followed: people added to
// them later are added too (the database trigger in a hospital, syncDemoDepartmentTargets in the Demo).

export type DepartmentRef = { id?: string, name?: string, nameEn?: string }
export type DepartmentAssignSelection = { all: boolean, departmentIds: string[], followNew: boolean }
// A department (or the whole hospital: departmentId null) a programme follows. `seen` (Demo only): the active employees
// of the department the Demo already knew of, so only people added later are added (as the database trigger does).
export type DepartmentTarget = { id: string, programId?: string, departmentId: string|null, active: boolean, createdAt?: string, seen?: string[] }
export type DepartmentAssignPreview = { employees: number, already: number, toAdd: number }

const isActive=(employee: Pick<TrainingEmployee,'employmentStatus'>)=>!employee.employmentStatus||String(employee.employmentStatus).toLowerCase()==='active'
// The department of an employee: by id in a hospital, by name in the Demo (its departments are named only).
export const employeeInDepartment=(employee: Pick<TrainingEmployee,'departmentId'|'department'>,department: DepartmentRef)=>Boolean((department.id&&employee.departmentId&&employee.departmentId===department.id)||(department.name&&employee.department===department.name))
// The keys an assignment may carry for an employee (the code, or the database id).
export const employeeKeys=(employee: TrainingEmployee)=>[employee.employeeCode,employee.id,employee.dbId].filter(Boolean).map(String)

// Whoever already participates: an assignment of the programme that is not cancelled.
export function participatingKeys(assignments: TrainingAssignment[],programId: string){
 const keys=new Set<string>()
 for(const row of assignments){
  if(row.programId!==programId||row.status==='cancelled')continue
  if(row.employeeId)keys.add(String(row.employeeId))
  if(row.employeeDbId)keys.add(String(row.employeeDbId))
 }
 return keys
}

// The plan: the active employees of the chosen departments, who of them will be added, and how many participate already.
export function departmentAssignmentPlan({employees,assignments,programId,departments,selection}: {employees: TrainingEmployee[],assignments: TrainingAssignment[],programId: string,departments: DepartmentRef[],selection: Pick<DepartmentAssignSelection,'all'|'departmentIds'>}){
 const chosen=selection.all?[]:departments.filter(department=>department.id&&selection.departmentIds.includes(department.id))
 const seen=new Set<string>()
 const inScope=employees.filter(employee=>{
  if(!isActive(employee))return false
  if(!selection.all&&!chosen.some(department=>employeeInDepartment(employee,department)))return false
  const key=String(employee.dbId||employee.employeeCode||employee.id||'')
  if(!key||seen.has(key))return false
  seen.add(key);return true
 })
 const present=participatingKeys(assignments,programId)
 const toAdd=inScope.filter(employee=>!employeeKeys(employee).some(key=>present.has(key)))
 return {employees:inScope,toAdd,already:inScope.length-toAdd.length}
}

export const planPreview=(plan: ReturnType<typeof departmentAssignmentPlan>): DepartmentAssignPreview=>({employees:plan.employees.length,already:plan.already,toAdd:plan.toAdd.length})

const departmentLabel=(department: DepartmentRef|undefined,en: boolean)=>(en?department?.nameEn||department?.name:department?.name)||''
export function selectedDepartmentNames(selection: Pick<DepartmentAssignSelection,'all'|'departmentIds'>,departments: DepartmentRef[],en: boolean){
 if(selection.all)return en?'the whole hospital':'όλο το νοσοκομείο'
 return selection.departmentIds.map(id=>departmentLabel(departments.find(department=>department.id===id),en)).filter(Boolean).join(', ')
}

// «Θα προστεθούν 12 εργαζόμενοι από ΜΕΘ, ΤΕΠ» / «12 employees from ICU, ED will be added».
export function departmentAssignmentMessage(count: number,selection: Pick<DepartmentAssignSelection,'all'|'departmentIds'>,departments: DepartmentRef[],en: boolean){
 const names=selectedDepartmentNames(selection,departments,en)
 if(en)return `${count} ${count===1?'employee':'employees'} from ${names} will be added`
 return `${count===1?'Θα προστεθεί':'Θα προστεθούν'} ${count} ${count===1?'εργαζόμενος':'εργαζόμενοι'} από ${names}`
}

// «Ανατέθηκε σε: ΜΕΘ, ΤΕΠ · και οι νέοι εργαζόμενοι» for the active targets of a programme (empty when none).
export function departmentTargetsText(targets: DepartmentTarget[],departments: DepartmentRef[],en: boolean){
 const active=targets.filter(target=>target.active)
 if(!active.length)return ''
 const names=active.some(target=>!target.departmentId)?(en?'Whole hospital':'Όλο το νοσοκομείο'):active.map(target=>departmentLabel(departments.find(department=>department.id===target.departmentId),en)||'—').join(', ')
 return en?`Assigned to: ${names} · and new employees`:`Ανατέθηκε σε: ${names} · και οι νέοι εργαζόμενοι`
}
