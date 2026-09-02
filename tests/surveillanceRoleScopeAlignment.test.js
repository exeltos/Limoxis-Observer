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
 it('keeps Doctor Reviewer assignment-scoped against the canonical work assignment table',()=>{
  expect(migration).toContain("om.role = 'doctor_reviewer'::public.app_role")
  expect(migration).toContain('from public.work_assignments wa')
  expect(migration).toContain("wa.source_type in ('surveillance_case','surveillance')")
  expect(migration).toContain('wa.source_id = target_case')
  expect(migration).toContain('public.current_user_has_case_assignment(target_org,target_case)')
  expect(migration).not.toContain('public.record_assignments')
 })
 it('preserves dependent policies instead of cascade-dropping the legacy helper',()=>{
  expect(migration).toContain('create or replace function public.can_view_surveillance_record(target_org uuid,target_department uuid)')
  expect(migration).not.toContain('drop function if exists public.can_view_surveillance_record(uuid,uuid) cascade')
  expect(migration).toContain('hai_classification_read')
  expect(migration).toContain('surveillance_devices_read')
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
