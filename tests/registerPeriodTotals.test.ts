import { describe, expect, it } from 'vitest'
import { computeIndicator, entriesInPeriod } from '../src/features/registers/registerEngine'
import type { Period } from '../src/features/registers/registerEngine'
import type { Register, RegisterEntry, RegisterIndicator } from '../src/features/registers/registerTypes'

const register = { kind: 'sheet', sheet: { rows: [{ key: 'vaginal' }, { key: 'cs' }], measures: [{ key: 'count' }] }, fields: [] } as Register
const indicator = { id: 'deliveries', aggregation: 'sum', rows: ['vaginal', 'cs'] } as RegisterIndicator
const entry = (periodStart: string, vaginal: number, cs: number, periodEnd: string | null = null) => ({ periodStart, periodEnd, values: { vaginal: { count: vaginal }, cs: { count: cs } } }) as unknown as RegisterEntry

describe('a sheet entry that totals several months', () => {
  const entries = [entry('2024-01-01', 104, 234, '2024-02-29'), entry('2024-03-01', 27, 50)]
  it('counts in the year that holds it, not in one of its months', () => {
    expect(entriesInPeriod(entries, { from: '2024-01-01', to: '2024-01-31' } as Period)).toHaveLength(0)
    expect(entriesInPeriod(entries, { from: '2024-01-01', to: '2024-12-31' } as Period)).toHaveLength(2)
    expect(computeIndicator(register, indicator, entries, { from: '2024-01-01', to: '2024-12-31' } as Period).value).toBe(415)
    expect(computeIndicator(register, indicator, entries, { from: '2024-03-01', to: '2024-03-31' } as Period).value).toBe(77)
  })
})
