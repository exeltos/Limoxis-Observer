import { describe,expect,it } from 'vitest'
import { readSource } from './helpers/readSource'

const read=path=>readSource(new URL(`../${path}`,import.meta.url))

describe('committee membership notification UX',()=>{
  const ui=read('src/core/notifications/NotificationCenter.jsx')

  it('keeps pending membership decisions inside the notification UI',()=>{
    expect(ui).toContain("answer(item,'approved')")
    expect(ui).toContain("answer(item,'rejected')")
  })

  it('does not render an open-record arrow for a pending membership notification',()=>{
    const centerBlock=ui.slice(ui.indexOf('export function NotificationCenter'),ui.indexOf('export function BirthdayGreeting'))
    expect(centerBlock).not.toContain('notification-open-record')
  })
})
