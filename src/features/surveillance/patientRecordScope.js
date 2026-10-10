// Which surveillance episodes and laboratory samples belong to a patient, to
// one admission of that patient, or to one surveillance episode.

const day = value => String(value || '').slice(0, 10)
const sameId = (a, b) => String(a) === String(b)

// Inside the admission's dates: from the admission day up to the discharge day
// (inclusive), or open-ended while the patient is still admitted.
function withinAdmission(date, admission) {
  return date >= String(admission.admissionDate || '') && (!admission.dischargeDate || date <= String(admission.dischargeDate))
}

// A row without a department is not excluded by the department.
function sameDepartment(row, admission) {
  return !admission.departmentId || !row.departmentId || sameId(row.departmentId, admission.departmentId)
}

// An episode belongs to a patient by the patient record id when both carry one,
// otherwise by the patient id. Missing ids never match.
export function episodeBelongsToPatient(episode, patient) {
  if (!episode || !patient) return false
  if (episode.patientRecordId && patient.recordId) return sameId(episode.patientRecordId, patient.recordId)
  return Boolean(episode.patientId && patient.id) && sameId(episode.patientId, patient.id)
}

// Cancelled episodes are never shown. Without an admission, every other episode
// is. With one, an episode linked to an admission must be linked to this one;
// an unlinked episode must have started within the admission, in its department.
// An unlinked episode without a start date is kept (in the admission's
// department), like a sample without a date, so it is never hidden from every admission.
export function episodesForAdmission(episodes = [], admission = null) {
  const visible = episodes.filter(episode => episode.status !== 'cancelled')
  if (!admission) return visible
  return visible.filter(episode => {
    if (episode.admissionId) return sameId(episode.admissionId, admission.id)
    const started = day(episode.startedAt)
    return (!started || withinAdmission(started, admission)) && sameDepartment(episode, admission)
  })
}

// The patient's samples taken during the admission, in its department. A sample
// without a collection or request date is kept.
export function samplesForAdmission(samples = [], patient, admission) {
  if (!patient || !admission) return []
  return samples.filter(sample => {
    const samePatient = patient.recordId && sample.patientRecordId
      ? sameId(sample.patientRecordId, patient.recordId)
      : String(sample.patientId || '') === String(patient.id || '')
    if (!samePatient) return false
    const date = day(sample.collectedAt || sample.requestedAt)
    return (!date || withinAdmission(date, admission)) && sameDepartment(sample, admission)
  })
}

// The episode's own samples, plus laboratory rows recorded for it afterwards:
// rows linked to the episode, and follow-ups of its samples (code `<sample>-R<n>`).
export function samplesForEpisode(episode, laboratoryRows = []) {
  if (!episode) return []
  const base = episode.samples || []
  const ids = new Set(base.map(sample => String(sample.id || '')))
  const extra = laboratoryRows
    .filter(sample => {
      const code = String(sample.id || '')
      if (ids.has(code)) return false
      const linked = String(sample.surveillanceCase || sample.surveillanceCaseId || '') === String(episode.id)
      const followUp = [...ids].some(id => id && code.startsWith(`${id}-R`))
      return linked || followUp
    })
    .map(sample => ({ ...sample, surveillanceCase: sample.surveillanceCase || episode.id }))
  return [...base, ...extra]
}

// Days in hospital, counting the admission day as day 1; until today while
// still admitted. Null when the dates are missing or out of order.
export function stayDays(from, to, today = new Date()) {
  if (!from) return null
  const start = new Date(`${day(from)}T12:00:00`)
  const end = to ? new Date(`${day(to)}T12:00:00`) : today
  const days = Math.round((end - start) / 86400000)
  return Number.isFinite(days) && days >= 0 ? days + 1 : null
}

// A follow-up sample is coded `<parent>-R<n>`; returns the parent's code, or ''.
export function sampleParentCode(sample) {
  const code = String(sample?.id || '')
  return /-R\d+$/.test(code) ? code.replace(/-R\d+$/, '') : ''
}

export function sampleTone(sample) {
  const result = String(sample.result || '').toLowerCase()
  if (result === 'positive') return 'positive'
  if (result === 'negative') return 'negative'
  return 'pending'
}
