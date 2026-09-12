import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const panel=fs.readFileSync('src/features/laboratory/LaboratoryAttachmentsPanel.jsx','utf8')
const record=fs.readFileSync('src/features/laboratory/LaboratorySampleCloudRecordPage.jsx','utf8')
const registry=fs.readFileSync('src/features/laboratory/LaboratoryWorkspace.jsx','utf8')

describe('laboratory attachment governance',()=>{
  it('uses the shared private attachment service for sample evidence',()=>{
    expect(panel).toContain("loadAttachments(organizationId,'laboratory_sample',sampleRecordId)")
    expect(panel).toContain("uploadAttachment(organizationId,'laboratory_sample',sampleRecordId")
    expect(panel).toContain('getAttachmentUrl(row.storagePath)')
    expect(panel).toContain('deleteAttachment(pendingDelete.id)')
    expect(panel).toContain('MAX_FILE_SIZE=25*1024*1024')
  })
  it('exposes attachments as a first-class record tab and keeps delete confirmation',()=>{
    expect(record).toContain("{id:'documents'")
    expect(record).toContain("tab==='documents'")
    expect(record).toContain('<LaboratoryAttachmentsPanel')
    expect(panel).toContain('<ConfirmDialog')
    expect(panel).toContain('open={Boolean(pendingDelete)}')
  })
  it('does not import the route wrapper from production laboratory screens',()=>{
    expect(record).not.toContain("from './LaboratoryPage'")
    expect(registry).not.toContain("from './LaboratoryPage'")
    expect(record).toContain("from './LaboratoryStatus'")
    expect(registry).toContain('export function Status')
  })
})
