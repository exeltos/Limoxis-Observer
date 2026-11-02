import { supabase } from '../../core/supabase/client'

// The latest APACHE II saved in the patient's clinical scales for the admission with this case number
// (null when there is none, or when the database is not reachable).
export async function findApacheScore(organizationId, caseNumber) {
  const number = String(caseNumber ?? '').trim()
  if (!supabase || !organizationId || !number) return null
  const admissions = await supabase.from('patient_admissions').select('id').eq('organization_id', organizationId).eq('case_number', number)
  if (admissions.error) throw admissions.error
  const ids = (admissions.data || []).map(row => row.id)
  if (!ids.length) return null
  const scales = await supabase.from('patient_clinical_scale_assessments').select('score,assessed_at').eq('organization_id', organizationId).eq('scale_key', 'apache-ii').in('admission_id', ids).order('assessed_at', { ascending: false }).limit(1)
  if (scales.error) throw scales.error
  const row = scales.data?.[0]
  return row && Number.isFinite(Number(row.score)) ? { score: Number(row.score), assessedAt: row.assessed_at } : null
}
