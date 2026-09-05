import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadOccupationalVisits as loadVisitsLocal, loadVaccinations as loadVaccinationsLocal, loadEmployeeTraining as loadTrainingLocal, loadEvaluations as loadEvaluationsLocal, loadCertificates as loadCertificatesLocal, saveCertificates as saveCertificatesLocal } from './employeeRecordsService'

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
  return { id: row.id, employeeId: row.employee_id, date: row.visit_date, type: row.visit_type, status: row.status, followUpDate: row.follow_up_date || null, fitStatus: row.fitness_status || '' }
}
export async function loadOccupationalVisitsAsync(organizationId, employeeDbId, employeeId) {
  if(isDemoDataEnvironment())return loadVisitsLocal().filter(x => x.employeeId === employeeId)
  ensureProductionContext(organizationId,employeeDbId,'occupational_health_visits.load')
  const { data, error } = await supabase
    .from('occupational_health_visits')
    .select('id,employee_id,visit_date,visit_type,status,follow_up_date,fitness_status')
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeDbId)
    .order('visit_date', { ascending: false })
  if (error) throw error
  return (data || []).map(visitFromRow)
}

// --- Vaccinations ---
function vaccinationFromRow(row) {
  return { id: row.id, employeeId: row.employee_id, vaccine: row.vaccine_label_snapshot, dose: row.dose || '', date: row.vaccination_date, validUntil: row.valid_until || null, status: row.status }
}
export async function loadVaccinationsAsync(organizationId, employeeDbId, employeeId) {
  if(isDemoDataEnvironment())return loadVaccinationsLocal().filter(x => x.employeeId === employeeId)
  ensureProductionContext(organizationId,employeeDbId,'employee_vaccinations.load')
  const { data, error } = await supabase
    .from('employee_vaccinations')
    .select('id,employee_id,vaccine_label_snapshot,dose,vaccination_date,valid_until,status')
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeDbId)
    .order('vaccination_date', { ascending: false })
  if (error) throw error
  return (data || []).map(vaccinationFromRow)
}

// --- Training summary ---
// Production training has one source of truth: training_records. The employee tab derives
// its rows from assignment records and joins the corresponding programme payload. This
// avoids the stale duplicate employee_training_summary table that was never populated by
// the production Training workflow.
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
      status:assignment.status||'assigned',
      programId:assignment.programId||null,
      score:assignment.score??null,
      competent:assignment.competent??null,
    }
  })
}

// --- Evaluations ---
function evaluationFromRow(row) {
  return { id: row.id, employeeId: row.employee_id, titleEl: row.title, titleEn: row.title_en || row.title, date: row.evaluation_date, resultEl: row.result || '', resultEn: row.result_en || row.result || '' }
}
export async function loadEvaluationsAsync(organizationId, employeeDbId, employeeId) {
  if(isDemoDataEnvironment())return loadEvaluationsLocal().filter(x => x.employeeId === employeeId)
  ensureProductionContext(organizationId,employeeDbId,'employee_evaluations.load')

  const [{data:formalRows,error:formalError},trainingContext]=await Promise.all([
    supabase
      .from('employee_evaluations')
      .select('id,employee_id,title,title_en,evaluation_date,result,result_en')
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

export function saveCertificatesLocalFallback(rows) {
  if(!isDemoDataEnvironment())throw new Error('PRODUCTION_LOCAL_WRITE_BLOCKED:employee_certificates')
  return saveCertificatesLocal(rows)
}
