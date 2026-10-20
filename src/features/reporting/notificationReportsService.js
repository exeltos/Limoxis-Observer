// Status of ΕΟΔΥ notifications per laboratory finding (notifiable_disease_reports).
// The demo workspace keeps them in memory for the session.
import { supabase } from '../../core/supabase/client'

const demoReports = new Map()
// A clinical notification of the demo patient with no admission (PT-260231): it shows in that
// patient's record under «Δηλωτέα νοσήματα» even though the patient has no admission.
const DEMO_NOTIFIED_AT = new Date(Date.now() - 35 * 86400000).toISOString().slice(0, 10)
demoReports.set('clinical|demo-1', { id: 'clinical|demo-1', findingKey: 'clinical|demo-1', status: 'notified', notifiedAt: DEMO_NOTIFIED_AT, reference: 'ΕΟΔΥ-2026-0147', notes: '', updatedAt: `${DEMO_NOTIFIED_AT}T10:00:00Z`, sampleId: '', patientRecordId: 'PT-260231', disease: 'Ελονοσία', diseaseCode: 'malaria', createdAt: `${DEMO_NOTIFIED_AT}T09:30:00Z` })

const mapRow = row => ({ id: row.id, findingKey: row.finding_key, status: row.status, notifiedAt: row.notified_at || '', reference: row.reference || '', notes: row.notes || '', updatedAt: row.updated_at, sampleId: row.sample_id || '', patientRecordId: row.patient_id || '', disease: row.disease_label || '', diseaseCode: row.disease_code || '', createdAt: row.created_at || '' })

export async function loadNotificationReports(organizationId, { isDemo = false } = {}) {
  if (isDemo) return [...demoReports.values()]
  if (!supabase || !organizationId) return []
  const { data, error } = await supabase.from('notifiable_disease_reports').select('id,finding_key,status,notified_at,reference,notes,updated_at,sample_id,patient_id,disease_label,disease_code,created_at').eq('organization_id', organizationId)
  if (error) throw error
  return (data || []).map(mapRow)
}

// The notifications made for one patient (clinical ones carry the patient, laboratory ones their sample's patient),
// newest first. Read-only; the demo workspace has none per patient.
export async function loadPatientNotificationReports(organizationId, patientRecordId, { isDemo = false } = {}) {
  if (isDemo || !supabase || !organizationId || !patientRecordId) return []
  const { data, error } = await supabase.from('notifiable_disease_reports').select('id,disease_code,disease_label,status,notified_at,created_at').eq('organization_id', organizationId).eq('patient_id', patientRecordId).order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(row => ({ id: row.id, disease: row.disease_label || row.disease_code || '', status: row.status, notifiedAt: row.notified_at || '', createdAt: row.created_at || '' }))
}

export async function saveNotificationReport(organizationId, finding, draft, { isDemo = false } = {}) {
  const report = { id: finding.findingKey, sampleId: finding.sample?.recordId || '', patientRecordId: finding.patientRecordId || '', findingKey: finding.findingKey, status: draft.status, notifiedAt: draft.status === 'notified' ? (draft.notifiedAt || new Date().toISOString().slice(0, 10)) : '', reference: draft.reference || '', notes: draft.notes || '', updatedAt: new Date().toISOString() }
  if (isDemo) { demoReports.set(report.findingKey, report); return report }
  const { data, error } = await supabase.from('notifiable_disease_reports').upsert({
    organization_id: organizationId,
    finding_key: finding.findingKey,
    sample_id: finding.sample.recordId || null,
    ...(finding.patientRecordId ? { patient_id: finding.patientRecordId } : {}),
    disease_code: finding.rule.id,
    status: report.status,
    notified_at: report.notifiedAt || null,
    reference: report.reference || null,
    notes: report.notes || null,
    updated_at: report.updatedAt,
  }, { onConflict: 'organization_id,finding_key' }).select('id,finding_key,status,notified_at,reference,notes,updated_at,sample_id,patient_id,disease_label,disease_code,created_at').single()
  if (error) throw error
  return mapRow(data)
}

// The notifications that belong to one record: those of the given laboratory samples (the
// episode's, reached through sample_id) and the clinical ones carrying the patient. Newest first.
export async function loadRecordNotificationReports(organizationId, { sampleRecordIds = [], patientRecordId = null } = {}, { isDemo = false } = {}) {
  if (isDemo) return [...demoReports.values()].filter(report => (patientRecordId && report.patientRecordId === patientRecordId) || sampleRecordIds.some(id => String(report.findingKey).startsWith(`${id}|`)))
  if (!supabase || !organizationId) return []
  const ids = [...new Set(sampleRecordIds.filter(Boolean))]
  const filters = [ids.length && `sample_id.in.(${ids.join(',')})`, patientRecordId && `patient_id.eq.${patientRecordId}`].filter(Boolean)
  if (!filters.length) return []
  const { data, error } = await supabase.from('notifiable_disease_reports').select('id,finding_key,status,notified_at,reference,notes,updated_at,sample_id,patient_id,disease_label,disease_code,created_at').eq('organization_id', organizationId).or(filters.join(',')).order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapRow)
}

// A clinical notification (no laboratory finding) is updated by its id.
export async function updateNotificationReport(organizationId, id, draft, { isDemo = false } = {}) {
  const patch = { status: draft.status, notified_at: draft.status === 'notified' ? (draft.notifiedAt || new Date().toISOString().slice(0, 10)) : null, reference: draft.reference || null, notes: draft.notes || null, updated_at: new Date().toISOString() }
  if (isDemo || !supabase) return { id, status: draft.status, notifiedAt: patch.notified_at || '', reference: draft.reference || '', notes: draft.notes || '' }
  const { data, error } = await supabase.from('notifiable_disease_reports').update(patch).eq('organization_id', organizationId).eq('id', id).select('id,finding_key,status,notified_at,reference,notes,updated_at,sample_id,patient_id,disease_label,disease_code,created_at').single()
  if (error) throw error
  return mapRow(data)
}
