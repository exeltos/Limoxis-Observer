import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fitCount, minutesBySlot, proposeTimes, timeFitLines, typicalTime } from '../src/features/controls/controlTimeFit'
import { zonedInstant } from '../src/features/controls/controlDueRules'

const h = (hour, minute = 0) => hour * 60 + minute
const at = (day, hour, minute = 0) => ({ at: zonedInstant(2026, 10, day, h(hour, minute)).toISOString() })

describe('control times against practice', () => {
  it('groups a history by day slot in Athens time', () => {
    const slots = minutesBySlot([at(5, 7, 10), at(5, 15, 30), at(6, 7, 0), { ...at(6, 8, 0), isExtra: true }], '2026-10-01T00:00:00Z', '2026-10-31T00:00:00Z')
    expect(slots).toEqual([[h(7, 10), h(7)], [h(15, 30)]])
  })
  it('counts the entries in their windows and gives the usual time', () => {
    const f = { kind: 'daily', times: ['09:00'] }
    expect(fitCount(f, [[h(7), h(7, 30), h(8, 30), h(10, 30), h(11, 30)]])).toBe(2)
    expect(typicalTime([h(7), h(7, 12), h(19)])).toBe(h(7, 10))
  })
  it('proposes 07:00 and 15:00 for a twice-a-day control done at 07:00 and 15:00, keeps a fitting 08:00', () => {
    const twice = { kind: 'daily', times: ['08:00', '16:00'] }
    const slots = [[h(6, 50), h(7), h(7, 5), h(6, 40)], [h(14, 50), h(15), h(15, 10), h(14, 30)]]
    expect(proposeTimes(twice, slots)).toEqual([h(7), h(15)])
    expect(proposeTimes({ kind: 'daily', times: ['08:00'] }, [[h(8), h(8, 30), h(7, 30)]])).toEqual([h(8)])
  })
  it('offers a change only when it catches clearly more entries', () => {
    const item = (times, history) => ({ item: { id: 'C', title: 'Ψυγείο', frequency: { kind: 'daily', times }, assignments: { ΜΕΘ: { dbId: 'a1', history } } }, departments: ['ΜΕΘ'] })
    const days = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
    const range = { from: '2026-10-01T00:00:00Z', to: '2026-10-31T00:00:00Z' }
    const [early] = timeFitLines([item(['09:00'], days.map((d) => at(d, 6, 30)))], null, range)
    expect(early).toMatchObject({ changed: true, current: ['09:00'], proposed: ['07:00'], rateNow: 0, rateProposed: 100, entries: 10 })
    const [fits] = timeFitLines([item(['08:00'], days.map((d) => at(d, 8, 15)))], null, range)
    expect(fits).toMatchObject({ changed: false, proposed: ['08:00'], rateNow: 100 })
    // Weekly controls and days split evenly without times are left out.
    expect(timeFitLines([{ ...item([], []), item: { ...item([], []).item, frequency: { kind: 'weekly' } } }], null, range)).toEqual([])
  })
  it('is read by the database per slot, with the caller’s rights', () => {
    const sql = readFileSync(new URL('../supabase/migrations/20261211110000_control_execution_times.sql', import.meta.url), 'utf8')
    expect(sql).toContain('security invoker')
    expect(sql).toContain('not e.is_extra')
  })
})
