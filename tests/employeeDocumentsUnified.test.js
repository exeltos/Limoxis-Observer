import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const tabs=fs.readFileSync('src/features/employees/EmployeeRecordTabs.jsx','utf8')
const attachments=fs.readFileSync('src/design-system/AttachmentField.jsx','utf8')
const workspace=fs.readFileSync('src/design-system/DocumentsWorkspace.jsx','utf8')
const navigation=fs.readFileSync('src/core/navigation/useContextualNavigation.js','utf8')

describe('employee documents and contextual return',()=>{
  it('renders the shared governed documents workspace',()=>{
    expect(tabs).toContain('DocumentsWorkspace')
    expect(tabs).toContain('Όλα τα αρχεία του εργαζομένου τηρούνται σε ένα σημείο')
    expect(tabs).toContain('entityId={employee.dbId||employee.id}')
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
