import {describe,expect,it} from 'vitest'
import { readSource } from './helpers/readSource'

const panel=readSource('src/design-system/EntityAttachmentsPanel.jsx')
const field=readSource('src/design-system/AttachmentField.jsx')
const record=readSource('src/features/laboratory/LaboratorySampleRecordView.jsx')
const registry=readSource('src/features/laboratory/LaboratoryWorkspace.jsx')

describe('laboratory attachment governance',()=>{
  it('uses the unified shared private attachment field for entity evidence',()=>{
    expect(panel).toContain("import { DocumentsWorkspace } from './DocumentsWorkspace'")
    expect(readSource('src/design-system/DocumentsWorkspace.jsx')).toContain('entityId={entityId}')
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
    // One status component for the registry and the record, on the shared StatusBadge.
    expect(registry).toContain("LaboratoryStatus, labResultLabel, labSampleStatus, labStatusLabel } from './LaboratoryStatus'")
    expect(registry).not.toContain('export function Status')
    expect(readSource('src/features/laboratory/LaboratoryStatus.jsx')).toContain('<StatusBadge')
  })
})
