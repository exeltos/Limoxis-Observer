import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const tabs=fs.readFileSync('src/features/employees/EmployeeRecordTabs.jsx','utf8')
const dialog=fs.readFileSync('src/features/surveillance/EmployeeSurveillanceRecordDialog.jsx','utf8')
const service=fs.readFileSync('src/features/laboratory/laboratoryRequestManagementService.js','utf8')
const css=fs.readFileSync('src/features/employees/employeeRecordTabsRefinements.css','utf8')

describe('employee record workflow refinement',()=>{
  it('returns from Training to the same employee training tab through an explicit contextual target',()=>{
    expect(tabs).toContain("useContextualNavigation('/training')")
    expect(tabs).toContain("returnTo:`/employees/${encodeURIComponent(employee.id)}`")
    expect(tabs).toContain("returnTab:'training'")
  })

  it('keeps employee documents in one compact governed workspace',()=>{
    expect(tabs).toContain('employee-documents-workspace')
    expect(tabs).toContain('entityType="employee-certificate"')
    expect(tabs).not.toContain('employee-certificates-workspace')
    expect(tabs).not.toContain('employee-other-documents')
    expect(css).toContain('.employee-documents-workspace')
  })

  it('shows compact employee surveillance and laboratory request codes',()=>{
    expect(tabs).toContain('compactEpisodeCode')
    expect(dialog).toContain('compactCode(sample.id)')
    expect(dialog).toContain('title={sample.id}')
  })

  it('lets authorized laboratory managers edit cancel or delete only pending unreceived requests',()=>{
    expect(dialog).toContain('CAPABILITIES.MANAGE_LAB_SAMPLES')
    expect(dialog).toContain('updateLaboratoryRequest')
    expect(dialog).toContain('cancelLaboratoryRequest')
    expect(dialog).toContain('deleteLaboratoryRequest')
    expect(service).toContain("sample.status!=='requested'")
    expect(service).toContain('sample.received_at')
    expect(service).toContain("from('microbiology_results')")
  })
})
