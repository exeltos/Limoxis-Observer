import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const migration=fs.readFileSync('supabase/migrations/202609021210_indicator_definitions_management_governance.sql','utf8')
const service=fs.readFileSync('src/features/management/managementCloudService.js','utf8')
const panel=fs.readFileSync('src/features/management/IndicatorsPanel.jsx','utf8')
const page=fs.readFileSync('src/features/management/ManagementPage.jsx','utf8')

describe('management indicator definitions',()=>{
 it('separates system definitions from hospital-managed definitions',()=>{
  expect(migration).toContain('indicators_manage_hospital')
  expect(migration).toContain('indicators_manage_system_owner')
  expect(migration).toContain('current_user_is_platform_owner()')
  expect(migration).toContain('trg_audit_indicator_definitions')
  expect(migration).toContain('revoke all on table public.indicator_definitions from anon')
 })
 it('persists definitions through Supabase',()=>{
  expect(service).toContain("from('indicator_definitions')")
  expect(service).toContain('loadIndicatorDefinitions')
  expect(service).toContain('saveIndicatorDefinition')
  expect(service).toContain('removeIndicatorDefinition')
 })
 it('exposes a governed management UI',()=>{
  expect(page).toContain("id:'indicators'")
  expect(page).toContain('<IndicatorsPanel/>')
  expect(panel).toContain('System · Owner managed')
  expect(panel).toContain('item.system&&!isOwner')
 })
})
