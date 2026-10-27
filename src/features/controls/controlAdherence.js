// Control programme adherence: how many executions a schedule called for in a
// period, how many were recorded, how many met their due time, and how many
// were missed. A schedule restarts from each completion (next due = completion
// + interval), so "expected" is the nominal count for the period from the
// frequency, not a replay of the due dates. Which entries count and which were
// on time follow the due rules (controlDueRules.executionMarks): the first N
// entries of a day by their slot deadline; otherwise by the deadline the
// previous entry set. Extra entries never count.
import { executionMarks, isWeekdaysOnly, periodUnit, zonedInstant, zonedParts } from './controlDueRules'
import { assignmentProgress } from './controlScheduling'

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
  if (isWeekdaysOnly(frequency)) return Math.floor(weekdayTime(from, to) / slotLength(frequency))
  return Math.floor(span / slotLength(frequency))
}

// The part of [from, to] that falls on Monday to Friday (Athens), in milliseconds.
function weekdayTime(from, to) {
  const end = new Date(to).getTime()
  let total = 0
  for (let t = new Date(from).getTime(); t < end;) {
    const p = zonedParts(t)
    const next = Math.min(end, zonedInstant(p.year, p.month, p.day + 1, 0).getTime())
    const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()
    if (weekday !== 0 && weekday !== 6) total += next - t
    t = next
  }
  return total
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
      const result = assignmentAdherence({ frequency: assignment.frequency || item.frequency, history: assignment.history || [], startedAt: assignment.createdAt || item.createdAt, counts }, period)
      if (!result.expected && !result.performed) continue
      lines.push({ item, department, frequency: assignment.frequency || item.frequency, ...result })
    }
  }
  return { lines, totals: adherenceTotals(lines) }
}

// The totals of adherence lines (worst line first).
function adherenceTotals(lines) {
  lines.sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101) || String(a.item.title).localeCompare(String(b.item.title), 'el'))
  const expected = lines.reduce((sum, line) => sum + line.expected, 0)
  const counted = lines.reduce((sum, line) => sum + Math.min(line.performed, line.expected), 0)
  const performed = lines.reduce((sum, line) => sum + line.performed, 0)
  const onTime = lines.reduce((sum, line) => sum + line.onTime, 0)
  return {
    expected,
    performed,
    onTime,
    missed: lines.reduce((sum, line) => sum + line.missed, 0),
    rate: expected ? Math.round((counted / expected) * 100) : null,
    onTimeRate: performed ? Math.round((onTime / performed) * 100) : null,
  }
}

// Today: the entries a daily control asks for today and how many are done
// (weekly, monthly and yearly controls have no share of a day; a weekdays-only
// control asks nothing at the weekend). null when the day asks nothing.
export function todayProgress(item, department, now = new Date()) {
  const assignment = item.assignments?.[department]
  if (!assignment || assignment.status === 'paused') return null
  const frequency = assignment.frequency || item.frequency || {}
  if (periodUnit(frequency) !== 'day') return null
  const p = zonedParts(now)
  const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()
  if (isWeekdaysOnly(frequency) && (weekday === 0 || weekday === 6)) return null
  const progress = assignmentProgress(item, department, now)
  return progress?.required ? { required: progress.required, done: progress.done } : null
}

// «Today» in the adherence lines: due = what the day asks, done = what is
// recorded so far, on time from the day's counts.
export function todayAdherence(rows, countsByAssignment = null, now = new Date()) {
  const lines = []
  const from = periodRange('today', now).from
  for (const { item, departments } of rows || []) {
    for (const department of departments) {
      const progress = todayProgress(item, department, now)
      if (!progress) continue
      const assignment = item.assignments[department]
      const frequency = assignment.frequency || item.frequency
      const counts = countsByAssignment ? countsByAssignment.get(assignment.dbId) || { performed: 0, onTime: 0 } : countAdherence(assignment.history || [], frequency, from, now)
      const performed = progress.done, expected = progress.required
      const onTime = Math.min(counts.onTime, performed)
      lines.push({ item, department, frequency, expected, performed, onTime, late: performed - onTime, missed: Math.max(0, expected - performed), rate: Math.round((Math.min(performed, expected) / expected) * 100), onTimeRate: performed ? Math.round((onTime / performed) * 100) : null })
    }
  }
  return { lines, totals: adherenceTotals(lines) }
}

// The adherence of any period the page offers.
export function periodAdherence(rows, period, countsByAssignment = null, now = new Date()) {
  return period === 'today' ? todayAdherence(rows, countsByAssignment, now) : programmeAdherence(rows, periodRange(period, now), countsByAssignment)
}

export const ADHERENCE_PERIODS = ['today', '30d', '60d', '6m', '12m']

// The short name of a period, for the chips and the column headings.
export const periodShort = (key, language = 'el') => ({
  el: { today: 'Σήμερα', '30d': '30 ημ.', '60d': '60 ημ.', '6m': '6 μήνες', '12m': '12 μήνες', '90d': '90 ημ.', year: 'Έτος' },
  en: { today: 'Today', '30d': '30 days', '60d': '60 days', '6m': '6 months', '12m': '12 months', '90d': '90 days', year: 'Year' },
})[language === 'en' ? 'en' : 'el'][key] || key

// Where the reports end: today, or, while the entries are still kept elsewhere
// (an import that stops on a day more than 2 days ago), the end of that day,
// so the rates do not fall day by day for want of data.
export function reportEnd(lastEntryAt, now = new Date()) {
  if (!lastEntryAt) return new Date(now)
  const last = new Date(lastEntryAt)
  if (now - last <= 2 * DAY) return new Date(now)
  const p = zonedParts(last)
  return new Date(zonedInstant(p.year, p.month, p.day + 1, 0).getTime() - 1000)
}

export function periodRange(key, now = new Date()) {
  const to = new Date(now)
  const from = new Date(now)
  if (key === 'today') { const p = zonedParts(now); return { from: zonedInstant(p.year, p.month, p.day, 0), to, now } }
  if (key === '60d') from.setDate(from.getDate() - 60)
  else if (key === '6m') from.setMonth(from.getMonth() - 6)
  else if (key === '90d') from.setDate(from.getDate() - 90)
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
