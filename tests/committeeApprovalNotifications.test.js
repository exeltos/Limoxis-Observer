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

  it('uses the real committee route and scheduled timestamp',()=>{
    const sql=read('supabase/migrations/202609010035_fix_committee_minutes_approval_notification_route.sql')
    expect(sql).toContain('m.scheduled_at')
    expect(sql).toContain("'path', '/committees/' || new.committee_id::text")
    expect(sql).not.toContain("'/meetings/'")
  })

  it('surfaces pending approvals in the notification center data source',()=>{
    const context=read('src/core/notifications/NotificationContext.jsx')
    expect(context).toContain('loadMyPendingCommitteeMinutesApprovalsAsync')
    expect(context).toContain('committeeMinutesApprovals')
    expect(context).toContain('processNotificationOutboxAsync')
  })

  it('keeps email approval actions inside Limoxis Observer',()=>{
    const template=read('supabase/functions/_shared/committeeApprovalEmail.ts')
    expect(template).toContain('Προβολή πρακτικών')
    expect(template).toContain('η έγκριση ή η απόρριψη ολοκληρώνεται μόνο αφού συνδεθείτε στο Limoxis Observer')
  })
})
