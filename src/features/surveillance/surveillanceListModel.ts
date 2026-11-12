// Row values of the Surveillance list: latest organism and resistance, review state.

export const latestOrganism = row => row.samples?.find(x => x.organism)?.organism || row.organism || null
export const latestResistance = row =>
  row.samples?.find(x => x.resistance)?.resistance || row.resistance || null
export const reviewState = row =>
  row.status !== 'active'
    ? 'completed'
    : row.reviewDue && new Date(`${String(row.reviewDue).slice(0, 10)}T23:59:59`) < new Date()
      ? 'overdue'
      : 'inProgress'
