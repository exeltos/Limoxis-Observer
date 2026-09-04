import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import { CAPABILITIES,ROLES,can,scopeFor } from '../src/core/permissions/roles'
import { DATA_SCOPES } from '../src/core/permissions/scopeTypes'
import { canSeeSensitiveEmployeeHealth } from '../src/core/permissions/roleUxPolicy'

const migration=fs.readFileSync(new URL('../supabase/migrations/20260904222000_hospital_admin_surveillance_read_alignment.sql',import.meta.url),'utf8')

describe('Hospital Admin production Surveillance alignment',()=>{
  it('keeps Hospital Admin surveillance visible at organization scope',()=>{
    expect(can(ROLES.HOSPITAL_ADMIN,CAPABILITIES.VIEW_SURVEILLANCE)).toBe(true)
    expect(scopeFor(CAPABILITIES.VIEW_SURVEILLANCE,{role:ROLES.HOSPITAL_ADMIN})).toBe(DATA_SCOPES.ORGANIZATION)
  })

  it('adds Hospital Admin to the canonical patient/surveillance read boundary',()=>{
    expect(migration).toContain("array['hospital_admin','infection_control_lead','infection_control_member']::public.app_role[]")
    expect(migration).toContain('create or replace function public.can_view_surveillance_record(target_org uuid,target_department uuid)')
    expect(migration).toContain('create policy patients_clinical_read on public.patients')
  })

  it('does not widen clinical mutation or sensitive employee-health authority',()=>{
    expect(can(ROLES.HOSPITAL_ADMIN,CAPABILITIES.CREATE_SURVEILLANCE)).toBe(false)
    expect(can(ROLES.HOSPITAL_ADMIN,CAPABILITIES.EDIT_SURVEILLANCE)).toBe(false)
    expect(can(ROLES.HOSPITAL_ADMIN,CAPABILITIES.REASSESS_SURVEILLANCE)).toBe(false)
    expect(can(ROLES.HOSPITAL_ADMIN,CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH)).toBe(false)
    expect(canSeeSensitiveEmployeeHealth(ROLES.HOSPITAL_ADMIN)).toBe(false)
    expect(migration).not.toContain('create policy surveillance_insert')
    expect(migration).not.toContain('create policy surveillance_update')
  })
})
