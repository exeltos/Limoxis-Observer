import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('transactional committee minutes submission',()=>{
  const sql=read('supabase/migrations/202609020001_v0316_committee_minutes_transactional_submission.sql')
  const workflow=read('src/features/committees/committeeWorkflowService.js')

  it('moves approval creation and meeting status transition into one database transaction',()=>{
    expect(sql).toContain('submit_committee_minutes_for_approval')
    expect(sql).toContain('insert into public.committee_minutes_approvals')
    expect(sql).toContain("set status='approval_pending'")
    expect(sql).toContain('insert into public.committee_history')
  })

  it('fails closed when a present voting member has no linked account',()=>{
    expect(sql).toContain('COMMITTEE_MINUTES_APPROVER_ACCOUNT_REQUIRED')
    expect(sql).toContain("a.attendance_status='present'")
    expect(sql).toContain('m.user_id is null')
  })

  it('deduplicates approvals by user account',()=>{
    expect(sql).toContain('distinct on (m.user_id)')
  })

  it('uses only the governed RPC for production submission',()=>{
    expect(workflow).toContain("supabase.rpc('submit_committee_minutes_for_approval'")
    expect(workflow).not.toContain('requestMinutesApprovals')
  })

  it('kicks notification delivery immediately without making email delivery part of the approval transaction',()=>{
    expect(workflow).toContain("supabase.functions.invoke('process-notification-outbox'")
    expect(workflow).toContain('.catch(()=>{})')
  })
})
