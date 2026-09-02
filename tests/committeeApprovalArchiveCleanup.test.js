import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('committee approval archive cleanup',()=>{
  const sql=read('supabase/migrations/202609010043_v0313_committee_approval_archive_outbox_cleanup.sql')

  it('cancels stale unsent notification work when an approval is replaced',()=>{
    expect(sql).toContain("status in ('pending','failed')")
    expect(sql).toContain("set status='cancelled'")
    expect(sql).toContain('entity_id=v_old.id')
  })

  it('archives the old decision before deleting the active approval row',()=>{
    expect(sql.indexOf('insert into public.committee_minutes_approval_history')).toBeLessThan(sql.indexOf('delete from public.committee_minutes_approvals'))
  })
})
