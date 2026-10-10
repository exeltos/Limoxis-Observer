import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
// Only the declarations matter here, not whether they carry !important.
const withoutImportant = css => css.replaceAll('!important', '')


const read = (path) => fs.readFileSync(path, 'utf8')

const workflowService = read('src/features/committees/committeeWorkflowService.js')
const listPage = read('src/features/committees/CommitteesPage.jsx')
const createPage = read('src/features/committees/CommitteeCreatePage.jsx')
const modulesCss = read('src/styles/features.css')
const migration = read('supabase/migrations/20260922110000_committee_secretariat_can_notify.sql')

describe('committee decisions: owner linked to a real account', () => {
  it('persists owner_id (not just free-text owner_label) on create and update', () => {
    expect(workflowService).toContain('owner_id:draft.ownerId||null')
    expect(workflowService).toContain('owner_id:next.ownerId||null')
    expect(workflowService).toContain('ownerId:data.owner_id||null')
  })

  it('widens announcement RLS to the committee_secretariat role, the same way as quality_manager', () => {
    expect(migration).toContain("'committee_secretariat'::app_role")
    expect(migration).toContain('management_announcements_insert')
    expect(migration).toContain('management_announcement_ack_manager_read')
  })
})

describe('committees list: overdue-action filter and sortable columns', () => {
  it('makes the overdue-actions metric a dedicated filter instead of only counting', () => {
    expect(listPage).toContain('overdueOnly')
    expect(listPage).toContain('isOverdue')
    expect(listPage).toContain('onClick={()=>setOverdueOnly(v=>!v)}')
  })

  it('sorts every column', () => {
    expect(listPage).toContain('toggleSort')
    expect(listPage).toContain('sortIndicator')
    expect(listPage).toContain('sortAccessors')
  })

  it('keeps the metric card as the direct grid child (no wrapping button)', () => {
    expect(listPage).not.toContain("style={{all:'unset'")
  })
})

describe('committee create page: field layout', () => {
  it('groups institutional basis with the term dates instead of pairing it with a tall textarea', () => {
    const jsx = createPage.slice(createPage.indexOf('return <Page>'))
    const basisIndex = jsx.indexOf('legalBasis')
    const termStartIndex = jsx.indexOf('termStart')
    const roleTextareaIndex = jsx.indexOf('committeeRole')
    expect(basisIndex).toBeGreaterThan(-1)
    expect(termStartIndex).toBeGreaterThan(basisIndex)
    expect(roleTextareaIndex).toBeGreaterThan(termStartIndex)
  })

  it('pairs the two long-text fields on one full-width row instead of stacking them as separate rows', () => {
    expect(createPage).toContain('committee-manual-textarea-row')
    expect(withoutImportant(modulesCss)).toContain('.committee-create-grid .committee-manual-textarea-row,\n.committee-create-grid .committee-notes-field{\n  grid-column:1 / -1;\n}')
    expect(withoutImportant(modulesCss)).toContain('.committee-create-grid .committee-manual-textarea-row{\n  display:flex;')
  })
})
