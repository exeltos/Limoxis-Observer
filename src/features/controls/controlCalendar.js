// Annual control calendar: one row per control and department, one cell per
// month. Frequent controls (daily, weekly, every few days) are counted —
// done / due so far, and planned for the months ahead. Infrequent ones
// (monthly, yearly, every 4+ weeks) are shown as dated events: done, done
// late, missed, or planned.
import { calculateNextDue } from './controlScheduling'
import { expectedOccurrences, graceFor } from './controlAdherence'

const MAX_STEPS = 400

export function isFrequentControl(frequency = {}) {
  if (frequency.kind === 'daily' || frequency.kind === 'weekly') return true
  if (frequency.kind === 'monthly' || frequency.kind === 'yearly') return false
  return (Number(frequency.interval) || 1) < 28
}

export function monthRange(year, month) {
  return { from: new Date(year, month, 1), to: new Date(year, month + 1, 1) }
}

const valid = (row) => row.status !== 'cancelled' && !row.cancelledAt && row.at
const isLate = (row, frequency) => {
  const due = row.previousNextDueAt || row.responseData?.previousNextDueAt
  return Boolean(due) && new Date(row.at) - new Date(due) > graceFor(frequency)
}

// Due dates from `start` onwards, stepped by the frequency, while before `until`.
function stepDates(frequency, start, until) {
  const dates = []
  let at = new Date(start)
  for (let i = 0; i < MAX_STEPS && at < until; i += 1) {
    dates.push(at)
    const next = new Date(calculateNextDue(frequency, at))
    if (!(next > at)) break
    at = next
  }
  return dates
}

// Missed due dates (an overdue schedule repeats each interval until today) and
// the planned dates from today to the end of the year.
function infrequentSchedule({ frequency, nextDueAt, paused }, yearEnd, now) {
  if (!nextDueAt || paused) return { missed: [], planned: [] }
  const due = new Date(nextDueAt)
  if (due >= now) return { missed: [], planned: stepDates(frequency, due, yearEnd) }
  const missed = stepDates(frequency, due, now)
  const resume = missed.length ? new Date(calculateNextDue(frequency, missed[missed.length - 1])) : now
  return { missed, planned: stepDates(frequency, resume > now ? resume : now, yearEnd) }
}

export function assignmentCalendar({ frequency = {}, history = [], startedAt = null, nextDueAt = null, paused = false }, year, now = new Date()) {
  const frequent = isFrequentControl(frequency)
  const started = startedAt ? new Date(startedAt) : null
  const yearEnd = new Date(year + 1, 0, 1)
  const done = history.filter(valid)
  const schedule = frequent ? null : infrequentSchedule({ frequency, nextDueAt, paused }, yearEnd, now)

  return Array.from({ length: 12 }, (_, month) => {
    const { from, to } = monthRange(year, month)
    const when = to <= now ? 'past' : from > now ? 'future' : 'current'
    const inMonth = (date) => new Date(date) >= from && new Date(date) < to
    const executions = done.filter((row) => inMonth(row.at))
    const late = executions.filter((row) => isLate(row, frequency)).length
    const cell = { month, when, done: executions.length, late, marks: executions.map((row) => ({ day: new Date(row.at).getDate(), late: isLate(row, frequency) })).sort((a, b) => a.day - b.day) }

    if (frequent) {
      const activeFrom = new Date(Math.max(from.getTime(), started ? started.getTime() : -Infinity))
      const pastEnd = new Date(Math.min(to.getTime(), now.getTime()))
      const expected = when === 'future' ? 0 : expectedOccurrences(frequency, activeFrom, pastEnd)
      const plannedFrom = new Date(Math.max(activeFrom.getTime(), now.getTime()))
      const planned = paused || when === 'past' ? 0 : expectedOccurrences(frequency, plannedFrom, to)
      const rate = expected ? Math.round((Math.min(executions.length, expected) / expected) * 100) : null
      return { ...cell, frequent: true, expected, planned, rate, inactive: Boolean(started && started >= to) }
    }

    const missed = schedule.missed.filter(inMonth).map((date) => date.getDate())
    const planned = schedule.planned.filter(inMonth).map((date) => date.getDate())
    return { ...cell, frequent: false, missed, planned, inactive: Boolean(started && started >= to) && !executions.length }
  })
}

// Rows of the calendar for the visible controls (same input as the adherence view).
export function programmeCalendar(rows, year, now = new Date()) {
  const lines = []
  for (const { item, departments } of rows || []) {
    for (const department of departments) {
      const assignment = item.assignments?.[department]
      if (!assignment) continue
      const months = assignmentCalendar({
        frequency: item.frequency,
        history: assignment.history || [],
        startedAt: assignment.createdAt || item.createdAt,
        nextDueAt: assignment.nextDueAt,
        paused: assignment.status === 'paused',
      }, year, now)
      lines.push({ item, department, months })
    }
  }
  lines.sort((a, b) => String(a.item.title).localeCompare(String(b.item.title), 'el') || a.department.localeCompare(b.department, 'el'))
  return lines
}

export function calendarTone(cell) {
  if (cell.frequent) {
    if (cell.rate == null) return cell.planned ? 'planned' : 'empty'
    return cell.rate >= 90 ? 'good' : cell.rate >= 75 ? 'fair' : 'low'
  }
  if (cell.missed.length) return 'low'
  if (cell.done) return cell.late ? 'fair' : 'good'
  if (cell.planned.length) return 'planned'
  return 'empty'
}

