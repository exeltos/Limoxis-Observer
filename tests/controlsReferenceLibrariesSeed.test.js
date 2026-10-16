import {describe,expect,it} from 'vitest'
import fs from 'node:fs'
import {demoLibrarySeed} from '../src/features/management/managementData'
import {SYSTEM_BASELINE_LIBRARY_KEYS} from '../src/features/management/libraryGovernance'

const migration=fs.readFileSync('supabase/migrations/20261102100000_controls_reference_libraries.sql','utf8')
const previous=fs.readFileSync('supabase/migrations/20260919170000_add_oxacillin_amr_reference_antibiotic.sql','utf8')
const libraries=fs.readFileSync('src/features/management/LibrariesPanel.jsx','utf8')
const NEW_KEYS=['measurementUnits','controlAnswers','itemForms','medicinesSupplies','equipment','environmentalLocations','surfacePoints']
const rowsOf=sql=>[...sql.matchAll(/^ {4}\('([A-Za-z]+)','([A-Z0-9-]+)',/gm)].map(([line,key,code])=>({line,key,code}))

describe('controls reference libraries seed',()=>{
 it('keeps every earlier baseline row unchanged',()=>{
  const lines=previous.split('\n').filter(line=>/^ {4}\('/.test(line)).map(line=>line.replace(/,$/,''))
  expect(lines.length).toBeGreaterThan(60)
  for(const line of lines)expect(migration).toContain(line)
 })

 it('seeds the control libraries with the codes the Controls module reads',()=>{
  const codes=rowsOf(migration).map(row=>`${row.key}:${row.code}`)
  for(const code of ['CTRL-TEMP','CTRL-EXPIRY','CTRL-ENV','CTRL-HYGIENE','CTRL-EQUIP','CTRL-DISINF','CTRL-AUDIT'])expect(codes).toContain(`controlTypes:${code}`)
  for(const code of ['UNIT-CELSIUS','UNIT-PERCENT','UNIT-PPM','UNIT-MGL','UNIT-PH','UNIT-KPA','UNIT-BAR','UNIT-CFU','UNIT-CFU-M3','UNIT-CFU-100ML','UNIT-MIN','UNIT-HOUR','UNIT-PIECE'])expect(codes).toContain(`measurementUnits:${code}`)
  for(const code of ['ANS-COMPLIANT','ANS-NONCOMPLIANT','ANS-PARTIAL','ANS-CLEAN','ANS-NOTCLEAN','ANS-WORKING','ANS-OUTOFORDER','ANS-NA'])expect(codes).toContain(`controlAnswers:${code}`)
  for(const code of ['FORM-TABLET','FORM-CAPSULE','FORM-AMPOULE','FORM-VIAL','FORM-FLACON','FORM-BOTTLE','FORM-BAG','FORM-TUBE','FORM-PIECE','FORM-PACK','FORM-OTHER'])expect(codes).toContain(`itemForms:${code}`)
  for(const key of NEW_KEYS)expect(codes.some(code=>code.startsWith(`${key}:`))).toBe(true)
  expect(new Set(codes).size).toBe(codes.length)
 })

 it('is idempotent, protected and follows the global propagation catalog',()=>{
  expect(migration).toContain("jsonb_build_object('system',true,'locked',true,'baseline_code',b.code)")
  expect(migration).toContain('on conflict (organization_id,library_key,name_el) do nothing')
  expect(migration).toContain('revoke all on function private.seed_system_master_libraries(uuid) from public,anon,authenticated')
  expect(migration).toContain('revoke all on function private.system_master_library_baseline() from public,anon,authenticated')
  expect(migration).toContain('where g.organization_id is null and g.library_key = b.library_key and g.code = b.code')
  expect(migration).toContain('set origin_item_id = g.id')
  expect(migration.indexOf('disable trigger trg_audit_master_library_items')).toBeLessThan(migration.indexOf('enable trigger trg_audit_master_library_items'))
  expect(migration).not.toContain("('departments'")
 })

 it('gives the Demo seed the same libraries and codes',()=>{
  const sqlCodes=new Map(rowsOf(migration).map(row=>[`${row.key}:${row.code}`,true]))
  for(const key of ['controlTypes',...NEW_KEYS]){
   const rows=demoLibrarySeed[key]
   expect(rows?.length).toBeGreaterThan(0)
   for(const [el,en,meta] of rows){
    expect(el&&en).toBeTruthy()
    expect(meta).toMatchObject({system:true,locked:true})
    expect(sqlCodes.has(`${key}:${meta.code}`)).toBe(true)
   }
   expect(rowsOf(migration).filter(row=>row.key===key).length).toBe(rows.length)
  }
 })

 it('classifies and lists the new libraries in Management',()=>{
  for(const key of NEW_KEYS){
   expect(SYSTEM_BASELINE_LIBRARY_KEYS).toContain(key)
   expect(libraries).toContain(`['${key}','library`)
  }
 })
})
