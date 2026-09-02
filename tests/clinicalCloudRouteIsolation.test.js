import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const route=fs.readFileSync('src/features/surveillance/PatientClinicalRecordRoute.jsx','utf8')
const cloud=fs.readFileSync('src/features/surveillance/PatientClinicalCloudRecordPage.jsx','utf8')
const app=fs.readFileSync('src/app/App.jsx','utf8')

describe('clinical cloud route isolation',()=>{
  it('keeps the rich legacy clinical record only in demo mode',()=>{
    expect(route).toContain('isDemo')
    expect(route).toContain('<PatientClinicalRecordPage patientMode={patientMode}/>')
    expect(route).toContain('<PatientClinicalCloudRecordPage patientMode={patientMode}/>')
  })

  it('routes patient and surveillance records through the environment switch',()=>{
    expect(app).toContain("import('../features/surveillance/PatientClinicalRecordRoute')")
    expect(app).toContain('<PatientClinicalRecordRoute />')
    expect(app).toContain('<PatientClinicalRecordRoute patientMode />')
  })

  it('does not import demo clinical or laboratory arrays in the production record page',()=>{
    expect(cloud).toContain("from './clinicalCloudService'")
    expect(cloud).not.toContain('clinicalDemoData')
    expect(cloud).not.toContain('laboratoryDemoData')
    expect(cloud).not.toContain('demoLibrarySeed')
    expect(cloud).toContain('createClinicalCase')
    expect(cloud).toContain('addClinicalReassessment')
    expect(cloud).toContain('completeClinicalCase')
  })
})
