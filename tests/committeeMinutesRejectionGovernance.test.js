import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('committee minutes rejection governance',()=>{
  it('requires a meaningful comment for rejection at the database boundary',()=>{
    const sql=read('supabase/migrations/202609010037_v0307_committee_minutes_rejection_comment_guard.sql')
    expect(sql).toContain("new.status = 'rejected'")
    expect(sql).toContain('COMMITTEE_APPROVAL_REJECTION_COMMENT_REQUIRED')
    expect(sql).toContain('trg_guard_committee_minutes_approval_decision')
  })

  it('prevents changing an approval after it has already been decided',()=>{
    const sql=read('supabase/migrations/202609010037_v0307_committee_minutes_rejection_comment_guard.sql')
    expect(sql).toContain("old.status <> 'pending'")
    expect(sql).toContain('COMMITTEE_APPROVAL_ALREADY_DECIDED')
  })
})
