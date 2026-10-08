import { describe,expect,it } from 'vitest'
import { DEFAULT_IDLE_LOCK_MINUTES,idleLockMinutesFor } from '../src/app/IdleLock'

describe('idle lock minutes',()=>{
 it('uses the organization setting, with 0 meaning never',()=>{
  expect(idleLockMinutesFor({idle_lock_minutes:30},false)).toBe(30)
  expect(idleLockMinutesFor({idle_lock_minutes:0},false)).toBe(0)
 })
 it('falls back to the default before the column is loaded',()=>{
  expect(idleLockMinutesFor({},false)).toBe(DEFAULT_IDLE_LOCK_MINUTES)
  expect(idleLockMinutesFor(null,false)).toBe(DEFAULT_IDLE_LOCK_MINUTES)
 })
})
