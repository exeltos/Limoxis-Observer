import { describe, expect, it } from 'vitest'
import { computeIndicator, periodOf } from '../src/features/registers/registerEngine'

// «Δεν καταγράφεται» (owner, 2/11/2026): an indicator resting on a field no entry has ever filled, or on a sheet row no day
// has a number for, is not recorded: empty, never judged — while a register that records it still counts a quiet period as 0.
const period = periodOf('year', '2026-06-15')
const caseRegister = {
  kind: 'case',
  fields: [{ key: 'date', type: 'date' }, { key: 'urgent', type: 'yesno' }, { key: 'start_date', type: 'date' }, { key: 'end_date', type: 'date' }],
  entryDateField: 'date',
}
const entry = values => ({ id: Math.random().toString(), entryDate: '2026-03-10', periodStart: '2026-03-10', values: { date: '2026-03-10', ...values } })
const share = { id: 'urgent_share', aggregation: 'percent', filters: [{ field: 'urgent', op: 'yes' }], denominatorFilters: [{ field: 'urgent', op: 'filled' }], direction: 'context' }

describe('indicators that the register never records', () => {
  it('is not recorded when the field of the denominator was never filled', () => {
    const result = computeIndicator(caseRegister, share, [entry({}), entry({})], period)
    expect(result).toMatchObject({ value: null, notRecorded: true, status: 'context' })
  })
  it('is recorded once any entry has the field, and a quiet period of a recording register is 0, not «not recorded»', () => {
    const entries = [entry({ urgent: true })]
    expect(computeIndicator(caseRegister, share, entries, period)).toMatchObject({ value: 100 })
    expect(computeIndicator(caseRegister, share, entries, periodOf('month', '2026-09-10')).notRecorded).toBeUndefined()
  })
  it('is not recorded when the register has no entries at all: nothing was measured yet, so no result meets a target', () => {
    expect(computeIndicator(caseRegister, share, [], period)).toMatchObject({ value: null, notRecorded: true, status: 'context' })
  })
  it('is not recorded when a sheet row has no number in any day', () => {
    const sheet = { kind: 'sheet', sheet: { period: 'month', rows: [{ key: 'seen' }, { key: 'left' }], measures: [{ key: 'count' }] } }
    const days = [{ id: 'a', periodStart: '2026-03-01', entryDate: '2026-03-01', values: { seen: { count: 10 } } }]
    const rate = { id: 'left_rate', aggregation: 'percent', rows: ['left'], denominatorRows: ['seen'], direction: 'lower', target: 2 }
    expect(computeIndicator(sheet, rate, days, period)).toMatchObject({ value: null, notRecorded: true, status: 'context' })
    expect(computeIndicator(sheet, { id: 'seen', aggregation: 'sum', rows: ['seen'] }, days, period).notRecorded).toBeUndefined()
  })
})
