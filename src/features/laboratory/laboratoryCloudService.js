import { supabase } from '../../core/supabase/client'

const assertCloud=()=>{if(!supabase)throw new Error('Supabase is not configured.')}
const iso=value=>value?new Date(value).toISOString():null

async function currentUserId(){
  assertCloud()
  const {data,error}=await supabase.auth.getUser()
  if(error)throw error
  const id=data?.user?.id
  if(!id)throw new Error('Authenticated user is required.')
  return id
}

function mapMicrobiology(row,ast=[],communications=[],amr=[]){
  if(!row)return null
  const classification=(amr||[]).find(item=>item.microbiology_result_id===row.id)
  return {
    id:row.id,
    result:row.result_status,
    resultStatus:row.validation_status,
    organism:row.organism,
    resistance:classification?.classification||row.resistance_class||null,
    susceptibilitySummary:row.susceptibility_summary||'',
    critical:Boolean(row.is_critical),
    resultedAt:row.resulted_at,
    validatedAt:row.validated_at,
    validatedBy:row.validated_by,
    method:row.method||'',
    preliminary:Boolean(row.preliminary),
    interpretationStandard:row.interpretation_standard||'',
    interpretationVersion:row.interpretation_version||'',
    ast:(ast||[]).filter(item=>item.microbiology_result_id===row.id).map(item=>({id:item.id,drug:item.antimicrobial_name,code:item.antimicrobial_code,method:item.method,sir:item.sir_category,mic:item.mic_value,operator:item.mic_operator,zone:item.zone_diameter_mm,standard:item.breakpoint_standard,version:item.breakpoint_version,notes:item.notes||''})),
    communications:(communications||[]).filter(item=>item.microbiology_result_id===row.id).map(item=>({id:item.id,at:item.communicated_at,to:item.recipient_name,role:item.recipient_role||'',method:item.communication_method,readBack:item.read_back_confirmed,notes:item.notes||''})),
  }
}

function mapSample(row,patient,department,microbiology=[]){
  const result=microbiology[0]||null
  return {
    id:row.sample_code,
    recordId:row.id,
    organizationId:row.organization_id,
    patientRecordId:row.patient_id,
    patientId:patient?.patient_code||row.patient_id,
    patient:`${patient?.first_name||''} ${patient?.last_name||''}`.trim(),
    patientEn:`${patient?.first_name||''} ${patient?.last_name||''}`.trim(),
    departmentId:row.department_id,
    department:department?.name||'',
    departmentEn:department?.name||'',
    surveillanceCase:row.surveillance_case_id||null,
    type:row.sample_type,
    source:row.source_site||'',
    sourceEn:row.source_site||'',
    collectedAt:row.collected_at,
    requestedAt:row.requested_at,
    receivedAt:row.received_at,
    status:row.status,
    priority:row.priority,
    specimenCondition:row.specimen_condition||'',
    rejectionReason:row.rejection_reason||'',
    result:result?.result||null,
    resultStatus:result?.resultStatus||'draft',
    organism:result?.organism||null,
    resistance:result?.resistance||null,
    critical:Boolean(result?.critical),
    microbiologyResults:microbiology,
  }
}

async function hydrateSamples(rows){
  if(!rows?.length)return []
  const patientIds=[...new Set(rows.map(row=>row.patient_id))]
  const departmentIds=[...new Set(rows.map(row=>row.department_id).filter(Boolean))]
  const sampleIds=rows.map(row=>row.id)
  const [patientsResult,departmentsResult,microResult]=await Promise.all([
    supabase.from('patients').select('id,patient_code,first_name,last_name').in('id',patientIds),
    departmentIds.length?supabase.from('departments').select('id,name').in('id',departmentIds):Promise.resolve({data:[],error:null}),
    supabase.from('microbiology_results').select('*').in('sample_id',sampleIds).order('resulted_at',{ascending:false}),
  ])
  for(const result of [patientsResult,departmentsResult,microResult])if(result.error)throw result.error
  const microRows=microResult.data||[]
  const microIds=microRows.map(row=>row.id)
  const [astResult,commResult,amrResult]=microIds.length?await Promise.all([
    supabase.from('antimicrobial_susceptibility_results').select('*').in('microbiology_result_id',microIds),
    supabase.from('critical_result_communications').select('*').in('microbiology_result_id',microIds).order('communicated_at',{ascending:false}),
    supabase.from('amr_classifications').select('*').in('microbiology_result_id',microIds).order('created_at',{ascending:false}),
  ]):[{data:[],error:null},{data:[],error:null},{data:[],error:null}]
  for(const result of [astResult,commResult,amrResult])if(result.error)throw result.error
  return rows.map(row=>mapSample(
    row,
    (patientsResult.data||[]).find(item=>item.id===row.patient_id),
    (departmentsResult.data||[]).find(item=>item.id===row.department_id),
    (microRows||[]).filter(item=>item.sample_id===row.id).map(item=>mapMicrobiology(item,astResult.data,commResult.data,amrResult.data)),
  ))
}

export async function loadLaboratorySamples(organizationId){
  assertCloud()
  if(!organizationId)return []
  const {data,error}=await supabase.from('laboratory_samples').select('*').eq('organization_id',organizationId).order('created_at',{ascending:false})
  if(error)throw error
  return hydrateSamples(data||[])
}

export async function loadLaboratorySample(organizationId,sampleCode){
  assertCloud()
  const {data,error}=await supabase.from('laboratory_samples').select('*').eq('organization_id',organizationId).eq('sample_code',sampleCode).maybeSingle()
  if(error)throw error
  if(!data)return null
  return (await hydrateSamples([data]))[0]
}

export async function createLaboratorySample(organizationId,patientRecordId,draft){
  assertCloud()
  const actorId=await currentUserId()
  const code=draft.sampleCode||`LAB-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${String(Date.now()).slice(-5)}`
  const {data,error}=await supabase.from('laboratory_samples').insert({organization_id:organizationId,patient_id:patientRecordId,department_id:draft.departmentId||null,surveillance_case_id:draft.surveillanceCaseId||null,sample_code:code,sample_type:draft.type,source_site:draft.source||null,collected_at:iso(draft.collectedAt),requested_at:iso(draft.requestedAt||new Date()),requested_by:actorId,received_at:iso(draft.receivedAt),status:draft.collectedAt?'collected':'requested',priority:draft.priority||'routine',created_by:actorId}).select('*').single()
  if(error)throw error
  return (await hydrateSamples([data]))[0]
}

export async function updateLaboratorySampleStatus(organizationId,sampleRecordId,status,patch={}){
  assertCloud()
  const actorId=await currentUserId()
  const payload={status,updated_by:actorId,updated_at:new Date().toISOString()}
  if(patch.receivedAt)payload.received_at=iso(patch.receivedAt)
  if(patch.collectedAt)payload.collected_at=iso(patch.collectedAt)
  if(patch.specimenCondition!==undefined)payload.specimen_condition=patch.specimenCondition||null
  if(patch.rejectionReason!==undefined){payload.rejection_reason=patch.rejectionReason||null;payload.rejected_at=patch.rejectionReason?new Date().toISOString():null}
  const {error}=await supabase.from('laboratory_samples').update(payload).eq('organization_id',organizationId).eq('id',sampleRecordId)
  if(error)throw error
}

export async function saveMicrobiologyResult(organizationId,sampleRecordId,draft){
  assertCloud()
  const actorId=await currentUserId()
  const row={organization_id:organizationId,sample_id:sampleRecordId,result_status:draft.result||'inconclusive',organism:draft.organism||null,resistance_class:draft.resistance||null,susceptibility_summary:draft.susceptibilitySummary||null,is_critical:Boolean(draft.critical),resulted_at:iso(draft.resultedAt||new Date()),created_by:actorId,updated_by:actorId,method:draft.method||null,preliminary:Boolean(draft.preliminary),validation_status:draft.validationStatus||'draft',validated_at:draft.validationStatus==='validated'?new Date().toISOString():null,validated_by:draft.validationStatus==='validated'?actorId:null,interpretation_standard:draft.interpretationStandard||null,interpretation_version:draft.interpretationVersion||null}
  if(draft.id){
    const {data,error}=await supabase.from('microbiology_results').update(row).eq('organization_id',organizationId).eq('id',draft.id).select('*').single()
    if(error)throw error
    return data
  }
  const {data,error}=await supabase.from('microbiology_results').insert(row).select('*').single()
  if(error)throw error
  return data
}

export async function addAstResult(organizationId,microbiologyResultId,draft){
  assertCloud()
  const actorId=await currentUserId()
  const {data,error}=await supabase.from('antimicrobial_susceptibility_results').insert({organization_id:organizationId,microbiology_result_id:microbiologyResultId,antimicrobial_code:draft.code||null,antimicrobial_name:draft.drug,method:draft.method||'MIC',mic_value:draft.mic||null,mic_operator:draft.operator||null,zone_diameter_mm:draft.zone||null,sir_category:draft.sir||'S',breakpoint_standard:draft.standard||'EUCAST',breakpoint_version:draft.version,technical_uncertainty:Boolean(draft.technicalUncertainty),notes:draft.notes||null,created_by:actorId}).select('*').single()
  if(error)throw error
  return data
}

export async function communicateCriticalResult(organizationId,microbiologyResultId,draft){
  assertCloud()
  const actorId=await currentUserId()
  const communicatedAt=iso(draft.at||new Date())
  const {data,error}=await supabase.from('critical_result_communications').insert({organization_id:organizationId,microbiology_result_id:microbiologyResultId,communicated_at:communicatedAt,communicated_by:actorId,recipient_name:draft.recipientName,recipient_role:draft.recipientRole||null,communication_method:draft.method||'phone',read_back_confirmed:Boolean(draft.readBack),notes:draft.notes||null}).select('*').single()
  if(error)throw error
  const {error:updateError}=await supabase.from('microbiology_results').update({critical_communicated_at:communicatedAt,critical_communicated_to:draft.recipientName,updated_by:actorId,updated_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('id',microbiologyResultId)
  if(updateError)throw updateError
  return data
}

export function getLaboratoryKpis(rows){
  const today=new Date().toISOString().slice(0,10)
  return {
    today:(rows||[]).filter(row=>String(row.requestedAt||row.collectedAt||'').slice(0,10)===today).length,
    pending:(rows||[]).filter(row=>['requested','collected','received','processing'].includes(row.status)).length,
    positive:(rows||[]).filter(row=>row.result==='positive').length,
    amr:(rows||[]).filter(row=>Boolean(row.resistance)).length,
    critical:(rows||[]).filter(row=>row.critical&&!(row.microbiologyResults||[]).some(result=>result.communications?.length)).length,
  }
}
