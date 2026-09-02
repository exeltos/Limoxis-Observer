import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const migration=fs.readFileSync('supabase/migrations/202609020108_organization_profile_management.sql','utf8')
const panel=fs.readFileSync('src/features/management/OrganizationProfilePanel.jsx','utf8')

describe('organization profile management',()=>{
 it('uses a narrow governed RPC for organization profile changes',()=>{
  expect(migration).toContain('update_organization_profile')
  expect(migration).toContain('current_user_is_platform_owner() or public.is_org_admin')
  expect(migration).toContain("'source','management_center'")
  expect(migration).toContain('revoke all on function')
  expect(migration).toContain('grant execute')
 })
 it('keeps platform-controlled identity fields read only in the hospital editor',()=>{
  expect(panel).toContain("value={form.code} disabled")
  expect(panel).toContain("value={form.type} disabled")
  expect(panel).toContain("supabase.rpc('update_organization_profile'")
 })
})
