import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const migrationPath=path.resolve('supabase/migrations/202609010030_v0294_committee_workflow_alignment.sql')
const sql=fs.readFileSync(migrationPath,'utf8')

describe('committee governance migration',()=>{
  it('persists stable workflow keys and member identity linkage',()=>{
    expect(sql).toContain('committee_members_committee_client_key_uq')
    expect(sql).toContain('committee_meetings_committee_client_key_uq')
    expect(sql).toContain('committee_attendance_meeting_client_key_uq')
    expect(sql).toContain('committee_decisions_committee_client_key_uq')
    expect(sql).toContain('committee_plan_items_committee_client_key_uq')
    expect(sql).toContain('user_id uuid references auth.users')
  })

  it('keeps membership approval server-governed',()=>{
    expect(sql).toContain('answer_committee_membership')
    expect(sql).toContain("user_id=auth.uid()")
    expect(sql).toContain("approval_status='pending'")
    expect(sql).toContain('revoke all on function public.answer_committee_membership(uuid,text) from public,anon')
    expect(sql).toContain('grant execute on function public.answer_committee_membership(uuid,text) to authenticated')
  })

  it('auto-finalizes minutes only after required approvals are complete',()=>{
    expect(sql).toContain('finalize_committee_meeting_after_approvals')
    expect(sql).toContain("status='finalized'")
    expect(sql).toContain('finalized_by=coalesce(finalized_by,new.approver_id)')
  })

  it('adds restrictive authorization guards for committee attachments and storage objects',()=>{
    expect(sql).toContain('attachments_committee_read_guard')
    expect(sql).toContain('attachments_committee_insert_guard')
    expect(sql).toContain('attachments_committee_update_guard')
    expect(sql).toContain('attachments_storage_committee_read_guard')
    expect(sql).toContain('attachments_storage_committee_insert_guard')
    expect(sql).toContain('attachments_storage_committee_delete_guard')
    expect(sql.match(/as restrictive/g)?.length).toBeGreaterThanOrEqual(6)
  })
})
