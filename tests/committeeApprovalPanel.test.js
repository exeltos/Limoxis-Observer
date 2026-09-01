import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('committee minutes approval panel',()=>{
  it('shows governed approval progress and user actions',()=>{
    const ui=read('src/features/committees/CommitteeApprovalPanel.jsx')
    expect(ui).toContain('Απαιτείται η απόφασή σας')
    expect(ui).toContain('Αίτημα διορθώσεων')
    expect(ui).toContain('Έγκριση πρακτικών')
    expect(ui).toContain('approverName')
    expect(ui).toContain('item.comment')
  })

  it('requires a correction comment before sending a change request',()=>{
    const ui=read('src/features/committees/CommitteeApprovalPanel.jsx')
    expect(ui).toContain('disabled={busy||!comment.trim()}')
    expect(ui).toContain("onRequestChanges(mine.id,comment.trim())")
  })

  it('keeps decisions immutable at the database boundary',()=>{
    const sql=read('supabase/migrations/202609010037_v0307_committee_minutes_rejection_comment_guard.sql')
    expect(sql).toContain('COMMITTEE_APPROVAL_REJECTION_COMMENT_REQUIRED')
    expect(sql).toContain('COMMITTEE_APPROVAL_ALREADY_DECIDED')
  })
})
