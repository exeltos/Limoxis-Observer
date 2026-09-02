import { describe,it,expect } from 'vitest'
import fs from 'node:fs'

const service=fs.readFileSync('src/features/management/bundleLibraryCloudService.js','utf8')
const panel=fs.readFileSync('src/features/management/BundleLibraryPanel.jsx','utf8')
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

 it('uses local bundle storage only in demo and cloud persistence in production',()=>{
  expect(panel).toContain('isDemo?loadBundleLibrary().map(normalize):[]')
  expect(panel).toContain('loadBundleTemplates(tenant.id)')
  expect(panel).toContain('await createBundleTemplate(tenant.id,cleaned)')
  expect(panel).toContain('await updateBundleTemplate(tenant.id,cleaned)')
  expect(panel).toContain('await publishBundleTemplate(tenant.id,item)')
  expect(panel).toContain('await retireBundleTemplate(tenant.id,item)')
  expect(panel).toContain('await removeBundleTemplate(tenant.id,item)')
 })

 it('keeps system templates owner-only and published hospital versions immutable',()=>{
  expect(panel).toContain('item.system&&!isPlatformOwner')
  expect(panel).toContain("const immutable=!item.system&&(item.status==='published'||item.status==='retired')")
  expect(panel).toContain("System · Μόνο Owner")
  expect(panel).toContain('Create new draft version')
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
