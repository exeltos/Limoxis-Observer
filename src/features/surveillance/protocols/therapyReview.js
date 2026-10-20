// The 48–72 h review of an antimicrobial therapy («antibiotic time-out»): the
// card appears 48 hours after the start, stays until a decision is recorded and
// is overdue after 72 hours (CDC Core Elements 2019; SSC 2021: daily assessment
// for de-escalation). Computed from the therapy start and the recorded reviews.
export const REVIEW_FROM_HOURS = 48
export const REVIEW_BY_HOURS = 72

export const REVIEW_DECISIONS = Object.freeze(['continue', 'deescalate', 'iv_to_oral', 'stop'])
export const REVIEW_REASONS = Object.freeze(['susceptibility', 'negative_cultures', 'clinical_improvement', 'no_infection', 'course_complete', 'adverse_event', 'oral_route_possible', 'no_improvement'])

// A date without a time (the demo, older entries) counts from the start of that day.
export function therapyStart(therapy) {
  const value = therapy?.startedAt
  if (!value) return null
  const text = String(value)
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00` : text)
  return Number.isNaN(date.getTime()) ? null : date
}

const HOUR = 3600000
export function reviewWindow(therapy, reviews = [], now = new Date()) {
  const start = therapyStart(therapy)
  if (!start) return null
  const own = reviews.filter(row => String(row.therapyId) === String(therapy.id)).sort((a, b) => new Date(b.reviewedAt) - new Date(a.reviewedAt))
  const latest = own[0] || null
  const hours = Math.floor((now.getTime() - start.getTime()) / HOUR)
  const opensAt = new Date(start.getTime() + REVIEW_FROM_HOURS * HOUR)
  const dueBy = new Date(start.getTime() + REVIEW_BY_HOURS * HOUR)
  const base = { therapyId: therapy.id, start, opensAt, dueBy, hours, latest, reviews: own }
  if (latest) {
    const reviewedHours = Math.round((new Date(latest.reviewedAt).getTime() - start.getTime()) / HOUR)
    return { ...base, state: reviewedHours <= REVIEW_BY_HOURS ? 'reviewed' : 'reviewedLate', reviewedHours }
  }
  if ((therapy.status || 'active') !== 'active') return { ...base, state: 'closed' }
  if (hours < REVIEW_FROM_HOURS) return { ...base, state: 'upcoming', hoursToOpen: REVIEW_FROM_HOURS - hours }
  if (hours <= REVIEW_BY_HOURS) return { ...base, state: 'due', hoursLeft: REVIEW_BY_HOURS - hours }
  return { ...base, state: 'overdue', hoursOver: hours - REVIEW_BY_HOURS }
}

export const reviewTone = state => ({ reviewed: 'success', reviewedLate: 'warning', due: 'warning', overdue: 'danger' })[state] || 'neutral'

// Which therapies show a review card: in the window, overdue, or already reviewed.
export const showsReviewCard = window => Boolean(window && ['due', 'overdue', 'reviewed', 'reviewedLate'].includes(window.state))
