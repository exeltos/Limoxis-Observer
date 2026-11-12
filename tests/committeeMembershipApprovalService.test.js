import { describe,expect,it } from 'vitest'
import path from 'node:path'
import { readSource } from './helpers/readSource'

const source=readSource(path.resolve('src/features/committees/committeeWorkflowService.js'))

describe('committee membership approval service',()=>{
  it('uses the server-governed membership approval RPC',()=>{
    expect(source).toContain('answerCommitteeMembershipAsync')
    expect(source).toContain("supabase.rpc('answer_committee_membership'")
    expect(source).toContain('p_member_id:member.dbId')
    expect(source).toContain('p_status:status')
  })

  it('does not permit arbitrary membership approval states',()=>{
    expect(source).toContain("['approved','rejected'].includes(status)")
    expect(source).toContain('COMMITTEE_MEMBERSHIP_APPROVAL_STATUS_INVALID')
  })

  it('keeps demo membership approval out of the production RPC path',()=>{
    expect(source).toContain('DEMO_COMMITTEE_MEMBERSHIP_APPROVAL_LOCAL_ONLY')
  })
})
