import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import { CAPABILITIES,ROLES,scopeFor } from '../src/core/permissions/roles'
import { DATA_SCOPES } from '../src/core/permissions/scopeTypes'

const migration=fs.readFileSync(new URL('../supabase/migrations/20260902223500_employee_self_profile_rls.sql',import.meta.url),'utf8')

describe('employee self profile RLS',()=>{
 it('makes VIEW_MY_PROFILE a true self scope for ordinary employee roles',()=>{
  expect(scopeFor(CAPABILITIES.VIEW_MY_PROFILE,{role:ROLES.DEPARTMENT_USER})).toBe(DATA_SCOPES.SELF)
  expect(scopeFor(CAPABILITIES.VIEW_MY_PROFILE,{role:ROLES.DEPARTMENT_MANAGER})).toBe(DATA_SCOPES.SELF)
  expect(scopeFor(CAPABILITIES.VIEW_MY_PROFILE,{role:ROLES.LINK_NURSE})).toBe(DATA_SCOPES.SELF)
 })
 it('links self access strictly to auth.uid and the explicit employee user_id',()=>{
  expect(migration).toContain('target_user = auth.uid()')
  expect(migration).toContain('public.current_user_is_employee_self(organization_id,user_id)')
 })
 it('keeps self profile read-only and does not broaden employee writes',()=>{
  expect(migration).toContain('Deliberately do not broaden employees_write')
  expect(migration).not.toContain('create policy employees_write')
 })
})
