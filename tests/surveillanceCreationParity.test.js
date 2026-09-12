import fs from 'node:fs'
import { describe,expect,it } from 'vitest'

const productionRegistry=fs.readFileSync('src/features/surveillance/ProductionSurveillancePage.jsx','utf8')
const productionRecord=fs.readFileSync('src/features/surveillance/PatientClinicalCloudRecordPage.jsx','utf8')
const sharedFlow=fs.readFileSync('src/features/surveillance/NewSurveillanceFlow.jsx','utf8')

describe('new surveillance Demo/Production parity',()=>{
  it('uses the canonical progressive flow from both production entry points',()=>{
    expect(productionRegistry).toContain("creationMode==='patient'&&<NewSurveillanceFlow")
    expect(productionRecord).toContain('createOpen&&patient&&<NewSurveillanceFlow')
    expect(productionRecord).not.toContain('CreateCloudSurveillance')
  })

  it('persists progressive production steps through injected cloud actions',()=>{
    for(const action of ['onCreate','onSaveAssessment','onRequestSample','onSaveIsolation']){
      expect(sharedFlow).toContain(action)
      expect(productionRegistry).toContain(`${action}=`)
      expect(productionRecord).toContain(`${action}=`)
    }
  })

  it('requires a patient code when inline creation runs outside Demo',()=>{
    expect(sharedFlow).toContain("!isDemo&&!patientDraft.patientCode.trim()")
    expect(sharedFlow).toContain("patientCode:patientDraft.patientCode.trim()||undefined")
  })
})
