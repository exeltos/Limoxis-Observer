import {describe,expect,it} from 'vitest'
import fs from 'node:fs'
import { readPatientClinicalRecordSource } from './helpers/patientClinicalRecordSource'

const service=fs.readFileSync('src/features/surveillance/clinicalCloudService.js','utf8')
const page=readPatientClinicalRecordSource()
const repository=fs.readFileSync('src/features/surveillance/clinicalRepository.js','utf8')

// What each operation writes is exercised in clinicalCloudServiceBehavior.test.js.
describe('clinical cloud service',()=>{
  it('loads surveillance cases from Supabase and hydrates canonical clinical domains',()=>{
    for(const table of ['surveillance_cases','surveillance_events','clinical_assessments','hai_classifications','laboratory_samples','microbiology_results','amr_classifications','antimicrobial_susceptibility_results','critical_result_communications','antimicrobial_therapies','isolation_episodes','surveillance_reassessments','surveillance_outcomes','surveillance_devices']){
      expect(service).toContain(`'${table}'`)
    }
  })

  it('persists canonical journey actions through the repository adapter',()=>{
    for(const fn of ['saveClinicalAssessment','saveHaiClassification','requestLaboratorySample','startIsolation','endIsolation','addAntimicrobialTherapy','endAntimicrobialTherapy','addSurveillanceDevice','removeSurveillanceDevice']){
      expect(service).toContain(`export async function ${fn}`)
    }
    expect(repository).toContain('saveClinicalAssessment(organizationId,record,draft)')
    expect(repository).toContain('saveHaiClassification(organizationId,record,draft)')
    expect(repository).toContain('requestLaboratorySample(organizationId,record,draft)')
    expect(page).toContain('repository.saveAssessment')
    expect(page).toContain('repository.requestSample')
  })

  it('supports reassessment and completion persistence',()=>{
    expect(service).toContain('export async function addClinicalReassessment')
    expect(service).toContain('export async function completeClinicalCase')
    expect(repository).toContain('addClinicalReassessment(organizationId,record.recordId,record.patientRecordId,draft)')
    expect(repository).toContain('completeClinicalCase(organizationId,record.recordId,record.patientRecordId,draft)')
  })

  it('supports voiding and reopening a surveillance case with a mandatory reason',()=>{
    expect(service).toContain('export async function voidClinicalCase')
    expect(service).toContain('export async function reopenClinicalCase')
    expect(repository).toContain('voidClinicalCase(organizationId,record.recordId,reason)')
    expect(repository).toContain('reopenClinicalCase(organizationId,record.recordId,reason)')
  })

  it('gates sensitive actions by capabilities in the shared record page',()=>{
    expect(page).toContain('CAPABILITIES.RECORD_CLINICAL_ASSESSMENT')
    expect(page).not.toContain("setDialog('amr')")
    expect(page).toContain('CAPABILITIES.MANAGE_ISOLATION')
    expect(page).toContain('CAPABILITIES.MANAGE_ANTIMICROBIAL_THERAPY')
    expect(page).toContain('CAPABILITIES.REASSESS_SURVEILLANCE')
    expect(page).toContain('CAPABILITIES.RECORD_SURVEILLANCE_OUTCOME')
    expect(page).toContain('CAPABILITIES.DELETE_SURVEILLANCE')
    expect(page).toContain('CAPABILITIES.REOPEN_SURVEILLANCE')
  })
})