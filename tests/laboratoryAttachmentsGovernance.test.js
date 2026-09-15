import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const panel=fs.readFileSync('src/design-system/EntityAttachmentsPanel.jsx','utf8')
const field=fs.readFileSync('src/design-system/AttachmentField.jsx','utf8')
const record=fs.readFileSync('src/features/laboratory/LaboratorySampleRecordView.jsx','utf8')
const registry=fs.readFileSync('src/features/laboratory/LaboratoryWorkspace.jsx','utf8')

describe('laboratory attachment governance',()=>{
  it('uses the unified shared private attachment field for entity evidence',()=>{
    expect(panel).toContain("import { AttachmentField } from './AttachmentField'")
    expect(panel).toContain('organizationId={organizationId}')
    expect(panel).toContain('entityType={entityType}')
    expect(panel).toContain('entityId={entityRecordId}')
    expect(field).toContain('loadAttachments(organizationId,entityType,entityId)')
    expect(field).toContain('uploadAttachment(organizationId,entityType,entityId,file')
    expect(field).toContain('getAttachmentUrl(file.storagePath)')
    expect(field).toContain('await deleteAttachment(id)')
  })
  it('exposes attachments as a first-class record tab and keeps delete confirmation',()=>{
    expect(record).toContain("{id:'attachments'")
    expect(record).toContain('<EntityAttachmentsPanel')
    expect(record).toContain('entityType="laboratory_sample"')
    expect(field).toContain('await confirm(')
  })
  it('does not import the route wrapper from production laboratory screens',()=>{
    expect(record).not.toContain("from './LaboratoryPage'")
    expect(registry).not.toContain("from './LaboratoryPage'")
    expect(record).toContain("from './LaboratoryStatus'")
    expect(registry).toContain('export function Status')
  })
})
