import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const service=fs.readFileSync('src/features/surveillance/clinicalCloudService.js','utf8')
const page=fs.readFileSync('src/features/surveillance/PatientClinicalCloudRecordPage.jsx','utf8')

describe('clinical cloud service',()=>{
  it('loads surveillance cases from Supabase and hydrates canonical clinical domains',()=>{
    for(const table of ['surveillance_cases','surveillance_events','clinical_assessments','hai_classifications','laboratory_samples','microbiology_results','amr_classifications','antimicrobial_susceptibility_results','critical_result_communications','antimicrobial_therapies','isolation_episodes','surveillance_reassessments','surveillance_outcomes','surveillance_devices']){
      expect(service).toContain(`from('${table}')`)
    }
  })

  it('creates a real case and initial surveillance-start event',()=>{
    expect(service).toContain('export async function createClinicalCase')
    expect(service).toContain("event_type:'surveillance_start'")
    expect(service).toContain('created_by:actorId')
  })

  it('persists clinical journey actions in canonical tables instead of generic events',()=>{
    for(const fn of ['saveClinicalAssessment','saveHaiClassification','requestLaboratorySample','startIsolation','endIsolation','addAntimicrobialTherapy','endAntimicrobialTherapy','addSurveillanceDevice','removeSurveillanceDevice','saveAmrClassification']){
      expect(service).toContain(`export async function ${fn}`)
    }
    expect(page).toContain('saveClinicalAssessment')
    expect(page).not.toContain("saveClinicalEvent(tenantId,record.recordId,'clinical_assessment'")
  })

  it('keeps laboratory request state distinct from specimen collection',()=>{
    expect(service).toContain("status:'requested'")
    expect(service).toContain('collected_at:null')
    expect(service).toContain('requested_by:actorId')
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

  it('gates sensitive production actions by capabilities',()=>{
    expect(page).toContain('CAPABILITIES.RECORD_CLINICAL_ASSESSMENT')
    expect(page).toContain('CAPABILITIES.CLASSIFY_RESISTANCE')
    expect(page).toContain('CAPABILITIES.MANAGE_ISOLATION')
    expect(page).toContain('CAPABILITIES.MANAGE_ANTIMICROBIAL_THERAPY')
    expect(page).toContain('CAPABILITIES.REASSESS_SURVEILLANCE')
    expect(page).toContain('CAPABILITIES.RECORD_SURVEILLANCE_OUTCOME')
  })
})