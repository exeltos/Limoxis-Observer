import { groupByColumn, selectAllPages, selectInChunks } from '../../core/data/inChunks'
import { binCloudRows,describeDeleted } from '../../core/recycleBin/recycleBinService'
import { supabase } from '../../core/supabase/client'
import { computeTurnaroundHours } from './model/laboratoryModel'
import { assertCloud, currentUserId } from '../../core/supabase/cloudContext'
import { ENVIRONMENTAL_TYPES } from '../surveillance/environmentalSurveillanceData'
import { AMR_CATEGORY_SELECT, amrCalculationColumns, amrCalculationSnapshot, amrCategoryRows } from './amrCalculation'

const iso=value=>value?new Date(value).toISOString():null
const environmentalTypes=['water','surface','environment','environmental','room','air','νερό','επιφάνεια','επιφανεια']
// The environmental types with a sampling standard (shared with Surveillance).
export const ENVIRONMENTAL_CATEGORIES=ENVIRONMENTAL_TYPES
const environmentalCategories=new Set(ENVIRONMENTAL_CATEGORIES)
const specimenLabel=(specimen,language='el')=>specimen?(language==='en'?(specimen.nameEn||specimen.name_en||specimen.nameEl||specimen.name_el):(specimen.nameEl||specimen.name_el||specimen.nameEn||specimen.name_en))||'':''
// Patient samples display the concrete specimen from the central Sample types
// library. The technical sample_type is retained separately for indicators.
export function sampleTypeLabel(value,t,language='el'){
  const sample=value&&typeof value==='object'?value:null
  const specimen=sample?.specimenType||sample?.specimen_type||null
  const exact=specimenLabel(specimen,language)
  if(exact)return exact
  const type=sample?.type||sample?.sample_type||value
  return environmentalCategories.has(type)?t(`environmentalStandards.${type==='room'?'roomCategory':type}`):t(type)
}
export function environmentalMethodLabel(method,t){return method?t(`environmentalStandards.${method}`):''}

function mapMicrobiology(row,ast=[],communications=[],amr=[]){
  if(!row)return null
  const classification=(amr||[]).find(item=>item.microbiology_result_id===row.id)
  return {
    id:row.id,
    result:row.result_status,
    resultStatus:row.validation_status,
    amendedFrom:row.amended_from||null,
    organism:row.organism,
    resistance:classification?.classification||row.resistance_class||null,
    amr:(amr||[]).filter(item=>item.microbiology_result_id===row.id).map(item=>({id:item.id,organism:item.organism||'',classification:item.classification,definitionSource:item.definition_source,definitionVersion:item.definition_version,status:item.status,rationale:item.rationale||'',classifiedAt:item.classified_at,calculationSnapshot:amrCalculationSnapshot(item)})),
    susceptibilitySummary:row.susceptibility_summary||'',
    critical:Boolean(row.is_critical),
    cfuCount:row.cfu_count,
    cfuLimit:row.cfu_limit,
    withinLimit:row.within_limit,
    resultedAt:row.resulted_at,
    validatedAt:row.validated_at,
    validatedBy:row.validated_by,
    method:row.method||'',
    preliminary:Boolean(row.preliminary),
    interpretationStandard:row.interpretation_standard||'',
    interpretationVersion:row.interpretation_version||'',
    ast:(ast||[]).filter(item=>item.microbiology_result_id===row.id).map(item=>({id:item.id,organism:item.organism||'',drug:item.antimicrobial_name,code:item.antimicrobial_code,method:item.method,sir:item.sir_category,mic:item.mic_value,operator:item.mic_operator,zone:item.zone_diameter_mm,standard:item.breakpoint_standard,version:item.breakpoint_version,notes:item.notes||''})),
    communications:(communications||[]).filter(item=>item.microbiology_result_id===row.id).map(item=>({id:item.id,at:item.communicated_at,to:item.recipient_name,role:item.recipient_role||'',method:item.communication_method,readBack:item.read_back_confirmed,notes:item.notes||''})),
  }
}

function mapSample(row,patient,department,microbiology=[],specimenType=null){
  const result=microbiology[0]||null
  const patientName=patient?`${patient.first_name||''} ${patient.last_name||''}`.trim():''
  const inferredType=patient?'patient':environmentalTypes.some(value=>String(row.sample_type||'').toLowerCase().includes(value))?'environment':'other'
  const subjectType=row.subject_type||inferredType
  const subjectName=row.subject_name||patientName||(subjectType==='environment'?(row.source_site||''):'')
  const subjectCode=row.subject_code||patient?.patient_code||''
  const specimen=specimenType||row.specimen_type||null
  const mappedSpecimen=specimen?{
    id:specimen.id||row.specimen_type_id||null,
    code:specimen.code||null,
    nameEl:specimen.nameEl||specimen.name_el||'',
    nameEn:specimen.nameEn||specimen.name_en||specimen.nameEl||specimen.name_el||'',
  }:null
  return {
    id:row.sample_code,
    recordId:row.id,
    organizationId:row.organization_id,
    patientRecordId:row.patient_id,
    patientId:patient?.patient_code||subjectCode||row.patient_id,
    patient:patientName||subjectName,
    patientEn:patientName||subjectName,
    subjectType,
    subjectName,
    subjectCode,
    employeeSurveillanceId:row.employee_surveillance_id||null,
    employeeSurveillanceBatchId:row.employee_surveillance_batch_id||null,
    departmentId:row.department_id,
    department:department?.name||'',
    departmentEn:department?.name||'',
    surveillanceCase:row.surveillance_case_id||null,
    clinicalContext:row.clinical_context||null,
    type:row.sample_type,
    specimenTypeId:row.specimen_type_id||mappedSpecimen?.id||null,
    specimenType:mappedSpecimen,
    source:row.source_site||'',
    sourceEn:row.source_site||'',
    environmentalMethod:row.environmental_method||'',
    location:row.location||'',
    point:row.point||'',
    environmentalBatchId:row.environmental_batch_id||null,
    collectedAt:row.collected_at,
    requestedAt:row.requested_at,
    receivedAt:row.received_at,
    rejectedAt:row.rejected_at,
    status:row.status,
    priority:row.priority,
    specimenCondition:row.specimen_condition||'',
    rejectionReason:row.rejection_reason||'',
    result:result?.result||null,
    resultStatus:result?.resultStatus||'draft',
    organism:result?.organism||null,
    resistance:result?.resistance||null,
    critical:Boolean(result?.critical),
    cfuCount:result?.cfuCount,
    cfuLimit:result?.cfuLimit,
    withinLimit:result?.withinLimit,
    microbiologyResults:microbiology,
    documentsReviewedAt:row.documents_reviewed_at||null,
    documentsReviewedBy:row.documents_reviewed_by||null,
    finalizedAt:row.finalized_at||null,
    finalizedBy:row.finalized_by||null,
    correctionReason:row.correction_reason||'',
    surveillanceReviewStatus:row.surveillance_review_status||null,
    surveillanceReviewReason:row.surveillance_review_reason||null,
    surveillanceReviewNote:row.surveillance_review_note||'',
    surveillanceReviewedAt:row.surveillance_reviewed_at||null,
    surveillanceReviewedBy:row.surveillance_reviewed_by||null,
  }
}

// Rows of `table` whose `column` is one of `ids`; many ids are read as the
// organization's whole list (see selectInChunks).
function relatedRows(organizationId,table,select,column,ids,orderColumn,orderOptions){
  const ordered=query=>orderColumn?query.order(orderColumn,orderOptions).order('id',{ascending:true}):query.order('id',{ascending:true})
  return selectInChunks(ids,chunk=>ordered(supabase.from(table).select(select).in(column,chunk)),{
    order:orderColumn?[[orderColumn,orderOptions]]:undefined,
    column,
    whole:organizationId?()=>ordered(supabase.from(table).select(select).eq('organization_id',organizationId)):undefined,
  })
}

async function hydrateSamples(rows){
  if(!rows?.length)return []
  const organizationId=rows[0].organization_id
  const patientIds=[...new Set(rows.map(row=>row.patient_id).filter(Boolean))]
  const departmentIds=[...new Set(rows.map(row=>row.department_id).filter(Boolean))]
  const specimenIds=[...new Set(rows.map(row=>row.specimen_type_id).filter(Boolean))]
  const sampleIds=rows.map(row=>row.id)
  const related=(table,select,column,ids,orderColumn,orderOptions)=>relatedRows(organizationId,table,select,column,ids,orderColumn,orderOptions)
  const specimenPromise=specimenIds.length?related('master_library_items','id,code,name_el,name_en','id',specimenIds):Promise.resolve({data:[],error:null})
  const [patientsResult,departmentsResult,specimensResult,microResult]=await Promise.all([
    related('patients','id,patient_code,first_name,last_name','id',patientIds),
    related('departments','id,name','id',departmentIds),
    specimenPromise,
    related('microbiology_results','*','sample_id',sampleIds,'resulted_at',{ascending:false}),
  ])
  for(const result of [patientsResult,departmentsResult,specimensResult,microResult])if(result.error)throw result.error
  const microRows=microResult.data||[]
  const microIds=microRows.map(row=>row.id)
  const [astResult,commResult,amrResult]=microIds.length?await Promise.all([
    related('antimicrobial_susceptibility_results','*','microbiology_result_id',microIds),
    related('critical_result_communications','*','microbiology_result_id',microIds,'communicated_at',{ascending:false}),
    related('amr_classifications',`*,${AMR_CATEGORY_SELECT}`,'microbiology_result_id',microIds,'created_at',{ascending:false}),
  ]):[{data:[],error:null},{data:[],error:null},{data:[],error:null}]
  for(const result of [astResult,commResult,amrResult])if(result.error)throw result.error
  // Each sample and result gets only its own rows, so mapping stays linear.
  const patients=new Map((patientsResult.data||[]).map(item=>[item.id,item]))
  const departments=new Map((departmentsResult.data||[]).map(item=>[item.id,item]))
  const specimens=new Map((specimensResult.data||[]).map(item=>[item.id,item]))
  const microBySample=groupByColumn(microRows,'sample_id')
  const astByResult=groupByColumn(astResult.data,'microbiology_result_id')
  const commByResult=groupByColumn(commResult.data,'microbiology_result_id')
  const amrByResult=groupByColumn(amrResult.data,'microbiology_result_id')
  return rows.map(row=>mapSample(
    row,
    patients.get(row.patient_id),
    departments.get(row.department_id),
    (microBySample.get(row.id)||[]).map(item=>mapMicrobiology(item,astByResult.get(item.id)||[],commByResult.get(item.id)||[],amrByResult.get(item.id)||[])),
    specimens.get(row.specimen_type_id)||null,
  ))
}

// One call (laboratory_sample_list, 20261201110000) returns the samples already
// joined with their patient, department, specimen-library item and results;
// `environmental` keeps the environmental ones (a superset the screens still filter).
// The paged reads below stay for a database without it yet.
export async function loadLaboratorySamples(organizationId,{environmental=false}={}){
  assertCloud()
  if(!organizationId)return []
  if(typeof supabase.rpc==='function'){
    const listed=await supabase.rpc('laboratory_sample_list',{p_organization_id:organizationId,p_environmental:environmental})
    if(!listed?.error&&Array.isArray(listed?.data))return listed.data.map(row=>mapSample(row,row.patient,row.department,(row.results||[]).map(item=>mapMicrobiology(item,item.ast,item.communications,item.amr)),row.specimen_type))
  }
  const rows=await selectAllPages(()=>supabase.from('laboratory_samples').select('*').eq('organization_id',organizationId).order('created_at',{ascending:false}).order('id',{ascending:true}))
  return hydrateSamples(rows)
}

// The samples of some staff surveillance records (an employee's record), read
// by employee_surveillance_id instead of the organization's whole list.
export async function loadEmployeeSurveillanceSamples(organizationId,surveillanceIds=[]){
  assertCloud()
  if(!organizationId)return []
  const ids=[...new Set((surveillanceIds||[]).filter(Boolean))]
  if(!ids.length)return []
  const {data,error}=await selectInChunks(ids,chunk=>supabase.from('laboratory_samples').select('*').eq('organization_id',organizationId).in('employee_surveillance_id',chunk).order('created_at',{ascending:false}).order('id',{ascending:true}),{order:[['created_at',{ascending:false}],['id',{ascending:true}]]})
  if(error)throw error
  return hydrateSamples(data||[])
}

// «Προς έλεγχο»: patient samples with a positive result, no episode and no decision yet,
// read without the organization's whole list (the filter runs in the database: an
// inner join on the positive result). The caller narrows them with samplesAwaitingReview.
export async function loadSamplesAwaitingReview(organizationId,{limit=300}={}){
  assertCloud()
  if(!organizationId)return []
  const {data,error}=await supabase.from('laboratory_samples').select('*,microbiology_results!inner(id)')
    .eq('organization_id',organizationId).eq('microbiology_results.result_status','positive')
    .is('surveillance_case_id',null).is('surveillance_review_status',null).not('patient_id','is',null)
    .order('requested_at',{ascending:false}).limit(limit)
  if(error)throw error
  const unique=[...new Map((data||[]).map(({microbiology_results:_joined,...row})=>[row.id,row])).values()]
  return hydrateSamples(unique)
}

// The infection-control decision on a sample. Only the review_laboratory_sample function
// may write it (the update policy of laboratory_samples is limited to laboratory roles):
// status 'episode_opened' (with caseId, also links the sample to the episode) or
// 'no_surveillance_needed' (with a reason code and an optional note).
export async function reviewLaboratorySample(organizationId,sampleRecordId,{status,reason=null,note=null,caseId=null}){
  assertCloud()
  const {error}=await supabase.rpc('review_laboratory_sample',{p_organization_id:organizationId,p_sample_id:sampleRecordId,p_status:status,p_reason:reason,p_note:note,p_case_id:caseId})
  if(error)throw error
  return true
}

// The samples of one patient record: the patient's own and those of its
// surveillance episodes, instead of the organization's whole list.
const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export async function loadPatientLaboratorySamples(organizationId,{patientRecordId=null,caseIds=[]}={}){
  assertCloud()
  if(!organizationId)return []
  const cases=[...new Set((caseIds||[]).filter(id=>UUID_PATTERN.test(String(id))))]
  const filters=[UUID_PATTERN.test(String(patientRecordId||''))&&`patient_id.eq.${patientRecordId}`,cases.length&&`surveillance_case_id.in.(${cases.join(',')})`].filter(Boolean)
  if(!filters.length)return []
  const rows=await selectAllPages(()=>supabase.from('laboratory_samples').select('*').eq('organization_id',organizationId).or(filters.join(',')).order('created_at',{ascending:false}).order('id',{ascending:true}))
  return hydrateSamples(rows)
}

// Every sample of the organization, for reports that must see the full history.
export async function loadAllLaboratorySamples(organizationId){
  return loadLaboratorySamples(organizationId)
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
  const {data,error}=await supabase.from('laboratory_samples').insert({
    organization_id:organizationId,
    patient_id:patientRecordId||null,
    department_id:draft.departmentId||null,
    surveillance_case_id:draft.surveillanceCaseId||null,
    employee_surveillance_id:draft.employeeSurveillanceId||null,
    employee_surveillance_batch_id:draft.employeeSurveillanceBatchId||null,
    subject_type:draft.subjectType||null,
    subject_name:draft.subjectName||null,
    subject_code:draft.subjectCode||null,
    sample_code:code,
    sample_type:draft.type,
    specimen_type_id:draft.specimenTypeId||null,
    source_site:draft.source||null,
    environmental_method:draft.environmentalMethod||null,
    location:draft.location||null,
    point:draft.point||null,
    environmental_batch_id:draft.environmentalBatchId||null,
    collected_at:iso(draft.collectedAt),
    requested_at:iso(draft.requestedAt||new Date()),
    requested_by:actorId,
    received_at:iso(draft.receivedAt),
    status:draft.collectedAt?'collected':'requested',
    priority:draft.priority||'routine',
    clinical_context:draft.clinicalContext&&Object.keys(draft.clinicalContext).length?draft.clinicalContext:null,
    created_by:actorId,
  }).select('*').single()
  if(error)throw error
  return (await hydrateSamples([data]))[0]
}

export async function deleteLaboratorySample(organizationId,sampleRecordId){
  assertCloud()
  if(!organizationId||!sampleRecordId)throw new Error('Laboratory sample is required.')
  const {data:micro,error:microError}=await supabase.from('microbiology_results').select('id').eq('organization_id',organizationId).eq('sample_id',sampleRecordId)
  if(microError)throw microError
  const microIds=(micro||[]).map(row=>row.id)
  const {data:sample}=await supabase.from('laboratory_samples').select('*').eq('organization_id',organizationId).eq('id',sampleRecordId).maybeSingle()
  const {data:amrRows,error:amrError}=microIds.length?await supabase.from('amr_classifications').select('id').eq('organization_id',organizationId).in('microbiology_result_id',microIds):{data:[],error:null}
  if(amrError)throw amrError
  const amrIds=(amrRows||[]).map(row=>row.id)
  // Deletion order, children first: an AMR classification's categories before it.
  const childParts=microIds.length?[
    ...['antimicrobial_susceptibility_results','critical_result_communications'].map(table=>({table,match:{microbiology_result_id:microIds}})),
    ...(amrIds.length?[{table:'amr_classification_categories',match:{amr_classification_id:amrIds}}]:[]),
    {table:'amr_classifications',match:{microbiology_result_id:microIds}},
  ]:[]
  await binCloudRows(organizationId,{module:'clinical',kind:'laboratory_samples',...describeDeleted('Δείγμα εργαστηρίου',{...(sample||{}),code:sample?.sample_code||sample?.code}),parts:[...childParts,{table:'microbiology_results',match:{sample_id:sampleRecordId}},{table:'laboratory_samples',match:{id:sampleRecordId}}]})
  if(microIds.length){
    for(const table of ['antimicrobial_susceptibility_results','critical_result_communications','amr_classifications']){const {error}=await supabase.from(table).delete().eq('organization_id',organizationId).in('microbiology_result_id',microIds);if(error)throw error}
    const {error}=await supabase.from('microbiology_results').delete().eq('organization_id',organizationId).in('id',microIds);if(error)throw error
  }
  const {error}=await supabase.from('laboratory_samples').delete().eq('organization_id',organizationId).eq('id',sampleRecordId);if(error)throw error
  return true
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
  const now=new Date().toISOString()
  const base={organization_id:organizationId,sample_id:sampleRecordId,result_status:draft.result||'inconclusive',organism:draft.organism||null,susceptibility_summary:draft.susceptibilitySummary||null,is_critical:Boolean(draft.critical),resulted_at:iso(draft.resultedAt||new Date()),updated_by:actorId,updated_at:now,method:draft.method||null,preliminary:Boolean(draft.preliminary),interpretation_standard:draft.interpretationStandard||null,interpretation_version:draft.interpretationVersion||null,cfu_count:draft.cfuCount==null||draft.cfuCount===''?null:Number(draft.cfuCount),cfu_limit:draft.cfuLimit==null||draft.cfuLimit===''?null:Number(draft.cfuLimit),within_limit:draft.withinLimit==null?null:Boolean(draft.withinLimit)}
  let data
  if(draft.id){
    const {data:existing,error:existingError}=await supabase.from('microbiology_results').select('id,validation_status').eq('organization_id',organizationId).eq('id',draft.id).single()
    if(existingError)throw existingError
    if(['validated','amended'].includes(existing.validation_status)){
      const result=await supabase.from('microbiology_results').insert({...base,validation_status:'amended',validated_at:now,validated_by:actorId,amended_from:existing.id,created_by:actorId}).select('*').single()
      if(result.error)throw result.error
      data=result.data
    }else{
      const validationStatus=draft.validationStatus||'draft'
      const result=await supabase.from('microbiology_results').update({...base,validation_status:validationStatus,validated_at:validationStatus==='validated'?now:null,validated_by:validationStatus==='validated'?actorId:null}).eq('organization_id',organizationId).eq('id',draft.id).select('*').single()
      if(result.error)throw result.error
      data=result.data
    }
  }else{
    const validationStatus=draft.validationStatus||'draft'
    const result=await supabase.from('microbiology_results').insert({...base,validation_status:validationStatus,validated_at:validationStatus==='validated'?now:null,validated_by:validationStatus==='validated'?actorId:null,created_by:actorId}).select('*').single()
    if(result.error)throw result.error
    data=result.data
  }
  if(['validated','amended'].includes(data.validation_status)){
    const {error:sampleError}=await supabase.from('laboratory_samples').update({status:'completed',updated_by:actorId,updated_at:now}).eq('organization_id',organizationId).eq('id',sampleRecordId)
    if(sampleError)throw sampleError
  }
  return data
}

export async function addAstResult(organizationId,microbiologyResultId,draft){
  assertCloud()
  const actorId=await currentUserId()
  const {data,error}=await supabase.from('antimicrobial_susceptibility_results').insert({organization_id:organizationId,microbiology_result_id:microbiologyResultId,organism:draft.organism||null,antimicrobial_code:draft.code||null,antimicrobial_name:draft.drug,method:draft.method||'MIC',mic_value:draft.mic||null,mic_operator:draft.operator||null,zone_diameter_mm:draft.zone||null,sir_category:draft.sir||'S',breakpoint_standard:draft.standard||'EUCAST',breakpoint_version:draft.version,technical_uncertainty:Boolean(draft.technicalUncertainty),notes:draft.notes||null,created_by:actorId}).select('*').single()
  if(error)throw error
  return data
}

export async function saveAmrClassification(organizationId,microbiologyResultId,draft){
  assertCloud()
  const actorId=await currentUserId()
  const now=new Date().toISOString()
  const classification=draft.classification||null
  const payload={organization_id:organizationId,microbiology_result_id:microbiologyResultId,organism:draft.organism||null,classification,definition_source:draft.definitionSource||'Magiorakos et al.',definition_version:draft.definitionVersion||'2012',...amrCalculationColumns(draft.calculationSnapshot),status:draft.status||'confirmed',rationale:draft.rationale||null,classified_by:actorId,classified_at:now}
  const {data,error}=await supabase.from('amr_classifications').insert(payload).select('*').single()
  if(error)throw error
  const categoryRows=amrCategoryRows(draft.calculationSnapshot).map(row=>({...row,organization_id:organizationId,amr_classification_id:data.id,created_by:actorId}))
  if(categoryRows.length){
    const {error:categoryError}=await supabase.from('amr_classification_categories').insert(categoryRows)
    if(categoryError)throw categoryError
  }
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

export async function markDocumentsReviewed(organizationId,sampleRecordId){
  assertCloud()
  const actorId=await currentUserId()
  const {error}=await supabase.from('laboratory_samples').update({documents_reviewed_at:new Date().toISOString(),documents_reviewed_by:actorId,updated_by:actorId,updated_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('id',sampleRecordId)
  if(error)throw error
}

export async function finalizeLaboratorySample(organizationId,sampleRecordId){
  assertCloud()
  const actorId=await currentUserId()
  const now=new Date().toISOString()
  const {error}=await supabase.from('laboratory_samples').update({finalized_at:now,finalized_by:actorId,status:'completed',updated_by:actorId,updated_at:now}).eq('organization_id',organizationId).eq('id',sampleRecordId)
  if(error)throw error
}

export async function reopenLaboratorySample(organizationId,sampleRecordId,reason){
  assertCloud()
  const actorId=await currentUserId()
  const now=new Date().toISOString()
  const {error}=await supabase.from('laboratory_samples').update({finalized_at:null,finalized_by:null,documents_reviewed_at:null,documents_reviewed_by:null,correction_reason:reason||null,status:'processing',updated_by:actorId,updated_at:now}).eq('organization_id',organizationId).eq('id',sampleRecordId)
  if(error)throw error
}

export async function loadEnvironmentalStandards(organizationId){
  assertCloud()
  if(!organizationId)return []
  const {data,error}=await supabase.from('environmental_standards').select('payload').eq('organization_id',organizationId)
  if(error)throw error
  return (data||[]).map(row=>row.payload)
}

export function resolveEnvironmentalStandard(standards,category,method){
  const list=standards||[]
  return list.find(item=>item.active&&item.subjectType===category&&item.sourceCode===method)
    || list.find(item=>item.active&&item.subjectType===category)
    || null
}

const pendingSampleStatuses=['requested','collected','received','processing']
export function getEnvironmentalKpis(rows){
  return {
    active:(rows||[]).filter(row=>pendingSampleStatuses.includes(row.status)).length,
    pendingLab:(rows||[]).filter(row=>pendingSampleStatuses.includes(row.status)&&!row.result).length,
    positive:(rows||[]).filter(row=>row.result==='positive').length,
    critical:(rows||[]).filter(row=>row.critical).length,
  }
}

export function getLaboratoryKpis(rows){
  const today=new Date().toISOString().slice(0,10)
  const turnaroundHours=(rows||[]).map(computeTurnaroundHours).filter(hours=>hours!=null)
  return {
    today:(rows||[]).filter(row=>String(row.requestedAt||row.collectedAt||'').slice(0,10)===today).length,
    pending:(rows||[]).filter(row=>['requested','collected','received','processing'].includes(row.status)).length,
    positive:(rows||[]).filter(row=>row.result==='positive').length,
    amr:(rows||[]).filter(row=>Boolean(row.resistance)).length,
    critical:(rows||[]).filter(row=>row.critical&&!(row.microbiologyResults||[]).some(result=>result.communications?.length)).length,
    avgTatHours:turnaroundHours.length?turnaroundHours.reduce((sum,hours)=>sum+hours,0)/turnaroundHours.length:null,
  }
}
