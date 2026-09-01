import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('committee membership notification UX',()=>{
  const ui=read('src/core/notifications/NotificationCenter.jsx')

  it('keeps pending membership decisions inside the notification UI',()=>{
    expect(ui).toContain("answerMembership(item,'approved')")
    expect(ui).toContain("answerMembership(item,'rejected')")
    expect(ui).toContain('Συμμετοχή σε επιτροπή — αναμένεται η απόφασή σας')
  })

  it('does not render an open-record arrow for a pending membership notification',()=>{
    const centerBlock=ui.slice(ui.indexOf('export function NotificationCenter'),ui.indexOf('export function BirthdayGreeting'))
    expect(centerBlock).not.toContain('notification-open-record')
  })
})
