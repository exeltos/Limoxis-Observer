import { describe,expect,it } from 'vitest'
import { calculateCloudDefinition } from '../src/features/indicators/indicatorCloudService'

describe('production indicator calculation',()=>{
 it('calculates rates with aliases and patient-day denominators',()=>{
  const row=calculateCloudDefinition({id:'who-hh',calculation:'auto',numerator:'compliant_hh_actions',denominator:'hh_opportunities',multiplier:100,target:85,direction:'higher'},{hh_compliant_actions:90,hh_opportunities:100})
  expect(row.value).toBe(90);expect(row.status).toBe('onTarget')
 })
 it('does not invent a rate when the denominator is zero',()=>{
  const row=calculateCloudDefinition({id:'mdro',calculation:'auto',numerator:'mdro_bsi',denominator:'patient_days',multiplier:1000,target:null,direction:'lower'},{mdro_bsi:2,patient_days:0})
  expect(row.value).toBeNull();expect(row.status).toBe('context')
 })
 it('supports count indicators without denominators',()=>{
  const row=calculateCloudDefinition({id:'active',calculation:'auto',numerator:'active_surveillance',denominator:null,multiplier:1,target:null,direction:'context'},{active_surveillance:7})
  expect(row.value).toBe(7);expect(row.numerator).toBe(7)
 })
})
