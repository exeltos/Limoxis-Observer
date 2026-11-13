import { describe, expect, it } from 'vitest'
import { ADHERENCE_PERIODS, assignmentAdherence, expectedOccurrences, missedDays, periodAdherence, periodRange, periodShort, programmeAdherence, slotLength, todayProgress } from '../src/features/controls/controlAdherence'
import type { ControlRow } from '../src/features/controls/controlTypes'

const day = 86400000
const now = new Date('2026-10-08T12:00:00Z')
const ago = (days, hours = 0) => new Date(now.getTime() - days * day - hours * 3600000).toISOString()

describe('control programme adherence', () => {
  it('derives the slot length and the expected count from the frequency', () => {
    expect(slotLength({ kind: 'daily', times: ['08:00', '20:00'] })).toBe(day / 2)
    expect(expectedOccurrences({ kind: 'daily', times: ['09:00'] }, ago(30), now)).toBe(30)
    expect(expectedOccurrences({ kind: 'weekly', interval: 1 }, ago(28), now)).toBe(4)
    expect(expectedOccurrences({ kind: 'weekly', interval: 2 }, ago(28), now)).toBe(2)
    // A year holds 12 calendar months, a 30-day month one, although the nominal month is 30.44 days.
    expect(expectedOccurrences({ kind: 'monthly', interval: 1 }, ago(365), now)).toBe(12)
    expect(expectedOccurrences({ kind: 'monthly', interval: 1 }, ago(30), now)).toBe(1)
  })

  it('counts performed, on-time and missed executions in the period', () => {
    const history = [
      { at: ago(1) },
      { at: ago(2) },
      { at: ago(2, -1) },                                           // a second entry that day: not one of the required
      { at: ago(3) },
      { at: ago(4), isExtra: true },                                // an extra entry: never counted
      { at: ago(5), status: 'cancelled' },                          // cancelled: not counted
      { at: ago(40) },                                              // outside the period
    ]
    const result = assignmentAdherence({ frequency: { kind: 'daily', timesPerDay: 1 }, history }, { from: ago(10), to: now, now })
    expect(result).toMatchObject({ expected: 10, performed: 3, onTime: 3, late: 0, missed: 7, rate: 30, onTimeRate: 100 })
  })

  it('marks a slot late once its window (±1 hour, in Athens time) has passed', () => {
    // 08:00 and 16:00: on time 07:00–09:00 and 15:00–17:00 (Athens, UTC+3 in October).
    const history = [
      { at: '2026-10-05T04:00:00Z' }, { at: '2026-10-05T12:30:00Z' },  // 07:00 and 15:30: both on time
      { at: '2026-10-06T07:30:00Z' },                                  // 10:30: the morning slot, late
      { at: '2026-10-06T13:45:00Z' },                                  // 16:45: the second slot, on time
    ]
    const result = assignmentAdherence({ frequency: { kind: 'daily', times: ['08:00', '16:00'] }, history }, { from: '2026-10-04T21:00:00Z', to: '2026-10-06T21:00:00Z', now })
    expect(result).toMatchObject({ expected: 4, performed: 4, onTime: 3, late: 1, missed: 0, rate: 100 })
  })

  it('does not expect executions before the assignment started and never exceeds 100%', () => {
    const history = Array.from({ length: 6 }, (_, i) => ({ at: ago(i + 0.5) }))
    const result = assignmentAdherence({ frequency: { kind: 'daily', times: ['09:00'] }, history, startedAt: ago(5) }, { from: ago(30), to: now, now })
    expect(result.expected).toBe(5)
    expect(result.rate).toBe(100)
    expect(result.missed).toBe(0)
  })

  it('totals the programme and lists the weakest assignments first', () => {
    const item = (id, frequency, assignments): ControlRow => ({ item: { id, title: id, frequency, assignments }, departments: Object.keys(assignments) }) as never
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
    expect(range.from.toISOString()).toBe('2025-12-31T22:00:00.000Z') // 1/1/2026 00:00 Athens
    expect(Math.round(((now as unknown as number) - (periodRange('90d', now).from as unknown as number)) / day)).toBe(90)
  })
  it('uses the counts from the database instead of the loaded history', () => {
    const rows: ControlRow[] = [{ item: { id: 'A', title: 'A', frequency: { kind: 'weekly', interval: 1 }, assignments: { ICU: { dbId: 'asg-1', history: [] } } }, departments: ['ICU'] }] as never
    const { totals } = programmeAdherence(rows, { from: ago(28), to: now, now }, new Map([['asg-1', { performed: 3, onTime: 2 }]]))
    expect(totals).toMatchObject({ expected: 4, performed: 3, onTime: 2, missed: 1, rate: 75 })
  })
})

describe('reports end on the last day with entries', () => {
  it('ends today when entries are recent, else at the end of the last day with entries', async () => {
    const { reportEnd } = await import('../src/features/controls/controlAdherence')
    const now = new Date('2026-10-27T10:00:00Z')
    expect(reportEnd('2026-10-27T06:00:00Z', now).toISOString()).toBe(now.toISOString())
    // No entry in the hospital for 6 hours: the entries come in once a day, the report ends with the last day that has them.
    expect(reportEnd('2026-10-26T18:00:00Z', now).toISOString()).toBe('2026-10-26T21:59:59.000Z')
    expect(reportEnd('2026-10-18T21:01:15Z', now).toISOString()).toBe('2026-10-19T20:59:59.000Z') // 19/10 23:59:59 Athens
    expect(reportEnd(null, now).toISOString()).toBe(now.toISOString())
  })
})

describe('the page period', () => {
  const now = new Date('2026-10-27T10:30:00Z') // Tuesday, 12:30 Athens
  const daily2 = { kind: 'daily', timesPerDay: 2, times: ['08:00', '16:00'] }
  const row = (frequency, history, extra = {}): ControlRow => ({ item: { id: 'A', title: 'A', frequency, assignments: { ΜΕΘ: { frequency, history, ...extra } } }, departments: ['ΜΕΘ'] }) as never
  it('starts «today» at midnight in Athens and offers a day, month, quarter, half-year or year, stepped back', () => {
    expect(ADHERENCE_PERIODS).toEqual(['day', 'month', 'quarter', 'half', 'year'])
    expect(periodRange('today', now).from.toISOString()).toBe('2026-10-26T22:00:00.000Z')
    expect(periodRange('day', now).from.toISOString()).toBe('2026-10-26T22:00:00.000Z')
    expect(periodShort('6m')).toBe('6 μήνες')
    expect(periodShort('day', 'el', now)).toBe('Σήμερα')
    expect(periodShort('day@-1', 'el', now)).toBe('26/10/2026')
    expect(periodShort('month', 'el', now)).toBe('Οκτ 2026')
    expect(periodShort('month@-10', 'el', now)).toBe('Δεκ 2025')
    expect(periodShort('quarter@-1', 'el', now)).toBe('3ο τρίμ. 2026')
    expect(periodShort('half', 'el', now)).toBe('2ο εξάμ. 2026')
    // A past month ends on its last second; the current one now.
    const september = periodRange('month@-1', now)
    expect([september.from.toISOString(), september.to.toISOString()]).toEqual(['2026-08-31T21:00:00.000Z', '2026-09-30T20:59:59.000Z'])
    expect(periodRange('month', now).to.toISOString()).toBe(now.toISOString())
  })
  it('counts today only what is already due: a set time still to come is not missed', () => {
    // 12:30 Athens: 08:00 is due (done at 08:10), 16:00 not yet.
    const { lines, totals } = periodAdherence([row(daily2, [{ at: '2026-10-27T05:10:00Z' }])], 'today', null, now)
    expect(lines).toHaveLength(1)
    expect(totals).toMatchObject({ expected: 1, performed: 1, missed: 0, rate: 100 })
    // Nothing done: 08:00 is missed, 16:00 still to come.
    const none = periodAdherence([row(daily2, [])], 'today', null, now)
    expect(none.totals).toMatchObject({ expected: 1, performed: 0, missed: 1, rate: 0 })
    expect(none.lines[0].missedDays).toEqual([{ day: '2026-10-27', missing: 1, times: ['08:00'] }])
  })
  it('asks nothing today of weekly controls, paused ones or weekdays-only ones at the weekend', () => {
    const sunday = new Date('2026-10-25T10:00:00Z')
    expect(todayProgress(row({ kind: 'weekly', interval: 1 }, []).item, 'ΜΕΘ', now)).toBeNull()
    expect(todayProgress(row(daily2, [], { status: 'paused' }).item, 'ΜΕΘ', now)).toBeNull()
    expect(todayProgress(row({ ...daily2, weekdaysOnly: true }, []).item, 'ΜΕΘ', sunday)).toBeNull()
  })
})

describe('the missed days of a control every N days', () => {
  it('names no day: the days between two executions are not missed', () => {
    const range = { from: '2026-10-01T00:00:00+03:00', to: '2026-11-02T00:00:00+02:00' }
    expect(missedDays({ kind: 'custom', interval: 4 }, new Map(), range, null)).toEqual([])
    // a daily control with no entry still names its days
    expect(missedDays({ kind: 'daily', timesPerDay: 1 }, new Map(), range, null).length).toBeGreaterThan(20)
  })
})
