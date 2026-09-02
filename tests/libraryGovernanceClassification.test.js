import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import { HOSPITAL_MANAGED_LIBRARY_KEYS,SYSTEM_BASELINE_LIBRARY_KEYS } from '../src/features/management/libraryGovernance'

const libraries=fs.readFileSync('src/features/management/LibrariesPanel.jsx','utf8')
const service=fs.readFileSync('src/features/management/managementCloudService.js','utf8')
const rls=fs.readFileSync('supabase/migrations/202609020104_platform_owner_system_library_governance.sql','utf8')

describe('canonical library governance classification',()=>{
 it('keeps hospital departments hospital-managed',()=>{
  expect(HOSPITAL_MANAGED_LIBRARY_KEYS).toContain('departments')
  expect(SYSTEM_BASELINE_LIBRARY_KEYS).not.toContain('departments')
  expect(service).toContain("if(libraryKey==='departments')")
  expect(service).toContain("from('departments')")
  expect(libraries).toContain('normalizeGovernance')
 })

 it('defines protected clinical/reference baseline libraries explicitly',()=>{
  for(const key of ['microorganisms','antibiotics','notifiableDiseases','sampleTypes','professionalCategories','vaccines','wasteTypes','antiseptics','isolationTypes','controlTypes','documentCategories']){
   expect(SYSTEM_BASELINE_LIBRARY_KEYS).toContain(key)
  }
 })

 it('keeps system baseline rows owner-only at the database boundary',()=>{
  expect(rls).toContain("coalesce(metadata->>'system','false') = 'true'")
  expect(rls).toContain('public.current_user_is_platform_owner()')
  expect(rls).toContain("coalesce(metadata->>'system','false') <> 'true'")
 })
})
