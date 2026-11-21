import { supabase as configuredSupabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { hospitalToday } from '../../core/dates/hospitalDate'
import { DEMO_SELF_EMPLOYEE_ID } from '../employees/employeeIdentity'
import { employeeRows } from '../employees/employeeDemoData'
import { loadTrainingState,saveTrainingState,type TrainingState } from './trainingData'
import type { TrainingParticipation,TrainingParticipationRequest,TrainingRequestStatus } from './trainingMyView'
import type { TrainingAssignment, TrainingProgram } from './trainingTypes'
import type { SupabaseClient } from '@supabase/supabase-js'

// Participation requests (owner, 20/11/2026): a user asks to attend a programme, the training managers accept (the
// assignment is created) or reject it with a reason. In a hospital: the table training_participation_requests (each
// user reads their own, manage_training all of the hospital) written only by the RPCs training_request_participation /
// training_decide_participation / training_cancel_participation_request (20261231606000). In the Demo the requests live
// in the sample training state (participationRequests), never in the database: the two are kept apart.
// The table and the RPCs are newer than the generated types: the untyped client.
const cloud=()=>{if(!hasSupabaseConfig||!configuredSupabase)throw new Error('PRODUCTION_TRAINING_CLOUD_REQUIRED:requests');return configuredSupabase as unknown as SupabaseClient}
const REQUEST_SELECT='id,program_id,requester_user_id,employee_id,requester_name,department_id,department_name,note,status,decision_reason,decided_at,created_at,assignment_id,training_programs(program_key,title)'
type RequestRow = { id: string, program_id: string, requester_user_id: string|null, employee_id: string|null, requester_name: string|null, department_id: string|null, department_name: string|null, note: string|null, status: string, decision_reason: string|null, decided_at: string|null, created_at: string|null, assignment_id: string|null, training_programs?: { program_key?: string, title?: string }|{ program_key?: string, title?: string }[]|null }

export function requestFromRow(row: RequestRow): TrainingParticipationRequest{
 const program=Array.isArray(row.training_programs)?row.training_programs[0]:row.training_programs
 return {id:row.id,programId:program?.program_key||row.program_id,programTitle:program?.title||'',requesterUserId:row.requester_user_id||null,employeeId:row.employee_id||null,requesterName:row.requester_name||'',department:row.department_name||'',departmentId:row.department_id||null,note:row.note||'',status:(row.status||'pending') as TrainingRequestStatus,decisionReason:row.decision_reason||'',decidedAt:row.decided_at||'',createdAt:row.created_at||'',assignmentId:row.assignment_id||null}
}

const demoRequests=(state: TrainingState)=>(Array.isArray(state.participationRequests)?state.participationRequests:[]) as TrainingParticipationRequest[]

// The requests the user may read: their own, or the hospital's for the training managers (the database decides).
export async function loadTrainingRequestsAsync(organizationId: string|null|undefined): Promise<TrainingParticipationRequest[]>{
 if(isDemoDataEnvironment())return demoRequests(loadTrainingState())
 if(!organizationId)return []
 // Every page (1,000 rows each), so an old pending request is never cut off.
 const rows: RequestRow[]=[]
 for(let from=0;;from+=1000){
  const {data,error}=await cloud().from('training_participation_requests').select(REQUEST_SELECT).eq('organization_id',organizationId).order('created_at',{ascending:false}).order('id').range(from,from+999)
  if(error)throw error
  rows.push(...((data||[]) as RequestRow[]))
  if(!data||data.length<1000)break
 }
 return rows.map(requestFromRow)
}

// «Συμμετοχή τμήματος»: only numbers per programme and department, for every department (no names). The Demo counts
// its own assignments (null here).
export async function loadTrainingParticipationAsync(organizationId: string|null|undefined): Promise<TrainingParticipation[]|null>{
 if(isDemoDataEnvironment()||!organizationId)return null
 const {data,error}=await cloud().rpc('training_program_participation',{p_organization_id:organizationId})
 if(error)throw error
 return ((data||[]) as {program_key: string,department_id: string|null,department_name: string|null,assigned: number,completed: number}[]).map(row=>({programId:row.program_key,departmentId:row.department_id||null,departmentName:row.department_name||'',assigned:Number(row.assigned)||0,completed:Number(row.completed)||0}))
}

// «Διοργάνωση»: the organising department of each programme, resolved in the database (organizer_department_id, else the
// department of the employee named as organiser), so it never depends on which employees the user may read. The Demo
// resolves it from its own sample data (null here).
export async function loadTrainingOrganizersAsync(organizationId: string|null|undefined): Promise<Map<string, string>|null>{
 if(isDemoDataEnvironment()||!organizationId)return null
 const {data,error}=await cloud().rpc('training_program_organizers',{p_organization_id:organizationId})
 if(error)throw error
 return new Map(((data||[]) as {program_key: string,department_name: string|null}[]).filter(row=>row.department_name).map(row=>[row.program_key,String(row.department_name)]))
}

// The user's request for a programme (the Demo's own employee asks in the sample data).
export async function requestTrainingParticipationAsync(organizationId: string|null|undefined,program: Pick<TrainingProgram,'id'|'title'>,note=''): Promise<TrainingParticipationRequest[]>{
 if(isDemoDataEnvironment()){
  const state=loadTrainingState(),employee=employeeRows.find(row=>row.id===DEMO_SELF_EMPLOYEE_ID)
  const request: TrainingParticipationRequest={id:`REQ-${Date.now()}`,programId:program.id,programTitle:program.title||'',requesterUserId:null,employeeId:DEMO_SELF_EMPLOYEE_ID,requesterName:employee?`${employee.firstName} ${employee.lastName}`:'',department:String(employee?.department||''),departmentId:null,note:note.trim(),status:'pending',decisionReason:'',decidedAt:'',createdAt:new Date().toISOString(),assignmentId:null}
  return demoRequests(saveTrainingState({...state,participationRequests:[request,...demoRequests(state)]}))
 }
 if(!organizationId)throw new Error('PRODUCTION_TRAINING_ORGANIZATION_REQUIRED:request')
 const {error}=await cloud().rpc('training_request_participation',{p_organization_id:organizationId,p_program_key:program.id,p_note:note.trim()||null})
 if(error)throw error
 return loadTrainingRequestsAsync(organizationId)
}

// The Demo's acceptance: the assignment as a manager adds a participant (TrainingProductionPage addParticipants).
function demoAccept(state: TrainingState,request: TrainingParticipationRequest): TrainingState{
 const program=state.programs.find(item=>item.id===request.programId),employee=employeeRows.find(row=>row.id===request.employeeId)
 const today=hospitalToday(),id=`TRA-REQ-${request.id}`
 const exists=state.assignments.some(row=>row.programId===request.programId&&row.status!=='cancelled'&&request.employeeId&&row.employeeId===request.employeeId)
 const assignment={id,programId:request.programId,employeeId:request.employeeId||'',employeeName:request.requesterName,department:request.department,departmentId:request.departmentId,email:employee?.email||'',assignedDate:today,dueDate:program?.dueDate||'',status:'assigned',attendanceResponse:'not_sent',attendance:null,completionConfirmedAt:null,score:null,competent:null,certificateId:null,createdAt:new Date().toISOString()} as unknown as TrainingAssignment
 return {...state,assignments:exists?state.assignments:[assignment,...state.assignments]}
}

// A training manager's decision: accept (the assignment is created) or reject with a reason.
export async function decideTrainingRequestAsync(organizationId: string|null|undefined,request: TrainingParticipationRequest,accept: boolean,reason=''): Promise<TrainingParticipationRequest[]>{
 if(isDemoDataEnvironment()){
  const state=loadTrainingState(),decidedAt=new Date().toISOString()
  const next=accept?demoAccept(state,request):state
  return demoRequests(saveTrainingState({...next,participationRequests:demoRequests(state).map(item=>item.id===request.id?{...item,status:accept?'accepted':'rejected',decisionReason:reason.trim(),decidedAt,assignmentId:accept?`TRA-REQ-${request.id}`:null}:item)}))
 }
 if(!organizationId)throw new Error('PRODUCTION_TRAINING_ORGANIZATION_REQUIRED:decide')
 const {error}=await cloud().rpc('training_decide_participation',{p_request_id:request.id,p_accept:accept,p_reason:reason.trim()||null})
 if(error)throw error
 return loadTrainingRequestsAsync(organizationId)
}

// The requester withdraws their own request while it waits.
export async function cancelTrainingRequestAsync(organizationId: string|null|undefined,requestId: string): Promise<TrainingParticipationRequest[]>{
 if(isDemoDataEnvironment()){
  const state=loadTrainingState()
  return demoRequests(saveTrainingState({...state,participationRequests:demoRequests(state).map(item=>item.id===requestId&&item.status==='pending'?{...item,status:'cancelled',decidedAt:new Date().toISOString()}:item)}))
 }
 if(!organizationId)throw new Error('PRODUCTION_TRAINING_ORGANIZATION_REQUIRED:cancel')
 const {error}=await cloud().rpc('training_cancel_participation_request',{p_request_id:requestId})
 if(error)throw error
 return loadTrainingRequestsAsync(organizationId)
}

// «Αιτήσεις συμμετοχής σε εκπαίδευση» on the administrator's home: how many wait for a decision (one count, no rows).
// The Demo counts its sample requests; a hospital reads the table (manage_training reads all of the hospital's).
export async function countPendingTrainingRequestsAsync(organizationId: string|null|undefined): Promise<number|null>{
 if(isDemoDataEnvironment())return demoRequests(loadTrainingState()).filter(request=>request.status==='pending').length
 if(!organizationId||!hasSupabaseConfig||!configuredSupabase)return null
 const {count,error}=await cloud().from('training_participation_requests').select('id',{count:'exact',head:true}).eq('organization_id',organizationId).eq('status','pending')
 return error||count==null?null:Number(count)
}
