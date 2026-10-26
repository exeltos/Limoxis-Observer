// Annual control calendar: one row per control and department, one cell per
// month. Frequent controls (daily, weekly, every few days) are counted —
// done / due so far, and planned for the months ahead. Infrequent ones
// (monthly, yearly, every 4+ weeks) are shown as dated events: done, done
// late, missed, or planned.
import { calculateNextDue } from './controlScheduling'
import { expectedOccurrences } from './controlAdherence'
import { executionMarks } from './controlDueRules'

const MAX_STEPS = 400

export function isFrequentControl(frequency = {}) {
  if (frequency.kind === 'daily' || frequency.kind === 'weekly') return true
  if (frequency.kind === 'monthly' || frequency.kind === 'yearly') return false
  return (Number(frequency.interval) || 1) < 28
}

export function monthRange(year, month) {
  return { from: new Date(year, month, 1), to: new Date(year, month + 1, 1) }
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

// monthCounts: twelve { done, late, marks } from the database
// (control_calendar_months); without it the history is counted.
export function assignmentCalendar({ frequency = {}, history = [], startedAt = null, nextDueAt = null, paused = false, monthCounts = null }, year, now = new Date()) {
  const frequent = isFrequentControl(frequency)
  const started = startedAt ? new Date(startedAt) : null
  const yearEnd = new Date(year + 1, 0, 1)
  // The counted entries (extra ones and those beyond a day's slots left out), late or not.
  const done = executionMarks(history, frequency).filter((mark) => mark.counted)
  const schedule = frequent ? null : infrequentSchedule({ frequency, nextDueAt, paused }, yearEnd, now)

  return Array.from({ length: 12 }, (_, month) => {
    const { from, to } = monthRange(year, month)
    const when = to <= now ? 'past' : from > now ? 'future' : 'current'
    const inMonth = (date) => new Date(date) >= from && new Date(date) < to
    const counted = monthCounts ? monthCounts[month] || { done: 0, late: 0, marks: [] } : null
    const executions = counted ? [] : done.filter((row) => inMonth(row.at))
    const doneCount = counted ? counted.done : executions.length
    const late = counted ? counted.late : executions.filter((mark) => !mark.onTime).length
    const marks = counted ? [...counted.marks] : executions.map((mark) => ({ day: new Date(mark.at).getDate(), late: !mark.onTime }))
    const cell = { month, when, done: doneCount, late, marks: marks.sort((a, b) => a.day - b.day) }

    if (frequent) {
      const activeFrom = new Date(Math.max(from.getTime(), started ? started.getTime() : -Infinity))
      const pastEnd = new Date(Math.min(to.getTime(), now.getTime()))
      const expected = when === 'future' ? 0 : expectedOccurrences(frequency, activeFrom, pastEnd)
      const plannedFrom = new Date(Math.max(activeFrom.getTime(), now.getTime()))
      const planned = paused || when === 'past' ? 0 : expectedOccurrences(frequency, plannedFrom, to)
      const rate = expected ? Math.round((Math.min(doneCount, expected) / expected) * 100) : null
      return { ...cell, frequent: true, expected, planned, rate, inactive: Boolean(started && started >= to) }
    }

    const missed = schedule.missed.filter(inMonth).map((date) => date.getDate())
    const planned = schedule.planned.filter(inMonth).map((date) => date.getDate())
    return { ...cell, frequent: false, missed, planned, inactive: Boolean(started && started >= to) && !doneCount }
  })
}

// Rows of the calendar for the visible controls (same input as the adherence view).
// monthsByAssignment: Map(assignment id → twelve month counts) from the
// database; null counts each assignment's loaded history (the demo).
export function programmeCalendar(rows, year, now = new Date(), monthsByAssignment = null) {
  const lines = []
  for (const { item, departments } of rows || []) {
    for (const department of departments) {
      const assignment = item.assignments?.[department]
      if (!assignment) continue
      const months = assignmentCalendar({
        frequency: assignment.frequency || item.frequency,
        history: assignment.history || [],
        startedAt: assignment.createdAt || item.createdAt,
        nextDueAt: assignment.nextDueAt,
        paused: assignment.status === 'paused',
        monthCounts: monthsByAssignment ? monthsByAssignment.get(assignment.dbId) || [] : null,
      }, year, now)
      lines.push({ item, department, frequency: assignment.frequency || item.frequency, months })
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


// The year so far for one row: frequent controls as done / due, infrequent
// ones as done against done + missed; `planned` counts what is still ahead.
export function calendarYearSummary(months = []) {
  const active = months.filter((cell) => !cell.inactive)
  if (active.some((cell) => cell.frequent)) {
    const done = active.reduce((sum, cell) => sum + (cell.when === 'future' ? 0 : cell.done), 0)
    const expected = active.reduce((sum, cell) => sum + (cell.expected || 0), 0)
    const planned = active.reduce((sum, cell) => sum + (cell.planned || 0), 0)
    return { frequent: true, done, expected, planned, rate: expected ? Math.round((Math.min(done, expected) / expected) * 100) : null }
  }
  const done = active.reduce((sum, cell) => sum + cell.done, 0)
  const missed = active.reduce((sum, cell) => sum + cell.missed.length, 0)
  const planned = active.reduce((sum, cell) => sum + cell.planned.length, 0)
  return { frequent: false, done, expected: done + missed, missed, planned, rate: done + missed ? Math.round((done / (done + missed)) * 100) : null }
}

// Consecutive rows of the same control, so the calendar names it once.
export function groupCalendarLines(lines = []) {
  const groups = []
  for (const line of lines) {
    const last = groups[groups.length - 1]
    if (last && last.item.id === line.item.id) last.lines.push(line)
    else groups.push({ item: line.item, lines: [line] })
  }
  return groups
}
