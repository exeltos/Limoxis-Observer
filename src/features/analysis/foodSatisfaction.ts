import { satisfactionCounts } from '../quality/surveys/surveyModel'
import type { AnyRecord } from '../../types/featureTypes'

// «Satisfaction with food» (demo): the 4–5 answers over the 1–5 answers of the «Food» section of the patient
// questionnaires, the same rule as the database (private.indicator_metric_snapshot).
export function foodSatisfactionMetrics(surveys: AnyRecord[] = [], responses: AnyRecord[] = [], inPeriod: (value: unknown) => boolean = () => true) {
  let answered = 0, satisfied = 0
  for (const survey of surveys) {
    if (survey.audience !== 'patients') continue
    const own = responses.filter(row => row.surveyId === survey.id && inPeriod(row.submittedAt))
    if (!own.length) continue
    const counts = satisfactionCounts({ ...survey, questions: (survey.questions || []).filter((question: AnyRecord) => question.section === 'food') }, own)
    answered += counts.answered
    satisfied += counts.satisfied
  }
  return { food_satisfied_answers: satisfied, food_rating_answers: answered }
}
