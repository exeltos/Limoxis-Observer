import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadTrainingState,saveTrainingState,trainingDemoState } from './trainingData'

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

const learnerOwnedAssignmentFields=['attendance','attendanceResponse','attendanceConfirmedAt','completionConfirmedAt','feedbackSubmittedAt','assessmentSubmittedAt','score','competent','certificateId','feedbackScores','feedbackComment','completedDate','accessToken','invitationSentAt']

async function resolveAssignmentIdentity(organizationId,assignment){
  if(assignment?.userId)return {userId:assignment.userId,departmentId:assignment.departmentId||null,email:assignment.email||null,accountLinked:true}
  const employeeCode=String(assignment?.employeeId||'').trim()
  if(!employeeCode)return {userId:null,departmentId:assignment?.departmentId||null,email:assignment?.email||null,accountLinked:false}
  const {data,error}=await supabase.from('employees').select('id,user_id,department_id,email,employee_code').eq('organization_id',organizationId).eq('employee_code',employeeCode).maybeSingle()
  if(error)throw error
  return {userId:data?.user_id||null,departmentId:data?.department_id||assignment?.departmentId||null,email:data?.email||assignment?.email||null,accountLinked:Boolean(data?.user_id)}
}

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
  for(const assignment of assignments){
    const identity=await resolveAssignmentIdentity(organizationId,assignment)
    const linkedAssignment={...assignment,userId:identity.userId,email:identity.email||assignment.email||null,accountLinked:identity.accountLinked}
    await upsertRecord(organizationId,'assignment',linkedAssignment,{departmentId:identity.departmentId,employeeUserId:identity.userId})
  }
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

export function demoTrainingState(){return structuredClone(trainingDemoState)}