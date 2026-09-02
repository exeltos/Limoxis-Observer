import { supabase } from '../../core/supabase/client'

const assertCloud=()=>{if(!supabase)throw new Error('Supabase is not configured.')}

async function currentUserId(){
  assertCloud()
  const {data,error}=await supabase.auth.getUser()
  if(error)throw error
  const id=data?.user?.id
  if(!id)throw new Error('Authenticated user is required.')
  return id
}

const iso=value=>value?new Date(value).toISOString():null
const dateOnly=value=>value?String(value).slice(0,10):null

function eventPayload(events,type){
  const row=(events||[]).find(item=>item.event_type===type)
  return row?.payload||null
}

function mapSample(row){
  return {
    id:row.sample_code,
    recordId:row.id,
    type:row.sample_type,
    source:row.source_site,
    collectedAt:row.collected_at,
    receivedAt:row.received_at,
    status:row.status,
    result:row.status==='validated'?'positive':row.status==='rejected'?'rejected':'pending',
    priority:row.priority,
    surveillanceCaseId:row.surveillance_case_id,
  }
}

function mapReassessment(row){
  return {
    id:row.id,
    date:dateOnly(row.reassessed_at),
    status:row.clinical_status,
    decision:row.isolation_decision||row.therapy_decision||'',
    isolationDecision:row.isolation_decision,
    therapyDecision:row.therapy_decision,
    notes:row.notes||'',
    nextReviewDue:dateOnly(row.next_review_due_at),
    byId:row.created_by,
  }
}

function mapOutcome(row){
  if(!row)return null
  return {id:row.id,status:row.outcome,date:dateOnly(row.occurred_at),notes:row.notes||'',recordedById:row.created_by}
}

export function mapClinicalCase({caseRow,patient,department,events=[],samples=[],reassessments=[],outcome=null,devices=[]}){
  const assessment=eventPayload(events,'clinical_assessment')
  const haiClassification=eventPayload(events,'hai_classification')
  const isolation=eventPayload(events,'isolation')
  const therapy=eventPayload(events,'therapy')||[]
  const start=eventPayload(events,'surveillance_start')||{}
  const timeline=(events||[]).map(row=>({at:row.occurred_at||row.created_at,type:row.event_type,actorId:row.created_by,detail:row.payload?.detail||row.event_status}))
  return {
    id:caseRow.id,
    recordId:caseRow.id,
    patientRecordId:caseRow.patient_id,
    patientId:patient?.patient_code||caseRow.patient_id,
    patient:`${patient?.first_name||''} ${patient?.last_name||''}`.trim(),
    patientEn:`${patient?.first_name||''} ${patient?.last_name||''}`.trim(),
    dateOfBirth:patient?.date_of_birth||null,
    departmentId:caseRow.department_id,
    department:department?.name||'',
    departmentEn:department?.name||'',
    admissionDate:patient?.admission_date||null,
    startedAt:caseRow.started_at,
    reviewDue:start.reviewDue||null,
    room:start.room||'',
    reason:start.reason||'',
    reasonEn:start.reasonEn||start.reason||'',
    status:caseRow.status,
    completedAt:caseRow.closed_at,
    closeReason:caseRow.close_reason,
    assessment,
    haiClassification,
    isolation,
    therapy:Array.isArray(therapy)?therapy:[],
    samples:(samples||[]).map(mapSample),
    reassessments:(reassessments||[]).map(mapReassessment),
    outcome:mapOutcome(outcome),
    devices:(devices||[]).map(row=>({id:row.id,name:row.device_type,nameEn:row.device_type,site:row.site,siteEn:row.site,indication:row.indication,indicationEn:row.indication,insertedAt:row.inserted_at,reviewDue:row.review_due_at,removedAt:row.removed_at,status:row.status})),
    timeline,
    reopenedAt:caseRow.reopened_at,
    reopenReason:caseRow.reopen_reason,
  }
}

async function hydrateCases(caseRows){
  if(!caseRows?.length)return []
  const caseIds=caseRows.map(row=>row.id)
  const patientIds=[...new Set(caseRows.map(row=>row.patient_id))]
  const departmentIds=[...new Set(caseRows.map(row=>row.department_id).filter(Boolean))]
  const [patientsResult,departmentsResult,eventsResult,samplesResult,reassessmentsResult,outcomesResult,devicesResult]=await Promise.all([
    supabase.from('patients').select('id,patient_code,first_name,last_name,date_of_birth,admission_date,status').in('id',patientIds),
    departmentIds.length?supabase.from('departments').select('id,name').in('id',departmentIds):Promise.resolve({data:[],error:null}),
    supabase.from('surveillance_events').select('*').in('surveillance_case_id',caseIds).order('created_at',{ascending:false}),
    supabase.from('laboratory_samples').select('*').in('surveillance_case_id',caseIds).order('collected_at',{ascending:false}),
    supabase.from('surveillance_reassessments').select('*').in('surveillance_case_id',caseIds).order('reassessed_at',{ascending:false}),
    supabase.from('surveillance_outcomes').select('*').in('surveillance_case_id',caseIds).order('occurred_at',{ascending:false}),
    supabase.from('surveillance_devices').select('*').in('surveillance_case_id',caseIds).order('inserted_at',{ascending:false}),
  ])
  for(const result of [patientsResult,departmentsResult,eventsResult,samplesResult,reassessmentsResult,outcomesResult,devicesResult])if(result.error)throw result.error
  return caseRows.map(caseRow=>mapClinicalCase({
    caseRow,
    patient:(patientsResult.data||[]).find(row=>row.id===caseRow.patient_id),
    department:(departmentsResult.data||[]).find(row=>row.id===caseRow.department_id),
    events:(eventsResult.data||[]).filter(row=>row.surveillance_case_id===caseRow.id),
    samples:(samplesResult.data||[]).filter(row=>row.surveillance_case_id===caseRow.id),
    reassessments:(reassessmentsResult.data||[]).filter(row=>row.surveillance_case_id===caseRow.id),
    outcome:(outcomesResult.data||[]).find(row=>row.surveillance_case_id===caseRow.id)||null,
    devices:(devicesResult.data||[]).filter(row=>row.surveillance_case_id===caseRow.id),
  }))
}

export async function loadClinicalCases(organizationId){
  assertCloud()
  if(!organizationId)return []
  const {data,error}=await supabase.from('surveillance_cases').select('*').eq('organization_id',organizationId).order('started_at',{ascending:false})
  if(error)throw error
  return hydrateCases(data||[])
}

export async function loadClinicalCasesForPatient(organizationId,patientRecordId){
  assertCloud()
  if(!organizationId||!patientRecordId)return []
  const {data,error}=await supabase.from('surveillance_cases').select('*').eq('organization_id',organizationId).eq('patient_id',patientRecordId).order('started_at',{ascending:false})
  if(error)throw error
  return hydrateCases(data||[])
}

export async function createClinicalCase(organizationId,patientRecordId,draft){
  assertCloud()
  const actorId=await currentUserId()
  const {data:department,error:departmentError}=draft.departmentId?await supabase.from('departments').select('id').eq('organization_id',organizationId).eq('id',draft.departmentId).eq('is_active',true).maybeSingle():{data:null,error:null}
  if(departmentError)throw departmentError
  if(draft.departmentId&&!department)throw new Error('Selected department is not available for this organization.')
  const {data:caseRow,error}=await supabase.from('surveillance_cases').insert({organization_id:organizationId,patient_id:patientRecordId,department_id:department?.id||null,status:'active',started_at:iso(draft.startedAt||new Date()),created_by:actorId}).select('*').single()
  if(error)throw error
  const {error:eventError}=await supabase.from('surveillance_events').insert({organization_id:organizationId,surveillance_case_id:caseRow.id,event_type:'surveillance_start',event_status:'completed',occurred_at:iso(draft.startedAt||new Date()),payload:{reviewDue:draft.reviewDue||null,room:draft.room||'',reason:draft.reason||draft.reasonEn||'',reasonEn:draft.reasonEn||draft.reason||'',suspectedSource:draft.suspectedSource||'',detail:'created'},created_by:actorId})
  if(eventError)throw eventError
  return (await hydrateCases([caseRow]))[0]
}

export async function saveClinicalEvent(organizationId,caseId,eventType,payload,{status='completed',occurredAt=null}={}){
  assertCloud()
  const actorId=await currentUserId()
  const {data,error}=await supabase.from('surveillance_events').insert({organization_id:organizationId,surveillance_case_id:caseId,event_type:eventType,event_status:status,occurred_at:iso(occurredAt||new Date()),payload:payload||{},created_by:actorId}).select('*').single()
  if(error)throw error
  return data
}

export async function addClinicalReassessment(organizationId,caseRecordId,patientRecordId,draft){
  assertCloud()
  const actorId=await currentUserId()
  const {data,error}=await supabase.from('surveillance_reassessments').insert({organization_id:organizationId,surveillance_case_id:caseRecordId,patient_id:patientRecordId,clinical_status:draft.status,isolation_decision:draft.isolationDecision||null,therapy_decision:draft.therapyDecision||draft.decision||null,notes:draft.notes||null,reassessed_at:iso(draft.date||new Date()),next_review_due_at:iso(draft.nextReviewDue),created_by:actorId}).select('*').single()
  if(error)throw error
  return mapReassessment(data)
}

export async function completeClinicalCase(organizationId,caseRecordId,patientRecordId,draft){
  assertCloud()
  const actorId=await currentUserId()
  const occurredAt=iso(draft.date||new Date())
  const {data:outcome,error:outcomeError}=await supabase.from('surveillance_outcomes').insert({organization_id:organizationId,surveillance_case_id:caseRecordId,patient_id:patientRecordId,outcome:draft.status,occurred_at:occurredAt,notes:draft.notes||null,created_by:actorId}).select('*').single()
  if(outcomeError)throw outcomeError
  const {error:caseError}=await supabase.from('surveillance_cases').update({status:'completed',closed_at:occurredAt,close_reason:draft.status,closed_by:actorId}).eq('organization_id',organizationId).eq('id',caseRecordId)
  if(caseError)throw caseError
  return mapOutcome(outcome)
}
