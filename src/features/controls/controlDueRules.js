// When a scheduled control is due, overdue, or already complete for its period.
// One rule per frequency, worked out in the hospital's time zone (Europe/Athens)
// and mirrored by the database (private.control_next_due and friends in
// 20261121140000_control_due_rules.sql), so the list, the adherence report, the
// calendar and control_assignments.next_due_at all agree.
//
//   daily, N times a day   the day holds N slots (the execution times, or the
//                          day split evenly). With execution times each slot
//                          has a window: from 1 hour before its time to 2 hours
//                          after it when once a day, 1 hour after when more
//                          often (frequency.toleranceMinutes sets the margin
//                          after), never past the next slot or 23:59:59. The
//                          day split evenly keeps the old rule: by the next
//                          slot, the last by 23:59:59. The k-th entry of a day
//                          covers slot k: in its window it is on time, later
//                          the same day it is late, none is a missed slot.
//   every N days           due by 23:59:59 on the N-th day after the last entry.
//   weekly / every N weeks due by Sunday 23:59:59 of the N-th week after the
//                          week of the last entry (weeks run Monday–Sunday).
//   monthly / N months     due by the last day of the N-th month after it.
//   yearly / N years       due by 31 December of the N-th year after it.
//
// A control is overdue when next_due_at has passed. The period that counts
// how many entries are required (the over-entry guard, «3/4 σήμερα») is the
// day for daily and every-N-days controls, the week, the month or the year.
// Extra entries («Έκτακτη καταχώρηση», is_extra) never count.

export const CONTROL_TIME_ZONE = 'Europe/Athens'
const MINUTE = 60000
const DAY_MINUTES = 1440
// The window around a set time: minutes before it, and after it when the
// control is done once a day or more often.
export const SLOT_EARLY_MINUTES = 60
export const SLOT_MARGIN_ONCE = 120
export const SLOT_MARGIN_SEVERAL = 60

const formatters = new Map()
function formatter(timeZone) {
  if (!formatters.has(timeZone)) formatters.set(timeZone, new Intl.DateTimeFormat('en-GB', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }))
  return formatters.get(timeZone)
}

// The wall-clock date and time of an instant in the time zone.
export function zonedParts(date, timeZone = CONTROL_TIME_ZONE) {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(new Date(date)).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]))
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour % 24, minute: parts.minute, second: parts.second }
}

const offsetAt = (ms, timeZone) => {
  const p = zonedParts(ms, timeZone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000
}

// The instant of a wall-clock time in the time zone (a time skipped by the
// spring change moves forward an hour, as in PostgreSQL).
export function zonedInstant(year, month, day, minutes = 0, timeZone = CONTROL_TIME_ZONE) {
  const wall = Date.UTC(year, month - 1, day, 0, minutes)
  let guess = wall - offsetAt(wall, timeZone)
  const second = wall - offsetAt(guess, timeZone)
  if (second !== guess) guess = Math.max(guess, second)
  return new Date(guess)
}

// A local calendar day, shifted by whole days.
const civilDay = (year, month, day) => { const d = new Date(Date.UTC(year, month - 1, day)); return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() } }
const localDay = (date, timeZone) => { const p = zonedParts(date, timeZone); return { year: p.year, month: p.month, day: p.day } }
const addDays = (d, n) => civilDay(d.year, d.month, d.day + n)

const positive = (value, fallback = 1) => { const n = Math.floor(Number(value)); return Number.isFinite(n) && n >= 1 ? n : fallback }

// The execution times of a daily control, minutes after midnight, in order.
const setTimes = (frequency = {}) => [...new Set((frequency.times || []).map((t) => /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim())).filter(Boolean).map((m) => Number(m[1]) * 60 + Number(m[2])).filter((m) => m >= 0 && m < DAY_MINUTES))].sort((a, b) => a - b)

// Slot start times of a daily control, minutes after midnight, in order.
export function slotStarts(frequency = {}) {
  const times = setTimes(frequency)
  if (times.length) return times
  const n = positive(frequency.timesPerDay)
  return Array.from({ length: n }, (_, i) => Math.floor((i * DAY_MINUTES) / n))
}

export const isDailyFrequency = (frequency = {}) => frequency.kind === 'daily'

// Entries a period requires: the slots of a day, otherwise one.
export function requiredPerPeriod(frequency = {}) {
  return isDailyFrequency(frequency) ? slotStarts(frequency).length : 1
}

export function periodUnit(frequency = {}) {
  if (frequency.kind === 'weekly') return 'week'
  if (frequency.kind === 'monthly') return 'month'
  if (frequency.kind === 'yearly') return 'year'
  return 'day'
}

function unitStart(unit, d) {
  if (unit === 'month') return { year: d.year, month: d.month, day: 1 }
  if (unit === 'year') return { year: d.year, month: 1, day: 1 }
  if (unit === 'week') { const weekday = (new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay() + 6) % 7; return addDays(d, -weekday) }
  return d
}
function unitNext(unit, s) {
  if (unit === 'month') return civilDay(s.year, s.month + 1, 1)
  if (unit === 'year') return { year: s.year + 1, month: 1, day: 1 }
  return addDays(s, unit === 'week' ? 7 : 1)
}

// [start, end) of the period (day, week, month or year) holding `at`.
export function periodBounds(frequency, at = new Date(), timeZone = CONTROL_TIME_ZONE) {
  const unit = periodUnit(frequency)
  const s = unitStart(unit, localDay(at, timeZone))
  const e = unitNext(unit, s)
  return { unit, start: zonedInstant(s.year, s.month, s.day, 0, timeZone), end: zonedInstant(e.year, e.month, e.day, 0, timeZone) }
}

// The last second of a local day.
const endOfDay = (d, timeZone) => { const n = addDays(d, 1); return new Date(zonedInstant(n.year, n.month, n.day, 0, timeZone).getTime() - 1000) }

// Deadline of slot `index` (0-based) on local day `d`.
export function slotDeadline(frequency, d, index, timeZone = CONTROL_TIME_ZONE) {
  const starts = slotStarts(frequency)
  const i = Math.min(Math.max(0, index), starts.length - 1)
  const boundary = i < starts.length - 1 ? starts[i + 1] : DAY_MINUTES
  const margin = slotMargin(frequency)
  const minutes = margin > 0 ? Math.min(starts[i] + margin, boundary) : boundary
  return minutes >= DAY_MINUTES ? endOfDay(d, timeZone) : zonedInstant(d.year, d.month, d.day, minutes, timeZone)
}

// Minutes after a set time that still count as on time: the control's own
// margin, otherwise 2 hours once a day and 1 hour more often; 0 (by the next
// slot) when the day is split evenly without times.
export function slotMargin(frequency = {}) {
  const tolerance = Number(frequency.toleranceMinutes)
  if (tolerance > 0) return tolerance
  const times = setTimes(frequency)
  if (!times.length) return 0
  return times.length === 1 ? SLOT_MARGIN_ONCE : SLOT_MARGIN_SEVERAL
}

// The earliest on-time moment of slot `index` on local day `d`: 1 hour before
// its time (with execution times), otherwise the start of the day.
export function slotOpens(frequency, d, index, timeZone = CONTROL_TIME_ZONE) {
  const starts = slotStarts(frequency)
  const i = Math.min(Math.max(0, index), starts.length - 1)
  const minutes = setTimes(frequency).length ? Math.max(0, starts[i] - SLOT_EARLY_MINUTES) : 0
  return zonedInstant(d.year, d.month, d.day, minutes, timeZone)
}

// The on-time window of slot `index` in minutes after midnight: [open, close]
// (close 1440 is the end of the day), as slotOpens and slotDeadline.
export function slotWindowMinutes(frequency = {}, index = 0) {
  const starts = slotStarts(frequency)
  const i = Math.min(Math.max(0, index), starts.length - 1)
  const boundary = i < starts.length - 1 ? starts[i + 1] : DAY_MINUTES
  const margin = slotMargin(frequency)
  return { open: setTimes(frequency).length ? Math.max(0, starts[i] - SLOT_EARLY_MINUTES) : 0, close: margin > 0 ? Math.min(starts[i] + margin, boundary) : boundary }
}

// End (last second) of the period `interval` units after the one holding `at`.
function periodDeadlineAfter(frequency, at, timeZone) {
  const k = positive(frequency.interval)
  const unit = periodUnit(frequency)
  const d = localDay(at, timeZone)
  const target = unit === 'month' ? civilDay(d.year, d.month + k, 1) : unit === 'year' ? { year: d.year + k, month: 1, day: 1 } : addDays(d, unit === 'week' ? 7 * k : k)
  const e = unitNext(unit, unitStart(unit, target))
  return new Date(zonedInstant(e.year, e.month, e.day, 0, timeZone).getTime() - 1000)
}

// next_due_at after an entry at `at`, when `doneInPeriod` regular entries
// (this one included) fall in its period.
export function nextDueAfterExecution(frequency = {}, at = new Date(), doneInPeriod = 1, timeZone = CONTROL_TIME_ZONE) {
  if (!isDailyFrequency(frequency)) return periodDeadlineAfter(frequency, at, timeZone).toISOString()
  const d = localDay(at, timeZone)
  const done = Math.max(0, Math.floor(Number(doneInPeriod) || 0))
  if (done < requiredPerPeriod(frequency)) return slotDeadline(frequency, d, done, timeZone).toISOString()
  return slotDeadline(frequency, addDays(d, 1), 0, timeZone).toISOString()
}

// The next deadline strictly after `from` (stepping a schedule forward).
export function nextDeadlineAfter(frequency = {}, from = new Date(), timeZone = CONTROL_TIME_ZONE) {
  if (!isDailyFrequency(frequency)) return periodDeadlineAfter(frequency, from, timeZone).toISOString()
  const t = new Date(from).getTime()
  const today = localDay(from, timeZone)
  for (const d of [addDays(today, -1), today, addDays(today, 1)]) {
    for (let i = 0; i < requiredPerPeriod(frequency); i += 1) {
      const deadline = slotDeadline(frequency, d, i, timeZone)
      if (deadline.getTime() > t) return deadline.toISOString()
    }
  }
  return slotDeadline(frequency, addDays(today, 2), 0, timeZone).toISOString()
}

// The first deadline of a new assignment: the open slot of today, or the end of
// the current week, month or year (every N days: today).
export function firstDue(frequency = {}, now = new Date(), timeZone = CONTROL_TIME_ZONE) {
  if (isDailyFrequency(frequency)) return nextDeadlineAfter(frequency, now, timeZone)
  return new Date(periodBounds(frequency, now, timeZone).end.getTime() - 1000).toISOString()
}

const regular = (row) => row && row.status !== 'cancelled' && !row.cancelledAt && !row.isExtra && !row.responseData?.isExtra && row.at

// How far the current period is: required, regular entries done, extra entries.
export function periodProgress(frequency = {}, history = [], now = new Date(), timeZone = CONTROL_TIME_ZONE) {
  const { unit, start, end } = periodBounds(frequency, now, timeZone)
  const inPeriod = (row) => row.at && new Date(row.at) >= start && new Date(row.at) < end && row.status !== 'cancelled' && !row.cancelledAt
  const rows = history.filter(inPeriod)
  const done = rows.filter(regular).length
  const required = requiredPerPeriod(frequency)
  return { unit, start: start.toISOString(), end: end.toISOString(), required, done, extra: rows.length - done, complete: done >= required }
}

// Each entry of an assignment's history marked as counted (one of the
// period's required entries) and on time (by its deadline), as the database
// does in private.control_execution_marks.
export function executionMarks(history = [], frequency = {}, timeZone = CONTROL_TIME_ZONE) {
  const rows = history.filter(regular).slice().sort((a, b) => new Date(a.at) - new Date(b.at))
  const daily = isDailyFrequency(frequency)
  const required = requiredPerPeriod(frequency)
  let dayKey = '', rank = 0
  return rows.map((row, index) => {
    if (daily) {
      const d = localDay(row.at, timeZone)
      const key = `${d.year}-${d.month}-${d.day}`
      rank = key === dayKey ? rank + 1 : 1
      dayKey = key
      const counted = rank <= required
      const at = new Date(row.at)
      return { row, at: row.at, counted, onTime: counted && at >= slotOpens(frequency, d, rank - 1, timeZone) && at <= slotDeadline(frequency, d, rank - 1, timeZone) }
    }
    const previous = rows[index - 1]
    return { row, at: row.at, counted: true, onTime: !previous || new Date(row.at) <= new Date(nextDueAfterExecution(frequency, previous.at, 1, timeZone)) }
  })
}

// Status of a due date: overdue once passed; due soon within two hours for
// daily controls, a day for the rest.
export function dueState(nextDueAt, frequency = {}, now = new Date()) {
  if (!nextDueAt) return 'scheduled'
  const diff = new Date(nextDueAt) - new Date(now)
  if (diff < 0) return 'overdue'
  if (diff <= (isDailyFrequency(frequency) ? 120 : 1440) * MINUTE) return 'dueSoon'
  return 'scheduled'
}
