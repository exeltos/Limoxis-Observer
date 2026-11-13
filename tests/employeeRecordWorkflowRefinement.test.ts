import {describe,expect,it} from 'vitest'
import { readEmployeeRecordTabsSource } from './helpers/employeeRecordTabsSource'
import { readSource } from './helpers/readSource'

const tabs=readEmployeeRecordTabsSource()
const dialog=readSource('src/features/surveillance/EmployeeSurveillanceRecordDialog.jsx')
const service=readSource('src/features/laboratory/laboratoryRequestManagementService.js')
const documents=readSource('src/design-system/DocumentsWorkspace.jsx')

describe('employee record workflow refinement',()=>{

  it('keeps employee documents in the canonical shared workspace',()=>{
    expect(tabs).toContain('DocumentsWorkspace')
    expect(documents).toContain('AttachmentField')
    expect(tabs).toContain('entityType="employee-certificate"')
    expect(tabs).not.toContain('employee-documents-workspace')
    expect(tabs).not.toContain('employee-certificates-workspace')
    expect(tabs).not.toContain('employee-other-documents')
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
