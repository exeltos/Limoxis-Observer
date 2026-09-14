import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const service=fs.readFileSync('src/features/surveillance/clinicalCloudService.js','utf8')
const page=fs.readFileSync('src/features/surveillance/PatientClinicalCanonicalPage.jsx','utf8')
const repository=fs.readFileSync('src/features/surveillance/clinicalRepository.js','utf8')

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

  it('persists canonical journey actions through the repository adapter',()=>{
    for(const fn of ['saveClinicalAssessment','saveHaiClassification','requestLaboratorySample','startIsolation','endIsolation','addAntimicrobialTherapy','endAntimicrobialTherapy','addSurveillanceDevice','removeSurveillanceDevice','saveAmrClassification']){
      expect(service).toContain(`export async function ${fn}`)
    }
    expect(repository).toContain('saveClinicalAssessment(organizationId,record,draft)')
    expect(repository).toContain('saveHaiClassification(organizationId,record,draft)')
    expect(repository).toContain('requestLaboratorySample(organizationId,record,draft)')
    expect(page).toContain('repository.saveAssessment')
    expect(page).toContain('repository.requestSample')
  })

  it('keeps laboratory request state distinct from specimen collection',()=>{
    expect(service).toContain("status:'requested'")
    expect(service).toContain('collected_at:null')
    expect(service).toContain('requested_by:actorId')
  })

  it('supports reassessment and completion persistence',()=>{
    expect(service).toContain('export async function addClinicalReassessment')
    expect(service).toContain('export async function completeClinicalCase')
    expect(service).toContain("status:'closed'")
    expect(service).toContain('closed_by:actorId')
    expect(repository).toContain('addClinicalReassessment(organizationId,record.recordId,record.patientRecordId,draft)')
    expect(repository).toContain('completeClinicalCase(organizationId,record.recordId,record.patientRecordId,draft)')
  })

  it('supports voiding and reopening a surveillance case with a mandatory reason',()=>{
    expect(service).toContain('export async function voidClinicalCase')
    expect(service).toContain('export async function reopenClinicalCase')
    expect(service).toContain("status:'cancelled',void_reason:reason")
    expect(service).toContain("status:'active',reopen_reason:reason")
    expect(repository).toContain('voidClinicalCase(organizationId,record.recordId,reason)')
    expect(repository).toContain('reopenClinicalCase(organizationId,record.recordId,reason)')
  })

  it('validates canonical department scope before clinical case creation',()=>{
    expect(service).toContain("from('departments').select('id')")
    expect(service).toContain(".eq('is_active',true).maybeSingle()")
    expect(service).toContain('Selected department is not available for this organization.')
  })

  it('gates sensitive actions by capabilities in the shared record page',()=>{
    expect(page).toContain('CAPABILITIES.RECORD_CLINICAL_ASSESSMENT')
    expect(page).toContain('CAPABILITIES.CLASSIFY_RESISTANCE')
    expect(page).toContain('CAPABILITIES.MANAGE_ISOLATION')
    expect(page).toContain('CAPABILITIES.MANAGE_ANTIMICROBIAL_THERAPY')
    expect(page).toContain('CAPABILITIES.REASSESS_SURVEILLANCE')
    expect(page).toContain('CAPABILITIES.RECORD_SURVEILLANCE_OUTCOME')
    expect(page).toContain('CAPABILITIES.DELETE_SURVEILLANCE')
    expect(page).toContain('CAPABILITIES.REOPEN_SURVEILLANCE')
  })

  it('requires a reason before voiding or reopening via the canonical reason dialog',()=>{
    expect(page).toContain('repository.voidCase(detailRecord,deleteReason.trim())')
    expect(page).toContain('repository.reopen(record,reason)')
    expect(page).toContain('disabled={!reason.trim()}')
    expect(page).toContain("permissions.canDelete?{id:'delete'")
  })
})