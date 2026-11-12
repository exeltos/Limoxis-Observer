import type { AnyRecord } from '../../types/featureTypes'
// Row values of the Surveillance list: latest organism and resistance, review state.

export const latestOrganism = (row: AnyRecord) => row.samples?.find((x: AnyRecord) => x.organism)?.organism || row.organism || null
export const latestResistance = (row: AnyRecord) =>
  row.samples?.find((x: AnyRecord) => x.resistance)?.resistance || row.resistance || null
export const reviewState = (row: AnyRecord) =>
  row.status !== 'active'
    ? 'completed'
    : row.reviewDue && new Date(`${String(row.reviewDue).slice(0, 10)}T23:59:59`) < new Date()
      ? 'overdue'
      : 'inProgress'
