// Analysis metrics of the add-on modules that have no database RPC of their own:
// the point prevalence survey (PPS) and LIRA outbreak investigations. The same
// builders feed demo (local stores) and production (RLS-scoped table reads), and
// the result keeps the shape mergeDomainMetrics can add up across hospitals:
// plain counters and [key, ...counts] rows — rates are derived when displayed.
const day = value => String(value || '').slice(0, 10)
const month = value => String(value || '').slice(0, 7)
const inRange = (value, range) => { const d = day(value); if (!d) return true; return (!range?.from || d >= range.from) && (!range?.to || d <= range.to) }
const tally = (rows, keyFn) => { const out = new Map(); for (const row of rows) { const key = keyFn(row); if (key == null || key === '') continue; out.set(key, (out.get(key) || 0) + 1) } return [...out.entries()].sort((a, b) => b[1] - a[1]) }
const DAY_MS = 86400000

// rows: { surveyDate, patientsTotal, patientsWithHai, patientsOnAntibiotics }
export function buildPpsMetrics(rows = [], range = {}) {
  const surveys = rows.filter(row => inRange(row.surveyDate, range))
  const byMonth = new Map()
  for (const row of surveys) {
    const key = month(row.surveyDate)
    if (!key) continue
    const current = byMonth.get(key) || [0, 0, 0]
    current[0] += Number(row.patientsTotal) || 0
    current[1] += Number(row.patientsWithHai) || 0
    current[2] += Number(row.patientsOnAntibiotics) || 0
    byMonth.set(key, current)
  }
  return {
    surveys: surveys.length,
    patients: surveys.reduce((sum, row) => sum + (Number(row.patientsTotal) || 0), 0),
    withHai: surveys.reduce((sum, row) => sum + (Number(row.patientsWithHai) || 0), 0),
    onAntibiotics: surveys.reduce((sum, row) => sum + (Number(row.patientsOnAntibiotics) || 0), 0),
    byMonth: [...byMonth.entries()].map(([key, values]) => [key, ...values]).sort((a, b) => a[0].localeCompare(b[0])),
  }
}

// rows: { status, organism, created_at, closed_at }; clusters: active outbreak clusters.
export function buildLiraMetrics(rows = [], range = {}, clusters = 0) {
  const items = rows.filter(row => inRange(row.created_at, range))
  const closed = items.filter(row => row.status === 'closed')
  const spans = closed.map(row => (Date.parse(row.closed_at) - Date.parse(row.created_at)) / DAY_MS).filter(value => Number.isFinite(value) && value >= 0)
  return {
    investigations: items.length,
    active: items.filter(row => row.status === 'active').length,
    closed: closed.length,
    closedDaysTotal: Math.round(spans.reduce((sum, value) => sum + value, 0) * 10) / 10,
    closedWithDates: spans.length,
    clusters: Number(clusters) || 0,
    byOrganism: tally(items, row => row.organism || '—'),
    byStatus: tally(items, row => row.status || '—'),
    monthly: tally(items, row => month(row.created_at)).sort((a, b) => a[0].localeCompare(b[0])),
  }
}
