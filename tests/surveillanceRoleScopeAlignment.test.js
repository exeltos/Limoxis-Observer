import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import { CAPABILITIES,ROLES,scopeFor } from '../src/core/permissions/roles'
import { DATA_SCOPES } from '../src/core/permissions/scopeTypes'

const migration=fs.readFileSync(new URL('../supabase/migrations/20260902214500_surveillance_role_scope_alignment.sql',import.meta.url),'utf8')

describe('surveillance role scope alignment',()=>{
 it('keeps Link Nurse and Department Manager department-scoped',()=>{
  expect(scopeFor(CAPABILITIES.VIEW_SURVEILLANCE,{role:ROLES.LINK_NURSE})).toBe(DATA_SCOPES.DEPARTMENT)
  expect(scopeFor(CAPABILITIES.VIEW_SURVEILLANCE,{role:ROLES.DEPARTMENT_MANAGER})).toBe(DATA_SCOPES.DEPARTMENT)
 })
 it('keeps Doctor Reviewer assignment-scoped instead of organization-wide in backend reads',()=>{
  expect(migration).toContain("om.role = 'doctor_reviewer'::public.app_role")
  expect(migration).toContain("ra.record_type = 'surveillance_case'")
  expect(migration).toContain('public.current_user_has_case_assignment(target_org,target_case)')
  expect(migration).not.toContain("array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]")
 })
 it('grants Link Nurse only department-authorized surveillance reads',()=>{
  expect(migration).toContain("array['department_manager','link_nurse']::public.app_role[]")
  expect(migration).toContain('public.current_user_has_department_scope(target_org,target_department)')
 })
 it('propagates case authorization through clinical child records',()=>{
  expect(migration).toContain('clinical_assessments_read')
  expect(migration).toContain('isolation_episodes_read')
  expect(migration).toContain('reassessments_read')
  expect(migration).toContain('outcomes_read')
  expect(migration).toContain('surveillance_events_clinical_read')
 })
})
