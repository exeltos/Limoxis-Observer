import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const source=fs.readFileSync(new URL('../src/features/surveillance/ProductionSurveillancePage.jsx',import.meta.url),'utf8')

describe('Production Surveillance registry loading',()=>{
  it('isolates clinical, patient and environmental registry failures',()=>{
    expect(source).toContain('Promise.allSettled([')
    expect(source).toContain("operation:'surveillance_cases_load'")
    expect(source).toContain("operation:'surveillance_patients_load'")
    expect(source).toContain("operation:'surveillance_environment_load'")
  })

  it('keeps employee surveillance behind the sensitive-health gate',()=>{
    expect(source).toContain('if(canSeeEmployeeSurveillance)')
    expect(source).toContain("operation:'employee_surveillance_registry_load'")
  })
})
