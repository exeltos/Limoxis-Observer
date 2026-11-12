import { describe,expect,it } from 'vitest'
import { readAnalysisPageSource } from './helpers/analysisPageSource'
import { readSource } from './helpers/readSource'

// Regression guard: Demo may change repositories/data, never the product component tree.
const users=readSource('src/features/management/ManagementUsersPanel.jsx')
const employee=readSource('src/features/employees/EmployeeRecordPage.jsx')
const surveillance=readSource('src/features/surveillance/SurveillanceCanonicalPage.jsx')
const employeeDialog=readSource('src/features/surveillance/EmployeeSurveillanceRecordDialog.jsx')
const analysis=readAnalysisPageSource()
const parityAudit=readSource('tools/check-frontend-parity.mjs')
const workflow=readSource('.github/workflows/ci.yml')

describe('Demo uses canonical product UI',()=>{
  it('renders the same organization-users registry and user pages in Demo and Production',()=>{
    expect(users).not.toMatch(/if\s*\(\s*isDemo\s*\)\s*return\s*</)
    expect(users).toContain('DEMO_USERS')
    expect(users).toContain('<RegistryTable')
    expect(users).toContain('<CreateUserView')
    expect(users).toContain('<UserAccessView')
    expect(users).toContain("if(isDemo){")
  })

  // The chooser and the employee dialog are exercised in surveillanceCenter*.test.jsx.
  it('uses one employee-surveillance creation flow and one record dialog from both entry points',()=>{
    expect(employee).not.toContain('ProductionEmployeeSurveillanceFlow')
    expect(surveillance).not.toContain('ProductionEmployeeSurveillanceFlow')
    expect(employeeDialog).toContain('onSaveFollowup')
  })

  it('uses one analytics renderer with normalized Demo microbiology data',()=>{
    expect(analysis).toContain('const activeSnapshot=isDemo?demoSnapshot:snapshot')
    expect(analysis).toContain('buildProductionRows(tab,activeSnapshot,tx)')
    expect(analysis).toContain("tab==='laboratory'?<><NationalSurveillance details={micro}")
    expect(analysis).not.toContain('DemoNationalSurveillance')
    expect(analysis).not.toContain('ProductionNationalSurveillance')
    expect(analysis).not.toMatch(/isDemo\s*\?\s*<[A-Z][\w.]*[\s\S]{0,400}?:\s*<[A-Z][\w.]*/)
  })

  it('preserves Platform Owner analytics comparison controls',()=>{
    expect(analysis).toContain("ownerCompareMode==='hospital'")
    expect(analysis).toContain("ownerCompareMode==='region'")
    expect(analysis).toContain('compareHospital')
    expect(analysis).toContain('compareRegion')
  })

  it('enforces parity as a blocking CI check',()=>{
    expect(parityAudit).toContain('demoEarlyUiReturn')
    expect(parityAudit).toContain('environmentComponentTernary')
    expect(workflow).toContain('npm run audit:frontend-parity')
  })
})
