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
function trainingFromRow(row) {
  return { id: row.id, employeeId: row.employee_id, titleEl: row.title, titleEn: row.title_en || row.title, date: row.training_date, status: row.status }
}
export async function loadEmployeeTrainingAsync(organizationId, employeeDbId, employeeId) {
  if(isDemoDataEnvironment())return loadTrainingLocal().filter(x => x.employeeId === employeeId)
  ensureProductionContext(organizationId,employeeDbId,'employee_training_summary.load')
  const { data, error } = await supabase
    .from('employee_training_summary')
    .select('id,employee_id,title,title_en,training_date,status')
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeDbId)
    .order('training_date', { ascending: false })
  if (error) throw error
  return (data || []).map(trainingFromRow)
}

// --- Evaluations ---
function evaluationFromRow(row) {
  return { id: row.id, employeeId: row.employee_id, titleEl: row.title, titleEn: row.title_en || row.title, date: row.evaluation_date, resultEl: row.result || '', resultEn: row.result_en || row.result || '' }
}
export async function loadEvaluationsAsync(organizationId, employeeDbId, employeeId) {
  if(isDemoDataEnvironment())return loadEvaluationsLocal().filter(x => x.employeeId === employeeId)
  ensureProductionContext(organizationId,employeeDbId,'employee_evaluations.load')
  const { data, error } = await supabase
    .from('employee_evaluations')
    .select('id,employee_id,title,title_en,evaluation_date,result,result_en')
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeDbId)
    .order('evaluation_date', { ascending: false })
  if (error) throw error
  return (data || []).map(evaluationFromRow)
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

export async function updateCertificateAsync(id, draft) {
  if(isDemoDataEnvironment())throw new Error('DEMO_CERTIFICATE_UPDATE_USES_LOCAL_STORE')
  if(!hasSupabaseConfig||!supabase)throw new Error('PRODUCTION_CLOUD_REQUIRED:employee_certificates.update')
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
