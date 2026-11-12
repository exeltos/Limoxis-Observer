import { describe,expect,it } from 'vitest'
import { readPatientClinicalRecordSource } from './helpers/patientClinicalRecordSource'
import { readSource } from './helpers/readSource'
import { readSplitSource } from './helpers/surveillanceSplitSource'

const registry=readSource('src/features/surveillance/SurveillanceCanonicalPage.jsx')
const record=readPatientClinicalRecordSource()
const repository=readSource('src/features/surveillance/clinicalRepository.js')
const admissionService=readSource('src/features/surveillance/clinicalAdmissionService.js')
const sharedFlow=readSource('src/features/surveillance/NewSurveillanceFlow.jsx')

describe('new surveillance Demo/Production parity',()=>{
  // The new-surveillance flow creates the episode; assessment, samples and
  // isolation are recorded afterwards in its journey (ClinicalJourney).
  it('creates through the shared repository contract and records the later steps in the journey',()=>{
    expect(sharedFlow).toContain('onCreate')
    for(const step of ['onSaveAssessment','onRequestSample','onSaveIsolation'])expect(sharedFlow).not.toContain(step)
    expect(registry).toContain('clinical.createCase')
    expect(record).toContain('repository.createCase')
    expect(record).toContain('repository.saveAssessment')
    expect(record).toContain('repository.requestSample')
    expect(repository).toContain('createClinicalCase(organizationId,patient.recordId,draft)')
    // The admission link is written with the case, in one transaction (create_surveillance_case).
    expect(readSplitSource('src/features/surveillance/clinicalCloudService.js')).toContain("p_admission_id: draft.admissionId || null")
    expect(admissionService).toContain("update({admission_id:admissionId})")
  })
})