import { describe,it,expect } from 'vitest'
import fs from 'node:fs'

const service=fs.readFileSync('src/features/management/announcementCloudService.js','utf8')
const panel=fs.readFileSync('src/features/management/AnnouncementsPanel.jsx','utf8')
const context=fs.readFileSync('src/core/notifications/NotificationContext.jsx','utf8')
const center=fs.readFileSync('src/core/notifications/NotificationCenter.jsx','utf8')
const migration=fs.readFileSync('supabase/migrations/202609020106_management_announcements_governance.sql','utf8')

describe('Management Center announcement persistence',()=>{
 it('persists announcements and acknowledgements in governed cloud tables',()=>{
  expect(service).toContain("from('management_announcements')")
  expect(service).toContain("from('management_announcement_acknowledgements')")
  expect(service).toContain('createAnnouncement')
  expect(service).toContain('updateAnnouncement')
  expect(service).toContain('removeAnnouncement')
  expect(service).toContain('acknowledgeAnnouncement')
  expect(service).toContain('loadMyAnnouncementAcknowledgements')
 })

 it('uses real tenant members and profiles for production recipients',()=>{
  expect(service).toContain("from('organization_members')")
  expect(service).toContain("from('profiles')")
  expect(service).toContain("eq('organization_id',organizationId)")
  expect(panel).toContain('loadAnnouncementUsers(tenant.id)')
  expect(panel).toContain('loadDepartments(tenant.id)')
  expect(panel).toContain('loadAnnouncements(tenant.id)')
 })

 it('keeps demo announcement data isolated while production uses cloud CRUD',()=>{
  expect(panel).toContain('if(isDemo)')
  expect(panel).toContain('createAnnouncement(tenant.id,payload)')
  expect(panel).toContain('updateAnnouncement(tenant.id,payload)')
  expect(panel).toContain('removeAnnouncement(tenant.id,a.id)')
  expect(context).toContain("if(!isDemo)return")
  expect(context).toContain('loadAnnouncements(tenant.id)')
 })

 it('enforces targeted RLS and audits announcement changes',()=>{
  expect(migration).toContain('management_announcements_read_targeted')
  expect(migration).toContain("audience_type='user'")
  expect(migration).toContain("audience_type='role'")
  expect(migration).toContain("audience_type='department'")
  expect(migration).toContain('organization_member_scopes')
  expect(migration).toContain('revoke all on public.management_announcements from anon')
  expect(migration).toContain('trg_audit_management_announcements')
  expect(migration).toContain('private.audit_management_change()')
 })

 it('requires persistent acknowledgement and prevents mark-all bypass',()=>{
  expect(context).toContain('loadMyAnnouncementAcknowledgements')
  expect(context).toContain('acknowledgeAnnouncementCloud')
  expect(context).toContain("x.type==='announcement'&&x.requiresAck&&!x.acknowledged")
  expect(context).toContain('if(requiredAckIds.has(id))return')
  expect(center).toContain("acknowledge:'Έλαβα γνώση'")
  expect(center).toContain('n.acknowledgeAnnouncement(item.id)')
 })
})
