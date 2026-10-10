import fs from 'node:fs'
import { describe,expect,it } from 'vitest'
import { readPatientClinicalRecordSource } from './helpers/patientClinicalRecordSource'

const registry=fs.readFileSync('src/features/surveillance/SurveillanceCanonicalPage.jsx','utf8')
const record=readPatientClinicalRecordSource()
const repository=fs.readFileSync('src/features/surveillance/clinicalRepository.js','utf8')
const admissionService=fs.readFileSync('src/features/surveillance/clinicalAdmissionService.js','utf8')
const sharedFlow=fs.readFileSync('src/features/surveillance/NewSurveillanceFlow.jsx','utf8')

describe('new surveillance Demo/Production parity',()=>{
  it('persists progressive steps through the shared repository contract',()=>{
    for(const action of ['onCreate','onSaveAssessment','onRequestSample','onSaveIsolation'])expect(sharedFlow).toContain(action)
    expect(registry).toContain('clinical.createCase')
    expect(registry).toContain('clinical.saveAssessment')
    expect(registry).toContain('clinical.requestSample')
    expect(record).toContain('repository.createCase')
    expect(record).toContain('repository.saveAssessment')
    expect(record).toContain('repository.requestSample')
    expect(repository).toContain('createClinicalCase(organizationId,patient.recordId,draft)')
    expect(repository).toContain('linkSurveillanceCaseToAdmission')
    expect(admissionService).toContain("update({admission_id:admissionId})")
  })
})