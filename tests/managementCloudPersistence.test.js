import { describe,it,expect } from 'vitest'
import fs from 'node:fs'

const service=fs.readFileSync('src/features/management/managementCloudService.js','utf8')
const page=fs.readFileSync('src/features/management/ManagementPage.jsx','utf8')
const migration=fs.readFileSync('supabase/migrations/202609020101_management_center_cloud_governance.sql','utf8')

describe('Management Center production persistence',()=>{
  it('provides tenant scoped custom role persistence',()=>{
    expect(service).toContain("from('custom_roles')")
    expect(service).toContain("from('custom_role_capabilities')")
    expect(service).toContain(".eq('organization_id',organizationId)")
  })

  it('provides tenant scoped external reference persistence',()=>{
    expect(service).toContain("from('external_reference_versions')")
    expect(service).toContain('loadExternalReferences')
    expect(service).toContain('updateExternalReference')
    expect(service).toContain('removeExternalReference')
  })

  it('keeps management authorization and database audit governance present',()=>{
    expect(page).toContain('CAPABILITIES.MANAGE_ROLES')
    expect(page).toContain('CAPABILITIES.MANAGE_EXTERNAL_REFERENCES')
    expect(migration).toContain('trg_audit_custom_roles')
    expect(migration).toContain('trg_audit_external_reference_versions')
    expect(migration).toContain('revoke all on table public.custom_roles from anon')
  })
})
