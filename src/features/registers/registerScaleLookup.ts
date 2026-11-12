import { supabase } from '../../core/supabase/client'

// The latest APACHE II saved in the patient's clinical scales for the admission with this case number:
// { patientId, score, assessedAt } — score is null when none was saved, and the whole result is null when
// no admission has this case number (or the database is not reachable).
export async function findApacheScore(organizationId: string | null | undefined, caseNumber: unknown) {
  const number = String(caseNumber ?? '').trim()
  if (!supabase || !organizationId || !number) return null
  const admissions = await supabase.from('patient_admissions').select('id,patient_id').eq('organization_id', organizationId).eq('case_number', number)
  if (admissions.error) throw admissions.error
  const ids = (admissions.data || []).map(row => row.id)
  if (!ids.length) return null
  const patientId = admissions.data![0].patient_id
  const scales = await supabase.from('patient_clinical_scale_assessments').select('score,assessed_at').eq('organization_id', organizationId).eq('scale_key', 'apache-ii').in('admission_id', ids).order('assessed_at', { ascending: false }).limit(1)
  if (scales.error) throw scales.error
  const row = scales.data?.[0]
  return row && Number.isFinite(Number(row.score)) ? { patientId, score: Number(row.score), assessedAt: row.assessed_at } : { patientId, score: null, assessedAt: null }
}
