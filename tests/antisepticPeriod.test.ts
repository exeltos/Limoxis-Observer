import { describe, expect, it } from 'vitest'
import { antisepticPeriodBounds, antisepticPeriodKind, antisepticPeriodLabel } from '../src/features/prevention/antisepticMethods'

describe('antiseptic consumption period', () => {
  it('tells a month, a whole year and another stretch apart', () => {
    expect(antisepticPeriodKind('2026-03')).toBe('month')
    expect(antisepticPeriodKind('2025-01 – 2025-12')).toBe('year')
    expect(antisepticPeriodKind('2025-01 – 2025-06')).toBe('range')
    expect(antisepticPeriodKind('')).toBe('')
  })

  it('gives the first and last day', () => {
    expect(antisepticPeriodBounds('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(antisepticPeriodBounds('2025-01 – 2025-12')).toEqual({ from: '2025-01-01', to: '2025-12-31' })
    expect(antisepticPeriodBounds('x')).toBeNull()
  })

  it('writes a year as the year, a month as MM/YYYY', () => {
    expect(antisepticPeriodLabel('2025-01 – 2025-12')).toBe('2025')
    expect(antisepticPeriodLabel('2026-03')).toBe('03/2026')
    expect(antisepticPeriodLabel('2025-01 – 2025-06')).toBe('01/2025 – 06/2025')
  })
})
