// One card per department on the Controls «Departments» tab: how many controls
// it runs, how many are overdue or due today, its programme adherence and when
// it last recorded. Built from the same scoped rows as the list, so a card and
// the list it opens always count the same controls.
import { assignmentStatus, getAssignment, isControlDue } from './controlScheduling'

const latest = (values) => values.filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || null

export function departmentCards(rows = [], adherenceLines = [], now = new Date(), language = 'el') {
  const cards = new Map()
  for (const { item, departments } of rows) {
    for (const department of departments) {
      if (!cards.has(department)) cards.set(department, { department, controls: 0, overdue: 0, dueToday: 0, lastAt: null, expected: 0, counted: 0 })
      const card = cards.get(department)
      const assignment = getAssignment(item, department)
      card.controls += 1
      if (assignmentStatus(item, department, now) === 'overdue') card.overdue += 1
      if (isControlDue(item, department, now)) card.dueToday += 1
      card.lastAt = latest([card.lastAt, assignment?.summary?.lastPerformedAt, assignment?.lastCompletedAt])
    }
  }
  for (const line of adherenceLines) {
    const card = cards.get(line.department)
    if (!card) continue
    card.expected += line.expected
    card.counted += Math.min(line.performed, line.expected)
  }
  return [...cards.values()]
    .map(({ expected, counted, ...card }) => ({ ...card, rate: expected ? Math.round((counted / expected) * 100) : null }))
    .sort((a, b) => (b.overdue > 0) - (a.overdue > 0) || a.department.localeCompare(b.department, language === 'en' ? 'en' : 'el'))
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
