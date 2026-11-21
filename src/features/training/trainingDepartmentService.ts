import { supabase as configuredSupabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { hospitalToday } from '../../core/dates/hospitalDate'
import { DEFAULT_TRAINER_FEEDBACK_TEMPLATE,normalizeTrainerFeedbackTemplate } from './trainingFeedbackTemplate'
import { loadTrainingState,saveTrainingState,type TrainingState } from './trainingData'
import { DEPARTMENT_TRAINING_KIND } from './trainingDepartmentPrograms'
import { loadTrainingStateAsync } from './trainingService'
import type { TrainingDepartment } from './trainingMyView'
import type { TrainingAssignment, TrainingEmployee, TrainingProgram, TrainingProgramDraft } from './trainingTypes'
import type { SupabaseClient } from '@supabase/supabase-js'

// «Εκπαίδευση τμήματος» (owner, 21/11/2026): the Department Manager's own department trainings. In a hospital every
// write goes through the RPCs training_department_save_program / training_department_set_participants /
// training_department_cancel_program (20261231608000), which check the role, the department and its employees. In the
// Demo the same changes go to the sample training state, never to the database: the two are kept apart.
// The RPCs are newer than the generated types: the untyped client.
const cloud=()=>{if(!hasSupabaseConfig||!configuredSupabase)throw new Error('PRODUCTION_TRAINING_CLOUD_REQUIRED:department');return configuredSupabase as unknown as SupabaseClient}
const numberOrNull=(value: unknown)=>value===''||value==null||!(Number(value)>0)?null:Number(value)

// The programme as the department sends it: the type, the organiser and the audience follow the department; no test.
function departmentProgram(draft: TrainingProgramDraft,department: TrainingDepartment,key: string,existing: TrainingProgram|null): TrainingProgram{
 const now=new Date().toISOString(),today=hospitalToday()
 const editing=Boolean(existing||draft.id),status=editing&&(draft.status==='planned'||draft.status==='active'||draft.status==='completed')?draft.status:(draft.startDate&&draft.startDate>today?'planned':'active')
 return {...(existing||{materials:[],assessmentQuestions:[],feedbackResponses:[],trainerFeedbackTemplate:normalizeTrainerFeedbackTemplate(DEFAULT_TRAINER_FEEDBACK_TEMPLATE),createdAt:now}),
  id:key,title:String(draft.title||'').trim(),category:draft.category||'clinical',method:draft.method||'in_person',owner:department.name,trainer:String(draft.trainer||'').trim(),
  audience:String(draft.audience||'').trim()||department.name,description:draft.description||'',startDate:draft.startDate||'',startTime:draft.startTime||'',dueDate:draft.dueDate||'',
  durationHours:numberOrNull(draft.durationHours),location:draft.location||'',validMonths:numberOrNull(draft.validMonths),requiresAssessment:false,passScore:null,status,
  deliveryKind:DEPARTMENT_TRAINING_KIND,organizerDepartmentId:department.id,departmentManaged:true,departmentId:existing?.departmentId??null,updatedAt:now} as TrainingProgram
}

// New or changed: returns the saved state and the programme's key.
export async function saveDepartmentTrainingAsync(organizationId: string|null|undefined,draft: TrainingProgramDraft,department: TrainingDepartment): Promise<{state: TrainingState,key: string}>{
 if(isDemoDataEnvironment()){
  const state=loadTrainingState(),existing=draft.id?state.programs.find(program=>program.id===draft.id)||null:null
  if(existing&&(!existing.departmentManaged||existing.status==='completed'||existing.status==='cancelled'))throw new Error('TRAINING_PROGRAM_LOCKED')
  const key=existing?.id||`TRN-D-${Date.now()}`,program=departmentProgram(draft,department,key,existing)
  const assignments=existing?state.assignments.map(row=>row.programId===key&&row.status==='assigned'?{...row,dueDate:program.dueDate}:row):state.assignments
  return {state:saveTrainingState({...state,programs:existing?state.programs.map(item=>item.id===key?program:item):[program,...state.programs],assignments}),key}
 }
 if(!organizationId)throw new Error('PRODUCTION_TRAINING_ORGANIZATION_REQUIRED:department_save')
 const key=draft.id||`TRN-D-${Date.now()}`,program=departmentProgram(draft,department,key,null)
 const {error}=await cloud().rpc('training_department_save_program',{p_organization_id:organizationId,p_program:{...program,organizerDepartmentId:department.id}})
 if(error)throw error
 return {state:await loadTrainingStateAsync(organizationId),key}
}

// The participants: `keep` are the department's current assignments that stay, `add` the employees chosen now. Whoever
// of the department is left out and has not started is cancelled (the database does the same).
export async function setDepartmentTrainingParticipantsAsync(organizationId: string|null|undefined,program: Pick<TrainingProgram,'id'|'dueDate'>,department: TrainingDepartment,keep: TrainingAssignment[],add: TrainingEmployee[]): Promise<TrainingState>{
 if(isDemoDataEnvironment()){
  const state=loadTrainingState(),now=new Date().toISOString(),stamp=Date.now(),kept=new Set(keep.map(row=>row.id))
  const started=(row: TrainingAssignment)=>row.status!=='assigned'||row.attendanceResponse==='confirmed'||Boolean(row.feedbackSubmittedAt||row.completionConfirmedAt)
  const inDepartment=(row: TrainingAssignment)=>row.departmentId===department.id||row.department===department.name
  const assignments=state.assignments.map(row=>row.programId===program.id&&inDepartment(row)&&row.status==='assigned'&&!kept.has(row.id)&&!started(row)?{...row,status:'cancelled'}:row)
  const present=new Set(assignments.filter(row=>row.programId===program.id&&row.status!=='cancelled').map(row=>String(row.employeeId)))
  const added=add.filter(employee=>!present.has(String(employee.id))).map((employee,index): TrainingAssignment=>({id:`TRA-${stamp}-${index}-${employee.id}`,programId:program.id,employeeId:employee.employeeCode||employee.id,employeeName:`${employee.firstName||''} ${employee.lastName||''}`.trim(),department:employee.department||department.name,departmentId:employee.departmentId||null,email:employee.email||'',accountLinked:true,assignedDate:hospitalToday(),dueDate:program.dueDate,status:'assigned',attendanceResponse:'not_sent',attendance:null,completionConfirmedAt:null,score:null,competent:null,certificateId:null,createdAt:now}))
  return saveTrainingState({...state,assignments:[...assignments,...added]})
 }
 if(!organizationId)throw new Error('PRODUCTION_TRAINING_ORGANIZATION_REQUIRED:department_participants')
 const ids=[...new Set([...keep.map(row=>row.employeeDbId),...add.map(employee=>employee.dbId)].filter(Boolean))] as string[]
 const {error}=await cloud().rpc('training_department_set_participants',{p_organization_id:organizationId,p_program_key:program.id,p_employee_ids:ids})
 if(error)throw error
 return loadTrainingStateAsync(organizationId)
}

// «Ακύρωση προγράμματος»: the programme is marked cancelled; its participants and results are kept.
export async function cancelDepartmentTrainingAsync(organizationId: string|null|undefined,programKey: string): Promise<TrainingState>{
 if(isDemoDataEnvironment()){const state=loadTrainingState();return saveTrainingState({...state,programs:state.programs.map(program=>program.id===programKey?{...program,status:'cancelled'}:program)})}
 if(!organizationId)throw new Error('PRODUCTION_TRAINING_ORGANIZATION_REQUIRED:department_cancel')
 const {error}=await cloud().rpc('training_department_cancel_program',{p_organization_id:organizationId,p_program_key:programKey})
 if(error)throw error
 return loadTrainingStateAsync(organizationId)
}
