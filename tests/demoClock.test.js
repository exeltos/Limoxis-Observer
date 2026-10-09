import { describe, expect, it } from 'vitest'
import { DEMO_AUTHORED_ON, demoOffsetDays, shiftDemoDate, shiftDemoDatesInPlace } from '../src/core/data/demoClock.js'

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

  it('keeps the fixtures as written while testing', () => {
    expect(DEMO_AUTHORED_ON).toBe('2026-08-29')
    expect(demoOffsetDays(new Date(2026, 9, 9))).toBe(0)
  })
})
