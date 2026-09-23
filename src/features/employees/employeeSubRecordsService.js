import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadOccupationalVisits as loadVisitsLocal, loadVaccinations as loadVaccinationsLocal, loadEmployeeTraining as loadTrainingLocal, loadEvaluations as loadEvaluationsLocal, loadCertificates as loadCertificatesLocal, saveCertificates as saveCertificatesLocal, loadExposureIncidents as loadExposureIncidentsLocal, saveExposureIncidents as saveExposureIncidentsLocal } from './employeeRecordsService'

function ensureProductionContext(organizationId,employeeDbId,operation){
  if(isDemoDataEnvironment())return false
  if(!hasSupabaseConfig||!supabase)throw new Error(`PRODUCTION_CLOUD_REQUIRED:${operation}`)
  if(!organizationId)throw new Error(`PRODUCTION_ORGANIZATION_REQUIRED:${operation}`)
  if(!employeeDbId)throw new Error(`PRODUCTION_EMPLOYEE_DB_ID_REQUIRED:${operation}`)
  return true
}

function cloudEnabled() {
  return hasSupabaseConfig && Boolean(supabase) && !isDemoDataEnvironment()
}

async function loadCanonicalTrainingContext(organizationId,employeeDbId,employeeId){
  ensureProductionContext(organizationId,employeeDbId,'training_records.employee_context')
  const {data:employee,error:employeeError}=await supabase
    .from('employees')
    .select('id,employee_code,user_id')
    .eq('organization_id',organizationId)
    .eq('id',employeeDbId)
    .maybeSingle()
  if(employeeError)throw employeeError

  const {data:assignmentRows,error:assignmentError}=await supabase
    .from('training_records')
    .select('id,record_key,record_type,employee_user_id,payload,created_at,updated_at')
    .eq('organization_id',organizationId)
    .eq('record_type','assignment')
    .order('updated_at',{ascending:false})
  if(assignmentError)throw assignmentError

  const employeeCode=String(employee?.employee_code||employeeId||'').trim()
  const userId=employee?.user_id||null
  const assignments=(assignmentRows||[]).filter(row=>{
    const payload=row.payload||{}
    const payloadEmployeeId=String(payload.employeeId||'').trim()
    return Boolean(
      (userId&&row.employee_user_id===userId)||
      (employeeCode&&payloadEmployeeId===employeeCode)||
      (employeeId&&payloadEmployeeId===String(employeeId))
    )
  })

  const programIds=[...new Set(assignments.map(row=>row.payload?.programId).filter(Boolean))]
  let programMap=new Map()
  if(programIds.length){
    const {data:programRows,error:programError}=await supabase
      .from('training_records')
      .select('record_key,payload')
      .eq('organization_id',organizationId)
      .eq('record_type','program')
      .in('record_key',programIds)
    if(programError)throw programError
    programMap=new Map((programRows||[]).map(row=>[row.record_key,row.payload||{}]))
  }
  return {assignments,programMap}
}

// --- Occupational health visits ---
function visitFromRow(row) {
  return {
    id:row.id,
    employeeId:row.employee_id,
    date:row.visit_date,
    type:row.visit_type,
    status:row.status,
    followUpDate:row.follow_up_date||null,
    fitStatus:row.fitness_status||'',
    clinicalNotes:row.clinical_notes||'',
    createdAt:row.created_at||null,
    updatedAt:row.updated_at||null,
  }
}
export async function loadOccupationalVisitsAsync(organizationId, employeeDbId, employeeId) {
  if(isDemoDataEnvironment())return loadVisitsLocal().filter(x => x.employeeId === employeeId)
  ensureProductionContext(organizationId,employeeDbId,'occupational_health_visits.load')
  const { data, error } = await supabase
    .from('occupational_health_visits')
    .select('id,employee_id,visit_date,visit_type,status,follow_up_date,fitness_status,clinical_notes,created_at,updated_at')
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeDbId)
    .order('visit_date', { ascending: false })
  if (error) throw error
  return (data || []).map(visitFromRow)
}

// --- Vaccinations ---
function vaccinationFromRow(row) {
  return {
    id:row.id,
    employeeId:row.employee_id,
    vaccine:row.vaccine_label_snapshot,
    dose:row.dose||'',
    date:row.vaccination_date,
    lotNumber:row.lot_number||'',
    validUntil:row.valid_until||null,
    status:row.status,
    clinicalNotes:row.clinical_notes||'',
    createdAt:row.created_at||null,
    updatedAt:row.updated_at||null,
  }
}
export async function loadVaccinationsAsync(organizationId, employeeDbId, employeeId) {
  if(isDemoDataEnvironment())return loadVaccinationsLocal().filter(x => x.employeeId === employeeId)
  ensureProductionContext(organizationId,employeeDbId,'employee_vaccinations.load')
  const { data, error } = await supabase
    .from('employee_vaccinations')
    .select('id,employee_id,vaccine_label_snapshot,dose,vaccination_date,lot_number,valid_until,status,clinical_notes,created_at,updated_at')
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeDbId)
    .order('vaccination_date', { ascending: false })
  if (error) throw error
  return (data || []).map(vaccinationFromRow)
}

// --- Training summary ---
// Production training has one source of truth: training_records. The employee tab derives
// its rows from assignment records and joins the corresponding programme payload.
export async function loadEmployeeTrainingAsync(organizationId, employeeDbId, employeeId) {
  if(isDemoDataEnvironment())return loadTrainingLocal().filter(x => x.employeeId === employeeId)
  const {assignments,programMap}=await loadCanonicalTrainingContext(organizationId,employeeDbId,employeeId)
  return assignments.map(row=>{
    const assignment=row.payload||{}
    const program=programMap.get(assignment.programId)||{}
    const title=program.title||assignment.programTitle||assignment.title||assignment.programId||'Training'
    return {
      id:row.record_key,
      employeeId:employeeDbId,
      titleEl:title,
      titleEn:program.titleEn||title,
      date:assignment.completedDate||program.startDate||assignment.assignedDate||program.dueDate||String(row.updated_at||row.created_at||'').slice(0,10),
      assignedDate:assignment.assignedDate||'',
      completedDate:assignment.completedDate||'',
      dueDate:program.dueDate||assignment.dueDate||'',
      status:assignment.status||'assigned',
      programId:assignment.programId||null,
      score:assignment.score??null,
      competent:assignment.competent??null,
      source:'training_records',
    }
  })
}

// --- Evaluations ---
const EVALUATION_COLUMNS='id,employee_id,title,title_en,evaluation_date,result,result_en,notes,evaluation_period,status,evaluator_user_id,criteria,overall_score,employee_comment,employee_acknowledged_at,employee_acknowledged_by,hr_approved_at,hr_approved_by,admin_approved_at,admin_approved_by,finalized_at'

function evaluationFromRow(row) {
  return { id:row.id,employeeId:row.employee_id,titleEl:row.title,titleEn:row.title_en||row.title,date:row.evaluation_date,resultEl:row.result||'',resultEn:row.result_en||row.result||'',period:row.evaluation_period||'',status:row.status||'draft',evaluatorUserId:row.evaluator_user_id||null,criteria:Array.isArray(row.criteria)?row.criteria:[],overallScore:row.overall_score==null?null:Number(row.overall_score),notes:row.notes||'',employeeComment:row.employee_comment||'',employeeAcknowledgedAt:row.employee_acknowledged_at||null,hrApprovedAt:row.hr_approved_at||null,adminApprovedAt:row.admin_approved_at||null,finalizedAt:row.finalized_at||null,source:'employee_evaluations' }
}

function evaluationScore(criteria=[]){const valid=criteria.filter(x=>Number(x.score)>=1&&Number(x.score)<=5);if(!valid.length)return null;const totalWeight=valid.reduce((n,x)=>n+(Number(x.weight)||1),0);return Number((valid.reduce((n,x)=>n+Number(x.score)*(Number(x.weight)||1),0)/totalWeight).toFixed(2))}

export async function createEmployeeEvaluationAsync(organizationId,employeeDbId,draft){
  ensureProductionContext(organizationId,employeeDbId,'employee_evaluations.create')
  const {data:userData}=await supabase.auth.getUser();const userId=userData?.user?.id||null
  const score=evaluationScore(draft.criteria)
  const {data,error}=await supabase.from('employee_evaluations').insert({organization_id:organizationId,employee_id:employeeDbId,title:'Αξιολόγηση απόδοσης',title_en:'Performance evaluation',evaluation_date:draft.date,evaluation_period:draft.period,status:'draft',evaluator_user_id:userId,created_by:userId,criteria:draft.criteria||[],overall_score:score,notes:draft.notes||'',result:score==null?'':`${score} / 5`,result_en:score==null?'':`${score} / 5`}).select(EVALUATION_COLUMNS).single()
  if(error)throw error;return evaluationFromRow(data)
}

export async function updateEmployeeEvaluationWorkflowAsync(organizationId,employeeDbId,evaluationId,{action,comment=''}){
  ensureProductionContext(organizationId,employeeDbId,'employee_evaluations.workflow')
  const {data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const userId=userData?.user?.id;if(!userId)throw new Error('Authentication required')
  const now=new Date().toISOString();let patch
  if(action==='submit')patch={status:'submitted'}
  else if(action==='acknowledge')patch={status:'employee_acknowledged',employee_comment:comment||null,employee_acknowledged_at:now,employee_acknowledged_by:userId}
  else if(action==='hrApprove')patch={status:'hr_approved',hr_approved_at:now,hr_approved_by:userId}
  else if(action==='finalize')patch={status:'finalized',admin_approved_at:now,admin_approved_by:userId,finalized_at:now}
  else throw new Error('Unsupported evaluation workflow action')
  const {data,error}=await supabase.from('employee_evaluations').update(patch).eq('organization_id',organizationId).eq('employee_id',employeeDbId).eq('id',evaluationId).select(EVALUATION_COLUMNS).single();if(error)throw error;return evaluationFromRow(data)
}
export async function loadEvaluationsAsync(organizationId, employeeDbId, employeeId) {
  if(isDemoDataEnvironment())return loadEvaluationsLocal().filter(x => x.employeeId === employeeId)
  ensureProductionContext(organizationId,employeeDbId,'employee_evaluations.load')

  const [{data:formalRows,error:formalError},trainingContext]=await Promise.all([
    supabase
      .from('employee_evaluations')
      .select(EVALUATION_COLUMNS)
      .eq('organization_id', organizationId)
      .eq('employee_id', employeeDbId)
      .order('evaluation_date', { ascending: false }),
    loadCanonicalTrainingContext(organizationId,employeeDbId,employeeId),
  ])
  if(formalError)throw formalError

  const trainingEvaluations=trainingContext.assignments
    .filter(row=>{
      const a=row.payload||{}
      return a.score!=null||Boolean(a.assessmentSubmittedAt)||Boolean(a.assessmentReviewStatus)
    })
    .map(row=>{
      const a=row.payload||{}
      const program=trainingContext.programMap.get(a.programId)||{}
      const title=program.title||a.programTitle||a.programId||'Training'
      const score=a.score!=null?Number(a.score):null
      const competent=a.competent===true
      const resultEl=score!=null?`Βαθμολογία ${score}%${a.competent!=null?` · ${competent?'Επιτυχής':'Μη επιτυχής'}`:''}`:(a.assessmentReviewStatus||'Υποβλήθηκε')
      const resultEn=score!=null?`Score ${score}%${a.competent!=null?` · ${competent?'Passed':'Not passed'}`:''}`:(a.assessmentReviewStatus||'Submitted')
      return {
        id:`training-${row.record_key}`,
        employeeId:employeeDbId,
        titleEl:`Αξιολόγηση γνώσεων · ${title}`,
        titleEn:`Knowledge assessment · ${program.titleEn||title}`,
        date:a.completedDate||String(a.assessmentSubmittedAt||row.updated_at||row.created_at||'').slice(0,10),
        resultEl,
        resultEn,
        score,
        competent:a.competent??null,
        programId:a.programId||null,
        assessmentAnswers:a.assessmentAnswers||{},
        assessmentQuestions:Array.isArray(program.assessmentQuestions)?program.assessmentQuestions:[],
        certificateId:a.certificateId||null,
        certificate:a.certificate||null,
        program:{title, titleEn:program.titleEn||title},
        source:'training',
      }
    })

  return [...(formalRows||[]).map(evaluationFromRow),...trainingEvaluations]
    .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))
}

// --- Certificates ---
function certificateFromRow(row) {
  return { id: row.id, employeeId: row.employee_id, titleEl: row.title, titleEn: row.title_en || row.title, issuer: row.issuer || '', issueDate: row.issue_date || '', validUntil: row.valid_until || '', certificateNumber: row.certificate_number || '', attachments: [] }
}
const CERTIFICATE_COLUMNS = 'id,employee_id,title,title_en,issuer,issue_date,valid_until,certificate_number'

export function certificatesCloudEnabled(employeeDbId) {
  if(isDemoDataEnvironment())return false
  return cloudEnabled() && Boolean(employeeDbId)
}

export async function loadCertificatesAsync(organizationId, employeeDbId, employeeId) {
  if(isDemoDataEnvironment())return loadCertificatesLocal().filter(x => x.employeeId === employeeId)
  ensureProductionContext(organizationId,employeeDbId,'employee_certificates.load')
  const { data, error } = await supabase
    .from('employee_certificates')
    .select(CERTIFICATE_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeDbId)
    .order('issue_date', { ascending: false })
  if (error) throw error
  return (data || []).map(certificateFromRow)
}

export async function createCertificateAsync(organizationId, employeeDbId, draft) {
  ensureProductionContext(organizationId,employeeDbId,'employee_certificates.create')
  const { data, error } = await supabase
    .from('employee_certificates')
    .insert({
      organization_id: organizationId,
      employee_id: employeeDbId,
      title: draft.titleEl,
      title_en: draft.titleEn || draft.titleEl,
      issuer: draft.issuer || null,
      issue_date: draft.issueDate || null,
      valid_until: draft.validUntil || null,
      certificate_number: draft.certificateNumber || null,
    })
    .select(CERTIFICATE_COLUMNS)
    .single()
  if (error) throw error
  return certificateFromRow(data)
}

export async function updateCertificateAsync(organizationId, employeeDbId, id, draft) {
  ensureProductionContext(organizationId,employeeDbId,'employee_certificates.update')
  const { data, error } = await supabase
    .from('employee_certificates')
    .update({
      title: draft.titleEl,
      title_en: draft.titleEn || draft.titleEl,
      issuer: draft.issuer || null,
      issue_date: draft.issueDate || null,
      valid_until: draft.validUntil || null,
      certificate_number: draft.certificateNumber || null,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id',organizationId)
    .eq('employee_id',employeeDbId)
    .eq('id', id)
    .select(CERTIFICATE_COLUMNS)
    .single()
  if (error) throw error
  return certificateFromRow(data)
}

export async function deleteCertificateAsync(organizationId, employeeDbId, id) {
  ensureProductionContext(organizationId,employeeDbId,'employee_certificates.delete')
  const { error } = await supabase
    .from('employee_certificates')
    .delete()
    .eq('organization_id',organizationId)
    .eq('employee_id',employeeDbId)
    .eq('id',id)
  if(error)throw error
  return true
}

export function saveCertificatesLocalFallback(rows) {
  if(!isDemoDataEnvironment())throw new Error('PRODUCTION_LOCAL_WRITE_BLOCKED:employee_certificates')
  return saveCertificatesLocal(rows)
}

// --- Occupational exposure incidents (needlestick/sharps/mucocutaneous) ---
function exposureIncidentFromRow(row) {
  return {
    id: row.id, employeeId: row.employee_id, incidentDate: row.incident_date, exposureType: row.exposure_type,
    deviceOrSource: row.device_or_source || '', bodySite: row.body_site || '', sourcePatientStatus: row.source_patient_status || '',
    reportedAt: row.reported_at || null, pepAdministered: row.pep_administered ?? null, pepDetails: row.pep_details || '',
    followUpStatus: row.follow_up_status || 'pending', followUpDueAt: row.follow_up_due_at || '', notes: row.notes || '', status: row.status || 'open',
  }
}
const EXPOSURE_INCIDENT_COLUMNS = 'id,employee_id,incident_date,exposure_type,device_or_source,body_site,source_patient_status,reported_at,pep_administered,pep_details,follow_up_status,follow_up_due_at,notes,status'

export function exposureIncidentsCloudEnabled(employeeDbId) {
  if(isDemoDataEnvironment())return false
  return cloudEnabled() && Boolean(employeeDbId)
}

export async function loadExposureIncidentsAsync(organizationId, employeeDbId, employeeId) {
  if(isDemoDataEnvironment())return loadExposureIncidentsLocal().filter(x => x.employeeId === employeeId)
  ensureProductionContext(organizationId,employeeDbId,'occupational_exposure_incidents.load')
  const { data, error } = await supabase
    .from('occupational_exposure_incidents')
    .select(EXPOSURE_INCIDENT_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeDbId)
    .order('incident_date', { ascending: false })
  if (error) throw error
  return (data || []).map(exposureIncidentFromRow)
}

export async function createExposureIncidentAsync(organizationId, employeeDbId, draft) {
  ensureProductionContext(organizationId,employeeDbId,'occupational_exposure_incidents.create')
  const { data, error } = await supabase
    .from('occupational_exposure_incidents')
    .insert({
      organization_id: organizationId,
      employee_id: employeeDbId,
      incident_date: draft.incidentDate,
      exposure_type: draft.exposureType,
      device_or_source: draft.deviceOrSource || null,
      body_site: draft.bodySite || null,
      source_patient_status: draft.sourcePatientStatus || null,
      pep_administered: draft.pepAdministered ?? null,
      pep_details: draft.pepDetails || null,
      follow_up_status: draft.followUpStatus || 'pending',
      follow_up_due_at: draft.followUpDueAt || null,
      notes: draft.notes || null,
      status: draft.status || 'open',
    })
    .select(EXPOSURE_INCIDENT_COLUMNS)
    .single()
  if (error) throw error
  return exposureIncidentFromRow(data)
}

export async function updateExposureIncidentAsync(organizationId, employeeDbId, id, draft) {
  ensureProductionContext(organizationId,employeeDbId,'occupational_exposure_incidents.update')
  const { data, error } = await supabase
    .from('occupational_exposure_incidents')
    .update({
      incident_date: draft.incidentDate,
      exposure_type: draft.exposureType,
      device_or_source: draft.deviceOrSource || null,
      body_site: draft.bodySite || null,
      source_patient_status: draft.sourcePatientStatus || null,
      pep_administered: draft.pepAdministered ?? null,
      pep_details: draft.pepDetails || null,
      follow_up_status: draft.followUpStatus || 'pending',
      follow_up_due_at: draft.followUpDueAt || null,
      notes: draft.notes || null,
      status: draft.status || 'open',
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id',organizationId)
    .eq('employee_id',employeeDbId)
    .eq('id', id)
    .select(EXPOSURE_INCIDENT_COLUMNS)
    .single()
  if (error) throw error
  return exposureIncidentFromRow(data)
}

export async function deleteExposureIncidentAsync(organizationId, employeeDbId, id) {
  ensureProductionContext(organizationId,employeeDbId,'occupational_exposure_incidents.delete')
  const { error } = await supabase
    .from('occupational_exposure_incidents')
    .delete()
    .eq('organization_id',organizationId)
    .eq('employee_id',employeeDbId)
    .eq('id',id)
  if(error)throw error
  return true
}

export function saveExposureIncidentsLocalFallback(rows) {
  if(!isDemoDataEnvironment())throw new Error('PRODUCTION_LOCAL_WRITE_BLOCKED:occupational_exposure_incidents')
  return saveExposureIncidentsLocal(rows)
}
