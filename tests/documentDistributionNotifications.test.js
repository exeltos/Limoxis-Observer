import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const migration = read('supabase/migrations/20260922090000_document_distribution_notifications.sql')
const announcementService = read('src/features/management/announcementCloudService.js')
const notificationContext = read('src/core/notifications/NotificationContext.jsx')
const recordPage = read('src/features/documents/DocumentRecordPage.jsx')
const listPage = read('src/features/documents/DocumentsPage.jsx')

describe('controlled document distribution & acknowledgement', () => {
  it('lets a distribution notice deep-link back to its document', () => {
    expect(migration).toContain('add column if not exists link_path text')
    expect(announcementService).toContain('link_path:item.linkPath||null')
    expect(announcementService).toContain('linkPath:row.link_path')
    expect(announcementService).toContain('loadAnnouncementByLinkPath')
    expect(notificationContext).toContain("to:a.linkPath||'/'")
  })

  it('widens document manager RLS instead of narrowing self-read', () => {
    expect(migration).toContain("'quality_manager'::app_role")
    expect(migration).toContain('management_announcements_insert')
    expect(migration).toContain('management_announcement_ack_manager_read')
    expect(migration.toLowerCase()).toContain('this only widens visibility')
  })

  it('lets managers see who has acknowledged a distribution', () => {
    expect(announcementService).toContain('loadAnnouncementAcknowledgers')
    expect(announcementService).toContain("from('management_announcement_acknowledgements')")
  })

  it('gates distribution on the published lifecycle state and manage/publish capability', () => {
    expect(recordPage).toContain("record.status !== 'published'")
    expect(recordPage).toContain('canManage || canPublish')
    expect(recordPage).toContain('requiresAck: true')
    expect(recordPage).toContain("linkPath = `/documents/${record.id}`")
  })

  it('derives distribution audience from the document department, not a new picker', () => {
    expect(recordPage).toContain("record.departmentId ? 'department' : 'all'")
    expect(recordPage).toContain('audienceValues = record.departmentId ? [record.departmentId] : []')
  })

  it('keeps demo mode local while production persists through the cloud service', () => {
    expect(recordPage).toContain('n.addAnnouncement(payload)')
    expect(recordPage).toContain('createAnnouncement(organizationId, payload)')
    expect(recordPage).toContain('n.reloadAnnouncements()')
  })

  it('adds a Distribution tab alongside the existing overview/files/history tabs', () => {
    expect(recordPage).toContain("{ id: 'distribution', label: en ? 'Distribution' : 'Κοινοποίηση', icon: Send }")
  })
})

describe('documents list: review-due filter and sortable columns', () => {
  it('makes the review-due metric toggle a dedicated filter instead of only counting', () => {
    expect(listPage).toContain('reviewDueOnly')
    expect(listPage).toContain('setReviewDueOnly(v=>!v)')
    expect(listPage).toContain('!reviewDueOnly||isReviewDue(family)')
  })

  it('clears the review-due filter alongside the other quick filters', () => {
    expect(listPage).toContain('setReviewDueOnly(false)')
    expect(listPage).toContain('(reviewDueOnly?1:0)')
  })

  it('sorts every column, including version by semantic comparison', () => {
    expect(listPage).toContain('toggleSort')
    expect(listPage).toContain('sortIndicator')
    expect(listPage).toContain("sort.key==='version'")
    expect(listPage).toContain('compareDocumentVersions(a.current,b.current)')
  })
})
