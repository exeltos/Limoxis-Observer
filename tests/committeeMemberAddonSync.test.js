import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('committee member access synchronization',()=>{
  const sql=read('supabase/migrations/202609010042_v0312_committee_member_addon_sync.sql')

  it('grants committee_member access for an active accepted or non-approval membership',()=>{
    expect(sql).toContain("approval_status in ('approved','not_required')")
    expect(sql).toContain("values(v_membership_id,'committee_member',null)")
  })

  it('removes only system-derived access when no qualifying committee membership remains',()=>{
    expect(sql).toContain("capability='committee_member'")
    expect(sql).toContain('granted_by is null')
  })

  it('preserves manually granted add-ons via conflict-safe synchronization',()=>{
    expect(sql).toContain('on conflict (membership_id,capability) do nothing')
  })
})
