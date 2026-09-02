import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import { CAPABILITIES,ROLES,can } from '../src/core/permissions/roles'

const migration=fs.readFileSync(new URL('../supabase/migrations/20260902215500_clinical_write_capability_alignment.sql',import.meta.url),'utf8')

describe('clinical write capability alignment',()=>{
 it('does not confuse clinical visibility with clinical mutation',()=>{
  expect(can(ROLES.LINK_NURSE,CAPABILITIES.VIEW_SURVEILLANCE)).toBe(true)
  expect(can(ROLES.LINK_NURSE,CAPABILITIES.RECORD_CLINICAL_ASSESSMENT)).toBe(false)
  expect(can(ROLES.DEPARTMENT_MANAGER,CAPABILITIES.VIEW_SURVEILLANCE)).toBe(true)
  expect(can(ROLES.DEPARTMENT_MANAGER,CAPABILITIES.MANAGE_ISOLATION)).toBe(false)
 })
 it('uses explicit capabilities for each clinical write domain',()=>{
  expect(migration).toContain("'record_clinical_assessment'")
  expect(migration).toContain("'manage_isolation'")
  expect(migration).toContain("'reassess_surveillance'")
  expect(migration).toContain("'record_surveillance_outcome'")
  expect(migration).toContain('public.current_user_has_capability(target_org,target_capability)')
 })
 it('keeps Doctor Reviewer writes bound to assigned cases',()=>{
  expect(can(ROLES.DOCTOR_REVIEWER,CAPABILITIES.RECORD_CLINICAL_ASSESSMENT)).toBe(true)
  expect(can(ROLES.DOCTOR_REVIEWER,CAPABILITIES.REASSESS_SURVEILLANCE)).toBe(true)
  expect(can(ROLES.DOCTOR_REVIEWER,CAPABILITIES.RECORD_SURVEILLANCE_OUTCOME)).toBe(true)
  expect(migration).toContain('public.current_user_has_case_assignment(target_org,target_case)')
 })
 it('does not grant outcome recording to IPC members without the capability',()=>{
  expect(can(ROLES.INFECTION_CONTROL_MEMBER,CAPABILITIES.REASSESS_SURVEILLANCE)).toBe(true)
  expect(can(ROLES.INFECTION_CONTROL_MEMBER,CAPABILITIES.RECORD_SURVEILLANCE_OUTCOME)).toBe(false)
 })
})
