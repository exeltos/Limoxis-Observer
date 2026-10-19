import { supabase } from '../../core/supabase/client'
import { firstDue,nextDueAfterExecution,periodBounds,periodProgress } from './controlDueRules'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { deleteAttachment,uploadAttachment } from '../../core/attachments/attachmentService'
import { evidenceSummary } from './controlCriticality'
import { loadControlDefinitionsLocal,saveControlDefinitionsLocal,loadControlAssignmentsLocal,saveControlAssignmentsLocal,loadControlExecutionsLocal,saveControlExecutionsLocal,loadControlDraftsLocal,saveControlDraftsLocal } from './controlStore'
import { assertCloud, currentUserId } from '../../core/supabase/cloudContext'

const demoId=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
const demoResolveDepartments=(names=[])=>(names||[]).filter(Boolean).map(name=>({id:name,name}))

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
  assignmentId:row.assignment_id||null,
  at:row.performed_at,
  value:row.value_text||'',
  resultText:row.result_text||'',
  checkedPoints:row.checked_points||'',
  notes:row.notes||'',
  structuredData:response.structuredData||null,
  evidence:Array.isArray(response.evidence)?response.evidence:[],
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
  // An extra entry («Έκτακτη καταχώρηση»): recorded with its reason, never counted.
  isExtra:Boolean(row.is_extra),
  extraReason:row.extra_reason||'',
  previousLastCompletedAt:response.previousLastCompletedAt||null,
  previousNextDueAt:response.previousNextDueAt||null,
 }
}

const startOfToday=()=>{const d=new Date();d.setHours(0,0,0,0);return d}

// What the registry shows of an assignment's executions without reading them:
// how many there are, how many today, findings and the latest one. In the cloud
// the database counts them (control_assignment_summary); the demo counts its
// local rows the same way.
export function summarizeHistory(history=[],todayFrom=startOfToday()){
 const valid=history.filter(h=>h.status!=='cancelled')
 return {
  executions:valid.length,
  today:valid.filter(h=>h.at&&new Date(h.at)>=todayFrom).length,
  findings:valid.filter(h=>h.hasFinding).length,
  lastPerformedAt:valid.map(h=>h.at).filter(Boolean).sort().pop()||null,
 }
}
const EMPTY_SUMMARY={executions:0,today:0,findings:0,lastPerformedAt:null}

function mapDefinition(row,assignments=[],executions=[],drafts=[],summaries=null,progress=null){
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
   createdAt:assignment.created_at||null,
   lastCompletedAt:assignment.last_completed_at,
   nextDueAt:assignment.next_due_at,
   status:assignment.status,
   // Only the executions this view asked for (recent ones, the expiry lists,
   // findings); counts come from summary.
   history,
   summary:summaries?(summaries.get(assignment.id)||EMPTY_SUMMARY):summarizeHistory(history),
   // The current period counted by the database (control_period_progress).
   progress:progress?.get(assignment.id)||null,
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
  goal:row.goal||'',
  acceptanceCriteria:row.acceptance_criteria||'',
  guideNotes:row.guide_notes||'',
  owner:meta.ownerLabel||'',
  ownerId:row.owner_id||null,
  ownerPerson:meta.ownerPerson||null,
  assignees:meta.assignees||{},
  location:meta.location||'',
  equipment:meta.equipment||'',
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
  // Department-scoped roles are checked by department id (roleUxPolicy).
  departmentIdByName:Object.fromEntries(activeAssignments.filter(a=>a.department?.name).map(a=>[a.department.name,a.department_id||a.department?.id||null])),
  assignments:assignmentMap,
 }
}

const ROW_PAGE=1000
// A filtered read of executions, page by page, so it never stops at the API's
// row cap. Callers always narrow it (an assignment, a period, findings, the
// expiry lists); nothing reads an organisation's whole history.
async function readExecutionPages(build){
 const rows=[]
 for(let from=0;;from+=ROW_PAGE){
  const {data,error}=await build().order('performed_at',{ascending:false}).order('id',{ascending:false}).range(from,from+ROW_PAGE-1)
  if(error)throw error
  rows.push(...(data||[]))
  if(!data||data.length<ROW_PAGE)return rows
 }
}
const RECENT_PER_ASSIGNMENT=50
const isExpiryDefinition=row=>row?.response_config?.mode==='list'&&row?.response_config?.template==='medication_expiry'

// The programme: definitions, assignments, drafts and per-assignment counts.
// Options: code (one control, with its recent executions for the entry form),
// findingsSince (executions with a finding since that date, for the CAPA queue),
// summary:false (definitions only). Expiry controls always bring the entries
// that carry their item lists.
export async function loadControlProgramme(organizationId,{code=null,findingsSince=null,summary=true}={}){
 if(isDemoDataEnvironment()){
  const definitions=loadControlDefinitionsLocal().filter(row=>!code||row.code===code)
  const assignments=loadControlAssignmentsLocal()
  const executions=loadControlExecutionsLocal()
  const drafts=loadControlDraftsLocal()
  return definitions.map(row=>mapDefinition(row,assignments,executions,drafts))
 }
 assertCloud(organizationId)
 let definitionsQuery=supabase.from('control_definitions').select('*').eq('organization_id',organizationId).neq('status','archived').order('created_at',{ascending:false})
 if(code)definitionsQuery=definitionsQuery.eq('code',code)
 let draftsQuery=supabase.from('control_drafts').select('*').eq('organization_id',organizationId).order('saved_at',{ascending:false})
 if(code)draftsQuery=draftsQuery.eq('control_id',code)
 const [definitionsResult,draftsResult,summaryResult,progressResult]=await Promise.all([
  definitionsQuery,
  draftsQuery,
  summary?supabase.rpc('control_assignment_summary',{p_organization_id:organizationId,p_today_from:startOfToday().toISOString()}):Promise.resolve({data:[],error:null}),
  summary||code?supabase.rpc('control_period_progress',{p_organization_id:organizationId}):Promise.resolve({data:[],error:null}),
 ])
 for(const result of [definitionsResult,draftsResult,summaryResult,progressResult])if(result.error)throw result.error
 const definitions=definitionsResult.data||[]
 if(!definitions.length)return []
 let assignmentsQuery=supabase.from('control_assignments').select('*,department:departments(id,name)').eq('organization_id',organizationId)
 if(code)assignmentsQuery=assignmentsQuery.in('control_id',definitions.map(row=>row.id))
 const {data:assignments,error:assignmentsError}=await assignmentsQuery
 if(assignmentsError)throw assignmentsError
 const summaries=summary?new Map((summaryResult.data||[]).map(row=>[row.assignment_id,{executions:Number(row.executions)||0,today:Number(row.today)||0,findings:Number(row.findings)||0,lastPerformedAt:row.last_performed_at||null}])):null
 const reads=[]
 const expiryIds=definitions.filter(isExpiryDefinition).map(row=>row.id)
 if(expiryIds.length)reads.push(readExecutionPages(()=>supabase.from('control_executions').select('*').eq('organization_id',organizationId).in('control_id',expiryIds).not('response_data->structuredData->rows','is',null)))
 if(findingsSince)reads.push(readExecutionPages(()=>supabase.from('control_executions').select('*').eq('organization_id',organizationId).eq('has_finding',true).gte('performed_at',new Date(findingsSince).toISOString())))
 if(code){
  for(const assignment of (assignments||[]).filter(a=>a.status!=='paused')){
   reads.push(supabase.from('control_executions').select('*').eq('organization_id',organizationId).eq('assignment_id',assignment.id).order('performed_at',{ascending:false}).limit(RECENT_PER_ASSIGNMENT).then(({data,error})=>{if(error)throw error;return data||[]}))
  }
 }
 const executions=[...new Map((await Promise.all(reads)).flat().map(row=>[row.id,row])).values()]
 const progress=new Map((progressResult.data||[]).map(row=>[row.assignment_id,{start:row.period_start,end:row.period_end,required:Number(row.required)||1,done:Number(row.done)||0,extra:Number(row.extra)||0}]))
 return definitions.map(row=>mapDefinition(row,assignments||[],executions,draftsResult.data||[],summaries,progress))
}

export async function loadControlByCode(organizationId,code){
 const rows=await loadControlProgramme(organizationId,{code})
 return rows.find(row=>row.id===code)||null
}

// One page of a control's executions (its departments' assignments), latest
// first, with the total, optionally within [from, to).
export async function loadControlHistoryPage(organizationId,assignmentIds=[],{page=1,pageSize=15,from=null,to=null}={}){
 const ids=[...new Set(assignmentIds.filter(Boolean))]
 if(!ids.length)return {rows:[],total:0}
 const start=(Math.max(1,page)-1)*pageSize
 if(isDemoDataEnvironment()){
  const rows=loadControlExecutionsLocal().filter(row=>ids.includes(row.assignment_id)&&(!from||new Date(row.performed_at)>=new Date(from))&&(!to||new Date(row.performed_at)<new Date(to))).map(mapExecution).sort((a,b)=>new Date(b.at)-new Date(a.at))
  return {rows:rows.slice(start,start+pageSize),total:rows.length}
 }
 assertCloud(organizationId)
 let query=supabase.from('control_executions').select('*',{count:'exact'}).eq('organization_id',organizationId).in('assignment_id',ids)
 if(from)query=query.gte('performed_at',new Date(from).toISOString())
 if(to)query=query.lt('performed_at',new Date(to).toISOString())
 const {data,error,count}=await query.order('performed_at',{ascending:false}).order('id',{ascending:false}).range(start,start+pageSize-1)
 if(error)throw error
 return {rows:(data||[]).map(mapExecution),total:count??(data||[]).length}
}

// Executions done and on time per assignment in a period, counted by the
// database (control_adherence_counts). The demo returns null: its local
// history is complete, so controlAdherence counts it directly.
export async function loadControlAdherenceCounts(organizationId,{from,to}){
 if(isDemoDataEnvironment())return null
 assertCloud(organizationId)
 const {data,error}=await supabase.rpc('control_adherence_counts',{p_organization_id:organizationId,p_from:new Date(from).toISOString(),p_to:new Date(to).toISOString()})
 if(error)throw error
 return new Map((data||[]).map(row=>[row.assignment_id,{performed:Number(row.performed)||0,onTime:Number(row.on_time)||0}]))
}

// Per assignment, the twelve months of a year: done, late, and the days for
// infrequent controls (control_calendar_months, in the viewer's time zone).
export async function loadControlCalendarMonths(organizationId,year){
 if(isDemoDataEnvironment())return null
 assertCloud(organizationId)
 const timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'
 const {data,error}=await supabase.rpc('control_calendar_months',{p_organization_id:organizationId,p_year:year,p_time_zone:timeZone})
 if(error)throw error
 const byAssignment=new Map()
 for(const row of data||[]){
  if(!byAssignment.has(row.assignment_id))byAssignment.set(row.assignment_id,Array.from({length:12},()=>({done:0,late:0,marks:[]})))
  byAssignment.get(row.assignment_id)[row.month]={done:Number(row.done)||0,late:Number(row.late)||0,marks:Array.isArray(row.marks)?row.marks:[]}
 }
 return byAssignment
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

// The control's texts, each in its own column.
const definitionTexts=draft=>({goal:draft.goal?.trim()||null,acceptance_criteria:draft.acceptanceCriteria?.trim()||null,guide_notes:draft.guideNotes?.trim()||null})

function responsePayload(draft,meta={}){
 return {
  ...(draft.responseConfig||{}),
  __meta:{
   titleEn:draft.titleEn||draft.title,
   ownerLabel:draft.owner||'',
   ownerPerson:draft.ownerPerson||null,
   assignees:Object.fromEntries(Object.entries(draft.assignees||{}).filter(([department,person])=>person&&(draft.departments||[]).includes(department))),
   location:draft.location||'',
   equipment:draft.equipment||'',
   createdByScope:draft.createdByScope||meta.createdByScope||'infection_control',
   createdForDepartment:draft.createdForDepartment||meta.createdForDepartment||null,
   createdByName:draft.createdBy||meta.actorName||'',
   updatedByName:meta.actorName||draft.updatedBy||'',
  },
 }
}

export async function saveControlDefinition(organizationId,draft,{actorName='',createdByScope,createdForDepartment}={}){
 if(isDemoDataEnvironment()){
  const userId=''
  const departments=demoResolveDepartments(draft.departments||[])
  if(!departments.length)throw new Error('At least one department is required.')
  const definitions=loadControlDefinitionsLocal()
  const assignments=loadControlAssignmentsLocal()
  const now=new Date()
  let definition
  if(draft.dbId){
   definition=definitions.find(x=>x.id===draft.dbId)
   if(!definition)throw new Error('Control not found.')
   Object.assign(definition,{
    title:draft.title.trim(),
    category:draft.category.trim(),
    description:draft.description||null,
    ...definitionTexts(draft),
    response_config:responsePayload(draft,{actorName,createdByScope,createdForDepartment}),
    frequency_config:{...(draft.frequency||{}),times:(draft.frequency?.times||[]).filter(Boolean)},
    status:draft.status||'active',
    updated_by:userId,
    updated_at:now.toISOString(),
   })
  }else{
   definition={
    id:demoId('ctrl-def'),
    organization_id:organizationId,
    code:draft.id||controlCode(),
    title:draft.title.trim(),
    category:draft.category.trim(),
    description:draft.description||null,
    ...definitionTexts(draft),
    owner_id:null,
    response_config:responsePayload(draft,{actorName,createdByScope,createdForDepartment}),
    frequency_config:{...(draft.frequency||{}),times:(draft.frequency?.times||[]).filter(Boolean)},
    status:draft.status||'active',
    created_by:userId,
    updated_by:userId,
    created_at:now.toISOString(),
    updated_at:now.toISOString(),
   }
   definitions.unshift(definition)
  }
  const wantedNames=new Set(departments.map(x=>x.name))
  for(const assignment of assignments.filter(a=>a.control_id===definition.id)){
   if(!wantedNames.has(assignment.department?.name)&&assignment.status!=='paused')assignment.status='paused'
  }
  const nextDue=firstDue(draft.frequency||{},now)
  for(const department of departments){
   const existingAssignment=assignments.find(a=>a.control_id===definition.id&&a.department_id===department.id)
   if(existingAssignment)existingAssignment.status='scheduled'
   else assignments.push({id:demoId('ctrl-asg'),control_id:definition.id,organization_id:organizationId,department_id:department.id,department:{id:department.id,name:department.name},status:'scheduled',next_due_at:nextDue,last_completed_at:null})
  }
  saveControlDefinitionsLocal(definitions)
  saveControlAssignmentsLocal(assignments)
  return loadControlByCode(organizationId,definition.code)
 }
 assertCloud(organizationId)
 const userId=await currentUserId()
 const departments=await resolveDepartments(organizationId,draft.departments||[])
 if(!departments.length)throw new Error('At least one department is required.')
 const payload={
  organization_id:organizationId,
  title:draft.title.trim(),
  category:draft.category.trim(),
  description:draft.description||null,
  ...definitionTexts(draft),
  owner_id:draft.ownerPerson?.userId||null,
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
 const nextDue=firstDue(draft.frequency||{},new Date())
 for(const department of departments){
  const previous=(existing||[]).find(x=>x.department_id===department.id)
  const row={control_id:definition.id,organization_id:organizationId,department_id:department.id,assignee_id:draft.assignees?.[department.name]?.userId||null,status:'scheduled',next_due_at:previous?.next_due_at||nextDue,last_completed_at:previous?.last_completed_at||null}
  const {error}=await supabase.from('control_assignments').upsert(row,{onConflict:'control_id,department_id'})
  if(error)throw error
 }
 return loadControlByCode(organizationId,definition.code)
}

export async function deleteControlDefinition(organizationId,record){
 if(isDemoDataEnvironment()){
  saveControlDefinitionsLocal(loadControlDefinitionsLocal().filter(x=>x.id!==record.dbId))
  saveControlAssignmentsLocal(loadControlAssignmentsLocal().filter(x=>x.control_id!==record.dbId))
  saveControlExecutionsLocal(loadControlExecutionsLocal().filter(x=>x.control_id!==record.dbId))
  return true
 }
 assertCloud(organizationId)
 const {error}=await supabase.from('control_definitions').delete().eq('organization_id',organizationId).eq('id',record.dbId)
 if(error)throw error
 return true
}

// Evidence goes to the shared attachments store under the execution id, which
// is generated before the insert so the files and the entry point at each other.
async function uploadExecutionEvidence(organizationId,executionId,files=[]){
 const uploaded=[]
 try{
  for(const file of files||[]){
   const saved=await uploadAttachment(organizationId,'control_execution',executionId,file,{category:String(file.type||'').startsWith('image/')?'photo':'other'})
   uploaded.push({...evidenceSummary(file),storagePath:saved.storagePath,attachmentId:saved.id})
  }
 }catch(error){await removeExecutionEvidence(uploaded);throw error}
 return uploaded
}
async function removeExecutionEvidence(items=[]){
 for(const item of items)await deleteAttachment(item.attachmentId).catch(()=>{})
}

// The over-entry guard: an entry beyond what the period requires is refused
// unless it is an extra entry with its reason. The database enforces the same
// (control_executions_period_guard); this check gives the message first.
export class ControlPeriodCompleteError extends Error{
 constructor(progress){super('control_period_complete');this.name='ControlPeriodCompleteError';this.code='control_period_complete';this.progress=progress}
}
const extraFields=payload=>{
 if(!payload.extra)return {is_extra:false,extra_reason:null}
 const reason=String(payload.extra.reason||'').trim()
 if(!reason)throw new Error('control_extra_reason_required')
 return {is_extra:true,extra_reason:reason}
}
const isPeriodCompleteError=error=>/control_period_complete/.test(String(error?.message||''))

// Demo: next_due_at from the assignment's entries, as the database trigger does.
function refreshDemoAssignment(assignmentId,frequency){
 const assignments=loadControlAssignmentsLocal()
 const stored=assignments.find(x=>x.id===assignmentId)
 if(!stored)return
 const history=loadControlExecutionsLocal().filter(x=>x.assignment_id===assignmentId).map(mapExecution).filter(h=>h.status!=='cancelled'&&!h.isExtra&&h.at).sort((a,b)=>new Date(b.at)-new Date(a.at))
 const last=history[0]
 if(last){
  const {start,end}=periodBounds(frequency,new Date(last.at))
  const done=history.filter(h=>new Date(h.at)>=start&&new Date(h.at)<end).length
  stored.last_completed_at=last.at
  stored.next_due_at=nextDueAfterExecution(frequency,new Date(last.at),done)
 }
 saveControlAssignmentsLocal(assignments)
}

export async function completeControlExecution(organizationId,record,department,payload={}){
 const assignment=record.assignments?.[department]
 if(!assignment?.dbId||!assignment?.departmentId)throw new Error('Control assignment is required.')
 const extra=extraFields(payload)
 if(isDemoDataEnvironment()){
  const progress=periodProgress(record.frequency||{},loadControlExecutionsLocal().filter(x=>x.assignment_id===assignment.dbId).map(mapExecution))
  if(progress.complete&&!extra.is_extra)throw new ControlPeriodCompleteError(progress)
  const userId=payload.actor?.id||''
  const now=new Date()
  const responseData={structuredData:payload.structuredData||null,evidence:(payload.evidenceFiles||[]).map(evidenceSummary),actorName:payload.actor?.name||'',actorEmail:payload.actor?.email||'',previousLastCompletedAt:assignment.lastCompletedAt||null,previousNextDueAt:assignment.nextDueAt||null}
  const execution={id:demoId('ctrl-exec'),assignment_id:assignment.dbId,control_id:record.dbId,organization_id:organizationId,department_id:assignment.departmentId,status:'completed',value_text:payload.value||null,result_text:payload.resultText?.trim()||null,checked_points:payload.checkedPoints?.trim()||null,response_data:responseData,notes:payload.notes||null,has_finding:Boolean(payload.hasFinding),performed_at:now.toISOString(),performed_by:userId,...extra}
  const executions=loadControlExecutionsLocal()
  executions.unshift(execution)
  saveControlExecutionsLocal(executions)
  refreshDemoAssignment(assignment.dbId,record.frequency||{})
  await removeControlDraft(organizationId,record,department)
  return mapExecution(execution)
 }
 assertCloud(organizationId)
 const userId=await currentUserId()
 const now=new Date()
 const executionId=crypto.randomUUID()
 const evidence=await uploadExecutionEvidence(organizationId,executionId,payload.evidenceFiles)
 const responseData={structuredData:payload.structuredData||null,evidence:evidence.map(({attachmentId:_attachmentId,...item})=>item),actorName:payload.actor?.name||'',actorEmail:payload.actor?.email||'',previousLastCompletedAt:assignment.lastCompletedAt||null,previousNextDueAt:assignment.nextDueAt||null}
 const {data,error}=await supabase.from('control_executions').insert({id:executionId,assignment_id:assignment.dbId,control_id:record.dbId,organization_id:organizationId,department_id:assignment.departmentId,status:'completed',value_text:payload.value||null,result_text:payload.resultText?.trim()||null,checked_points:payload.checkedPoints?.trim()||null,response_data:responseData,notes:payload.notes||null,has_finding:Boolean(payload.hasFinding),performed_at:now.toISOString(),performed_by:userId,...extra}).select('*').single()
 if(error){await removeExecutionEvidence(evidence);if(isPeriodCompleteError(error))throw new ControlPeriodCompleteError(null);throw error}
 // last_completed_at and next_due_at are set by the database
 // (control_executions_refresh_due), for every role that may record.
 await removeControlDraft(organizationId,record,department)
 return mapExecution(data)
}

// A correction sets the result text and points checked only when it carries them
// (removing an expiry item, for one, does not), so they are never wiped by accident.
const executionTexts=payload=>({
 ...('resultText' in payload?{result_text:payload.resultText?.trim()||null}:{}),
 ...('checkedPoints' in payload?{checked_points:payload.checkedPoints?.trim()||null}:{}),
})

export async function updateControlExecution(organizationId,record,department,execution,payload={}){
 const assignment=record.assignments?.[department]
 if(!assignment?.dbId)throw new Error('Control assignment is required.')
 if(isDemoDataEnvironment()){
  const executions=loadControlExecutionsLocal()
  const current=executions.find(x=>x.id===execution.id)
  if(!current)throw new Error('Execution not found.')
  current.response_data={
   ...(current.response_data||{}),
   structuredData:payload.structuredData||null,
   editedByName:payload.actor?.name||'',
   editReason:(payload.reason||'Correction after completion').trim(),
  }
  current.value_text=payload.value||null
  Object.assign(current,executionTexts(payload))
  current.notes=payload.notes||null
  current.has_finding=Boolean(payload.hasFinding)
  saveControlExecutionsLocal(executions)
  return mapExecution(current)
 }
 assertCloud(organizationId)
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
  ...executionTexts(payload),
  response_data:responseData,
  notes:payload.notes||null,
  has_finding:Boolean(payload.hasFinding),
 }
 const {data,error}=await supabase.from('control_executions').update(updatePayload).eq('organization_id',organizationId).eq('id',execution.id).select('*').single()
 if(error)throw error
 return mapExecution(data)
}

export async function voidControlExecution(organizationId,record,department,execution,{reason='',actor}={}){
 if(!reason.trim())throw new Error('A cancellation reason is required.')
 if(isDemoDataEnvironment()){
  const userId=actor?.id||''
  const executions=loadControlExecutionsLocal()
  const current=executions.find(x=>x.id===execution.id)
  if(!current)throw new Error('Execution not found.')
  current.status='cancelled'
  current.cancelled_at=new Date().toISOString()
  current.cancelled_by=userId
  current.cancellation_reason=reason.trim()
  current.response_data={...(current.response_data||{}),cancelledByName:actor?.name||''}
  saveControlExecutionsLocal(executions)
  const assignment=record.assignments?.[department]
  if(assignment?.dbId){
   const assignments=loadControlAssignmentsLocal()
   const stored=assignments.find(x=>x.id===assignment.dbId)
   const remaining=executions.some(x=>x.assignment_id===assignment.dbId&&x.status!=='cancelled'&&!x.is_extra)
   if(stored&&!remaining&&execution.previousNextDueAt){stored.last_completed_at=execution.previousLastCompletedAt||null;stored.next_due_at=execution.previousNextDueAt}
   saveControlAssignmentsLocal(assignments)
   if(remaining)refreshDemoAssignment(assignment.dbId,record.frequency||{})
  }
  return mapExecution(current)
 }
 assertCloud(organizationId)
 const userId=await currentUserId()
 const responseData={...(execution.responseData||{}),cancelledByName:actor?.name||''}
 const cancelledAt=new Date().toISOString()
 const {data,error}=await supabase.from('control_executions').update({status:'cancelled',cancelled_at:cancelledAt,cancelled_by:userId,cancellation_reason:reason.trim(),response_data:responseData}).eq('organization_id',organizationId).eq('id',execution.id).select('*').single()
 if(error)throw error
 // The database works next_due_at out again from the entries left.
 return mapExecution(data)
}

export async function saveControlDraft(organizationId,record,department,payload){
 const assignment=record.assignments?.[department]
 if(!assignment?.departmentId)throw new Error('Control assignment is required.')
 if(isDemoDataEnvironment()){
  const userId='demo-user'
  const recordKey=`${record.id}.${assignment.departmentId}.${userId}`
  const drafts=loadControlDraftsLocal()
  const now=new Date().toISOString()
  let row=drafts.find(x=>x.organization_id===organizationId&&x.record_key===recordKey)
  if(row){
   row.payload=payload
   row.updated_at=now
   row.saved_at=now
  }else{
   row={id:demoId('ctrl-draft'),organization_id:organizationId,record_key:recordKey,control_id:record.id,department_id:assignment.departmentId,created_by:userId,payload,saved_at:now,updated_at:now}
   drafts.push(row)
  }
  saveControlDraftsLocal(drafts)
  return {...payload,id:row.id,savedAt:row.saved_at,recordKey:row.record_key}
 }
 assertCloud(organizationId)
 const userId=await currentUserId()
 const recordKey=`${record.id}.${assignment.departmentId}.${userId}`
 const row={organization_id:organizationId,record_key:recordKey,control_id:record.id,department_id:assignment.departmentId,created_by:userId,payload,saved_at:new Date().toISOString(),updated_at:new Date().toISOString()}
 const {data,error}=await supabase.from('control_drafts').upsert(row,{onConflict:'organization_id,record_key'}).select('*').single()
 if(error)throw error
 return {...payload,id:data.id,savedAt:data.saved_at,recordKey:data.record_key}
}

async function removeControlDraft(organizationId,record,department){
 const assignment=record.assignments?.[department]
 if(!assignment?.departmentId)return
 if(isDemoDataEnvironment()){
  const userId='demo-user'
  const drafts=loadControlDraftsLocal().filter(x=>!(x.organization_id===organizationId&&x.control_id===record.id&&x.department_id===assignment.departmentId&&x.created_by===userId))
  saveControlDraftsLocal(drafts)
  return
 }
 assertCloud(organizationId)
 const userId=await currentUserId()
 const {error}=await supabase.from('control_drafts').delete().eq('organization_id',organizationId).eq('control_id',record.id).eq('department_id',assignment.departmentId).eq('created_by',userId)
 if(error)throw error
}
