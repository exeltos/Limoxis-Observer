import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadPrevalenceSurveyLocal, savePrevalenceSurveyLocal } from './prevalenceSurveyStore'

const assertCloud = organizationId => {
  if (!supabase) throw new Error('Supabase is not configured.')
  if (!organizationId) throw new Error('Organization is required.')
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  const id = data?.user?.id
  if (!id) throw new Error('Authenticated user is required.')
  return id
}

function mapRow(row, departmentName) {
  return {
    id: row.id,
    surveyDate: row.survey_date,
    departmentId: row.department_id || '',
    departmentEl: departmentName || '',
    patientsTotal: row.patients_total,
    patientsWithHai: row.patients_with_hai,
    patientsOnAntibiotics: row.patients_on_antibiotics,
    responsibleName: row.responsible_name || '',
    notes: row.notes || '',
    createdAt: row.created_at,
    createdById: row.created_by,
  }
}

export async function loadPrevalenceSurveyHistory(organizationId) {
  if (isDemoDataEnvironment()) return loadPrevalenceSurveyLocal()
  assertCloud(organizationId)
  const [{ data, error }, { data: departments, error: departmentsError }] = await Promise.all([
    supabase.from('point_prevalence_surveys').select('*').eq('organization_id', organizationId).order('survey_date', { ascending: false }),
    supabase.from('departments').select('id,name').eq('organization_id', organizationId),
  ])
  if (error) throw error
  if (departmentsError) throw departmentsError
  const byId = new Map((departments || []).map(d => [d.id, d.name]))
  return (data || []).map(row => mapRow(row, byId.get(row.department_id)))
}

export async function savePrevalenceSurvey(organizationId, record) {
  if (isDemoDataEnvironment()) {
    const rows = loadPrevalenceSurveyLocal()
    const saved = { id: `PPS-${Date.now()}`, ...record, createdAt: new Date().toISOString(), createdById: 'demo-user' }
    savePrevalenceSurveyLocal([saved, ...rows])
    return saved
  }
  assertCloud(organizationId)
  const userId = await currentUserId()
  const payload = {
    organization_id: organizationId,
    department_id: record.departmentId || null,
    survey_date: record.surveyDate,
    patients_total: Number(record.patientsTotal) || 0,
    patients_with_hai: Number(record.patientsWithHai) || 0,
    patients_on_antibiotics: Number(record.patientsOnAntibiotics) || 0,
    responsible_name: record.responsibleName || null,
    notes: record.notes || null,
    created_by: userId,
    updated_by: userId,
  }
  const { data, error } = await supabase.from('point_prevalence_surveys').insert(payload).select('*').single()
  if (error) throw error
  return mapRow(data, record.departmentEl)
}

export async function deletePrevalenceSurvey(organizationId, id) {
  if (isDemoDataEnvironment()) {
    savePrevalenceSurveyLocal(loadPrevalenceSurveyLocal().filter(row => row.id !== id))
    return
  }
  assertCloud(organizationId)
  if (!id) return
  const { error } = await supabase.from('point_prevalence_surveys').delete().eq('organization_id', organizationId).eq('id', id)
  if (error) throw error
}
