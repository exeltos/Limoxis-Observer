// WHO hand hygiene: opportunities, compliance and the WHO "moments" of each
// observation. One observation row can cover several professionals observed
// together (professionalsCount); each one is a separate opportunity.

export function observationWeight(item) {
  return Math.max(1, Number(item?.professionalsCount) || 1)
}

// The WHO moments of an observation, without duplicates; older rows stored a
// single `moment`.
export function normalizeWhoMoments(item) {
  const values = Array.isArray(item?.moments) ? item.moments.filter(Boolean) : []
  if (values.length) return [...new Set(values)]
  return item?.moment ? [item.moment] : []
}

// Compliance = hand rub (HR) or hand wash (HW) opportunities over all
// opportunities, as a percentage with one decimal.
export function whoStatsFromObservations(items = []) {
  const weighted = action => items.reduce((sum, item) => sum + (item.action === action ? observationWeight(item) : 0), 0)
  const opportunities = items.reduce((sum, item) => sum + observationWeight(item), 0)
  const handRub = weighted('HR')
  const handWash = weighted('HW')
  const missed = weighted('MISSED')
  const compliant = handRub + handWash
  return {
    opportunities,
    handRub,
    handWash,
    missed,
    professionals: opportunities,
    compliant,
    compliance: opportunities ? Number(((compliant / opportunities) * 100).toFixed(1)) : 0,
  }
}

// The statistics shown on a saved session: the stored ones, or computed from
// its observations; a session saved without observations falls back to its
// stored totals and rate.
export function sessionHandHygieneStats(record) {
  if (record.whoStats) return record.whoStats
  const stats = whoStatsFromObservations(record.whoObservations || [])
  const opportunities = stats.opportunities || record.observations || 0
  const compliant = stats.compliant || record.compliant || 0
  return {
    ...stats,
    opportunities,
    compliant,
    compliance: opportunities ? Number(((compliant / opportunities) * 100).toFixed(1)) : record.rate || 0,
  }
}
