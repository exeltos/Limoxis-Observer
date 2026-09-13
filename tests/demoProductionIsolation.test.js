import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const app=fs.readFileSync(new URL('../src/app/App.jsx',import.meta.url),'utf8')
const route=fs.readFileSync(new URL('../src/features/surveillance/SurveillanceRoutePage.jsx',import.meta.url),'utf8')
const canonicalSurveillance=fs.readFileSync(new URL('../src/features/surveillance/SurveillanceCanonicalPage.jsx',import.meta.url),'utf8')
const patientRoute=fs.readFileSync(new URL('../src/features/surveillance/PatientClinicalRecordRoute.jsx',import.meta.url),'utf8')
const canonicalPatientRecord=fs.readFileSync(new URL('../src/features/surveillance/PatientClinicalCanonicalPage.jsx',import.meta.url),'utf8')
const clinicalRepository=fs.readFileSync(new URL('../src/features/surveillance/clinicalRepository.js',import.meta.url),'utf8')
const analysis=fs.readFileSync(new URL('../src/features/analysis/AnalysisPage.jsx',import.meta.url),'utf8')
const platformService=fs.readFileSync(new URL('../src/features/platform/platformService.js',import.meta.url),'utf8')
const environment=fs.readFileSync(new URL('../src/core/data/dataEnvironment.js',import.meta.url),'utf8')

describe('demo / production isolation',()=>{
  it('routes surveillance through one canonical frontend',()=>{
    expect(app).toContain("import('../features/surveillance/SurveillanceRoutePage')")
    expect(route).toContain('<SurveillanceCanonicalPage/>')
    expect(route).not.toContain('ProductionSurveillancePage')
    expect(route).not.toContain('isDemo')
  })

  it('keeps environment branching in the surveillance data layer',()=>{
    expect(canonicalSurveillance).toContain('isDemo')
    expect(canonicalSurveillance).toContain('loadClinicalCases')
    expect(canonicalSurveillance).toContain('surveillanceDemoData')
    expect(clinicalRepository).toContain('if(isDemo)')
    expect(clinicalRepository).toContain('loadClinicalCasesForPatient')
    expect(clinicalRepository).toContain('createClinicalCase')
  })

  it('routes both demo and production clinical records to the canonical record implementation',()=>{
    expect(patientRoute).toContain('<PatientClinicalCanonicalPage patientMode={patientMode}/>')
    expect(patientRoute).not.toContain('PatientClinicalCloudRecordPage')
    expect(patientRoute).not.toContain('PatientClinicalRecordPage')
    expect(canonicalPatientRecord).toContain('createClinicalRepository')
  })

  it('keeps synthetic analytics behind demo and production on one canonical persisted loader and renderer',()=>{
    expect(analysis).toContain('const productionScope=!isDemo&&')
    expect(analysis).toContain('loadAnalysisSnapshot(')
    expect(analysis).toContain("isDemo?(DEMO_KPI[tab]||DEMO_KPI.overview)")
    expect(analysis).toContain('DEMO_MICROBIOLOGY')
    expect(analysis).toContain("tab==='national'?<NationalSurveillance details={micro}")
    expect(analysis).not.toContain('DemoNationalSurveillance')
    expect(analysis).not.toContain('ProductionNationalSurveillance')
    expect(platformService).toContain('export async function loadAnalysisSnapshot')
    expect(platformService).not.toContain('export async function loadGlobalReportSummary')
    expect(platformService).not.toContain('export async function loadPlatformAnalyticsDetails')
  })

  it('returns empty-shaped fallbacks outside the demo environment',()=>{
    expect(environment).toContain('environmentFallback=fallback=>isDemoDataEnvironment()?structuredClone(fallback):emptyShape(fallback)')
  })
})
