import { describe, expect, it } from 'vitest'
import { groupPeriods, periodKind, periodRange } from '../src/features/management/BedDaysPanel'

describe('patient days periods', () => {
  it('recognises a month, a quarter, a year and any other range', () => {
    expect(periodKind('2026-02-01', '2026-02-28')).toEqual({ kind: 'month', year: 2026, month: 2 })
    expect(periodKind('2026-04-01', '2026-06-30')).toEqual({ kind: 'quarter', year: 2026, quarter: 2 })
    expect(periodKind('2025-01-01', '2025-12-31')).toEqual({ kind: 'year', year: 2025 })
    expect(periodKind('2026-11-01', '2026-11-07').kind).toBe('custom')
    expect(periodKind('2026-02-01', '2026-03-31').kind).toBe('custom')
  })
  it('turns the chosen duration into Από–Έως', () => {
    expect(periodRange({ duration: 'month', year: 2024, month: 2 })).toEqual({ from: '2024-02-01', to: '2024-02-29' })
    expect(periodRange({ duration: 'quarter', year: 2026, quarter: 4 })).toEqual({ from: '2026-10-01', to: '2026-12-31' })
    expect(periodRange({ duration: 'year', year: 2026 })).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(periodRange({ duration: 'custom', from: '2026-11-01', to: '2026-11-07' })).toEqual({ from: '2026-11-01', to: '2026-11-07' })
  })
  it('shows one line per period with the departments and the hospital total', () => {
    const groups = groupPeriods([
      { id: 'a', from: '2026-01-01', to: '2026-01-31', scope: 'department', departmentId: 'icu', value: 10 },
      { id: 'b', from: '2026-01-01', to: '2026-01-31', scope: 'hospital', value: 50 },
      { id: 'c', from: '2026-02-01', to: '2026-02-28', scope: 'department', departmentId: 'icu', value: 12 },
    ])
    expect(groups.map(g => g.key)).toEqual(['2026-02-01|2026-02-28', '2026-01-01|2026-01-31'])
    expect(groups[1].hospital.id).toBe('b')
    expect(groups[1].departments.map(d => d.id)).toEqual(['a'])
  })
})
