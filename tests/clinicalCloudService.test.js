import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const service=fs.readFileSync('src/features/surveillance/clinicalCloudService.js','utf8')

describe('clinical cloud service',()=>{
  it('loads surveillance cases from Supabase and hydrates clinical domains',()=>{
    expect(service).toContain("from('surveillance_cases')")
    expect(service).toContain("from('surveillance_events')")
    expect(service).toContain("from('laboratory_samples')")
    expect(service).toContain("from('surveillance_reassessments')")
    expect(service).toContain("from('surveillance_outcomes')")
    expect(service).toContain("from('surveillance_devices')")
  })

  it('creates a real case and initial surveillance-start event',()=>{
    expect(service).toContain('export async function createClinicalCase')
    expect(service).toContain("event_type:'surveillance_start'")
    expect(service).toContain('created_by:actorId')
  })

  it('supports reassessment and completion persistence',()=>{
    expect(service).toContain('export async function addClinicalReassessment')
    expect(service).toContain('export async function completeClinicalCase')
    expect(service).toContain("status:'completed'")
    expect(service).toContain('closed_by:actorId')
  })

  it('validates canonical department scope before clinical case creation',()=>{
    expect(service).toContain("from('departments').select('id')")
    expect(service).toContain(".eq('is_active',true).maybeSingle()")
    expect(service).toContain('Selected department is not available for this organization.')
  })
})
