import {describe,expect,it} from 'vitest'
import {CAPABILITIES,MANAGEMENT_CAPABILITIES,ROLES,can} from '../src/core/permissions/roles'
import { readSource } from './helpers/readSource'

const migration=readSource('supabase/migrations/20260902114838_indicator_definitions_management_governance.sql')
const service=readSource('src/features/management/managementCloudService.js')
const panel=readSource('src/features/management/IndicatorsPanel.jsx')
const page=readSource('src/features/management/ManagementPage.jsx')

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
 it('routes indicator management through its dedicated capability',()=>{
  // The hospital's indicator definitions live in «Δείκτες & Στόχοι»: managing them does not open the Management Center.
  expect(MANAGEMENT_CAPABILITIES).not.toContain(CAPABILITIES.MANAGE_INDICATORS)
  expect(MANAGEMENT_CAPABILITIES).toContain(CAPABILITIES.MANAGE_ANNOUNCEMENTS)
  expect(can(ROLES.QUALITY_MANAGER,CAPABILITIES.MANAGE_INDICATORS)).toBe(true)
  expect(can(ROLES.QUALITY_MANAGER,CAPABILITIES.MANAGE_LIBRARIES)).toBe(false)
  expect(page).not.toContain("okCap(CAPABILITIES.MANAGE_INDICATORS)?[{id:'indicators'")
  expect(readSource('src/features/quality/QualityPage.jsx')).toContain("goTo('/indicators/new')")
 })
 it('exposes a governed management UI',()=>{
  expect(page).toContain("id:'indicators'")
  expect(page).toContain('<IndicatorsPanel global={global}/>')
  expect(panel).toContain("item.system?(el?'Σύστημα':'System'):(el?'Νοσοκομείο':'Hospital')")
  expect(panel).toContain('item.system&&!isOwner')
 })
})
