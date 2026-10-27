import { describe, expect, it } from 'vitest'
import { groupAdherenceByDepartment, missedDays, monthRanges } from '../src/features/controls/controlAdherence'

describe('adherence: missed days, months and departments', () => {
  const days = new Map([['2026-10-20', 2], ['2026-10-21', 1], ['2026-10-23', 2]])
  it('names the whole days a daily control was short of its entries', () => {
    const f = { kind: 'daily', times: ['09:00', '17:00'] }
    // 20 done, 21 one short, 22 none, 23 done; 24 has not ended.
    expect(missedDays(f, days, { from: new Date('2026-10-19T22:00:00Z'), to: new Date('2026-10-24T12:00:00Z') })).toEqual([{ day: '2026-10-21', missing: 1 }, { day: '2026-10-22', missing: 2 }])
  })
  it('skips the weekend of a weekdays-only control and days before it started', () => {
    const f = { kind: 'daily', times: ['09:00'], weekdaysOnly: true }
    const out = missedDays(f, new Map(), { from: new Date('2026-10-16T22:00:00Z'), to: new Date('2026-10-20T23:00:00Z') })
    expect(out.map((x) => x.day)).toEqual(['2026-10-19', '2026-10-20'])
    expect(missedDays(f, new Map(), { from: new Date('2026-10-16T22:00:00Z'), to: new Date('2026-10-20T23:00:00Z') }, '2026-10-19T21:00:00Z').map((x) => x.day)).toEqual(['2026-10-20'])
  })
  it('names the whole weeks a weekly control had no entry, none for monthly ones', () => {
    const weeks = missedDays({ kind: 'weekly', interval: 1 }, days, { from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-10-27T12:00:00Z') })
    expect(weeks.map((x) => x.day)).toEqual(['2026-10-05', '2026-10-12'])
    expect(missedDays({ kind: 'monthly', interval: 1 }, days, { from: new Date('2026-01-01'), to: new Date('2026-10-27') })).toEqual([])
  })
  it('splits 6 and 12 months into calendar months', () => {
    const months = monthRanges('6m', new Date('2026-10-27T12:00:00Z'))
    expect(months.map((m) => m.key)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'])
    expect(monthRanges('30d')).toEqual([])
  })
  it('groups the lines per department, worst first', () => {
    const item = (id) => ({ id, title: id })
    const groups = groupAdherenceByDepartment([
      { item: item('A'), department: 'ΜΕΘ', expected: 10, performed: 10, onTime: 10, missed: 0 },
      { item: item('A'), department: 'ΤΕΠ', expected: 10, performed: 5, onTime: 4, missed: 5 },
      { item: item('B'), department: 'ΤΕΠ', expected: 10, performed: 10, onTime: 10, missed: 0 },
    ])
    expect(groups.map((g) => g.department)).toEqual(['ΤΕΠ', 'ΜΕΘ'])
    expect(groups[0].totals).toMatchObject({ expected: 20, performed: 15, missed: 5, rate: 75, onTimeRate: 93 })
  })
})
