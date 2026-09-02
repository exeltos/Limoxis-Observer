import { describe,it,expect } from 'vitest'
import fs from 'node:fs'

const service=fs.readFileSync('src/features/management/bundleLibraryCloudService.js','utf8')
const migration=fs.readFileSync('supabase/migrations/202609020105_prevention_bundle_template_governance.sql','utf8')

describe('Management Center bundle template persistence',()=>{
 it('persists bundle templates in the governed cloud table',()=>{
  expect(service).toContain("from('prevention_bundle_templates')")
  expect(service).toContain('loadBundleTemplates')
  expect(service).toContain('createBundleTemplate')
  expect(service).toContain('updateBundleTemplate')
  expect(service).toContain('publishBundleTemplate')
  expect(service).toContain('retireBundleTemplate')
  expect(service).toContain('removeBundleTemplate')
  expect(service).toContain("query=item.system?query.is('organization_id',null):query.eq('organization_id',organizationId)")
 })

 it('separates immutable system governance from hospital governance',()=>{
  expect(migration).toContain('prevention_bundle_templates_manage_system_owner')
  expect(migration).toContain('public.current_user_is_platform_owner()')
  expect(migration).toContain('prevention_bundle_templates_manage_hospital')
  expect(migration).toContain('public.is_org_admin(organization_id)')
  expect(migration).toContain("'infection_control_lead'::public.app_role")
 })

 it('enables RLS, removes anon access and audits mutations',()=>{
  expect(migration).toContain('enable row level security')
  expect(migration).toContain('revoke all on table public.prevention_bundle_templates from anon')
  expect(migration).toContain('trg_audit_prevention_bundle_templates')
  expect(migration).toContain('private.audit_management_change()')
 })
})
