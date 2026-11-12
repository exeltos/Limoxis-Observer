import { describe,it,expect } from 'vitest'
import { readSource } from './helpers/readSource'

const service=readSource('src/features/management/managementCloudService.js')
const page=readSource('src/features/management/ManagementPage.jsx')
const migration=readSource('supabase/migrations/20260902095722_management_center_cloud_governance.sql')

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
    // External references moved to the platform screen (global Management Center).
    expect(page).toContain("{id:'references',label:t('externalReferences'),icon:Globe2}]")
    expect(migration).toContain('trg_audit_custom_roles')
    expect(migration).toContain('trg_audit_external_reference_versions')
    expect(migration).toContain('revoke all on table public.custom_roles from anon')
  })
})
