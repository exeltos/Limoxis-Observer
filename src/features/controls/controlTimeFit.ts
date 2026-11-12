// The «Times» report: when each department really records its daily
// controls, against the set times and their windows (controlDueRules), and the
// set times that would fit that practice. A proposal moves a time to the full
// hour that catches the most entries in its window; it is offered only when
// it catches clearly more than the time set now.
import { CONTROL_TIME_ZONE, isDailyFrequency, slotMargin, slotStarts, slotWindowMinutes, zonedParts } from './controlDueRules'

const DAY_MINUTES = 1440
export const TIME_FIT_DAYS = 30

export const hhmm = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

const hasSetTimes = (frequency = {}) => (frequency.times || []).some((t) => /^\d{1,2}:\d{2}$/.test(String(t || '').trim()))

const regular = (row) => row && row.at && row.status !== 'cancelled' && !row.cancelledAt && !row.isExtra && !row.responseData?.isExtra

// The entries of a history in [from, to], as minutes after midnight per slot
// (the k-th entry of a day is slot k), as control_execution_times does.
export function minutesBySlot(history = [], from, to, timeZone = CONTROL_TIME_ZONE) {
  const start = new Date(from).getTime(), end = new Date(to).getTime()
  const rows = history.filter(regular).filter((row) => { const t = new Date(row.at).getTime(); return t >= start && t <= end }).sort((a, b) => new Date(a.at) - new Date(b.at))
  const slots = []
  let dayKey = '', rank = 0
  for (const row of rows) {
    const p = zonedParts(row.at, timeZone)
    const key = `${p.year}-${p.month}-${p.day}`
    rank = key === dayKey ? rank + 1 : 0
    dayKey = key
    ;(slots[rank] ||= []).push(p.hour * 60 + p.minute)
  }
  return slots
}

const inWindow = (minutes, { open, close }) => minutes >= open && minutes <= Math.min(close, DAY_MINUTES)

// Entries of the required slots that fall in their windows.
export function fitCount(frequency, slots = []) {
  return slotStarts(frequency).reduce((sum, _, i) => sum + (slots[i] || []).filter((m) => inWindow(m, slotWindowMinutes(frequency, i))).length, 0)
}

// The middle time of a slot's entries, to the nearest 5 minutes.
export function typicalTime(minutes = []) {
  if (!minutes.length) return null
  const sorted = [...minutes].sort((a, b) => a - b)
  const middle = sorted[Math.floor((sorted.length - 1) / 2)]
  return Math.min(DAY_MINUTES - 5, Math.round(middle / 5) * 5)
}

// The set times that fit the entries best, or the current ones.
export function proposeTimes(frequency = {}, slots = []) {
  const current = slotStarts(frequency)
  const margin = slotMargin(frequency)
  const proposed = current.map((start, i) => {
    const entries = slots[i] || []
    if (!entries.length) return start
    const score = (time) => entries.filter((m) => m >= time - 60 && m <= time + margin).length
    let best = start, bestScore = score(start)
    for (let hour = 0; hour < 24; hour += 1) {
      const time = hour * 60, value = score(time)
      if (value > bestScore || (value === bestScore && Math.abs(time - start) < Math.abs(best - start))) { best = time; bestScore = value }
    }
    return best
  })
  const ordered = proposed.every((time, i) => i === 0 || time > proposed[i - 1])
  return ordered ? proposed : current
}

// One line per department of a daily control with set times.
// rows: [{ item, departments }]; timesByAssignment: Map(assignment id → slots)
// from the database, or null to read each assignment's history.
export function timeFitLines(rows = [], timesByAssignment = null, { from, to } = {}) {
  const lines = []
  for (const { item, departments } of rows) {
    for (const department of departments) {
      const assignment = item.assignments?.[department]
      const frequency = assignment?.frequency || item.frequency || {}
      if (!assignment || !isDailyFrequency(frequency) || !hasSetTimes(frequency)) continue
      const required = slotStarts(frequency).length
      const slots = (timesByAssignment ? timesByAssignment.get(assignment.dbId) || [] : minutesBySlot(assignment.history, from, to)).slice(0, required)
      const entries = slots.reduce((sum, list) => sum + (list?.length || 0), 0)
      const current = slotStarts(frequency)
      const best = proposeTimes(frequency, slots)
      const fitNow = fitCount(frequency, slots)
      const fitBest = fitCount({ ...frequency, times: best.map(hhmm) }, slots)
      // A change is worth proposing when it catches clearly more entries.
      const changed = best.some((time, i) => time !== current[i]) && fitBest - fitNow >= Math.max(3, Math.ceil(entries * 0.1))
      const proposed = changed ? best : current
      lines.push({
        item, department, assignment, frequency, entries,
        current: current.map(hhmm),
        typical: current.map((_, i) => { const t = typicalTime(slots[i]); return t == null ? null : hhmm(t) }),
        proposed: proposed.map(hhmm),
        changed,
        rateNow: entries ? Math.round((fitNow / entries) * 100) : null,
        rateProposed: entries ? Math.round(((changed ? fitBest : fitNow) / entries) * 100) : null,
      })
    }
  }
  return lines.sort((a, b) => a.department.localeCompare(b.department, 'el') || String(a.item.title).localeCompare(String(b.item.title), 'el'))
}
