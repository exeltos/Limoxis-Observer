import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('committee approval briefing',()=>{
  const ui=read('src/core/notifications/NotificationCenter.jsx')

  it('counts minutes approvals in total attention',()=>{
    expect(ui).toContain('minutesApprovals.length')
    expect(ui).toContain('committeeMinutesApprovals')
  })

  it('links pending minutes approval work directly from the briefing',()=>{
    expect(ui).toContain("Πρακτικά επιτροπής — αναμένεται η έγκρισή σας")
    expect(ui).toContain('navigate(item.to)')
  })
})
