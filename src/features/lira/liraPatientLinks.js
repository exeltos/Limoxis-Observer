import { supabase } from '../../core/supabase/client'
import { liraDemoInvestigations } from './liraDemoInvestigations'

// The outbreak investigation(s) a patient was reviewed into: read-only, from the case
// reviews of lira_outbreak_case_reviews (patient_id). A review that excluded the patient
// does not count. The same roles that read the investigations read this; nobody else gets
// a row (the policies decide, there is no security definer function that could leak it).
// The demo hospital links its sample patient to the active Klebsiella investigation.
export const DEMO_OUTBREAK_LINKS = Object.freeze({ 'PT-260184': { investigationId: 'LIRA-INV-01', department: 'ΜΕΘ', departmentEn: 'ICU', cases: 4 } })

const latestPerKey = (rows, keyOf) => {
  const seen = new Map()
  for (const row of rows) if (!seen.has(keyOf(row))) seen.set(keyOf(row), row)
  return [...seen.values()]
}

export async function loadPatientOutbreakLinks(organizationId, { patientRecordId = null, patientCode = '' } = {}, { isDemo = false } = {}) {
  if (isDemo) {
    const link = DEMO_OUTBREAK_LINKS[patientCode]
    const investigation = link && liraDemoInvestigations.find(row => row.id === link.investigationId)
    return investigation
      ? [{ id: investigation.id, title: investigation.organism, organism: investigation.organism, status: investigation.status, department: link.department, departmentEn: link.departmentEn, from: investigation.created_at, cases: link.cases }]
      : []
  }
  if (!supabase || !organizationId || !patientRecordId) return []
  const reviewed = await supabase
    .from('lira_outbreak_case_reviews')
    .select('investigation_id,record_key,classification,reviewed_at')
    .eq('organization_id', organizationId)
    .eq('patient_id', patientRecordId)
    .order('reviewed_at', { ascending: false })
  if (reviewed.error) throw reviewed.error
  const mine = latestPerKey(reviewed.data || [], row => row.investigation_id).filter(row => row.classification !== 'excluded')
  if (!mine.length) return []
  const ids = mine.map(row => row.investigation_id)
  const [investigations, all] = await Promise.all([
    supabase.from('lira_outbreak_investigations').select('id,title,organism,status,scope_from,created_at,department_id').eq('organization_id', organizationId).in('id', ids),
    supabase.from('lira_outbreak_case_reviews').select('investigation_id,record_key,classification,reviewed_at').eq('organization_id', organizationId).in('investigation_id', ids).order('reviewed_at', { ascending: false }),
  ])
  if (investigations.error) throw investigations.error
  if (all.error) throw all.error
  const departmentIds = [...new Set((investigations.data || []).map(row => row.department_id).filter(Boolean))]
  const departments = departmentIds.length ? await supabase.from('departments').select('id,name').eq('organization_id', organizationId).in('id', departmentIds) : { data: [] }
  const departmentName = new Map((departments.data || []).map(row => [row.id, row.name]))
  const counts = new Map()
  for (const row of latestPerKey(all.data || [], item => `${item.investigation_id}|${item.record_key}`))
    if (row.classification !== 'excluded') counts.set(row.investigation_id, (counts.get(row.investigation_id) || 0) + 1)
  return (investigations.data || []).map(row => ({
    id: row.id,
    title: row.title || row.organism || '',
    organism: row.organism || '',
    status: row.status,
    department: departmentName.get(row.department_id) || '',
    departmentEn: departmentName.get(row.department_id) || '',
    from: row.scope_from || row.created_at || '',
    cases: counts.get(row.id) || 0,
  }))
}
