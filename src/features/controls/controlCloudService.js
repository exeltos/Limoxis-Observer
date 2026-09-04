import { supabase } from '../../core/supabase/client'
import { calculateNextDue } from './controlScheduling'

const assertCloud=organizationId=>{
 if(!supabase)throw new Error('Supabase is not configured.')
 if(!organizationId)throw new Error('Organization is required.')
}

async function currentUserId(){
 const {data,error}=await supabase.auth.getUser()
 if(error)throw error
 const id=data?.user?.id
 if(!id)throw new Error('Authenticated user is required.')
 return id
}

const cleanResponseConfig=value=>{
 const next={...(value||{})}
 const meta=next.__meta||{}
 delete next.__meta
 return {config:next,meta}
}

function mapExecution(row){
 const response=row.response_data||{}
 return {
  id:row.id,
  at:row.performed_at,
  value:row.value_text||'',
  notes:row.notes||'',
  structuredData:response.structuredData||null,
  responseData:response,
  hasFinding:Boolean(row.has_finding),
  status:row.status,
  actorId:row.performed_by,
  by:response.actorName||row.performed_by||'',
  email:response.actorEmail||'',
  editedAt:row.edited_at||null,
  editedBy:response.editedByName||row.edited_by||'',
  editedById:row.edited_by||null,
  cancelledAt:row.cancelled_at||null,
  cancelledBy:response.cancelledByName||row.cancelled_by||'',
  cancelledById:row.cancelled_by||null,
  cancellationReason:row.cancellation_reason||'',
  previousLastCompletedAt:response.previousLastCompletedAt||null,
  previousNextDueAt:response.previousNextDueAt||null,
 }
}

function mapDefinition(row,assignments=[],executions=[],drafts=[]){
 const {config:responseConfig,meta}=cleanResponseConfig(row.response_config)
 const frequency=row.frequency_config||{kind:'daily',timesPerDay:1,times:['09:00'],interval:1}
 const activeAssignments=assignments.filter(a=>a.control_id===row.id&&a.status!=='paused')
 const assignmentMap={}
 for(const assignment of activeAssignments){
  const department=assignment.department?.name||''
  const history=executions.filter(x=>x.assignment_id===assignment.id).map(mapExecution).sort((a,b)=>new Date(b.at)-new Date(a.at))
  const draft=drafts.find(x=>x.department_id===assignment.department_id&&x.control_id===row.code)
  assignmentMap[department]={
   dbId:assignment.id,
   departmentId:assignment.department_id,
   department,
   lastCompletedAt:assignment.last_completed_at,
   nextDueAt:assignment.next_due_at,
   status:assignment.status,
   history,
   draft:draft?{...draft.payload,id:draft.id,savedAt:draft.saved_at,recordKey:draft.record_key}:null,
   hasDraft:Boolean(draft),
  }
 }
 return {
  id:row.code,
  dbId:row.id,
  organizationId:row.organization_id,
  title:row.title,
  titleEn:meta.titleEn||row.title,
  category:row.category,
  description:row.description||'',
  owner:meta.ownerLabel||'',
  ownerId:row.owner_id||null,
  responseConfig,
  frequency,
  status:row.status,
  createdByScope:meta.createdByScope||'infection_control',
  createdForDepartment:meta.createdForDepartment||null,
  createdBy:meta.createdByName||'',
  updatedBy:meta.updatedByName||'',
  createdAt:row.created_at,
  updatedAt:row.updated_at,
  departments:activeAssignments.map(a=>a.department?.name).filter(Boolean),
  assignments:assignmentMap,
 }
}

export async function loadControlProgramme(organizationId){
 assertCloud(organizationId)
 const [definitionsResult,assignmentsResult,executionsResult,draftsResult]=await Promise.all([
  supabase.from('control_definitions').select('*').eq('organization_id',organizationId).neq('status','archived').order('created_at',{ascending:false}),
  supabase.from('control_assignments').select('*,department:departments(id,name)').eq('organization_id',organizationId),
  supabase.from('control_executions').select('*').eq('organization_id',organizationId).order('performed_at',{ascending:false}),
  supabase.from('control_drafts').select('*').eq('organization_id',organizationId).order('saved_at',{ascending:false}),
 ])
 for(const result of [definitionsResult,assignmentsResult,executionsResult,draftsResult])if(result.error)throw result.error
 return (definitionsResult.data||[]).map(row=>mapDefinition(row,assignmentsResult.data||[],executionsResult.data||[],draftsResult.data||[]))
}

export async function loadControlByCode(organizationId,code){
 const rows=await loadControlProgramme(organizationId)
 return rows.find(row=>row.id===code)||null
}

async function resolveDepartments(organizationId,names=[]){
 if(!names.length)return []
 const {data,error}=await supabase.from('departments').select('id,name').eq('organization_id',organizationId).in('name',names).eq('is_active',true)
 if(error)throw error
 const rows=data||[]
 if(rows.length!==new Set(names).size)throw new Error('One or more selected departments are not available for this organization.')
 return rows
}

function controlCode(){
 const stamp=new Date().toISOString().replace(/\D/g,'').slice(2,12)
 const tail=Math.floor(Math.random()*900+100)
 return `CTRL-${stamp}-${tail}`
}

function responsePayload(draft,meta={}){
 return {
  ...(draft.responseConfig||{}),
  __meta:{
   titleEn:draft.titleEn||draft.title,
   ownerLabel:draft.owner||'',
   createdByScope:draft.createdByScope||meta.createdByScope||'infection_control',
   createdForDepartment:draft.createdForDepartment||meta.createdForDepartment||null,
   createdByName:draft.createdBy||meta.actorName||'',
   updatedByName:meta.actorName||draft.updatedBy||'',
  },
 }
}

export async function saveControlDefinition(organizationId,draft,{actorName='',createdByScope,createdForDepartment}={}){
 assertCloud(organizationId)
 const userId=await currentUserId()
 const departments=await resolveDepartments(organizationId,draft.departments||[])
 if(!departments.length)throw new Error('At least one department is required.')
 const payload={
  organization_id:organizationId,
  title:draft.title.trim(),
  category:draft.category.trim(),
  description:draft.description||null,
  owner_id:null,
  response_config:responsePayload(draft,{actorName,createdByScope,createdForDepartment}),
  frequency_config:{...(draft.frequency||{}),times:(draft.frequency?.times||[]).filter(Boolean)},
  status:draft.status||'active',
  updated_by:userId,
  updated_at:new Date().toISOString(),
 }
 let definition
 if(draft.dbId){
  const {data,error}=await supabase.from('control_definitions').update(payload).eq('organization_id',organizationId).eq('id',draft.dbId).select('*').single()
  if(error)throw error
  definition=data
 }else{
  const {data,error}=await supabase.from('control_definitions').insert({...payload,code:draft.id||controlCode(),created_by:userId}).select('*').single()
  if(error)throw error
  definition=data
 }
 const {data:existing,error:existingError}=await supabase.from('control_assignments').select('id,department_id,status,last_completed_at,next_due_at').eq('organization_id',organizationId).eq('control_id',definition.id)
 if(existingError)throw existingError
 const wantedIds=new Set(departments.map(x=>x.id))
 for(const assignment of existing||[]){
  if(!wantedIds.has(assignment.department_id)&&assignment.status!=='paused'){
   const {error}=await supabase.from('control_assignments').update({status:'paused'}).eq('organization_id',organizationId).eq('id',assignment.id)
   if(error)throw error
  }
 }
 const nextDue=calculateNextDue(draft.frequency||{},new Date())
 for(const department of departments){
  const previous=(existing||[]).find(x=>x.department_id===department.id)
  const row={control_id:definition.id,organization_id:organizationId,department_id:department.id,status:'scheduled',next_due_at:previous?.next_due_at||nextDue,last_completed_at:previous?.last_completed_at||null}
  const {error}=await supabase.from('control_assignments').upsert(row,{onConflict:'control_id,department_id'})
  if(error)throw error
 }
 return loadControlByCode(organizationId,definition.code)
}

export async function deleteControlDefinition(organizationId,record){
 assertCloud(organizationId)
 const {error}=await supabase.from('control_definitions').delete().eq('organization_id',organizationId).eq('id',record.dbId)
 if(error)throw error
 return true
}

export async function completeControlExecution(organizationId,record,department,payload={}){
 assertCloud(organizationId)
 const userId=await currentUserId()
 const assignment=record.assignments?.[department]
 if(!assignment?.dbId||!assignment?.departmentId)throw new Error('Control assignment is required.')
 const now=new Date()
 const responseData={structuredData:payload.structuredData||null,actorName:payload.actor?.name||'',actorEmail:payload.actor?.email||'',previousLastCompletedAt:assignment.lastCompletedAt||null,previousNextDueAt:assignment.nextDueAt||null}
 const {data,error}=await supabase.from('control_executions').insert({assignment_id:assignment.dbId,control_id:record.dbId,organization_id:organizationId,department_id:assignment.departmentId,status:'completed',value_text:payload.value||null,response_data:responseData,notes:payload.notes||null,has_finding:Boolean(payload.hasFinding),performed_at:now.toISOString(),performed_by:userId}).select('*').single()
 if(error)throw error
 const {error:updateError}=await supabase.from('control_assignments').update({last_completed_at:now.toISOString(),next_due_at:calculateNextDue(record.frequency||{},now),status:'scheduled'}).eq('organization_id',organizationId).eq('id',assignment.dbId)
 if(updateError)throw updateError
 await removeControlDraft(organizationId,record,department)
 return mapExecution(data)
}

export async function updateControlExecution(organizationId,record,department,execution,payload={}){
 assertCloud(organizationId)
 const assignment=record.assignments?.[department]
 if(!assignment?.dbId)throw new Error('Control assignment is required.')
 const {data:current,error:currentError}=await supabase.from('control_executions').select('id,response_data').eq('organization_id',organizationId).eq('id',execution.id).single()
 if(currentError)throw currentError
 const responseData={
  ...(current.response_data||{}),
  structuredData:payload.structuredData||null,
  editedByName:payload.actor?.name||'',
  editReason:(payload.reason||'Correction after completion').trim(),
 }
 const updatePayload={
  value_text:payload.value||null,
  response_data:responseData,
  notes:payload.notes||null,
  has_finding:Boolean(payload.hasFinding),
 }
 const {data,error}=await supabase.from('control_executions').update(updatePayload).eq('organization_id',organizationId).eq('id',execution.id).select('*').single()
 if(error)throw error
 return mapExecution(data)
}

export async function voidControlExecution(organizationId,record,department,execution,{reason='',actor}={}){
 assertCloud(organizationId)
 if(!reason.trim())throw new Error('A cancellation reason is required.')
 const userId=await currentUserId()
 const responseData={...(execution.responseData||{}),cancelledByName:actor?.name||''}
 const cancelledAt=new Date().toISOString()
 const {data,error}=await supabase.from('control_executions').update({status:'cancelled',cancelled_at:cancelledAt,cancelled_by:userId,cancellation_reason:reason.trim(),response_data:responseData}).eq('organization_id',organizationId).eq('id',execution.id).select('*').single()
 if(error)throw error
 const assignment=record.assignments?.[department]
 if(assignment?.dbId&&execution.previousNextDueAt){
  const {error:assignmentError}=await supabase.from('control_assignments').update({last_completed_at:execution.previousLastCompletedAt||null,next_due_at:execution.previousNextDueAt,status:'scheduled'}).eq('organization_id',organizationId).eq('id',assignment.dbId)
  if(assignmentError)throw assignmentError
 }
 return mapExecution(data)
}

export async function saveControlDraft(organizationId,record,department,payload){
 assertCloud(organizationId)
 const userId=await currentUserId()
 const assignment=record.assignments?.[department]
 if(!assignment?.departmentId)throw new Error('Control assignment is required.')
 const recordKey=`${record.id}.${assignment.departmentId}.${userId}`
 const row={organization_id:organizationId,record_key:recordKey,control_id:record.id,department_id:assignment.departmentId,created_by:userId,payload,saved_at:new Date().toISOString(),updated_at:new Date().toISOString()}
 const {data,error}=await supabase.from('control_drafts').upsert(row,{onConflict:'organization_id,record_key'}).select('*').single()
 if(error)throw error
 return {...payload,id:data.id,savedAt:data.saved_at,recordKey:data.record_key}
}

export async function removeControlDraft(organizationId,record,department){
 assertCloud(organizationId)
 const userId=await currentUserId()
 const assignment=record.assignments?.[department]
 if(!assignment?.departmentId)return
 const {error}=await supabase.from('control_drafts').delete().eq('organization_id',organizationId).eq('control_id',record.id).eq('department_id',assignment.departmentId).eq('created_by',userId)
 if(error)throw error
}
