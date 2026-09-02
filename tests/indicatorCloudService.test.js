import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
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
 it('keeps production indicators on the cloud route with department scoping and history',()=>{
  const page=fs.readFileSync('src/features/indicators/IndicatorsCloudPage.jsx','utf8')
  const wrapper=fs.readFileSync('src/features/indicators/IndicatorsPage.jsx','utf8')
  expect(wrapper).toContain('isDemo?<IndicatorsDemoPage/>:<IndicatorsCloudPage/>')
  expect(page).toContain('departmentScoped')
  expect(page).toContain('effectiveDepartment')
  expect(page).toContain('Historical trend')
  expect(page).toContain('CAPABILITIES.MANAGE_INDICATORS')
 })
 it('updates an existing snapshot explicitly instead of relying on expression-index onConflict',()=>{
  const service=fs.readFileSync('src/features/indicators/indicatorCloudService.js','utf8')
  expect(service).toContain('findExistingSnapshot')
  expect(service).toContain(".is('department_id',null)")
  expect(service).not.toContain("onConflict:'organization_id,indicator_key,department_id,period_start,period_end'")
 })
 it('mirrors department-scoped snapshot RLS in migrations',()=>{
  const migration=fs.readFileSync('supabase/migrations/20260902201000_indicator_snapshot_department_scope.sql','utf8')
  expect(migration).toContain('current_user_has_department_scope')
  expect(migration).toContain("current_user_has_capability(organization_id, 'view_indicators')")
  expect(migration).toContain("current_user_has_capability(organization_id, 'manage_indicators')")
 })
})
