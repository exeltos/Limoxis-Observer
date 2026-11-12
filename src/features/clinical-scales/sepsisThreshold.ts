// Decision support after a saved assessment: a qSOFA of 2 or more, or a SOFA that
// rose by 2 or more against the previous SOFA of the same admission (Sepsis-3),
// prompts «Πιθανή σήψη — έναρξη πρωτοκόλλου;». It never diagnoses sepsis and never
// starts anything by itself: the clinician decides.
export const QSOFA_THRESHOLD = 2
export const SOFA_DELTA_THRESHOLD = 2

const keyOf = row => row?.scale_key || row?.scale?.scale_key || ''
const time = row => new Date(row?.assessed_at || 0).getTime()

export function sepsisPromptFor(saved, rows = []) {
  if (!saved) return null
  const key = keyOf(saved)
  const score = Number(saved.score)
  if (!Number.isFinite(score)) return null
  if (key === 'qsofa') return score >= QSOFA_THRESHOLD ? { kind: 'qsofa', score, assessmentId: saved.id || null } : null
  if (key !== 'sofa') return null
  const sameAdmission = row => !saved.admission_id || !row.admission_id || String(row.admission_id) === String(saved.admission_id)
  const previous = rows
    .filter(row => row && row.id !== saved.id && keyOf(row) === 'sofa' && sameAdmission(row) && time(row) <= time(saved) && Number.isFinite(Number(row.score)))
    .sort((a, b) => time(b) - time(a))[0]
  if (!previous) return null
  const delta = score - Number(previous.score)
  return delta >= SOFA_DELTA_THRESHOLD ? { kind: 'sofa', score, delta, previousScore: Number(previous.score), assessmentId: saved.id || null } : null
}
