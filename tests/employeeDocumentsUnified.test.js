import {describe,expect,it} from 'vitest'
import { readEmployeeRecordTabsSource } from './helpers/employeeRecordTabsSource'
import { readSource } from './helpers/readSource'

const tabs=readEmployeeRecordTabsSource()
const attachments=readSource('src/design-system/AttachmentField.jsx')
const workspace=readSource('src/design-system/DocumentsWorkspace.jsx')
const navigation=readSource('src/core/navigation/useContextualNavigation.js')

describe('employee documents and contextual return',()=>{
  it('renders the shared governed documents workspace',()=>{
    expect(tabs).toContain('DocumentsWorkspace')
    expect(workspace).toContain('<AttachmentField')
    expect(tabs).not.toContain('employee-certificates-section')
    expect(tabs).not.toContain('employee-documents-workspace')
  })

  it('uses employee-specific attachment types',()=>{
    expect(attachments).toContain("entityType==='employee-certificate'")
    for(const value of ['certification','employmentCertificate','professionalLicense','degree','trainingCertificate','identityDocument','medicalDocument','other'])expect(attachments).toContain(`'${value}'`)
    expect(attachments).toContain('employeeDocumentTypeLabel')
  })

  it('supports an explicit return target and tab for cross-module navigation',()=>{
    expect(navigation).toContain('returnTo,returnTab')
    expect(navigation).toContain('pathname:returnTo||location.pathname')
    expect(navigation).toContain('tab:returnTab??tab??null')
    expect(navigation).toContain('location.state?.limoxisFrom||readSessionJson(CONTEXT_KEY,null)')
  })
})
