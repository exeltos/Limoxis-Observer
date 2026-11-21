import { supabase as configuredSupabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { hospitalToday } from '../../core/dates/hospitalDate'
import { loadTrainingState,saveTrainingState,type TrainingState } from './trainingData'
import { loadTrainingStateAsync } from './trainingService'
import { departmentAssignmentPlan,employeeInDepartment,employeeKeys,planPreview } from './trainingDepartmentAssign'
import type { DepartmentAssignPreview,DepartmentAssignSelection,DepartmentRef,DepartmentTarget } from './trainingDepartmentAssign'
import type { TrainingAssignment, TrainingEmployee, TrainingProgram } from './trainingTypes'
import type { SupabaseClient } from '@supabase/supabase-js'

// «Ανάθεση σε τμήματα» (owner, 21/11/2026). In a hospital everything runs on the server: the counts before the
// confirmation (training_assign_departments_preview), the assignment (training_assign_departments) and stopping a
// followed department (training_stop_department_target), 20261231609000; the followed departments are read from
// training_program_department_targets. In the Demo the same changes go to the sample training state
// (departmentTargets), never to the database: the two are kept apart.
// The table and the RPCs are newer than the generated types: the untyped client.
const cloud=()=>{if(!hasSupabaseConfig||!configuredSupabase)throw new Error('PRODUCTION_TRAINING_CLOUD_REQUIRED:assign_departments');return configuredSupabase as unknown as SupabaseClient}
type Program = Pick<TrainingProgram,'id'|'dbId'|'dueDate'|'status'>
type TargetRow = { id: string, department_id: string|null, active: boolean, created_at: string|null }
export type DepartmentAssignResult = { employees: number, already: number, added: number, following: number }

const demoTargets=(state: TrainingState)=>(Array.isArray(state.departmentTargets)?state.departmentTargets:[]) as DepartmentTarget[]
const locked=(program: Pick<TrainingProgram,'status'>)=>program.status==='completed'||program.status==='cancelled'
const isActiveEmployee=(employee: Pick<TrainingEmployee,'employmentStatus'>)=>!employee.employmentStatus||String(employee.employmentStatus).toLowerCase()==='active'

// The demo assignment of an employee, as «Προσθήκη συμμετεχόντων» writes it.
function demoAssignment(program: Program,employee: TrainingEmployee,index: number,stamp: number,now: string): TrainingAssignment{
 return {id:`TRA-G-${stamp}-${index}-${employee.id}`,programId:program.id,employeeId:employee.employeeCode||employee.id,employeeName:`${employee.firstName||''} ${employee.lastName||''}`.trim(),department:employee.department||'',departmentId:employee.departmentId||null,email:employee.email||'',assignedDate:hospitalToday(),dueDate:program.dueDate,status:'assigned',attendanceResponse:'not_sent',attendance:null,completionConfirmedAt:null,score:null,competent:null,certificateId:null,createdAt:now} as TrainingAssignment
}

// The departments the programme follows (active only).
export async function loadDepartmentTargetsAsync(organizationId: string|null|undefined,program: Program): Promise<DepartmentTarget[]>{
 if(isDemoDataEnvironment())return demoTargets(loadTrainingState()).filter(target=>target.programId===program.id&&target.active)
 if(!organizationId||!program.dbId)return []
 const {data,error}=await cloud().from('training_program_department_targets').select('id,department_id,active,created_at').eq('organization_id',organizationId).eq('program_id',program.dbId).eq('active',true).order('created_at')
 if(error)throw error
 return ((data||[]) as TargetRow[]).map(row=>({id:row.id,programId:program.id,departmentId:row.department_id||null,active:row.active,createdAt:row.created_at||undefined}))
}

// «Θα προστεθούν N εργαζόμενοι»: in a hospital the server counts (whoever manages training may not read the staff register).
export async function previewDepartmentAssignmentAsync(organizationId: string|null|undefined,program: Program,selection: DepartmentAssignSelection,{employees,assignments,departments}: {employees: TrainingEmployee[],assignments: TrainingAssignment[],departments: DepartmentRef[]}): Promise<DepartmentAssignPreview>{
 if(isDemoDataEnvironment())return planPreview(departmentAssignmentPlan({employees,assignments,programId:program.id,departments,selection}))
 if(!organizationId)throw new Error('PRODUCTION_TRAINING_ORGANIZATION_REQUIRED:assign_departments_preview')
 const {data,error}=await cloud().rpc('training_assign_departments_preview',{p_organization_id:organizationId,p_program_key:program.id,p_department_ids:selection.all?[]:selection.departmentIds,p_all:selection.all})
 if(error)throw error
 const row=(data||{}) as Partial<DepartmentAssignPreview>
 return {employees:Number(row.employees)||0,already:Number(row.already)||0,toAdd:Number(row.toAdd)||0}
}

// The assignment: returns the saved state and the counts.
export async function assignDepartmentsAsync(organizationId: string|null|undefined,program: Program,selection: DepartmentAssignSelection,{employees,departments}: {employees: TrainingEmployee[],departments: DepartmentRef[]}): Promise<{state: TrainingState,result: DepartmentAssignResult}>{
 if(isDemoDataEnvironment()){
  if(locked(program))throw new Error('TRAINING_PROGRAM_LOCKED')
  const state=loadTrainingState(),now=new Date().toISOString(),stamp=Date.now()
  const plan=departmentAssignmentPlan({employees,assignments:state.assignments,programId:program.id,departments,selection})
  const added=plan.toAdd.map((employee,index)=>demoAssignment(program,employee,index,stamp,now))
  let targets=demoTargets(state),following=0
  if(selection.followNew){
   for(const departmentId of selection.all?[null]:selection.departmentIds){
    following+=1
    const department=departments.find(item=>item.id===departmentId),seen=[...new Set(employees.filter(employee=>isActiveEmployee(employee)&&(!department||employeeInDepartment(employee,department))).flatMap(employeeKeys))]
    const existing=targets.find(target=>target.programId===program.id&&target.departmentId===departmentId)
    targets=existing?targets.map(target=>target===existing?{...target,active:true,seen:[...new Set([...(target.seen||[]),...seen])]}:target):[...targets,{id:`TGT-${stamp}-${following}`,programId:program.id,departmentId,active:true,createdAt:now,seen}]
   }
  }
  return {state:saveTrainingState({...state,assignments:[...state.assignments,...added],departmentTargets:targets}),result:{employees:plan.employees.length,already:plan.already,added:added.length,following}}
 }
 if(!organizationId)throw new Error('PRODUCTION_TRAINING_ORGANIZATION_REQUIRED:assign_departments')
 const {data,error}=await cloud().rpc('training_assign_departments',{p_organization_id:organizationId,p_program_key:program.id,p_department_ids:selection.all?[]:selection.departmentIds,p_all:selection.all,p_follow_new:selection.followNew})
 if(error)throw error
 const row=(data||{}) as Partial<DepartmentAssignResult>
 return {state:await loadTrainingStateAsync(organizationId),result:{employees:Number(row.employees)||0,already:Number(row.already)||0,added:Number(row.added)||0,following:Number(row.following)||0}}
}

// «Διακοπή αυτόματης προσθήκης»: the departments stop being followed; the assignments already made stay.
export async function stopDepartmentTargetsAsync(organizationId: string|null|undefined,targets: DepartmentTarget[]){
 if(isDemoDataEnvironment()){const ids=new Set(targets.map(target=>target.id)),state=loadTrainingState();saveTrainingState({...state,departmentTargets:demoTargets(state).map(target=>ids.has(target.id)?{...target,active:false}:target)});return}
 if(!organizationId)throw new Error('PRODUCTION_TRAINING_ORGANIZATION_REQUIRED:stop_department_target')
 for(const target of targets){const {error}=await cloud().rpc('training_stop_department_target',{p_organization_id:organizationId,p_target_id:target.id});if(error)throw error}
}

// The Demo's counterpart of the database trigger: the active employees who joined a followed department after it was
// followed (not in its `seen`) and have no assignment of the programme get one. Returns the new state, or null when nothing changed (and always null outside the Demo).
export function syncDemoDepartmentTargets(employees: TrainingEmployee[],departments: DepartmentRef[]): TrainingState|null{
 if(!isDemoDataEnvironment())return null
 const state=loadTrainingState(),targets=demoTargets(state)
 if(!targets.some(target=>target.active)||!employees.length)return null
 const now=new Date().toISOString(),stamp=Date.now(),added: TrainingAssignment[]=[]
 let changed=false
 const nextTargets=targets.map(target=>{
  const program=state.programs.find(item=>item.id===target.programId)
  if(!target.active||!program||locked(program))return target
  const department=target.departmentId?departments.find(item=>item.id===target.departmentId):null
  if(target.departmentId&&!department)return target
  const seen=new Set(target.seen||[])
  const newcomers=employees.filter(employee=>isActiveEmployee(employee)&&(!department||employeeInDepartment(employee,department))&&!employeeKeys(employee).some(key=>seen.has(key)))
  if(!newcomers.length)return target
  const plan=departmentAssignmentPlan({employees:newcomers,assignments:[...state.assignments,...added],programId:program.id,departments,selection:{all:true,departmentIds:[]}})
  added.push(...plan.toAdd.map((employee,index)=>demoAssignment(program,employee,added.length+index,stamp,now)))
  changed=true
  return {...target,seen:[...seen,...newcomers.flatMap(employeeKeys)]}
 })
 return changed?saveTrainingState({...state,assignments:[...state.assignments,...added],departmentTargets:nextTargets}):null
}
