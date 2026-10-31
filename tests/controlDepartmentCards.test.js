import { describe, expect, it } from 'vitest'
import { controlRates, departmentCards } from '../src/features/controls/controlDepartmentCards'

const now = new Date('2026-10-26T10:00:00Z')
const item = (id, assignments) => ({ id, title: id, frequency: { kind: 'daily', timesPerDay: 1 }, assignments })

describe('department cards on the Controls page', () => {
  const rows = [
    { item: item('A', { ΜΕΘ: { nextDueAt: '2026-10-25T08:00:00Z', lastCompletedAt: '2026-10-24T08:00:00Z' }, ΤΕΠ: { nextDueAt: '2026-11-20T08:00:00Z', lastCompletedAt: '2026-10-26T07:00:00Z' } }), departments: ['ΜΕΘ', 'ΤΕΠ'] },
    { item: item('B', { ΜΕΘ: { nextDueAt: '2026-11-20T08:00:00Z', summary: { lastPerformedAt: '2026-10-26T09:00:00Z' } } }), departments: ['ΜΕΘ'] },
  ]
  const lines = [
    { item: rows[0].item, department: 'ΜΕΘ', expected: 10, performed: 8 },
    { item: rows[0].item, department: 'ΤΕΠ', expected: 10, performed: 12 },
    { item: rows[1].item, department: 'ΜΕΘ', expected: 10, performed: 10 },
  ]

  it('counts each department\'s controls, overdue ones, adherence and latest entry, overdue departments first', () => {
    const cards = departmentCards(rows, lines, now)
    expect(cards.map((c) => c.department)).toEqual(['ΜΕΘ', 'ΤΕΠ'])
    expect(cards[0]).toMatchObject({ controls: 2, overdue: 1, rate: 90, lastAt: '2026-10-26T09:00:00Z' })
    // More done than due counts as 100%, never above.
    expect(cards[1]).toMatchObject({ controls: 1, overdue: 0, rate: 100 })
  })

  it('puts the lowest adherence next when nothing is overdue', () => {
    const calm = rows.map((row) => ({ ...row, item: { ...row.item, assignments: Object.fromEntries(Object.entries(row.item.assignments).map(([dep, a]) => [dep, { ...a, nextDueAt: '2026-11-20T08:00:00Z' }])) } }))
    const low = [{ item: calm[0].item, department: 'ΤΕΠ', expected: 10, performed: 5, missed: 5 }, { item: calm[0].item, department: 'ΜΕΘ', expected: 10, performed: 9, missed: 1 }]
    const cards = departmentCards(calm, low, now)
    expect(cards.map((c) => c.department)).toEqual(['ΤΕΠ', 'ΜΕΘ'])
    expect(cards[0]).toMatchObject({ rate: 50, missed: 5, expected: 10 })
  })

  it('gives every control one adherence over the departments shown', () => {
    const rates = controlRates(lines)
    expect(rates.get('A')).toBe(90)
    expect(rates.get('B')).toBe(100)
  })
})
