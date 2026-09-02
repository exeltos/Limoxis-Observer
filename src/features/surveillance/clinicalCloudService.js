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
const latest=(rows=[])=>rows[0]||null

function eventPayload(events,type){
  const row=(events||[]).find(item=>item.event_type===type)
  return row?.payload||null
}

function mapAssessment(row){
  if(!row)return null
  return {id:row.id,date:dateOnly(row.assessed_at),assessmentType:row.assessment_type,classification:row.classification,signsSymptoms:row.signs_symptoms||[],riskFactors:row.risk_factors||[],summary:row.summary||'',notes:row.summary||'',byId:row.created_by}
}

function mapHai(row){
  if(!row)return null
  return {id:row.id,status:row.case_status,type:row.hai_type,definitionSet:row.definition_set,definitionVersion:row.definition_version,criteriaMet:row.criteria_met,criteriaEvidence:row.criteria_evidence||[],rationale:row.rationale||'',classifiedAt:row.classified_at,classifiedBy:row.classified_by}
}

function mapAmr(row){
  if(!row)return null
  return {id:row.id,classification:row.classification,status:row.status,definitionSource:row.definition_source,definitionVersion:row.definition_version,calculationSnapshot:row.calculation_snapshot||{},rationale:row.rationale||'',classifiedAt:row.classified_at,classifiedBy:row.classified_by}
}

function mapMicrobiologyResult(row,{amrRows=[],astRows=[],communications=[]}={}){
  if(!row)return null
  return {
    id:row.id,
    status:row.result_status,
    organism:row.organism,
    resistanceClass:row.resistance_class,
    susceptibilitySummary:row.susceptibility_summary,
    critical:row.is_critical,
    resultedAt:row.resulted_at,
    validationStatus:row.validation_status,
    validatedAt:row.validated_at,
    validatedBy:row.validated_by,
    method:row.method,
    preliminary:row.preliminary,
    interpretationStandard:row.interpretation_standard,
    interpretationVersion:row.interpretation_version,
    amr:mapAmr(latest(amrRows.filter(item=>item.microbiology_result_id===row.id))),
    ast:astRows.filter(item=>item.microbiology_result_id===row.id).map(item=>({id:item.id,antimicrobial:item.antimicrobial,method:item.method,micValue:item.mic_value,diskZoneMm:item.disk_zone_mm,interpretation:item.interpretation,breakpointStandard:item.breakpoint_standard,breakpointVersion:item.breakpoint_version,breakpointValue:item.breakpoint_value,testedAt:item.tested_at})),
    communications:communications.filter(item=>item.microbiology_result_id===row.id).map(item=>({id:item.id,at:item.communicated_at,byId:item.communicated_by,recipient:item.recipient,channel:item.channel,readBackConfirmed:item.read_back_confirmed,notes:item.notes||''})),
  }
}

function mapSample(row,related={}){
  const results=(related.results||[]).filter(item=>item.sample_id===row.id).map(item=>mapMicrobiologyResult(item,related))
  const validated=results.find(item=>item.validationStatus==='validated')||results[0]||null
  return {
    id:row.sample_code,
    recordId:row.id,
    type:row.sample_type,
    source:row.source_site,
    collectedAt:row.collected_at,
    receivedAt:row.received_at,
    requestedAt:row.requested_at,
    requestedBy:row.requested_by,
    status:row.status,
    result:validated?.status||null,
    organism:validated?.organism||null,
    resistance:validated?.amr?.classification||validated?.resistanceClass||null,
    critical:Boolean(validated?.critical),
    priority:row.priority,
    surveillanceCaseId:row.surveillance_case_id,
    microbiologyResults:results,
  }
}

function mapIsolation(row){
  if(!row)return null
  return {id:row.id,precautions:row.precautions||[],room:row.room||'',reason:row.reason||'',startedAt:row.started_at,reviewDue:row.review_due_at,endedAt:row.ended_at,endReason:row.end_reason||'',status:row.status,createdBy:row.created_by,endedBy:row.ended_by}
}

function mapTherapy(row){
  return {id:row.id,antimicrobial:row.antimicrobial,dose:row.dose||'',route:row.route||'',indication:row.indication||'',startedAt:row.started_at,plannedEndAt:row.planned_end_at,endedAt:row.ended_at,approvalStatus:row.approval_status,status:row.status,createdBy:row.created_by}
}

function mapDevice(row){
  return {id:row.id,name:row.device_type,nameEn:row.device_type,site:row.site,siteEn:row.site,indication:row.indication,indicationEn:row.indication,insertedAt:row.inserted_at,reviewDue:row.review_due_at,removedAt:row.removed_at,status:row.status,createdBy:row.created_by}
}

function mapReassessment(row){
  return {id:row.id,date:dateOnly(row.reassessed_at),status:row.clinical_status,decision:row.isolation_decision||row.therapy_decision||'',isolationDecision:row.isolation_decision,therapyDecision:row.therapy_decision,notes:row.notes||'',nextReviewDue:dateOnly(row.next_review_due_at),byId:row.created_by}
}

function mapOutcome(row){
  if(!row)return null
  return {id:row.id,status:row.outcome,date:dateOnly(row.occurred_at),notes:row.notes||'',recordedById:row.created_by}
}

function clinicalTimeline({events=[],assessments=[],hai=[],samples=[],therapies=[],isolations=[],reassessments=[],outcomes=[],devices=[]}){
  return [
    ...events.map(row=>({at:row.occurred_at||row.created_at,type:row.event_type,actorId:row.created_by,detail:row.payload?.detail||row.event_status})),
    ...assessments.map(row=>({at:row.assessed_at,type:'clinical_assessment',actorId:row.created_by,detail:row.classification||row.assessment_type})),
    ...hai.map(row=>({at:row.classified_at,type:'hai_classification',actorId:row.classified_by,detail:`${row.hai_type} · ${row.case_status}`})),
    ...samples.map(row=>({at:row.requested_at||row.collected_at||row.created_at,type:'sample_requested',actorId:row.requested_by||row.created_by,detail:row.sample_code})),
    ...therapies.map(row=>({at:row.started_at,type:'therapy_started',actorId:row.created_by,detail:row.antimicrobial})),
    ...isolations.map(row=>({at:row.started_at,type:'isolation_started',actorId:row.created_by,detail:row.reason})),
    ...reassessments.map(row=>({at:row.reassessed_at,type:'reassessment',actorId:row.created_by,detail:row.clinical_status})),
    ...outcomes.map(row=>({at:row.occurred_at,type:'outcome',actorId:row.created_by,detail:row.outcome})),
    ...devices.map(row=>({at:row.inserted_at||row.created_at,type:'device_added',actorId:row.created_by,detail:row.device_type})),
  ].filter(item=>item.at).sort((a,b)=>new Date(b.at)-new Date(a.at))
}

export function mapClinicalCase({caseRow,patient,department,events=[],assessments=[],hai=[],samples=[],relatedLab={},therapies=[],isolations=[],reassessments=[],outcomes=[],devices=[]}){
  const start=eventPayload(events,'surveillance_start')||{}
  const caseAssessments=assessments.filter(row=>row.surveillance_case_id===caseRow.id)
  const caseHai=hai.filter(row=>row.surveillance_case_id===caseRow.id)
  const caseSamples=samples.filter(row=>row.surveillance_case_id===caseRow.id)
  const caseTherapies=therapies.filter(row=>row.surveillance_case_id===caseRow.id)
  const caseIsolations=isolations.filter(row=>row.surveillance_case_id===caseRow.id)
  const caseReassessments=reassessments.filter(row=>row.surveillance_case_id===caseRow.id)
  const caseOutcomes=outcomes.filter(row=>row.surveillance_case_id===caseRow.id)
  const caseDevices=devices.filter(row=>row.surveillance_case_id===caseRow.id)
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
    assessment:mapAssessment(latest(caseAssessments)),
    assessments:caseAssessments.map(mapAssessment),
    haiClassification:mapHai(latest(caseHai)),
    haiClassifications:caseHai.map(mapHai),
    isolation:mapIsolation(caseIsolations.find(row=>row.status==='active')||latest(caseIsolations)),
    isolations:caseIsolations.map(mapIsolation),
    therapy:caseTherapies.map(mapTherapy),
    samples:caseSamples.map(row=>mapSample(row,relatedLab)),
    reassessments:caseReassessments.map(mapReassessment),
    outcome:mapOutcome(latest(caseOutcomes)),
    devices:caseDevices.map(mapDevice),
    timeline:clinicalTimeline({events,assessments:caseAssessments,hai:caseHai,samples:caseSamples,therapies:caseTherapies,isolations:caseIsolations,reassessments:caseReassessments,outcomes:caseOutcomes,devices:caseDevices}),
    reopenedAt:caseRow.reopened_at,
    reopenReason:caseRow.reopen_reason,
  }
}

async function hydrateCases(caseRows){
  if(!caseRows?.length)return []
  const caseIds=caseRows.map(row=>row.id)
  const patientIds=[...new Set(caseRows.map(row=>row.patient_id))]
  const departmentIds=[...new Set(caseRows.map(row=>row.department_id).filter(Boolean))]
  const [patientsResult,departmentsResult,eventsResult,assessmentsResult,haiResult,samplesResult,therapiesResult,isolationsResult,reassessmentsResult,outcomesResult,devicesResult]=await Promise.all([
    supabase.from('patients').select('id,patient_code,first_name,last_name,date_of_birth,admission_date,status').in('id',patientIds),
    departmentIds.length?supabase.from('departments').select('id,name').in('id',departmentIds):Promise.resolve({data:[],error:null}),
    supabase.from('surveillance_events').select('*').in('surveillance_case_id',caseIds).order('created_at',{ascending:false}),
    supabase.from('clinical_assessments').select('*').in('surveillance_case_id',caseIds).order('assessed_at',{ascending:false}),
    supabase.from('hai_classifications').select('*').in('surveillance_case_id',caseIds).order('classified_at',{ascending:false}),
    supabase.from('laboratory_samples').select('*').in('surveillance_case_id',caseIds).order('requested_at',{ascending:false,nullsFirst:false}),
    supabase.from('antimicrobial_therapies').select('*').in('surveillance_case_id',caseIds).order('started_at',{ascending:false}),
    supabase.from('isolation_episodes').select('*').in('surveillance_case_id',caseIds).order('started_at',{ascending:false}),
    supabase.from('surveillance_reassessments').select('*').in('surveillance_case_id',caseIds).order('reassessed_at',{ascending:false}),
    supabase.from('surveillance_outcomes').select('*').in('surveillance_case_id',caseIds).order('occurred_at',{ascending:false}),
    supabase.from('surveillance_devices').select('*').in('surveillance_case_id',caseIds).order('inserted_at',{ascending:false,nullsFirst:false}),
  ])
  const baseResults=[patientsResult,departmentsResult,eventsResult,assessmentsResult,haiResult,samplesResult,therapiesResult,isolationsResult,reassessmentsResult,outcomesResult,devicesResult]
  for(const result of baseResults)if(result.error)throw result.error

  const sampleIds=(samplesResult.data||[]).map(row=>row.id)
  let relatedLab={results:[],amrRows:[],astRows:[],communications:[]}
  if(sampleIds.length){
    const microbiologyResult=await supabase.from('microbiology_results').select('*').in('sample_id',sampleIds).order('resulted_at',{ascending:false})
    if(microbiologyResult.error)throw microbiologyResult.error
    const resultIds=(microbiologyResult.data||[]).map(row=>row.id)
    relatedLab.results=microbiologyResult.data||[]
    if(resultIds.length){
      const [amrResult,astResult,communicationResult]=await Promise.all([
        supabase.from('amr_classifications').select('*').in('microbiology_result_id',resultIds).order('classified_at',{ascending:false,nullsFirst:false}),
        supabase.from('antimicrobial_susceptibility_results').select('*').in('microbiology_result_id',resultIds).order('tested_at',{ascending:false,nullsFirst:false}),
        supabase.from('critical_result_communications').select('*').in('microbiology_result_id',resultIds).order('communicated_at',{ascending:false}),
      ])
      for(const result of [amrResult,astResult,communicationResult])if(result.error)throw result.error
      relatedLab={...relatedLab,amrRows:amrResult.data||[],astRows:astResult.data||[],communications:communicationResult.data||[]}
    }
  }

  return caseRows.map(caseRow=>mapClinicalCase({
    caseRow,
    patient:(patientsResult.data||[]).find(row=>row.id===caseRow.patient_id),
    department:(departmentsResult.data||[]).find(row=>row.id===caseRow.department_id),
    events:(eventsResult.data||[]).filter(row=>row.surveillance_case_id===caseRow.id),
    assessments:assessmentsResult.data||[],
    hai:haiResult.data||[],
    samples:samplesResult.data||[],
    relatedLab,
    therapies:therapiesResult.data||[],
    isolations:isolationsResult.data||[],
    reassessments:reassessmentsResult.data||[],
    outcomes:outcomesResult.data||[],
    devices:devicesResult.data||[],
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

export async function saveClinicalAssessment(organizationId,record,draft){
  assertCloud()
  const actorId=await currentUserId()
  const {data,error}=await supabase.from('clinical_assessments').insert({organization_id:organizationId,surveillance_case_id:record.recordId,patient_id:record.patientRecordId,department_id:record.departmentId||null,assessment_type:draft.assessmentType||'suspected',classification:draft.classification||'undetermined',signs_symptoms:draft.signsSymptoms||[],risk_factors:draft.riskFactors||[],summary:draft.summary||draft.notes||null,assessed_at:iso(draft.date||new Date()),created_by:actorId}).select('*').single()
  if(error)throw error
  return mapAssessment(data)
}

export async function saveHaiClassification(organizationId,record,draft){
  assertCloud()
  const actorId=await currentUserId()
  const {data,error}=await supabase.from('hai_classifications').insert({organization_id:organizationId,surveillance_case_id:record.recordId,patient_id:record.patientRecordId,case_status:draft.status||'suspected',hai_type:draft.type,definition_set:draft.definitionSet||'local',definition_version:draft.definitionVersion||null,criteria_met:draft.criteriaMet??null,criteria_evidence:draft.criteriaEvidence||[],rationale:draft.rationale||null,classified_at:iso(draft.classifiedAt||new Date()),classified_by:actorId}).select('*').single()
  if(error)throw error
  return mapHai(data)
}

function sampleCode(){
  const stamp=new Date().toISOString().slice(2,10).replaceAll('-','')
  const suffix=Math.random().toString(36).slice(2,8).toUpperCase()
  return `LAB-${stamp}-${suffix}`
}

export async function requestLaboratorySample(organizationId,record,draft){
  assertCloud()
  const actorId=await currentUserId()
  const {data,error}=await supabase.from('laboratory_samples').insert({organization_id:organizationId,patient_id:record.patientRecordId,surveillance_case_id:record.recordId,department_id:record.departmentId||null,sample_code:sampleCode(),sample_type:draft.type,source_site:draft.source||null,collected_at:null,received_at:null,status:'requested',requested_at:iso(new Date()),requested_by:actorId,priority:draft.priority||'routine',created_by:actorId}).select('*').single()
  if(error)throw error
  return mapSample(data)
}

export async function startIsolation(organizationId,record,draft){
  assertCloud()
  const actorId=await currentUserId()
  const {data,error}=await supabase.from('isolation_episodes').insert({organization_id:organizationId,patient_id:record.patientRecordId,surveillance_case_id:record.recordId,department_id:record.departmentId||null,precautions:draft.precautions||[],room:draft.room||null,reason:draft.reason,started_at:iso(draft.startedAt||new Date()),review_due_at:iso(draft.reviewDue),status:'active',created_by:actorId}).select('*').single()
  if(error)throw error
  return mapIsolation(data)
}

export async function endIsolation(organizationId,isolationId,draft={}){
  assertCloud()
  const actorId=await currentUserId()
  const {data,error}=await supabase.from('isolation_episodes').update({status:draft.status||'ended',ended_at:iso(draft.endedAt||new Date()),end_reason:draft.reason||null,ended_by:actorId,updated_by:actorId,updated_at:iso(new Date())}).eq('organization_id',organizationId).eq('id',isolationId).select('*').single()
  if(error)throw error
  return mapIsolation(data)
}

export async function addAntimicrobialTherapy(organizationId,record,draft){
  assertCloud()
  const actorId=await currentUserId()
  const {data,error}=await supabase.from('antimicrobial_therapies').insert({organization_id:organizationId,patient_id:record.patientRecordId,surveillance_case_id:record.recordId,antimicrobial:draft.antimicrobial,dose:draft.dose||null,route:draft.route||null,indication:draft.indication||null,started_at:iso(draft.startedAt||new Date()),planned_end_at:iso(draft.plannedEndAt),approval_status:draft.approvalStatus||'not_required',status:'active',created_by:actorId}).select('*').single()
  if(error)throw error
  return mapTherapy(data)
}

export async function endAntimicrobialTherapy(organizationId,therapyId,draft={}){
  assertCloud()
  const actorId=await currentUserId()
  const {data,error}=await supabase.from('antimicrobial_therapies').update({status:draft.status||'completed',ended_at:iso(draft.endedAt||new Date()),updated_by:actorId,updated_at:iso(new Date())}).eq('organization_id',organizationId).eq('id',therapyId).select('*').single()
  if(error)throw error
  return mapTherapy(data)
}

export async function addSurveillanceDevice(organizationId,record,draft){
  assertCloud()
  const actorId=await currentUserId()
  const {data,error}=await supabase.from('surveillance_devices').insert({organization_id:organizationId,surveillance_case_id:record.recordId,patient_id:record.patientRecordId,department_id:record.departmentId||null,device_type:draft.type,site:draft.site||null,indication:draft.indication||null,inserted_at:iso(draft.insertedAt||new Date()),review_due_at:iso(draft.reviewDue),status:'active',created_by:actorId}).select('*').single()
  if(error)throw error
  return mapDevice(data)
}

export async function removeSurveillanceDevice(organizationId,deviceId,draft={}){
  assertCloud()
  const actorId=await currentUserId()
  const {data,error}=await supabase.from('surveillance_devices').update({status:'removed',removed_at:iso(draft.removedAt||new Date()),updated_by:actorId,updated_at:iso(new Date())}).eq('organization_id',organizationId).eq('id',deviceId).select('*').single()
  if(error)throw error
  return mapDevice(data)
}

export async function saveAmrClassification(organizationId,microbiologyResultId,draft){
  assertCloud()
  const actorId=await currentUserId()
  const {data,error}=await supabase.from('amr_classifications').insert({organization_id:organizationId,microbiology_result_id:microbiologyResultId,classification:draft.classification||null,definition_source:draft.definitionSource,definition_version:draft.definitionVersion,calculation_snapshot:draft.calculationSnapshot||{},status:draft.status||'proposed',rationale:draft.rationale||null,classified_by:actorId,classified_at:iso(draft.classifiedAt||new Date())}).select('*').single()
  if(error)throw error
  return mapAmr(data)
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