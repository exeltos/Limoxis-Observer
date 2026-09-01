import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('committee minutes revision cycle',()=>{
  const sql=read('supabase/migrations/202609010040_v0310_committee_minutes_revision_cycle.sql')

  it('archives the previous approver decision before a new cycle starts',()=>{
    expect(sql).toContain('committee_minutes_approval_history')
    expect(sql).toContain('archive_previous_committee_minutes_approval')
    expect(sql).toContain('before insert on public.committee_minutes_approvals')
    expect(sql).toContain('delete from public.committee_minutes_approvals where id=v_old.id')
  })

  it('returns rejected minutes to editable draft and cancels the remaining pending decisions',()=>{
    expect(sql).toContain("if new.status='rejected' and old.status='pending'")
    expect(sql).toContain("set status='cancelled'")
    expect(sql).toContain("set status='draft',finalized_at=null,finalized_by=null")
    expect(sql).toContain('Αίτημα διορθώσεων πρακτικών')
  })

  it('keeps the existing client resubmission path reusable',()=>{
    const workflow=read('src/features/committees/committeeWorkflowService.js')
    expect(workflow).toContain('requestMinutesApprovals')
    expect(workflow).toContain("status:'pending'")
    expect(workflow).toContain("approval_pending")
  })
})
