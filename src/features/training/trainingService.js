import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { findTrainingAccess,loadTrainingState,saveTrainingState,trainingDemoState } from './trainingData'

function requireProduction(organizationId,operation){
  if(isDemoDataEnvironment())return false
  if(!hasSupabaseConfig||!supabase)throw new Error(`PRODUCTION_TRAINING_CLOUD_REQUIRED:${operation}`)
  if(!organizationId)throw new Error(`PRODUCTION_TRAINING_ORGANIZATION_REQUIRED:${operation}`)
  return true
}

function emptyState(){return {programs:[],assignments:[],certificates:[],emailOutbox:[],history:[]}}

function normalizeRows(rows=[]){
  const state=emptyState()
  for(const row of rows){
    const payload={...(row.payload||{}),id:row.record_key,dbId:row.id,departmentId:row.department_id||row.payload?.departmentId||null,userId:row.employee_user_id||row.payload?.userId||null}
    if(row.record_type==='program')state.programs.push(payload)
    else if(row.record_type==='assignment')state.assignments.push(payload)
    else if(row.record_type==='certificate')state.certificates.push(payload)
    else if(row.record_type==='history_snapshot')state.history=Array.isArray(payload.items)?payload.items:[]
  }
  return state
}

export async function loadTrainingStateAsync(organizationId){
  if(isDemoDataEnvironment())return loadTrainingState()
  requireProduction(organizationId,'load')
  const {data,error}=await supabase.from('training_records').select('id,record_key,record_type,department_id,employee_user_id,payload,created_at,updated_at').eq('organization_id',organizationId).order('updated_at',{ascending:false})
  if(error)throw error
  return normalizeRows(data||[])
}

export async function loadTrainingAccessAsync(organizationId,userId,token){
  if(isDemoDataEnvironment()){
    const state=loadTrainingState();const access=findTrainingAccess(state,token)
    return access?{state,access,assignment:null}:null
  }
  requireProduction(organizationId,'access.load')
  if(!userId||!token)return null
  const {data:programRow,error:programError}=await supabase.from('training_records').select('id,record_key,payload').eq('organization_id',organizationId).eq('record_type','program').or(`payload->>checkInToken.eq.${token},payload->>completionToken.eq.${token}`).maybeSingle()
  if(programError)throw programError
  if(!programRow)return null
  const program={...(programRow.payload||{}),id:programRow.record_key,dbId:programRow.id}
  const mode=program.checkInToken===token?'checkin':program.completionToken===token?'complete':null
  if(!mode)return null
  const {data:assignmentRow,error:assignmentError}=await supabase.from('training_records').select('id,record_key,department_id,employee_user_id,payload').eq('organization_id',organizationId).eq('record_type','assignment').eq('employee_user_id',userId).eq('payload->>programId',programRow.record_key).maybeSingle()
  if(assignmentError)throw assignmentError
  if(!assignmentRow)return {access:{program,mode},assignment:null}
  return {access:{program,mode},assignment:{...(assignmentRow.payload||{}),id:assignmentRow.record_key,dbId:assignmentRow.id,departmentId:assignmentRow.department_id||null,userId:assignmentRow.employee_user_id||null}}
}

const learnerOwnedAssignmentFields=['attendance','attendanceResponse','checkInAt','completionConfirmedAt','feedbackSubmittedAt','assessmentSubmittedAt','score','competent','certificateId','feedbackScores','feedbackComment','completedDate']

async function upsertRecord(organizationId,recordType,payload,{departmentId=null,employeeUserId=null}={}){
  const recordKey=payload?.id
  if(!recordKey)throw new Error('TRAINING_RECORD_KEY_REQUIRED')
  const cleanPayload={...payload};delete cleanPayload.dbId
  const {data:existing,error:existingError}=await supabase.from('training_records').select('payload,department_id,employee_user_id').eq('organization_id',organizationId).eq('record_key',recordKey).maybeSingle()
  if(existingError)throw existingError
  if(recordType==='program'&&Array.isArray(existing?.payload?.feedbackResponses))cleanPayload.feedbackResponses=existing.payload.feedbackResponses
  if(recordType==='assignment'&&existing?.payload){
    for(const key of learnerOwnedAssignmentFields){if(Object.prototype.hasOwnProperty.call(existing.payload,key))cleanPayload[key]=existing.payload[key]}
    if(existing.payload.status==='completed'||existing.payload.status==='in_progress')cleanPayload.status=existing.payload.status
  }
  const row={organization_id:organizationId,record_key:recordKey,record_type:recordType,department_id:departmentId||payload.departmentId||existing?.department_id||null,employee_user_id:employeeUserId||payload.userId||existing?.employee_user_id||null,payload:cleanPayload,updated_at:new Date().toISOString()}
  const {data,error}=await supabase.from('training_records').upsert(row,{onConflict:'organization_id,record_key'}).select('id,record_key,record_type,department_id,employee_user_id,payload').single()
  if(error)throw error
  return data
}

export async function saveManagedTrainingStateAsync(organizationId,state){
  if(isDemoDataEnvironment())return saveTrainingState(state)
  requireProduction(organizationId,'save')
  const programs=state?.programs||[],assignments=state?.assignments||[],certificates=state?.certificates||[]
  for(const program of programs)await upsertRecord(organizationId,'program',program)
  for(const assignment of assignments)await upsertRecord(organizationId,'assignment',assignment,{departmentId:assignment.departmentId||null,employeeUserId:assignment.userId||null})
  for(const certificate of certificates)await upsertRecord(organizationId,'certificate',certificate,{departmentId:certificate.departmentId||null,employeeUserId:certificate.userId||null})
  await upsertRecord(organizationId,'history_snapshot',{id:'training-history',items:state?.history||[]})
  return loadTrainingStateAsync(organizationId)
}

export async function deleteTrainingRecordAsync(organizationId,recordKey){
  if(isDemoDataEnvironment())return true
  requireProduction(organizationId,'delete')
  const {error}=await supabase.from('training_records').delete().eq('organization_id',organizationId).eq('record_key',recordKey)
  if(error)throw error
  return true
}

export async function trainingCheckInAsync(token){
  if(isDemoDataEnvironment())throw new Error('DEMO_TRAINING_CHECKIN_LOCAL_ONLY')
  if(!hasSupabaseConfig||!supabase)throw new Error('PRODUCTION_TRAINING_CLOUD_REQUIRED:checkin')
  const {data,error}=await supabase.rpc('training_check_in',{p_token:token})
  if(error)throw error
  return data
}

export async function trainingCompleteAsync(token,{answers={},feedbackScores={},feedbackComment=''}={}){
  if(isDemoDataEnvironment())throw new Error('DEMO_TRAINING_COMPLETION_LOCAL_ONLY')
  if(!hasSupabaseConfig||!supabase)throw new Error('PRODUCTION_TRAINING_CLOUD_REQUIRED:completion')
  const {data,error}=await supabase.rpc('training_complete',{p_token:token,p_answers:answers,p_feedback_scores:feedbackScores,p_feedback_comment:feedbackComment||null})
  if(error)throw error
  return data
}

export function demoTrainingState(){return structuredClone(trainingDemoState)}
