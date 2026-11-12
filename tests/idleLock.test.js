import { describe,expect,it } from 'vitest'
import { DEFAULT_IDLE_LOCK_MINUTES,idleLockMinutesFor } from '../src/app/IdleLock'

describe('idle lock minutes',()=>{
 it('uses the organization setting, always 5–30 minutes (never off)',()=>{
  expect(idleLockMinutesFor({idle_lock_minutes:30},false)).toBe(30)
  expect(idleLockMinutesFor({idle_lock_minutes:0},false)).toBe(30)
  expect(idleLockMinutesFor({idle_lock_minutes:60},false)).toBe(30)
  expect(idleLockMinutesFor({idle_lock_minutes:2},false)).toBe(5)
 })
 it('falls back to the default before the column is loaded',()=>{
  expect(idleLockMinutesFor({},false)).toBe(DEFAULT_IDLE_LOCK_MINUTES)
  expect(idleLockMinutesFor(null,false)).toBe(DEFAULT_IDLE_LOCK_MINUTES)
 })
})

describe('idle lock · Platform Owner', () => {
  it('always locks the owner, after 10 minutes at most', async () => {
    const { ownerIdleLockMinutes } = await import('../src/app/IdleLock')
    expect([0, null, 5, 10, 15, 60].map(ownerIdleLockMinutes)).toEqual([10, 10, 5, 10, 10, 10])
  })
})
