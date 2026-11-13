import type { ClinicalCaseLike, EpisodeSample } from './clinicalTypes'
// Row values of the Surveillance list: latest organism and resistance, review state.

export const latestOrganism = (row: ClinicalCaseLike) => row.samples?.find((x: EpisodeSample) => x.organism)?.organism || row.organism || null
export const latestResistance = (row: ClinicalCaseLike) =>
  row.samples?.find((x: EpisodeSample) => x.resistance)?.resistance || row.resistance || null
export const reviewState = (row: ClinicalCaseLike) =>
  row.status !== 'active'
    ? 'completed'
    : row.reviewDue && new Date(`${String(row.reviewDue).slice(0, 10)}T23:59:59`) < new Date()
      ? 'overdue'
      : 'inProgress'
