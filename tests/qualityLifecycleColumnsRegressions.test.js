import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

// Quality module review: create/save for all four quality record types wrote
// owner_label, lifecycle_status, void_reason, voided_at/by, correction_
// reason/opened_at/by and history — none of which existed on any of the
// quality_* tables, so production create/save/void/correct failed outright
// with a PostgREST "column does not exist" error. reported_by and
// lead_auditor_id are real uuid FKs but the UI edits/shows them as free-text
// names, which was unconditionally blanked for any real (uuid) value.
describe('quality record create/save writes columns that actually exist, and reported-by / lead-auditor display correctly', () => {
  const migration = fs.readFileSync('supabase/migrations/20260924143000_quality_lifecycle_and_label_columns.sql', 'utf8')
  const service = fs.readFileSync('src/features/quality/qualityService.js', 'utf8')
  const createPage = fs.readFileSync('src/features/quality/QualityCreatePage.jsx', 'utf8')
  const recordPage = fs.readFileSync('src/features/quality/QualityRecordPage.jsx', 'utf8')

  it('the migration adds the lifecycle/label columns to every quality table', () => {
    for (const table of ['quality_incidents', 'quality_findings', 'quality_capa_actions', 'quality_audits']) {
      expect(migration).toContain(`alter table public.${table}`)
    }
    for (const column of ['owner_label', 'lifecycle_status', 'void_reason', 'voided_at', 'voided_by', 'correction_reason', 'correction_opened_at', 'correction_opened_by', 'history']) {
      expect(migration).toContain(column)
    }
    expect(migration).toContain('reported_by_label')
    expect(migration).toContain('lead_auditor_label')
  })

  it('reportedBy and leadAuditor are read from their own label column instead of being blanked whenever the id happens to be a real uuid', () => {
    expect(service).toContain("reportedBy:row.reported_by_label||''")
    expect(service).toContain("leadAuditor:row.lead_auditor_label||''")
  })

  it('the create flow captures the reporting actor\'s display name instead of leaving reported_by_label unset (also fixes demo showing the raw "demo-user" id)', () => {
    expect(createPage).toContain('reportedByLabel:actor.name')
    expect(service).toContain('reported_by_label:draft.reportedByLabel||null')
    expect(service).toContain("reportedBy:draft.reportedByLabel||''")
  })

  it('saving an audit persists the edited lead auditor instead of silently discarding it', () => {
    expect(service).toContain('lead_auditor_label:record.leadAuditor||null')
  })

  it('compactCode matches the codes the app actually generates (prefix-dash-6digits-dash-6+digits)', () => {
    expect(service).toContain('/^(INC|FND|CAPA|AUD)-(\\d{6})-(\\d{6,})$/')
  })

  it('an audit record queries findings that cite it back, not just the reverse (findings/incidents -> CAPA) direction', () => {
    expect(recordPage).toContain("recordType==='audits'")
    expect(recordPage).toContain("kind:'findings'")
  })
})
