import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'
// Only the declarations matter here, not whether they carry !important.
const withoutImportant = css => css.replaceAll('!important', '')


const read = (path) => readSource(path)

const workflowService = read('src/features/committees/committeeWorkflowService.js')
const listPage = read('src/features/committees/CommitteesPage.jsx')
const createPage = read('src/features/committees/CommitteeCreatePage.jsx')
// Οι κανόνες της φόρμας επιτροπής φορτώνονται με τις σελίδες της ενότητας.
const modulesCss = read('src/features/committees/committeesScreens.css')
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
  it('keeps the overdue actions as a filter of the list', () => {
    expect(listPage).toContain('overdueOnly')
    expect(listPage).toContain('isOverdue')
    expect(listPage).toContain("setOverdueOnly(value==='overdue')")
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
