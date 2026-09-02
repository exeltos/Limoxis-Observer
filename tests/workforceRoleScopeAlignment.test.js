import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import { CAPABILITIES,ROLES,scopeFor } from '../src/core/permissions/roles'
import { DATA_SCOPES } from '../src/core/permissions/scopeTypes'

const migration=fs.readFileSync(new URL('../supabase/migrations/20260902211500_workforce_role_scope_alignment.sql',import.meta.url),'utf8')

describe('workforce role scope alignment',()=>{
 it('keeps hospital-wide workforce viewers organization-scoped',()=>{
  expect(scopeFor(CAPABILITIES.VIEW_STAFF,{role:ROLES.HOSPITAL_ADMIN})).toBe(DATA_SCOPES.ORGANIZATION)
  expect(scopeFor(CAPABILITIES.VIEW_STAFF,{role:ROLES.INFECTION_CONTROL_LEAD})).toBe(DATA_SCOPES.ORGANIZATION)
  expect(scopeFor(CAPABILITIES.VIEW_STAFF,{role:ROLES.HR_OFFICE})).toBe(DATA_SCOPES.ORGANIZATION)
  expect(scopeFor(CAPABILITIES.VIEW_STAFF,{role:ROLES.OCCUPATIONAL_PHYSICIAN})).toBe(DATA_SCOPES.ORGANIZATION)
 })
 it('treats laboratory and department roles as department-scoped workforce viewers',()=>{
  expect(scopeFor(CAPABILITIES.VIEW_STAFF,{role:ROLES.LABORATORY})).toBe(DATA_SCOPES.DEPARTMENT)
  expect(scopeFor(CAPABILITIES.VIEW_STAFF,{role:ROLES.LINK_NURSE})).toBe(DATA_SCOPES.DEPARTMENT)
  expect(scopeFor(CAPABILITIES.VIEW_STAFF,{role:ROLES.DEPARTMENT_MANAGER})).toBe(DATA_SCOPES.DEPARTMENT)
 })
 it('enforces workforce department scope in RLS without granting department registry writes',()=>{
  expect(migration).toContain("array['link_nurse','department_manager','laboratory']::public.app_role[]")
  expect(migration).toContain('public.current_user_has_department_scope(target_org,target_department)')
  expect(migration).toContain('drop policy if exists employees_read')
  expect(migration).toContain('drop policy if exists employees_write')
  expect(migration).not.toContain("array['hr_office','link_nurse','department_manager','laboratory']::public.app_role[]")
 })
})
