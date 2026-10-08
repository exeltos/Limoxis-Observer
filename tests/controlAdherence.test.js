import { describe, expect, it } from 'vitest'
import { assignmentAdherence, expectedOccurrences, periodRange, programmeAdherence, slotLength } from '../src/features/controls/controlAdherence'

const day = 86400000
const now = new Date('2026-10-08T12:00:00Z')
const ago = (days, hours = 0) => new Date(now.getTime() - days * day - hours * 3600000).toISOString()

describe('control programme adherence', () => {
  it('derives the slot length and the expected count from the frequency', () => {
    expect(slotLength({ kind: 'daily', times: ['08:00', '20:00'] })).toBe(day / 2)
    expect(expectedOccurrences({ kind: 'daily', times: ['09:00'] }, ago(30), now)).toBe(30)
    expect(expectedOccurrences({ kind: 'weekly', interval: 1 }, ago(28), now)).toBe(4)
    expect(expectedOccurrences({ kind: 'weekly', interval: 2 }, ago(28), now)).toBe(2)
    expect(expectedOccurrences({ kind: 'monthly', interval: 1 }, ago(365), now)).toBe(11)
  })

  it('counts performed, on-time, late and missed executions in the period', () => {
    const history = [
      { at: ago(1), previousNextDueAt: ago(1, 1) },                // 1h late: within the 2h grace
      { at: ago(2), previousNextDueAt: ago(2, 5) },                // 5h late
      { at: ago(3), previousNextDueAt: ago(3) },
      { at: ago(4), status: 'cancelled' },                          // cancelled: not counted
      { at: ago(40) },                                              // outside the period
    ]
    const result = assignmentAdherence({ frequency: { kind: 'daily', times: ['09:00'] }, history }, { from: ago(10), to: now, now })
    expect(result).toMatchObject({ expected: 10, performed: 3, onTime: 2, late: 1, missed: 7, rate: 30, onTimeRate: 67 })
  })

  it('does not expect executions before the assignment started and never exceeds 100%', () => {
    const history = Array.from({ length: 6 }, (_, i) => ({ at: ago(i + 0.5) }))
    const result = assignmentAdherence({ frequency: { kind: 'daily', times: ['09:00'] }, history, startedAt: ago(5) }, { from: ago(30), to: now, now })
    expect(result.expected).toBe(5)
    expect(result.rate).toBe(100)
    expect(result.missed).toBe(0)
  })

  it('totals the programme and lists the weakest assignments first', () => {
    const item = (id, frequency, assignments) => ({ item: { id, title: id, frequency, assignments }, departments: Object.keys(assignments) })
    const rows = [
      item('A', { kind: 'weekly', interval: 1 }, { ICU: { history: [{ at: ago(1) }, { at: ago(8) }, { at: ago(15) }, { at: ago(22) }] } }),
      item('B', { kind: 'weekly', interval: 1 }, { ED: { history: [{ at: ago(3) }] } }),
    ]
    const { lines, totals } = programmeAdherence(rows, { from: ago(28), to: now, now })
    expect(lines.map((line) => line.item.id)).toEqual(['B', 'A'])
    expect(totals).toMatchObject({ expected: 8, performed: 5, missed: 3, rate: 63 })
  })

  it('offers fixed reporting periods', () => {
    const range = periodRange('year', now)
    expect(range.from.getMonth()).toBe(0)
    expect(range.from.getDate()).toBe(1)
    expect(Math.round((now - periodRange('90d', now).from) / day)).toBe(90)
  })
})
