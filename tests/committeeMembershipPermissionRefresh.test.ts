import { describe,expect,it } from 'vitest'
import { readSource } from './helpers/readSource'

const read=path=>readSource(new URL(`../${path}`,import.meta.url))

describe('committee membership permission refresh',()=>{
  it('refreshes tenant permissions immediately after a membership decision',()=>{
    const context=read('src/core/notifications/NotificationContext.jsx')
    expect(context).toContain('reloadMemberships')
    expect(context).toContain('Promise.all([reloadCommitteeMemberships(),reloadMemberships()])')
  })

  it('keeps committee membership links on the public committee code route',()=>{
    const service=read('src/features/committees/committeeMembershipService.js')
    expect(service).toContain('committeeId:row.committee?.code||null')
  })
})
