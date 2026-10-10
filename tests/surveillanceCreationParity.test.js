import fs from 'node:fs'
import { describe,expect,it } from 'vitest'
import { readPatientClinicalRecordSource } from './helpers/patientClinicalRecordSource'

const registry=fs.readFileSync('src/features/surveillance/SurveillanceCanonicalPage.jsx','utf8')
const record=readPatientClinicalRecordSource()
const repository=fs.readFileSync('src/features/surveillance/clinicalRepository.js','utf8')
const admissionService=fs.readFileSync('src/features/surveillance/clinicalAdmissionService.js','utf8')
const sharedFlow=fs.readFileSync('src/features/surveillance/NewSurveillanceFlow.jsx','utf8')

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
    expect(repository).toContain('linkSurveillanceCaseToAdmission')
    expect(admissionService).toContain("update({admission_id:admissionId})")
  })
})