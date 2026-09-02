import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('committee approval deep-link route',()=>{
  it('builds email links with committee code, meeting key and approval id',()=>{
    const sql=read('supabase/migrations/202609010038_v0308_committee_minutes_approval_deep_link.sql')
    expect(sql).toContain('c.code')
    expect(sql).toContain('m.client_key')
    expect(sql).toContain("'?meeting='")
    expect(sql).toContain("'&approval='")
  })

  it('lets authenticated approvers reach their approval without broad committee capability',()=>{
    const route=read('src/features/committees/CommitteeRecordPageRoute.jsx')
    const app=read('src/app/App.jsx')
    expect(route).toContain('if(!canViewCommittee&&!approvalId)return <Navigate')
    expect(route).toContain('loadCommitteeApprovalDeepLinkAsync')
    expect(app).toContain('<CommitteeRecordPageRoute />')
    expect(app).not.toContain('gate(CAPABILITIES.VIEW_COMMITTEES, <CommitteeRecordPageRoute />)')
  })

  it('verifies the approval belongs to the current user before loading it',()=>{
    const service=read('src/features/committees/committeeApprovalDeepLinkService.js')
    expect(service).toContain(".eq('approver_id',userId)")
    expect(service).toContain(".eq('id',approvalId)")
    expect(service).toContain('decideCommitteeApprovalDeepLinkAsync')
  })

  it('uses the governed approval panel for approve and correction-request actions',()=>{
    const route=read('src/features/committees/CommitteeRecordPageRoute.jsx')
    expect(route).toContain('<CommitteeApprovalPanel')
    expect(route).toContain("decide('approved','')")
    expect(route).toContain("decide('rejected',comment)")
  })
})
