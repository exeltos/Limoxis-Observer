import fs from 'node:fs'
import { describe,expect,it } from 'vitest'

const users=fs.readFileSync('src/features/management/ManagementUsersPanel.jsx','utf8')
const employee=fs.readFileSync('src/features/employees/EmployeeRecordPage.jsx','utf8')
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

  it('uses one employee-surveillance creation flow and one record dialog',()=>{
    expect(employee).not.toContain('ProductionEmployeeSurveillanceFlow')
    expect(employee).toContain('surveillanceOpen&&!selfReadOnly&&<EmployeeSurveillanceFlow')
    expect(employee).toContain('selected&&<EmployeeSurveillanceRecordDialog')
    expect(employee).not.toContain('selected&&isDemo&&<ObserverDialog')
    expect(employeeDialog).toContain('onSaveFollowup')
  })

  it('uses one analytics renderer with normalized Demo microbiology data',()=>{
    expect(analysis).toContain('DEMO_MICRO')
    expect(analysis).toContain('<NationalView details={activeMicro}')
    expect(analysis).not.toContain('DemoNationalSurveillance')
    expect(analysis).not.toContain('ProductionNationalSurveillance')
    expect(analysis).not.toMatch(/isDemo\s*\?\s*<[A-Z][\w.]*[\s\S]{0,400}?:\s*<[A-Z][\w.]*/)
  })

  it('enforces parity as a blocking CI check',()=>{
    expect(parityAudit).toContain('demoEarlyUiReturn')
    expect(parityAudit).toContain('environmentComponentTernary')
    expect(workflow).toContain('npm run audit:frontend-parity')
  })
})
