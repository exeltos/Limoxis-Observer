import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import { CAPABILITIES,ROLES,can } from '../src/core/permissions/roles'

const migration=fs.readFileSync(new URL('../supabase/migrations/20260902220500_antimicrobial_therapy_role_alignment.sql',import.meta.url),'utf8')

describe('antimicrobial therapy role alignment',()=>{
 it('matches the three operational roles that hold therapy management capability',()=>{
  expect(can(ROLES.INFECTION_CONTROL_LEAD,CAPABILITIES.MANAGE_ANTIMICROBIAL_THERAPY)).toBe(true)
  expect(can(ROLES.PHARMACY,CAPABILITIES.MANAGE_ANTIMICROBIAL_THERAPY)).toBe(true)
  expect(can(ROLES.DOCTOR_REVIEWER,CAPABILITIES.MANAGE_ANTIMICROBIAL_THERAPY)).toBe(true)
  expect(can(ROLES.INFECTION_CONTROL_MEMBER,CAPABILITIES.MANAGE_ANTIMICROBIAL_THERAPY)).toBe(false)
 })
 it('uses the capability at the RLS write boundary',()=>{
  expect(migration).toContain("public.current_user_has_capability(target_org,'manage_antimicrobial_therapy')")
  expect(migration).toContain('public.current_user_can_manage_antimicrobial_therapy(organization_id,surveillance_case_id)')
 })
 it('keeps pharmacy and IPC Lead hospital-wide while Doctor Reviewer is assignment-bound',()=>{
  expect(migration).toContain("array['infection_control_lead','pharmacy']::public.app_role[]")
  expect(migration).toContain('public.current_user_has_case_assignment(target_org,target_case)')
 })
 it('does not grant IPC Member mutation just because therapy is readable',()=>{
  expect(migration).toContain("array['infection_control_lead','infection_control_member','pharmacy']::public.app_role[]")
  expect(migration).not.toContain("array['infection_control_lead','infection_control_member','pharmacy','doctor_reviewer']::public.app_role[]")
 })
})
