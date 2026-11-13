import { describe,expect,it } from 'vitest'
import { HOSPITAL_MANAGED_LIBRARY_KEYS,SYSTEM_BASELINE_LIBRARY_KEYS } from '../src/features/management/libraryGovernance'
import { readSource } from './helpers/readSource'

const libraries=readSource('src/features/management/LibrariesPanel.jsx')
const service=readSource('src/features/management/managementCloudService.js')
const rls=readSource('supabase/migrations/20260902101828_platform_owner_system_library_governance.sql')

describe('canonical library governance classification',()=>{
 it('keeps hospital departments hospital-managed',()=>{
  expect(HOSPITAL_MANAGED_LIBRARY_KEYS).toContain('departments')
  expect(SYSTEM_BASELINE_LIBRARY_KEYS).not.toContain('departments')
  expect(service).toContain("if(libraryKey==='departments')")
  expect(service).toContain("from('departments')")
  expect(libraries).toContain('normalizeGovernance')
 })

 it('defines protected clinical/reference baseline libraries explicitly',()=>{
  for(const key of ['microorganisms','antibiotics','notifiableDiseases','sampleTypes','professionalCategories','vaccines','wasteTypes','antiseptics','isolationTypes','controlTypes','measurementUnits','controlAnswers','itemForms','medicinesSupplies','equipment','environmentalLocations','surfacePoints','documentCategories']){
   expect(SYSTEM_BASELINE_LIBRARY_KEYS).toContain(key)
  }
 })

 it('keeps system baseline rows owner-only at the database boundary',()=>{
  expect(rls).toContain("coalesce(metadata->>'system','false') = 'true'")
  expect(rls).toContain('public.current_user_is_platform_owner()')
  expect(rls).toContain("coalesce(metadata->>'system','false') <> 'true'")
 })
})
