// Which surveillance episodes and laboratory samples belong to a patient, to
// one admission of that patient, or to one surveillance episode.

const sameId = (a, b) => String(a) === String(b)

// The hospital's calendar day of a date or timestamp. Timestamps come from the
// database in UTC (a sample taken at 00:00 in Greece reads 21:00 or 22:00 of the
// day before), so a value with an offset is read in the hospital's time zone.
const HOSPITAL_TIME_ZONE = 'Europe/Athens'
const hospitalDayFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: HOSPITAL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
export function hospitalDay(value) {
  const text = String(value || '')
  if (text.length <= 10 || !/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(text)) return text.slice(0, 10)
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text.slice(0, 10)
  const parts = hospitalDayFormat.formatToParts(date)
  const part = type => parts.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
const day = hospitalDay

function dayBefore(date) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() - 1)
  return value.toISOString().slice(0, 10)
}

// The last day of an admission: its discharge day. A stay closed without one
// (the FileMaker import has none) ends the day before the patient's next
// admission; an active stay, or the latest one, stays open. '' means open.
export function admissionWindowEnd(admission, admissions = []) {
  if (!admission) return ''
  if (admission.dischargeDate) return day(admission.dischargeDate)
  if (admission.status === 'active') return ''
  const start = day(admission.admissionDate)
  const next = admissions
    .filter(row => !sameId(row.id, admission.id))
    .map(row => day(row.admissionDate))
    .filter(date => date && date > start)
    .sort()[0]
  return next ? dayBefore(next) : ''
}

// Inside the admission's dates: from the admission day up to its last day
// (inclusive), or open-ended.
function withinAdmission(date, admission, admissions) {
  const end = admissionWindowEnd(admission, admissions)
  return date >= day(admission.admissionDate) && (!end || date <= end)
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
// `admissions` (all of the patient's) closes a discharged stay without a
// discharge date at the next admission.
export function episodesForAdmission(episodes = [], admission = null, { admissions = [] } = {}) {
  const visible = episodes.filter(episode => episode.status !== 'cancelled')
  if (!admission) return visible
  return visible.filter(episode => {
    if (episode.admissionId) return sameId(episode.admissionId, admission.id)
    const started = day(episode.startedAt)
    return (!started || withinAdmission(started, admission, admissions)) && sameDepartment(episode, admission)
  })
}

// The patient's episodes (not cancelled) that belong to none of their admissions.
export function episodesOutsideAdmissions(episodes = [], admissions = []) {
  return episodesForAdmission(episodes).filter(
    episode => !admissions.some(admission => episodesForAdmission([episode], admission, { admissions }).length),
  )
}

function samplePatient(sample, patient) {
  return patient.recordId && sample.patientRecordId
    ? sameId(sample.patientRecordId, patient.recordId)
    : String(sample.patientId || '') === String(patient.id || '')
}

const SAMPLE_SOURCE = {
  bloodCulture: 'bloodstream',
  urineCulture: 'urinary',
  respiratorySample: 'respiratory',
  woundCulture: 'surgicalSite',
}
const SOURCE_PATTERNS = [
  ['bloodstream', /αιμοκαλλ|αίμα|αιμα|blood|bloodstream/i],
  ['urinary', /ούρ|ουρ|urine|urinary/i],
  ['respiratory', /πτύελ|πτυελ|sputum|τραχει|trache|bal\b|βρογχ|bronch|αναπνευ|respir/i],
  ['surgicalSite', /τραύμ|τραυμ|wound|χειρουργ|surg|τομή|τομη|incision|πύον|pus/i],
]

function sourceFromText(value) {
  const text = String(value || '')
  return SOURCE_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] || ''
}

function sampleSource(sample) {
  return SAMPLE_SOURCE[sample?.sampleType || sample?.type] || sourceFromText(`${sample?.source || ''} ${sample?.type || ''}`)
}

function episodeSource(episode) {
  const stored = String(episode?.suspectedSource || '')
  if (stored && stored !== 'other') return stored
  return sourceFromText(`${episode?.reason || ''} ${episode?.reasonEn || ''}`)
}

function daysApart(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY
  const left = new Date(`${a}T12:00:00Z`).getTime()
  const right = new Date(`${b}T12:00:00Z`).getTime()
  if (!Number.isFinite(left) || !Number.isFinite(right)) return Number.POSITIVE_INFINITY
  return Math.abs(left - right) / 86400000
}

function sampleMatchesEpisodeList(sample, episode) {
  const ids = [sample?.id, sample?.recordId].filter(Boolean).map(String)
  return (episode?.samples || []).some(row =>
    [row?.id, row?.recordId].filter(Boolean).some(value => ids.includes(String(value))),
  )
}

// Imported/LIS samples can belong to the same admission as an existing surveillance
// episode but have no surveillance_case_id. For the patient folder we still want the
// clinical hierarchy Admission -> Surveillance -> Sample. Explicit database links are
// always authoritative; only missing links are inferred, from the same admission, by
// clinical source and then by the closest date. A specific source is never silently
// attached to an incompatible specific source when several episodes exist.
export function inferredEpisodeForSample(sample, episodes = []) {
  if (!sample) return null
  const visible = episodes.filter(episode => episode && episode.status !== 'cancelled')
  const caseId = String(
    sample.surveillanceCase || sample.surveillanceCaseId || sample.surveillance_case_id || '',
  )
  if (caseId) {
    const explicit = visible.find(
      episode => sameId(episode.id, caseId) || (episode.recordId && sameId(episode.recordId, caseId)),
    )
    if (explicit) return explicit
  }

  const embedded = visible.find(episode => sampleMatchesEpisodeList(sample, episode))
  if (embedded) return embedded
  if (!visible.length) return null

  const sampleKind = sampleSource(sample)
  const sampleDate = day(sample.collectedAt || sample.requestedAt || sample.resultedAt)
  const candidates = visible
    .map(episode => {
      const kind = episodeSource(episode)
      const generic = !kind || !episode.suspectedSource || episode.suspectedSource === 'other'
      const compatible = !sampleKind || !kind || kind === sampleKind
      if (sampleKind && kind && kind !== sampleKind) return null
      const distance = daysApart(sampleDate, day(episode.startedAt))
      return {
        episode,
        score:
          (kind && sampleKind && kind === sampleKind ? 1000 : 0) +
          (generic ? 100 : 0) +
          (distance === 0 ? 50 : 0) -
          (Number.isFinite(distance) ? distance : 30),
        distance,
        compatible,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.distance - b.distance)

  if (candidates.length) return candidates[0].episode
  // If the admission has only one surveillance episode, an otherwise unclassified
  // imported sample belongs beneath that single clinical episode rather than in a
  // second, disconnected bucket.
  return visible.length === 1 ? visible[0] : null
}

function withInferredSurveillance(sample, episodes) {
  if (
    sample.surveillanceCase ||
    sample.surveillanceCaseId ||
    sample.surveillance_case_id ||
    episodes.some(episode => sampleMatchesEpisodeList(sample, episode))
  )
    return sample
  const episode = inferredEpisodeForSample(sample, episodes)
  return episode
    ? { ...sample, surveillanceCase: episode.id, surveillanceLinkInferred: true }
    : sample
}

// The admission of the episode a sample is linked to, or ''.
function linkedAdmissionId(sample, episodes) {
  const caseId = String(sample.surveillanceCase || sample.surveillanceCaseId || '')
  if (!caseId) return ''
  const episode = episodes.find(row => sameId(row.id, caseId) || (row.recordId && sameId(row.recordId, caseId)))
  return episode?.admissionId ? String(episode.admissionId) : ''
}

// The patient's samples of the admission. A sample of an episode linked to an
// admission belongs to that admission, whatever its date; any other sample
// belongs to the admission it was taken in (`admissions` closes a discharged
// stay without a discharge date), in its department. A sample without a
// collection or request date is kept. Missing legacy/LIS case links are enriched
// in-memory so the patient folder can display them under the matching surveillance.
export function samplesForAdmission(samples = [], patient, admission, { admissions = [], episodes = [] } = {}) {
  if (!patient || !admission) return []
  const scopedEpisodes = episodesForAdmission(episodes, admission, { admissions })
  return samples
    .filter(sample => {
      if (!samplePatient(sample, patient)) return false
      const linked = linkedAdmissionId(sample, episodes)
      if (linked) return sameId(linked, admission.id)
      const date = day(sample.collectedAt || sample.requestedAt)
      return (!date || withinAdmission(date, admission, admissions)) && sameDepartment(sample, admission)
    })
    .map(sample => withInferredSurveillance(sample, scopedEpisodes))
}

// The patient's samples that belong to none of their admissions, so the record
// never hides them.
export function samplesOutsideAdmissions(samples = [], patient, admissions = [], { episodes = [] } = {}) {
  if (!patient) return []
  return samples.filter(
    sample =>
      samplePatient(sample, patient) &&
      !admissions.some(admission => samplesForAdmission([sample], patient, admission, { admissions, episodes }).length),
  )
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
