import { describe,expect,it } from 'vitest'
import { inferLiraTimeWindow } from '../src/features/lira/liraTime'

describe('LIRA natural language time parser',()=>{
 const today='2026-09-02'
 it('understands relative days',()=>{
  expect(inferLiraTimeWindow('Τι έγινε χθες;',{today})).toMatchObject({start:'2026-09-01',end:'2026-09-01'})
  expect(inferLiraTimeWindow('Τι έγινε προχθές;',{today})).toMatchObject({start:'2026-08-31',end:'2026-08-31'})
 })
 it('understands this week',()=>{
  expect(inferLiraTimeWindow('Τι άλλαξε αυτή την εβδομάδα;',{today})).toMatchObject({start:'2026-08-31',end:'2026-09-02',kind:'week'})
 })
 it('understands a named month',()=>{
  expect(inferLiraTimeWindow('Τι έγινε τον Αύγουστο;',{today})).toMatchObject({start:'2026-08-01',end:'2026-08-31',kind:'month'})
 })
 it('understands explicit date ranges',()=>{
  expect(inferLiraTimeWindow('Δείξε μου από 1/8/2026 έως 31/8/2026',{today})).toMatchObject({start:'2026-08-01',end:'2026-08-31',kind:'range'})
 })
 it('understands last quarter as a rolling 90-day window',()=>{
  expect(inferLiraTimeWindow('Τι έγινε το τελευταίο τρίμηνο;',{today})).toMatchObject({start:'2026-06-05',end:'2026-09-02',kind:'rolling'})
 })
})
