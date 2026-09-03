import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const app=fs.readFileSync(new URL('../src/app/App.jsx',import.meta.url),'utf8')
const route=fs.readFileSync(new URL('../src/features/surveillance/SurveillanceRoutePage.jsx',import.meta.url),'utf8')
const productionSurveillance=fs.readFileSync(new URL('../src/features/surveillance/ProductionSurveillancePage.jsx',import.meta.url),'utf8')
const patientRoute=fs.readFileSync(new URL('../src/features/surveillance/PatientClinicalRecordRoute.jsx',import.meta.url),'utf8')
const cloudPatientRecord=fs.readFileSync(new URL('../src/features/surveillance/PatientClinicalCloudRecordPage.jsx',import.meta.url),'utf8')
const analysis=fs.readFileSync(new URL('../src/features/analysis/AnalysisPage.jsx',import.meta.url),'utf8')
const environment=fs.readFileSync(new URL('../src/core/data/dataEnvironment.js',import.meta.url),'utf8')

describe('demo / production isolation',()=>{
  it('routes surveillance through an environment-aware boundary',()=>{
    expect(app).toContain("import('../features/surveillance/SurveillanceRoutePage')")
    expect(route).toContain('if(!isDemo)return <ProductionSurveillancePage/>')
    expect(route).toContain("lazy(()=>import('./SurveillancePage')")
  })

  it('keeps synthetic surveillance datasets out of the production registry',()=>{
    expect(productionSurveillance).toContain('loadClinicalCases(tenant.id)')
    expect(productionSurveillance).toContain("loadPatients(tenant.id,{isDemo:false})")
    expect(productionSurveillance).toContain('createClinicalCase(')
    expect(productionSurveillance).not.toContain('surveillanceDemoData')
    expect(productionSurveillance).not.toContain('employeeSurveillanceData')
    expect(productionSurveillance).not.toContain('environmentalSurveillanceData')
    expect(productionSurveillance).not.toContain('laboratoryDemoData')
  })

  it('routes production clinical records only to the cloud record implementation',()=>{
    expect(patientRoute).toContain('return isDemo')
    expect(patientRoute).toContain('<PatientClinicalRecordPage patientMode={patientMode}/>')
    expect(patientRoute).toContain('<PatientClinicalCloudRecordPage patientMode={patientMode}/>')
    expect(cloudPatientRecord).not.toContain('surveillanceDemoData')
  })

  it('blocks synthetic analytics from production rendering',()=>{
    expect(analysis).toContain('!isDemo?')
    expect(analysis).toContain('analysis-production-empty')
    expect(analysis).toContain('Demo or synthetic values are never used as a fallback.')
  })

  it('returns empty-shaped fallbacks outside the demo environment',()=>{
    expect(environment).toContain('environmentFallback=fallback=>isDemoDataEnvironment()?structuredClone(fallback):emptyShape(fallback)')
  })
})
