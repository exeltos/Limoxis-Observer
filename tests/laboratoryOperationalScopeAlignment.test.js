import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import { CAPABILITIES,ROLES,scopeFor } from '../src/core/permissions/roles'
import { DATA_SCOPES } from '../src/core/permissions/scopeTypes'

const migration=fs.readFileSync(new URL('../supabase/migrations/20260902213000_laboratory_operational_scope_alignment.sql',import.meta.url),'utf8')
const workforceMigration=fs.readFileSync(new URL('../supabase/migrations/20260902211500_workforce_role_scope_alignment.sql',import.meta.url),'utf8')

describe('laboratory operational scope separation',()=>{
 it('keeps laboratory workforce visibility department-scoped in the permission engine',()=>{
  expect(scopeFor(CAPABILITIES.VIEW_STAFF,{role:ROLES.LABORATORY})).toBe(DATA_SCOPES.DEPARTMENT)
 })
 it('makes laboratory workflow capabilities organization-scoped in the permission engine',()=>{
  for(const capability of [CAPABILITIES.VIEW_LAB,CAPABILITIES.MANAGE_LAB_SAMPLES,CAPABILITIES.VALIDATE_LAB_RESULTS,CAPABILITIES.COMMUNICATE_CRITICAL_RESULTS,CAPABILITIES.CLASSIFY_RESISTANCE,CAPABILITIES.REOPEN_LAB_RECORD]){
   expect(scopeFor(capability,{role:ROLES.LABORATORY})).toBe(DATA_SCOPES.ORGANIZATION)
  }
 })
 it('keeps laboratory controls department-scoped',()=>{
  expect(scopeFor(CAPABILITIES.VIEW_CONTROLS,{role:ROLES.LABORATORY})).toBe(DATA_SCOPES.DEPARTMENT)
  expect(scopeFor(CAPABILITIES.EXECUTE_CONTROL,{role:ROLES.LABORATORY})).toBe(DATA_SCOPES.DEPARTMENT)
 })
 it('keeps laboratory sample processing organization-wide at the RLS boundary',()=>{
  expect(migration).toContain("array['hospital_admin','infection_control_lead','infection_control_member','laboratory']::public.app_role[]")
  expect(migration).toContain("array['laboratory']::public.app_role[]")
  expect(migration).not.toContain("public.current_user_has_department_scope(organization_id,department_id)\n  )\nwith check")
 })
 it('allows department clinical roles to see only samples from their assigned departments',()=>{
  expect(migration).toContain("array['department_manager','link_nurse']::public.app_role[]")
  expect(migration).toContain('public.current_user_has_department_scope(target_org,target_department)')
 })
 it('keeps employee visibility and laboratory operations as distinct authorization rules',()=>{
  expect(workforceMigration).toContain("array['link_nurse','department_manager','laboratory']::public.app_role[]")
  expect(workforceMigration).toContain('public.current_user_can_view_employee')
  expect(migration).toContain('public.current_user_can_view_laboratory_sample')
  expect(migration).not.toContain('public.current_user_can_view_employee')
 })
 it('makes microbiology result reads inherit the authorized parent sample',()=>{
  expect(migration).toContain('drop policy if exists microbiology_results_read')
  expect(migration).toContain('public.current_user_can_view_laboratory_sample(s.organization_id,s.department_id)')
 })
})
