import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('committee approval notification lifecycle',()=>{
  const sql=read('supabase/migrations/202609010041_v0311_committee_approval_outbox_lifecycle.sql')

  it('cancels unsent approval emails when an approval is no longer pending',()=>{
    expect(sql).toContain("new.status in ('approved','rejected','cancelled')")
    expect(sql).toContain("status in ('pending','failed')")
    expect(sql).toContain("set status='cancelled'")
  })

  it('matches the specific approval and recipient',()=>{
    expect(sql).toContain('entity_id=new.id')
    expect(sql).toContain('recipient_user_id=new.approver_id')
  })
})
