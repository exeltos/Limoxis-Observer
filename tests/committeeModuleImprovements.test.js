import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')

const recordPage = read('src/features/committees/CommitteeRecordPage.jsx')
const workflowService = read('src/features/committees/committeeWorkflowService.js')
const listPage = read('src/features/committees/CommitteesPage.jsx')
const createPage = read('src/features/committees/CommitteeCreatePage.jsx')
const modulesCss = read('src/styles/modules.css')
const migration = read('supabase/migrations/20260922110000_committee_secretariat_can_notify.sql')

describe('committee decisions: owner linked to a real account', () => {
  it('persists owner_id (not just free-text owner_label) on create and update', () => {
    expect(workflowService).toContain('owner_id:draft.ownerId||null')
    expect(workflowService).toContain('owner_id:next.ownerId||null')
    expect(workflowService).toContain('ownerId:data.owner_id||null')
  })

  it('lets a manager pick a committee member as owner instead of only free text', () => {
    expect(recordPage).toContain('chooseOwnerMember')
    expect(recordPage).toContain("ownerMode==='manual'")
    expect(recordPage).toContain('member?.userId')
  })

  it('notifies the assigned owner through the shared distribution mechanism when the assignment changes', () => {
    expect(recordPage).toContain('async function notifyDecisionOwner(decision)')
    expect(recordPage).toContain("audienceType:'user',audienceValues:[decision.ownerId]")
    expect(recordPage).toContain('draft.ownerId!==(existing?.ownerId||null)')
  })

  it('notifies committee members with portal accounts when a meeting is scheduled', () => {
    expect(recordPage).toContain('async function notifyUpcomingMeeting(meeting)')
    expect(recordPage).toContain("recipients=activeMembers.map(m=>m.userId).filter(Boolean)")
    expect(recordPage).toContain('await notifyUpcomingMeeting(next)')
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
    expect(modulesCss).toContain('.committee-create-grid .committee-manual-textarea-row,\n.committee-create-grid .committee-notes-field{\n  grid-column:1 / -1!important;\n}')
    expect(modulesCss).toContain('.committee-create-grid .committee-manual-textarea-row{\n  display:flex!important;')
  })
})
