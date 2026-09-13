import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const source=fs.readFileSync(new URL('../src/features/surveillance/SurveillanceCanonicalPage.jsx',import.meta.url),'utf8')

describe('Production Surveillance registry loading',()=>{
  it('loads production domains independently in the canonical page',()=>{
    expect(source).toContain('Promise.allSettled([')
    expect(source).toContain('loadClinicalCases(tenant.id)')
    expect(source).toContain('loadEmployeeSurveillanceRecords(tenant.id)')
    expect(source).toContain('loadLaboratorySamples(tenant.id)')
    expect(source).toContain('loadDepartments(tenant.id)')
    expect(source).toContain("operation:'surveillance_canonical_load'")
  })

  it('keeps production employee surveillance behind the sensitive-health gate',()=>{
    expect(source).toContain('const canEmployees=')
    expect(source).toContain('canSeeSensitiveEmployeeHealth')
    expect(source).toContain('canEmployees?await loadEmployeeSurveillanceBatches')
  })

  it('does not fall back to demo datasets in the production branch',()=>{
    expect(source).toContain('if(isDemo){')
    expect(source).toContain("}else if(tenant?.id){")
    expect(source).toContain('setCases(surveillanceDemoData.map')
    expect(source).toContain('setCases(results[0].status===\'fulfilled\'?results[0].value:[])')
  })
})
