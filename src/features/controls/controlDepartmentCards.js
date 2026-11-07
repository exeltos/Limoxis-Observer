// One card per department on the Controls «Departments» tab: how many controls
// it runs, how many are overdue, today's entries done of those due, its
// programme adherence over the chosen period and when it last recorded. Built from the same scoped rows as the list, so a card and
// the list it opens always count the same controls.
import { assignmentFrequency, assignmentStatus, getAssignment } from './controlScheduling'
import { todayProgress } from './controlAdherence'
import { isDailyFrequency, isWeekdaysOnly, zonedParts } from './controlDueRules'

// «Today» on a Saturday or Sunday (owner, 7/11/2026): the departments whose daily controls all run Monday–Friday have
// nothing to do and leave the view. Empty on working days.
export function weekendClosedDepartments(rows = [], now = new Date()) {
  const { year, month, day } = zonedParts(now)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  if (weekday !== 0 && weekday !== 6) return new Set()
  const daily = new Map()
  for (const { item, departments } of rows) {
    for (const department of departments) {
      const frequency = assignmentFrequency(item, department)
      if (!isDailyFrequency(frequency)) continue
      daily.set(department, (daily.get(department) ?? true) && isWeekdaysOnly(frequency))
    }
  }
  return new Set([...daily].filter(([, closed]) => closed).map(([department]) => department))
}

const latest = (values) => values.filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || null

export function departmentCards(rows = [], adherenceLines = [], now = new Date(), language = 'el') {
  const cards = new Map()
  for (const { item, departments } of rows) {
    for (const department of departments) {
      if (!cards.has(department)) cards.set(department, { department, controls: 0, overdue: 0, todayDone: 0, todayRequired: 0, lastAt: null, expected: 0, counted: 0, missed: 0 })
      const card = cards.get(department)
      const assignment = getAssignment(item, department)
      card.controls += 1
      if (assignmentStatus(item, department, now) === 'overdue') card.overdue += 1
      const today = todayProgress(item, department, now)
      if (today) { card.todayRequired += today.required; card.todayDone += Math.min(today.done, today.required) }
      card.lastAt = latest([card.lastAt, assignment?.summary?.lastPerformedAt, assignment?.lastCompletedAt])
    }
  }
  for (const line of adherenceLines) {
    const card = cards.get(line.department)
    if (!card) continue
    card.expected += line.expected
    card.counted += Math.min(line.performed, line.expected)
    card.missed += line.missed
  }
  // The lowest adherence first (owner, 7/11/2026), then those with overdue controls; without a rate last.
  return [...cards.values()]
    .map((card) => ({ ...card, rate: card.expected ? Math.round((card.counted / card.expected) * 100) : null }))
    .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101) || (b.overdue > 0) - (a.overdue > 0) || a.department.localeCompare(b.department, language === 'en' ? 'en' : 'el'))
}

// The adherence of each control over the departments the list shows (one bar per row).
export function controlRates(adherenceLines = []) {
  const totals = new Map()
  for (const line of adherenceLines) {
    const total = totals.get(line.item.id) || { expected: 0, counted: 0 }
    total.expected += line.expected
    total.counted += Math.min(line.performed, line.expected)
    totals.set(line.item.id, total)
  }
  return new Map([...totals].map(([id, { expected, counted }]) => [id, expected ? Math.round((counted / expected) * 100) : null]))
}
