// An environmental result is «within / outside limits» only against a known limit:
// the one it was assessed with (saved on the result) or, failing that, the configured
// protocol's. Without either it has no assessment («Χωρίς όριο πρωτοκόλλου»), whatever
// an older record says.
const known = value => value != null && value !== '' && Number.isFinite(Number(value))

export const resultLimit = (result, standard = null) =>
  known(result?.cfuLimit) ? Number(result.cfuLimit) : known(standard?.limitCfu) ? Number(standard.limitCfu) : null

// true · false · null (no limit to compare with)
export const limitAssessment = (result, standard = null) =>
  resultLimit(result, standard) == null ? null : typeof result?.withinLimit === 'boolean' ? result.withinLimit : null

export const isOutsideLimit = (result, standard = null) => limitAssessment(result, standard) === false
