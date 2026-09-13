import fs from 'node:fs'
import { describe,expect,it } from 'vitest'

const registry=fs.readFileSync('src/features/surveillance/SurveillanceCanonicalPage.jsx','utf8')
const record=fs.readFileSync('src/features/surveillance/PatientClinicalCanonicalPage.jsx','utf8')
const repository=fs.readFileSync('src/features/surveillance/clinicalRepository.js','utf8')
const sharedFlow=fs.readFileSync('src/features/surveillance/NewSurveillanceFlow.jsx','utf8')

describe('new surveillance Demo/Production parity',()=>{
  it('uses the same progressive patient flow from registry and record entry points',()=>{
    expect(registry).toContain("creation==='patient'&&<NewSurveillanceFlow")
    expect(record).toContain('createOpen&&<NewSurveillanceFlow')
    expect(record).not.toContain('PatientClinicalCloudRecordPage')
  })

  it('persists progressive steps through the shared repository contract',()=>{
    for(const action of ['onCreate','onSaveAssessment','onRequestSample','onSaveIsolation'])expect(sharedFlow).toContain(action)
    expect(registry).toContain('clinical.createCase')
    expect(registry).toContain('clinical.saveAssessment')
    expect(registry).toContain('clinical.requestSample')
    expect(record).toContain('repository.createCase')
    expect(record).toContain('repository.saveAssessment')
    expect(record).toContain('repository.requestSample')
    expect(repository).toContain('if(!isDemo)return createClinicalCase')
  })

  it('requires a patient code when inline creation runs outside Demo',()=>{
    expect(sharedFlow).toContain("!isDemo&&!patientDraft.patientCode.trim()")
    expect(sharedFlow).toContain("patientCode:patientDraft.patientCode.trim()||undefined")
  })

  it('keeps one canonical patient tab structure in both environments',()=>{
    for(const tab of ['summary','admissions','surveillanceJourney','clinicalData','documents','history'])expect(record).toContain(`id:'${tab}'`)
    expect(record).not.toContain("id:'clinical'")
  })
})
