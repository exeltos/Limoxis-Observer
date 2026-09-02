import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const migration=fs.readFileSync('supabase/migrations/20260902154615_system_master_library_baseline_seed_v2.sql','utf8')

describe('system master library baseline seed',()=>{
 it('seeds every canonical protected library class',()=>{
  for(const key of ['microorganisms','antibiotics','notifiableDiseases','sampleTypes','professionalCategories','vaccines','wasteTypes','antiseptics','isolationTypes','controlTypes','documentCategories']){
   expect(migration).toContain(`('${key}'`)
  }
 })

 it('does not seed hospital departments as system records',()=>{
  expect(migration).not.toContain("('departments'")
 })

 it('is idempotent and marks baseline rows protected',()=>{
  expect(migration).toContain("jsonb_build_object('system',true,'locked',true")
  expect(migration).toContain('on conflict (organization_id,library_key,name_el) do nothing')
 })

 it('automatically seeds future organizations without exposing the seed functions',()=>{
  expect(migration).toContain('trg_seed_system_master_libraries')
  expect(migration).toContain('after insert on public.organizations')
  expect(migration).toContain('revoke all on function private.seed_system_master_libraries(uuid) from public,anon,authenticated')
  expect(migration).toContain('pg_trigger_depth() > 1')
 })
})
