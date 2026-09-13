import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const service=fs.readFileSync(new URL('../src/features/documents/documentService.js',import.meta.url),'utf8')
const migration=fs.readFileSync(new URL('../supabase/migrations/202609130001_documents_revision_governance.sql',import.meta.url),'utf8')
const feedback=fs.readFileSync(new URL('../src/core/feedback/FeedbackContext.jsx',import.meta.url),'utf8')
const recordPage=fs.readFileSync(new URL('../src/features/documents/DocumentRecordPage.jsx',import.meta.url),'utf8')

describe('controlled document governance metadata',()=>{
  it('persists approval identity and timestamp',()=>{
    expect(service).toContain("approved_at:now,approved_by:actor?.id||null")
    expect(service).toContain('approvedAt:row.approved_at||null')
  })

  it('requires a reason before creating a revision',()=>{
    expect(service).toContain('DOCUMENT_REVISION_REASON_REQUIRED')
    expect(service).toContain('revision_reason:reason')
  })

  it('adds the governance columns through an idempotent migration',()=>{
    expect(migration).toContain('add column if not exists revision_reason text')
    expect(migration).toContain('add column if not exists approved_at timestamptz')
    expect(migration).toContain('add column if not exists approved_by uuid')
  })

  it('supports required text capture in the shared confirmation dialog',()=>{
    expect(feedback).toContain('inputRequired')
    expect(feedback).toContain('<textarea')
    expect(feedback).toContain('confirmInput.trim()')
  })

  it('captures revision rationale from the record workflow',()=>{
    expect(recordPage).toContain("label: en ? 'Revision reason' : 'Λόγος αναθεώρησης'")
    expect(recordPage).toContain('required: true')
    expect(recordPage).toContain('revisionReason')
    expect(recordPage).toContain('createDocumentRevisionAsync(organizationId, record, actor, rows, revisionReason)')
  })

  it('surfaces lifecycle governance in the overview and history',()=>{
    expect(recordPage).toContain('Current active version')
    expect(recordPage).toContain('Ισχύουσα έκδοση')
    expect(recordPage).toContain('record.approvedAt')
    expect(recordPage).toContain('record.publishedAt')
    expect(recordPage).toContain('version.revisionReason')
  })
})
