import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import { userFacingError } from '../src/core/feedback/userFacingError.js'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('committee member account resolution',()=>{
  const sql=read('supabase/migrations/202609010045_v0315_committee_member_account_resolution.sql')

  it('resolves only one active organization account by exact employee email',()=>{
    expect(sql).toContain("om.status='active'")
    expect(sql).toContain('count(distinct om.user_id)')
    expect(sql).toContain('if v_count=1 then return v_user_id')
  })

  it('blocks participation approval when no unique account can be linked',()=>{
    expect(sql).toContain('COMMITTEE_MEMBER_ACCOUNT_REQUIRED_FOR_PARTICIPATION_APPROVAL')
    const message=userFacingError(new Error('COMMITTEE_MEMBER_ACCOUNT_REQUIRED_FOR_PARTICIPATION_APPROVAL'),{language:'el',context:'save'})
    expect(message).toContain('λογαριασμό')
    expect(message).not.toContain('Supabase')
  })
})
