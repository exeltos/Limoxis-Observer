import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('committee approval audit history',()=>{
  it('allows authorized committee viewers to read archived approval cycles',()=>{
    const sql=read('supabase/migrations/202609010044_v0314_committee_approval_history_visibility.sql')
    expect(sql).toContain('current_user_can_view_committee')
    expect(sql).toContain('grant select')
  })

  it('loads archived approval decisions separately from the active cycle',()=>{
    const service=read('src/features/committees/committeeService.js')
    expect(service).toContain("selectRows('committee_minutes_approval_history'")
    expect(service).toContain('approvalHistory:h.map(mapApproval)')
    expect(service).toContain('approvals:p.map(mapApproval)')
  })
})
