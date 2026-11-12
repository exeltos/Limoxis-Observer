// An environmental result is «within / outside limits» only against a known limit:
// the one it was assessed with (saved on the result) or, failing that, the configured
// protocol's. Without either it has no assessment («Χωρίς όριο πρωτοκόλλου»), whatever
// an older record says.
import type { AnyRecord } from '../../types/featureTypes'

type Result = AnyRecord | null | undefined
const known = (value: unknown) => value != null && value !== '' && Number.isFinite(Number(value))

export const resultLimit = (result: Result, standard: Result = null) =>
  known(result?.cfuLimit) ? Number(result?.cfuLimit) : known(standard?.limitCfu) ? Number(standard?.limitCfu) : null

// true · false · null (no limit to compare with)
export const limitAssessment = (result: Result, standard: Result = null) =>
  resultLimit(result, standard) == null ? null : typeof result?.withinLimit === 'boolean' ? result.withinLimit : null

export const isOutsideLimit = (result: Result, standard: Result = null) => limitAssessment(result, standard) === false

// What a screen or a document SHOWS about a result: the assessment against a known limit and, for a result without one
// (e.g. imported from the old system), the verdict the laboratory recorded with it. It is only for display: what needs
// action (isOutsideLimit, the lists, the indicators) still counts only the results assessed against a known limit.
// The result of an environmental or staff-check sample reads one of three ways: Θετικό, Αρνητικό, Εντός αποδεκτών ορίων
// (a positive, i.e. growth, that the laboratory found within the acceptable limits).
export const environmentalResultWord = (result: Result, language = 'el', standard: Result = null) => {
  const en = language === 'en'
  if (result?.result === 'negative') return en ? 'Negative' : 'Αρνητικό'
  if (result?.result !== 'positive') return ''
  return shownAssessment(result, standard) === true ? (en ? 'Within acceptable limits' : 'Εντός αποδεκτών ορίων') : en ? 'Positive' : 'Θετικό'
}

export const shownAssessment = (result: Result, standard: Result = null): boolean | null => {
  const assessed = limitAssessment(result, standard)
  if (assessed != null) return assessed
  return typeof result?.withinLimit === 'boolean' ? result.withinLimit : null
}
