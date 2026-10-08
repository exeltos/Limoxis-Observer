// Control programme adherence: how many executions a schedule called for in a
// period, how many were recorded, how many met their due time, and how many
// were missed. A schedule restarts from each completion (next due = completion
// + interval), so "expected" is the nominal count for the period from the
// frequency, not a replay of the due dates.

const HOUR = 3600000, DAY = 24 * HOUR

// Length of one scheduled slot in milliseconds.
export function slotLength(frequency = {}) {
  const interval = Math.max(1, Number(frequency.interval) || 1)
  if (frequency.kind === 'daily') {
    const perDay = Math.max(1, (frequency.times || []).filter(Boolean).length || Number(frequency.timesPerDay) || 1)
    return DAY / perDay
  }
  if (frequency.kind === 'weekly') return 7 * DAY * interval
  if (frequency.kind === 'monthly') return 30.4375 * DAY * interval
  if (frequency.kind === 'yearly') return 365.25 * DAY * interval
  return DAY * interval
}

// Late tolerance: a daily slot may run a couple of hours late, longer cycles a day.
export function graceFor(frequency = {}) {
  return frequency.kind === 'daily' ? 2 * HOUR : DAY
}

export function expectedOccurrences(frequency, from, to) {
  const span = new Date(to) - new Date(from)
  if (!(span > 0)) return 0
  return Math.floor(span / slotLength(frequency))
}

// One assignment (control × department) over [from, to].
export function assignmentAdherence({ frequency, history = [], startedAt = null }, { from, to, now = new Date() }) {
  const start = new Date(Math.max(new Date(from).getTime(), startedAt ? new Date(startedAt).getTime() : -Infinity))
  const end = new Date(Math.min(new Date(to).getTime(), new Date(now).getTime()))
  const expected = expectedOccurrences(frequency, start, end)
  const done = history.filter((row) => row.status !== 'cancelled' && !row.cancelledAt && row.at && new Date(row.at) >= start && new Date(row.at) <= end)
  const grace = graceFor(frequency)
  const onTime = done.filter((row) => {
    const due = row.previousNextDueAt || row.responseData?.previousNextDueAt
    return !due || new Date(row.at) - new Date(due) <= grace
  })
  const performed = done.length
  const counted = Math.min(performed, expected)
  return {
    expected,
    performed,
    onTime: onTime.length,
    late: performed - onTime.length,
    missed: Math.max(0, expected - performed),
    rate: expected ? Math.round((counted / expected) * 100) : null,
    onTimeRate: performed ? Math.round((onTime.length / performed) * 100) : null,
  }
}

// Rows for the programme: one per control and department, plus totals.
export function programmeAdherence(rows, period) {
  const lines = []
  for (const { item, departments } of rows || []) {
    for (const department of departments) {
      const assignment = item.assignments?.[department]
      if (!assignment) continue
      const result = assignmentAdherence({ frequency: item.frequency, history: assignment.history || [], startedAt: assignment.createdAt || item.createdAt }, period)
      if (!result.expected && !result.performed) continue
      lines.push({ item, department, ...result })
    }
  }
  lines.sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101) || String(a.item.title).localeCompare(String(b.item.title), 'el'))
  const expected = lines.reduce((sum, line) => sum + line.expected, 0)
  const counted = lines.reduce((sum, line) => sum + Math.min(line.performed, line.expected), 0)
  const performed = lines.reduce((sum, line) => sum + line.performed, 0)
  const onTime = lines.reduce((sum, line) => sum + line.onTime, 0)
  return {
    lines,
    totals: {
      expected,
      performed,
      onTime,
      missed: lines.reduce((sum, line) => sum + line.missed, 0),
      rate: expected ? Math.round((counted / expected) * 100) : null,
      onTimeRate: performed ? Math.round((onTime / performed) * 100) : null,
    },
  }
}

export const ADHERENCE_PERIODS = ['30d', '90d', '12m', 'year']

export function periodRange(key, now = new Date()) {
  const to = new Date(now)
  const from = new Date(now)
  if (key === '90d') from.setDate(from.getDate() - 90)
  else if (key === '12m') from.setFullYear(from.getFullYear() - 1)
  else if (key === 'year') { from.setMonth(0, 1); from.setHours(0, 0, 0, 0) }
  else from.setDate(from.getDate() - 30)
  return { from, to, now }
}

export const adherenceTone = (rate) => (rate == null ? 'neutral' : rate >= 90 ? 'good' : rate >= 75 ? 'fair' : 'low')
