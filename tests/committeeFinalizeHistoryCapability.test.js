import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('committee finalize history capability',()=>{
  it('allows a finalize-capable custom role to append the governed submission history event',()=>{
    const sql=read('supabase/migrations/202609020002_v0317_committee_history_finalize_capability.sql')
    expect(sql).toContain("'finalize_committee_minutes'")
    expect(sql).toContain('committee_history_append')
  })
})
