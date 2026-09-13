import fs from 'node:fs'
import { describe,expect,it } from 'vitest'

// Regression guard: Demo may change repositories/data, never the product component tree.
const users=fs.readFileSync('src/features/management/ManagementUsersPanel.jsx','utf8')
const employee=fs.readFileSync('src/features/employees/EmployeeRecordPage.jsx','utf8')
const employeeTabs=fs.readFileSync('src/features/employees/EmployeeRecordTabs.jsx','utf8')
const surveillance=fs.readFileSync('src/features/surveillance/SurveillanceCanonicalPage.jsx','utf8')
const employeeDialog=fs.readFileSync('src/features/surveillance/EmployeeSurveillanceRecordDialog.jsx','utf8')
const analysis=fs.readFileSync('src/features/analysis/AnalysisPage.jsx','utf8')
const parityAudit=fs.readFileSync('tools/check-frontend-parity.mjs','utf8')
const workflow=fs.readFileSync('.github/workflows/ci.yml','utf8')

describe('Demo uses canonical product UI',()=>{
  it('renders the same organization-users registry and dialogs in Demo and Production',()=>{
    expect(users).not.toMatch(/if\s*\(\s*isDemo\s*\)\s*return\s*</)
    expect(users).toContain('DEMO_USERS')
    expect(users).toContain('<RegistryTable')
    expect(users).toContain('<CreateUserDialog')
    expect(users).toContain('<UserAccessDialog')
    expect(users).toContain("if(isDemo){")
  })

  it('uses one employee-surveillance creation flow and one record dialog from both entry points',()=>{
    expect(employee).not.toContain('ProductionEmployeeSurveillanceFlow')
    expect(employee).toContain('surveillanceOpen&&!selfReadOnly&&<EmployeeSurveillanceFlow')
    expect(employee).toContain('<EmployeeSurveillanceTab')
    expect(employeeTabs).toContain('selected&&<EmployeeSurveillanceRecordDialog')
    expect(surveillance).not.toContain('ProductionEmployeeSurveillanceFlow')
    expect(surveillance).toContain("creation==='employee'&&canEmployees&&<EmployeeSurveillanceFlow")
    expect(surveillance).toContain("creation==='bulk'&&canEmployees&&<BulkEmployeeSurveillanceFlow")
    expect(surveillance).toContain('openEmployee&&<EmployeeSurveillanceRecordDialog')
    expect(employeeDialog).toContain('onSaveFollowup')
  })

  it('uses one analytics renderer with normalized Demo microbiology data',()=>{
    expect(analysis).toContain('DEMO_MICROBIOLOGY')
    expect(analysis).toContain("tab==='national'?<NationalSurveillance details={micro}")
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
