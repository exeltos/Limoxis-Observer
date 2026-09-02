import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const governanceSql=fs.readFileSync(path.resolve('supabase/migrations/202609012245_v0304_committee_meeting_cancellation_governance.sql'),'utf8')
const rpcSql=fs.readFileSync(path.resolve('supabase/migrations/202609012255_v0305_committee_meeting_cancel_rpc.sql'),'utf8')
const service=fs.readFileSync(path.resolve('src/features/committees/committeeMeetingLifecycleService.js'),'utf8')
const feedback=fs.readFileSync(path.resolve('src/core/feedback/userFacingError.js'),'utf8')

describe('committee meeting cancellation governance',()=>{
  it('requires a reason and prevents reopening a cancelled meeting',()=>{
    expect(governanceSql).toContain('COMMITTEE_MEETING_CANCELLATION_REASON_REQUIRED')
    expect(governanceSql).toContain('COMMITTEE_MEETING_CANCELLED_IMMUTABLE')
    expect(governanceSql).toContain("old.status not in ('draft','planned','in_progress')")
  })

  it('records cancellation actor and timestamp',()=>{
    expect(governanceSql).toContain('new.cancelled_at := coalesce(new.cancelled_at, now())')
    expect(governanceSql).toContain('new.cancelled_by := coalesce(new.cancelled_by, auth.uid())')
  })

  it('uses one transactional RPC for cancellation and history',()=>{
    expect(rpcSql).toContain('create or replace function public.cancel_committee_meeting')
    expect(rpcSql).toContain("action,reason,event_data")
    expect(rpcSql).toContain("'Ακύρωση συνεδρίασης'")
    expect(service).toContain("supabase.rpc('cancel_committee_meeting'")
    expect(service).not.toContain("from('committee_history').insert")
  })

  it('does not expose the cancel RPC to anonymous callers',()=>{
    expect(rpcSql).toContain('revoke all on function public.cancel_committee_meeting(uuid,text) from public, anon')
    expect(rpcSql).toContain('grant execute on function public.cancel_committee_meeting(uuid,text) to authenticated, service_role')
  })

  it('maps cancellation failures to human-facing feedback',()=>{
    expect(feedback).toContain('committee_meeting_cancellation_reason_required')
    expect(feedback).toContain('committee_meeting_cancellation_not_allowed')
    expect(feedback).toContain('committee_meeting_cancelled_immutable')
  })
})
