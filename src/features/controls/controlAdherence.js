// Control programme adherence: how many executions a schedule called for in a
// period, how many were recorded, how many met their due time, and how many
// were missed. A schedule restarts from each completion (next due = completion
// + interval), so "expected" is the nominal count for the period from the
// frequency, not a replay of the due dates. Which entries count and which were
// on time follow the due rules (controlDueRules.executionMarks): the first N
// entries of a day by their slot deadline; otherwise by the deadline the
// previous entry set. Extra entries never count.
import { executionMarks } from './controlDueRules'

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

export function expectedOccurrences(frequency, from, to) {
  const span = new Date(to) - new Date(from)
  if (!(span > 0)) return 0
  return Math.floor(span / slotLength(frequency))
}

// Counted and on-time executions of one assignment's history within [start, end].
export function countAdherence(history, frequency, start, end) {
  const marks = executionMarks(history, frequency).filter((mark) => mark.counted && new Date(mark.at) >= start && new Date(mark.at) <= end)
  return { performed: marks.length, onTime: marks.filter((mark) => mark.onTime).length }
}

// One assignment (control × department) over [from, to]. `counts`
// ({ performed, onTime }) comes from the database (control_adherence_counts,
// which applies the same start, end and grace); without it the history is counted.
export function assignmentAdherence({ frequency, history = [], startedAt = null, counts = null }, { from, to, now = new Date() }) {
  const start = new Date(Math.max(new Date(from).getTime(), startedAt ? new Date(startedAt).getTime() : -Infinity))
  const end = new Date(Math.min(new Date(to).getTime(), new Date(now).getTime()))
  const expected = expectedOccurrences(frequency, start, end)
  const { performed, onTime } = counts || countAdherence(history, frequency, start, end)
  const counted = Math.min(performed, expected)
  return {
    expected,
    performed,
    onTime,
    late: performed - onTime,
    missed: Math.max(0, expected - performed),
    rate: expected ? Math.round((counted / expected) * 100) : null,
    onTimeRate: performed ? Math.round((onTime / performed) * 100) : null,
  }
}

// Rows for the programme: one per control and department, plus totals.
// countsByAssignment: Map(assignment id → { performed, onTime }) from the
// database; null counts each assignment's loaded history (the demo).
export function programmeAdherence(rows, period, countsByAssignment = null) {
  const lines = []
  for (const { item, departments } of rows || []) {
    for (const department of departments) {
      const assignment = item.assignments?.[department]
      if (!assignment) continue
      const counts = countsByAssignment ? countsByAssignment.get(assignment.dbId) || { performed: 0, onTime: 0 } : null
      const result = assignmentAdherence({ frequency: item.frequency, history: assignment.history || [], startedAt: assignment.createdAt || item.createdAt, counts }, period)
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

// The adherence rows grouped by control (worst first): each group carries the
// control's totals across its departments, counted like the programme totals.
export function groupAdherenceLines(lines = []) {
  const groups = new Map()
  for (const line of lines) {
    if (!groups.has(line.item.id)) groups.set(line.item.id, { item: line.item, lines: [] })
    groups.get(line.item.id).lines.push(line)
  }
  return [...groups.values()].map((group) => {
    const expected = group.lines.reduce((sum, line) => sum + line.expected, 0)
    const counted = group.lines.reduce((sum, line) => sum + Math.min(line.performed, line.expected), 0)
    const performed = group.lines.reduce((sum, line) => sum + line.performed, 0)
    const onTime = group.lines.reduce((sum, line) => sum + line.onTime, 0)
    return {
      ...group,
      totals: {
        expected,
        performed,
        onTime,
        late: performed - onTime,
        missed: group.lines.reduce((sum, line) => sum + line.missed, 0),
        rate: expected ? Math.round((counted / expected) * 100) : null,
      },
    }
  }).sort((a, b) => (a.totals.rate ?? 101) - (b.totals.rate ?? 101) || String(a.item.title).localeCompare(String(b.item.title), 'el'))
}
