import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const read = path => fs.readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20261013120000_demo_permissions.sql')
const shell = read('src/app/AppShell.jsx')
const tenantContext = read('src/core/tenant/TenantContext.jsx')
const tenantService = read('src/core/tenant/tenantService.js')

describe('Demo permissions', () => {
  it('gives Hospital Admin Occupational Health only inside a Demo organization', () => {
    expect(migration).toMatch(/capability_key not in \('view_occupational_health','manage_occupational_health'\)\s+or exists \(select 1 from public\.organizations o where o\.id = target_org and o\.is_demo\)/)
    expect(migration).toContain("and capability_key not in ('view_platform','manage_platform')")
    expect(tenantContext).toMatch(/realDemoTenant && item\?\.role === ROLES\.HOSPITAL_ADMIN[\s\S]*'view_occupational_health', 'manage_occupational_health'/)
  })
  it('keeps "no member changes their own role" outside Demo organizations', () => {
    expect(migration).toMatch(/current_setting\('limoxis\.demo_role_switch', true\), ''\) = 'on'\s+and exists \(select 1 from public\.organizations o where o\.id = new\.organization_id and o\.is_demo\)/)
    expect(migration).toContain("raise exception 'SELF_PRIVILEGE_CHANGE_FORBIDDEN'")
  })
  it('switches only the caller\'s own membership, in a Demo, to a previewable role', () => {
    expect(migration).toContain("raise exception 'Roles can be switched only in a Demo organization'")
    expect(migration).toContain('om.user_id = auth.uid() and om.status = \'active\'')
    expect(migration).not.toMatch(/p_role not in \([^)]*'platform_owner'/)
    expect(migration).toContain("perform set_config('limoxis.demo_role_switch', 'off', true);")
    expect(migration).toContain('grant execute on function public.demo_switch_my_role(uuid, text, uuid) to authenticated;')
  })
  it('the evaluator switches role from the Demo bar; the Owner keeps the on-screen preview', () => {
    expect(tenantService).toContain("supabase.rpc('demo_switch_my_role'")
    expect(shell).toContain('const demoEvaluator=realDemoTenant&&!isPlatformOwner')
    expect(shell).toContain('await switchDemoRole(tenant.id,nextRole,departmentId)')
    expect(shell).toContain("{canRolePreview&&!platformMode&&!realDemoTenant&&<div className=\"role-preview-control\">")
  })
})
