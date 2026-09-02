import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const service=fs.readFileSync('src/features/laboratory/laboratoryCloudService.js','utf8')
const page=fs.readFileSync('src/features/laboratory/LaboratoryCloudPage.jsx','utf8')
const record=fs.readFileSync('src/features/laboratory/LaboratorySampleCloudRecordPage.jsx','utf8')
const route=fs.readFileSync('src/features/laboratory/LaboratoryPage.jsx','utf8')
const recordRoute=fs.readFileSync('src/features/laboratory/LaboratorySampleRecordPage.jsx','utf8')
const migration=fs.readFileSync('supabase/migrations/20260902190000_laboratory_critical_result_workflow_fix.sql','utf8')
const immutabilityMigration=fs.readFileSync('supabase/migrations/20260902191000_laboratory_validated_result_immutability.sql','utf8')

describe('laboratory production persistence',()=>{
  it('loads canonical laboratory domains from Supabase',()=>{
    for(const table of ['laboratory_samples','microbiology_results','antimicrobial_susceptibility_results','critical_result_communications','amr_classifications'])expect(service).toContain(`from('${table}')`)
  })

  it('supports production laboratory writes',()=>{
    expect(service).toContain('export async function createLaboratorySample')
    expect(service).toContain('export async function updateLaboratorySampleStatus')
    expect(service).toContain('export async function saveMicrobiologyResult')
    expect(service).toContain('export async function addAstResult')
    expect(service).toContain('export async function communicateCriticalResult')
    expect(service).toContain('critical_communicated_at')
  })

  it('keeps demo and production runtime paths isolated',()=>{
    expect(route).toContain('isDemo?<LaboratoryDemoPage/>:<LaboratoryCloudPage/>')
    expect(recordRoute).toContain('isDemo?<LaboratorySampleDemoRecordPage/>:<LaboratorySampleCloudRecordPage/>')
    expect(page).not.toContain('laboratoryDemoData')
    expect(record).not.toContain('laboratoryDemoData')
  })

  it('allows a critical result to exist before communication and indexes the hot paths',()=>{
    expect(migration).toContain('drop constraint if exists microbiology_results_check')
    expect(migration).toContain('idx_laboratory_samples_org_status')
    expect(migration).toContain('idx_microbiology_results_sample_validation')
  })

  it('versions edits to validated results instead of overwriting them',()=>{
    expect(service).toContain("['validated','amended'].includes(existing.validation_status)")
    expect(service).toContain("validation_status:'amended'")
    expect(service).toContain('amended_from:existing.id')
    expect(immutabilityMigration).toContain('enforce_microbiology_result_immutability')
    expect(immutabilityMigration).toContain("old.validation_status in ('validated','amended')")
    expect(immutabilityMigration).toContain('Validated microbiology results are immutable; create an amendment instead.')
  })
})
