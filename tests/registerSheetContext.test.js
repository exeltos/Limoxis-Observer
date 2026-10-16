import { describe, expect, it } from 'vitest'
import { rowContext } from '../src/features/registers/RegisterSheet'

const measures = [{ key: 'n' }]
const months = { '2026-06': { r: { n: 20 } }, '2026-07': { r: { n: 22 } }, '2026-08': { r: { n: 21 } }, '2025-09': { r: { n: 18 } } }
const valuesOf = month => months[month]

describe('monthly sheet: what a row looked like before', () => {
  it('reads the previous month, last year and twelve months ending this month', () => {
    const context = rowContext('r', measures, valuesOf, '2026-09', 23)
    expect(context.previous).toBe(21)
    expect(context.lastYear).toBe(18)
    expect(context.trend).toHaveLength(12)
    expect(context.trend.at(-1)).toBe(23)
    expect(context.unusual).toBe(false)
  })

  it('flags a value more than half away from the three months before', () => {
    expect(rowContext('r', measures, valuesOf, '2026-09', 210).unusual).toBe(true)
    expect(rowContext('r', measures, valuesOf, '2026-09', 5).unusual).toBe(true)
    expect(rowContext('r', measures, valuesOf, '2026-09', null).unusual).toBe(false)
  })

  it('does not flag rows whose usual count is too small to judge', () => {
    const few = { '2026-08': { r: { n: 2 } } }
    expect(rowContext('r', measures, month => few[month], '2026-09', 6).unusual).toBe(false)
  })
})
