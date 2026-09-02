import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import { CAPABILITIES,ROLES,scopeFor } from '../src/core/permissions/roles'
import { DATA_SCOPES } from '../src/core/permissions/scopeTypes'

const page=fs.readFileSync(new URL('../src/features/indicators/IndicatorsCloudPage.jsx',import.meta.url),'utf8')
const migration=fs.readFileSync(new URL('../supabase/migrations/20260902205000_indicator_role_scope_alignment.sql',import.meta.url),'utf8')

describe('indicator role scope alignment',()=>{
 it('keeps department-scoped indicator roles department-scoped in the permission engine',()=>{
  expect(scopeFor(CAPABILITIES.VIEW_INDICATORS,{role:ROLES.LINK_NURSE})).toBe(DATA_SCOPES.DEPARTMENT)
  expect(scopeFor(CAPABILITIES.VIEW_INDICATORS,{role:ROLES.DEPARTMENT_MANAGER})).toBe(DATA_SCOPES.DEPARTMENT)
 })
 it('keeps organization indicator roles organization-scoped even when they may have department assignments',()=>{
  expect(scopeFor(CAPABILITIES.VIEW_INDICATORS,{role:ROLES.INFECTION_CONTROL_LEAD})).toBe(DATA_SCOPES.ORGANIZATION)
  expect(scopeFor(CAPABILITIES.VIEW_INDICATORS,{role:ROLES.QUALITY_MANAGER})).toBe(DATA_SCOPES.ORGANIZATION)
  expect(scopeFor(CAPABILITIES.VIEW_INDICATORS,{role:ROLES.DOCTOR_REVIEWER})).toBe(DATA_SCOPES.ORGANIZATION)
 })
 it('derives the indicator page scope from the capability model instead of departmentIds presence',()=>{
  expect(page).toContain('scopeFor(CAPABILITIES.VIEW_INDICATORS')
  expect(page).toContain('indicatorScope===DATA_SCOPES.DEPARTMENT')
  expect(page).not.toContain('departmentScoped=scopedDepartmentIds.length>0')
 })
 it('enforces the same department scope on live metrics and persisted snapshots',()=>{
  expect(migration).toContain("array['link_nurse','department_manager']::public.app_role[]")
  expect(migration).toContain("if v_scoped and p_department_id is null then raise exception 'Department scope required'")
  expect(migration).toContain('public.current_user_has_department_scope(organization_id,department_id)')
  expect(migration).toContain('drop policy if exists indicator_snapshots_read')
 })
})
