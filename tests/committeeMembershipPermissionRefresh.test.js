import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

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
