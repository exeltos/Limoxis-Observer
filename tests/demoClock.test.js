import { describe, expect, it } from 'vitest'
import { DEMO_AUTHORED_ON, demoOffsetDays, shiftDemoDate, shiftDemoDatesInPlace, shiftDemoMonth } from '../src/core/data/demoClock.js'

describe('Demo dates follow today', () => {
  it('shifts dates and timestamps, keeping their form', () => {
    expect(shiftDemoDate('2026-08-29', 41)).toBe('2026-10-09')
    expect(shiftDemoDate('2026-08-29T10:15:00.000Z', 41)).toBe('2026-10-09T10:15:00.000Z')
    expect(shiftDemoDate('2026-08-29T10:15', 41)).toBe('2026-10-09T10:15')
    expect(shiftDemoDate('2025/26', 41)).toBe('2025/26')
    expect(shiftDemoDate('PT-260179', 41)).toBe('PT-260179')
  })

  it('shifts every dataset once, even objects shared between lists', () => {
    const shared = { due: '2026-09-01' }
    const data = [[shared, { at: '2026-08-20', dateOfBirth: '1980-10-09', nested: { until: '2027-01-31', birthDate: '2026-08-10' } }], [shared]]
    shiftDemoDatesInPlace(data, 10)
    expect(shared.due).toBe('2026-09-11')
    expect(data[0][1]).toEqual({ at: '2026-08-30', dateOfBirth: '1980-10-09', nested: { until: '2027-02-10', birthDate: '2026-08-20' } })
  })

  it('moves monthly period records by whole months', () => {
    const row = { periodStart: '2026-07-01', periodEnd: '2026-07-31', period: '2026-07', date: '2026-07-31', createdAt: '2026-07-31T08:00:00', checkedAt: '2026-08-20' }
    shiftDemoDatesInPlace([row], 41)
    expect(row).toEqual({ periodStart: '2026-08-01', periodEnd: '2026-08-31', period: '2026-08', date: '2026-08-31', createdAt: '2026-08-31T08:00:00', checkedAt: '2026-09-30' })
    expect(shiftDemoMonth('2026-01-31', 1)).toBe('2026-02-28')
    expect(shiftDemoMonth('2026-08-28', 1)).toBe('2026-09-28')
  })

  it('keeps the fixtures as written while testing', () => {
    expect(DEMO_AUTHORED_ON).toBe('2026-08-29')
    expect(demoOffsetDays(new Date(2026, 9, 9))).toBe(0)
  })
})

describe('Demo meetings', () => {
  it('move by whole months with the month in their title', async () => {
    const { shiftDemoMonthsInPlace } = await import('../src/core/data/demoClock.js')
    const meetings = [[{ date: '2026-08-18', title: 'Τακτική συνεδρίαση Αυγούστου', finalizedAt: '2026-08-19T09:20:00Z', notes: 'Αυγούστου' }, { date: '2026-12-08', title: 'December review' }]]
    shiftDemoMonthsInPlace(meetings, 1)
    expect(meetings[0][0]).toEqual({ date: '2026-09-18', title: 'Τακτική συνεδρίαση Σεπτεμβρίου', finalizedAt: '2026-09-19T09:20:00Z', notes: 'Αυγούστου' })
    expect(meetings[0][1]).toEqual({ date: '2027-01-08', title: 'January review' })
  })
})
