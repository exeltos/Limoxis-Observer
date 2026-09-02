import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import { CAPABILITIES,ROLES,can } from '../src/core/permissions/roles'

const migration=fs.readFileSync(new URL('../supabase/migrations/20260902222000_patient_surveillance_lifecycle_alignment.sql',import.meta.url),'utf8')

describe('patient and surveillance lifecycle alignment',()=>{
 it('keeps department viewers read-only for patient and surveillance lifecycle',()=>{
  expect(can(ROLES.LINK_NURSE,CAPABILITIES.VIEW_PATIENTS)).toBe(true)
  expect(can(ROLES.LINK_NURSE,CAPABILITIES.CREATE_PATIENT)).toBe(false)
  expect(can(ROLES.DEPARTMENT_MANAGER,CAPABILITIES.VIEW_SURVEILLANCE)).toBe(true)
  expect(can(ROLES.DEPARTMENT_MANAGER,CAPABILITIES.EDIT_SURVEILLANCE)).toBe(false)
 })
 it('gives IPC Lead explicit patient and surveillance lifecycle capabilities',()=>{
  expect(can(ROLES.INFECTION_CONTROL_LEAD,CAPABILITIES.CREATE_PATIENT)).toBe(true)
  expect(can(ROLES.INFECTION_CONTROL_LEAD,CAPABILITIES.EDIT_PATIENT)).toBe(true)
  expect(can(ROLES.INFECTION_CONTROL_LEAD,CAPABILITIES.CREATE_SURVEILLANCE)).toBe(true)
  expect(can(ROLES.INFECTION_CONTROL_LEAD,CAPABILITIES.EDIT_SURVEILLANCE)).toBe(true)
  expect(can(ROLES.INFECTION_CONTROL_LEAD,CAPABILITIES.CLOSE_SURVEILLANCE)).toBe(true)
 })
 it('separates generic editing from close and reopen governance actions',()=>{
  expect(migration).toContain("'edit_surveillance'")
  expect(migration).toContain("'close_surveillance'")
  expect(migration).toContain("'reopen_surveillance'")
  expect(migration).toContain('public.close_surveillance_case')
  expect(migration).toContain('public.reopen_surveillance_case')
 })
 it('does not let Doctor Reviewer inherit patient registry mutation',()=>{
  expect(can(ROLES.DOCTOR_REVIEWER,CAPABILITIES.CREATE_PATIENT)).toBe(false)
  expect(can(ROLES.DOCTOR_REVIEWER,CAPABILITIES.EDIT_PATIENT)).toBe(false)
  expect(can(ROLES.DOCTOR_REVIEWER,CAPABILITIES.REOPEN_SURVEILLANCE)).toBe(false)
 })
})
