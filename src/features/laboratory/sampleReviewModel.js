// «Προς έλεγχο»: which laboratory samples wait for an infection-control decision.
// SAMPLE = Laboratory; INFECTION of a patient = Surveillance (episode). One episode has
// many samples; many samples never become an episode. A positive/alert sample of a
// patient with no episode and no decision yet shows in the worklist; negatives never do
// (they stay in the list as the denominators of the indicators).
import { ROLES } from '../../core/permissions/roles'

export const REVIEW_STATUS = Object.freeze({ EPISODE_OPENED: 'episode_opened', NO_SURVEILLANCE: 'no_surveillance_needed' })

// The roles that decide on a sample (the same four the review_laboratory_sample RPC accepts).
export const SAMPLE_REVIEW_ROLES = Object.freeze([ROLES.INFECTION_CONTROL_LEAD, ROLES.INFECTION_CONTROL_MEMBER, ROLES.DOCTOR_REVIEWER, ROLES.HOSPITAL_ADMIN])
export const canReviewSamples = role => SAMPLE_REVIEW_ROLES.includes(role)

// Reason codes of «Δεν χρειάζεται επιτήρηση» (stored as code, shown in plain words).
export const NO_SURVEILLANCE_REASONS = Object.freeze(['contamination', 'colonization', 'known_case', 'other'])
export const NO_SURVEILLANCE_REASON_LABELS = Object.freeze({
  el: { contamination: 'Επιμόλυνση', colonization: 'Αποικισμός', known_case: 'Γνωστό περιστατικό', other: 'Άλλο' },
  en: { contamination: 'Contamination', colonization: 'Colonisation', known_case: 'Known case', other: 'Other' },
})

const clean = value => String(value ?? '').trim()

// Positive with an identified organism, or with a resistance flag (MDR/XDR/PDR/MRSA/…),
// or a positive blood culture, or a critical result. Reuses the laboratory's own fields:
// result, organism, resistance, critical, type.
export function isAlertSample(sample) {
  if (!sample || clean(sample.result).toLowerCase() !== 'positive') return false
  return Boolean(clean(sample.organism) || clean(sample.resistance) || sample.critical || (sample.type || sample.sampleType) === 'bloodCulture')
}

// A patient sample with no episode and no decision.
export function needsSurveillanceReview(sample) {
  if (!sample || (sample.subjectType && sample.subjectType !== 'patient')) return false
  if (['rejected', 'cancelled'].includes(sample.status)) return false
  if (sample.surveillanceCase || sample.surveillanceCaseId) return false
  if (sample.surveillanceReviewStatus) return false
  // A follow-up code (`<sample>-R<n>`) is requested from an episode: it already has one.
  if (/-R\d+$/.test(clean(sample.id))) return false
  return isAlertSample(sample)
}

export const samplesAwaitingReview = (samples = []) => samples.filter(needsSurveillanceReview)

// The plain-word tag after a decision; '' while the sample is undecided or has no decision.
export function reviewTag(sample, language = 'el') {
  const en = language === 'en'
  if (sample?.surveillanceReviewStatus === REVIEW_STATUS.EPISODE_OPENED) return en ? 'Episode opened' : 'Επεισόδιο ανοίχτηκε'
  if (sample?.surveillanceReviewStatus === REVIEW_STATUS.NO_SURVEILLANCE) return en ? 'Reviewed, no surveillance' : 'Αξιολογήθηκε, χωρίς επιτήρηση'
  return ''
}

export const reasonLabel = (code, language = 'el') => NO_SURVEILLANCE_REASON_LABELS[language === 'en' ? 'en' : 'el'][code] || ''

// Laboratory list filter: «Μόνο θετικά» keeps positive results; negatives are never
// removed from the data, only hidden from this view.
export const LAB_RESULT_SCOPES = Object.freeze({ ALL: 'all', POSITIVE: 'positive' })
export const defaultLabScope = role => canReviewSamples(role) ? LAB_RESULT_SCOPES.POSITIVE : LAB_RESULT_SCOPES.ALL
export const matchesLabScope = (sample, scope) => scope !== LAB_RESULT_SCOPES.POSITIVE || clean(sample?.result).toLowerCase() === 'positive'

// «Άνοιγμα επεισοδίου»: the patient record opens on its surveillance tab with the new-episode
// flow already started for this sample (the page links the sample once the episode exists).
export function sampleEpisodeTarget(sample) {
  return {
    path: `/patients/${encodeURIComponent(sample.patientId || sample.subjectCode || '')}`,
    state: {
      openTab: 'surveillanceJourney',
      createFromSample: {
        id: sample.id, recordId: sample.recordId ?? null, type: sample.type, source: sample.source, organism: sample.organism ?? null,
        resistance: sample.resistance ?? null, collectedAt: sample.collectedAt ?? sample.requestedAt ?? null, patientId: sample.patientId,
      },
    },
  }
}
