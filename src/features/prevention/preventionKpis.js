// The key figures of each Prevention tab, with their period and target:
// hand hygiene and bundles over the last 30 days, waste and antiseptics for the
// latest month with records against the month before.
export const HAND_HYGIENE_TARGET = 80
// Alcohol-based hand rub use, L per 1.000 patient days (owner's target, 28/10/2026).
export const ABHR_TARGET = 20

const DAY = 86400000
const inLastDays = (value, days, now) => {
  const time = Date.parse(String(value || '').length <= 10 ? `${value}T12:00:00` : value)
  return Number.isFinite(time) && now - time <= days * DAY && time <= now + DAY
}
const monthOf = row => String(row.periodStart || row.period || row.date || '').slice(0, 7)
const previousMonth = month => {
  const [year, value] = month.split('-').map(Number)
  return value === 1 ? `${year - 1}-12` : `${year}-${String(value - 1).padStart(2, '0')}`
}
const round1 = value => (value == null ? null : Math.round(value * 10) / 10)
const sum = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0)

// WHO method: pooled compliant actions over all observed opportunities.
export function handHygieneKpis(rows = [], { now = Date.now() } = {}) {
  const recent = rows.filter(row => inLastDays(row.date, 30, now))
  const rate = list => {
    const opportunities = sum(list, 'observations')
    return opportunities ? round1((sum(list, 'compliant') / opportunities) * 100) : null
  }
  const byDepartment = new Map()
  for (const row of recent) byDepartment.set(row.departmentEl, [...(byDepartment.get(row.departmentEl) || []), row])
  const below = [...byDepartment.values()].filter(list => {
    const value = rate(list)
    return value != null && value < HAND_HYGIENE_TARGET
  }).length
  // latest: the newest observation of all, so an empty window can say when the last one was.
  const latest = rows.map(row => String(row.date || '').slice(0, 10)).filter(Boolean).sort().at(-1) || null
  return { rate: rate(recent), opportunities: sum(recent, 'observations'), sessions: recent.length, departments: byDepartment.size, below, latest }
}

// The latest month with records against the month before: total and per 1.000 patient days.
function monthly(rows, valueKey, eligible = () => true) {
  const months = [...new Set(rows.map(monthOf).filter(Boolean))].sort()
  const month = months.at(-1) || null
  if (!month) return { month: null, current: null, before: null, allDepartments: 0 }
  const figures = list => {
    const counted = list.filter(row => eligible(row) && Number(row.patientDays) > 0)
    const days = sum(counted, 'patientDays')
    return {
      total: round1(sum(list, valueKey)),
      perThousand: days ? Math.round((sum(counted, valueKey) / days) * 100000) / 100 : null,
      departments: new Set(list.map(row => row.departmentEl).filter(Boolean)).size,
    }
  }
  const before = rows.filter(row => monthOf(row) === previousMonth(month))
  return {
    month,
    current: figures(rows.filter(row => monthOf(row) === month)),
    before: before.length ? figures(before) : null,
    allDepartments: new Set(rows.map(row => row.departmentEl).filter(Boolean)).size,
  }
}

export const wasteKpis = (rows = []) => monthly(rows, 'weight')
// Only alcohol-based hand rubs count towards the ABHR indicator.
export const antisepticKpis = (rows = []) => monthly(rows, 'litres', row => row.indicatorEligible !== false)

// All-or-none compliance over the last 30 days.
export function bundleKpis(rows = [], { now = Date.now() } = {}) {
  const recent = rows.filter(row => inLastDays(row.date, 30, now))
  const full = recent.filter(row => row.allOrNone).length
  return {
    rate: recent.length ? round1((full / recent.length) * 100) : null,
    assessments: recent.length,
    deviations: recent.reduce((total, row) => total + (Number(row.failedCount ?? row.findings?.length) || 0), 0),
  }
}
