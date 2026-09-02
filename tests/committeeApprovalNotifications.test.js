import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('committee minutes approval notifications',()=>{
  it('queues one notification per approval and recipient',()=>{
    const sql=read('supabase/migrations/202609010034_committee_minutes_approval_notification_outbox.sql')
    expect(sql).toContain("'committee_minutes_approval_requested'")
    expect(sql).toContain('unique (notification_type, entity_type, entity_id, recipient_user_id)')
    expect(sql).toContain('trg_queue_committee_minutes_approval_notification')
  })

  it('uses the current committee code, meeting key and approval id in email links',()=>{
    const sql=read('supabase/migrations/202609010038_v0308_committee_minutes_approval_deep_link.sql')
    expect(sql).toContain('m.scheduled_at')
    expect(sql).toContain('c.code')
    expect(sql).toContain('m.client_key')
    expect(sql).toContain("'?meeting='")
    expect(sql).toContain("'&approval='")
    expect(sql).not.toContain("'/meetings/'")
  })

  it('surfaces pending approvals in the notification center data source',()=>{
    const context=read('src/core/notifications/NotificationContext.jsx')
    expect(context).toContain('loadMyPendingCommitteeMinutesApprovalsAsync')
    expect(context).toContain('committeeMinutesApprovals')
    expect(context).toContain('processNotificationOutboxAsync')
  })

  it('deep links an approval to the real committee code and meeting key',()=>{
    const inbox=read('src/features/committees/committeeMinutesApprovalInboxService.js')
    expect(inbox).toContain('id,code,name')
    expect(inbox).toContain('id,client_key,title,scheduled_at,status')
    expect(inbox).toContain('?meeting=')
    expect(inbox).toContain('&approval=')
    expect(inbox).toContain('row.committee.code')
  })

  it('keeps email approval actions inside Limoxis Observer',()=>{
    const template=read('supabase/functions/_shared/committeeApprovalEmail.ts')
    expect(template).toContain('Προβολή πρακτικών')
    expect(template).toContain('η έγκριση ή η απόρριψη ολοκληρώνεται μόνο αφού συνδεθείτε στο Limoxis Observer')
  })
})
