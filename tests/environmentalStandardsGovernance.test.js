import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const migration=fs.readFileSync('supabase/migrations/20260902114500_environmental_standards_governance_hardening.sql','utf8')
const panel=fs.readFileSync('src/features/management/EnvironmentalStandardsPanel.jsx','utf8')

describe('environmental standards governance',()=>{
 it('removes anonymous access and separates hospital from system mutation',()=>{
  expect(migration).toContain('revoke all privileges on table public.environmental_standards from anon')
  expect(migration).toContain('environmental_standards_manage_hospital')
  expect(migration).toContain("coalesce((payload->>'system')::boolean,false)=false")
  expect(migration).toContain('environmental_standards_manage_system_owner')
  expect(migration).toContain('public.current_user_is_platform_owner()')
  expect(migration).toContain('trg_audit_environmental_standards')
 })
 it('keeps system protocols read only for hospital users in the UI',()=>{
  expect(panel).toContain('const isPlatformOwner=role===ROLES.PLATFORM_OWNER')
  expect(panel).toContain("System · Read only")
  expect(panel).toContain('systemLocked=item.system&&!isPlatformOwner')
  expect(panel).toContain("(!item.system||isPlatformOwner)")
  expect(panel).toContain('disabled={readOnlySystem}')
 })
})
