import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const tabsCss=fs.readFileSync('src/features/employees/employeeRecordTabsRefinements.css','utf8')
const attachments=fs.readFileSync('src/design-system/AttachmentField.jsx','utf8')
const navigation=fs.readFileSync('src/core/navigation/useContextualNavigation.js','utf8')

describe('employee documents and contextual return',()=>{
  it('presents employee certifications and documents as one attachment workspace',()=>{
    expect(tabsCss).toContain('.employee-certificates-workspace>.employee-certificates-section:first-of-type{display:none}')
    expect(tabsCss).toContain('.employee-other-documents .employee-certificates-section-header{display:none}')
  })

  it('uses employee-specific attachment types',()=>{
    expect(attachments).toContain("entityType==='employee-certificate'")
    for(const value of ['certification','employmentCertificate','professionalLicense','degree','trainingCertificate','identityDocument','medicalDocument','other'])expect(attachments).toContain(`'${value}'`)
    expect(attachments).toContain('employeeDocumentTypeLabel')
  })

  it('falls back to stored navigation context when route state is lost',()=>{
    expect(navigation).toContain('readSessionJson')
    expect(navigation).toContain('location.state?.limoxisFrom||readSessionJson(CONTEXT_KEY,null)')
  })
})
