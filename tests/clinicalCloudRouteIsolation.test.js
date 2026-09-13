import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const route=fs.readFileSync('src/features/surveillance/PatientClinicalRecordRoute.jsx','utf8')
const canonical=fs.readFileSync('src/features/surveillance/PatientClinicalCanonicalPage.jsx','utf8')
const repository=fs.readFileSync('src/features/surveillance/clinicalRepository.js','utf8')
const app=fs.readFileSync('src/app/App.jsx','utf8')

describe('clinical route isolation',()=>{
  it('routes Demo and Production through one canonical clinical record',()=>{
    expect(route).toContain('<PatientClinicalCanonicalPage patientMode={patientMode}/>')
    expect(route).not.toContain('isDemo')
    expect(route).not.toContain('PatientClinicalCloudRecordPage')
    expect(route).not.toContain('PatientClinicalRecordPage')
  })

  it('routes patient and surveillance records through the canonical record route',()=>{
    expect(app).toContain("import('../features/surveillance/PatientClinicalRecordRoute')")
    expect(app).toContain('<PatientClinicalRecordRoute/>')
    expect(app).toContain('<PatientClinicalRecordRoute patientMode/>')
  })

  it('keeps environment-specific persistence in the repository layer',()=>{
    expect(canonical).toContain("from './clinicalRepository'")
    expect(canonical).not.toContain('clinicalDemoData')
    expect(canonical).not.toContain('clinicalCloudService')
    expect(repository).toContain("from './clinicalDemoData'")
    expect(repository).toContain("from './clinicalCloudService'")
    expect(repository).toContain('if(isDemo)')
  })
})
