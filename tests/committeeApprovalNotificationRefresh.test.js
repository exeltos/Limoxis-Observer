import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('committee approval notification refresh',()=>{
  it('exposes an explicit minutes approval refresh action',()=>{
    const context=read('src/core/notifications/NotificationContext.jsx')
    expect(context).toContain('reloadCommitteeMinutesApprovals')
  })

  it('refreshes the bell immediately after an approval decision',()=>{
    const route=read('src/features/committees/CommitteeRecordPageRoute.jsx')
    expect(route).toContain('useNotifications')
    expect(route).toContain('Promise.all([load(),reloadCommitteeMinutesApprovals()])')
    expect(route).toContain('deciding')
  })
})
