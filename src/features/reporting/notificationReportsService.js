// Status of ΕΟΔΥ notifications per laboratory finding (notifiable_disease_reports).
// The demo workspace keeps them in memory for the session.
import { supabase } from '../../core/supabase/client'

const demoReports = new Map()

const mapRow = row => ({ findingKey: row.finding_key, status: row.status, notifiedAt: row.notified_at || '', reference: row.reference || '', notes: row.notes || '', updatedAt: row.updated_at })

export async function loadNotificationReports(organizationId, { isDemo = false } = {}) {
  if (isDemo) return [...demoReports.values()]
  if (!supabase || !organizationId) return []
  const { data, error } = await supabase.from('notifiable_disease_reports').select('finding_key,status,notified_at,reference,notes,updated_at').eq('organization_id', organizationId)
  if (error) throw error
  return (data || []).map(mapRow)
}

export async function saveNotificationReport(organizationId, finding, draft, { isDemo = false } = {}) {
  const report = { findingKey: finding.findingKey, status: draft.status, notifiedAt: draft.status === 'notified' ? (draft.notifiedAt || new Date().toISOString().slice(0, 10)) : '', reference: draft.reference || '', notes: draft.notes || '', updatedAt: new Date().toISOString() }
  if (isDemo) { demoReports.set(report.findingKey, report); return report }
  const { data, error } = await supabase.from('notifiable_disease_reports').upsert({
    organization_id: organizationId,
    finding_key: finding.findingKey,
    sample_id: finding.sample.recordId || null,
    disease_code: finding.rule.id,
    status: report.status,
    notified_at: report.notifiedAt || null,
    reference: report.reference || null,
    notes: report.notes || null,
    updated_at: report.updatedAt,
  }, { onConflict: 'organization_id,finding_key' }).select('finding_key,status,notified_at,reference,notes,updated_at').single()
  if (error) throw error
  return mapRow(data)
}
