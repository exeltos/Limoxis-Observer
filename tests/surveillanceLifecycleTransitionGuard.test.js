import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const migration=fs.readFileSync(new URL('../supabase/migrations/20260902224500_surveillance_lifecycle_transition_guard.sql',import.meta.url),'utf8')

describe('surveillance lifecycle transition guard',()=>{
 it('uses separate close and reopen capabilities',()=>{
  expect(migration).toContain("'close_surveillance'")
  expect(migration).toContain("'reopen_surveillance'")
  expect(migration).toContain('before update on public.surveillance_cases')
 })
 it('protects lifecycle metadata',()=>{
  expect(migration).toContain('new.closed_at is distinct from old.closed_at')
  expect(migration).toContain('new.closed_by is distinct from old.closed_by')
  expect(migration).toContain('new.close_reason is distinct from old.close_reason')
 })
 it('normalizes lifecycle audit metadata',()=>{
  expect(migration).toContain('new.closed_by := auth.uid()')
  expect(migration).toContain('new.closed_at := coalesce(new.closed_at,now())')
  expect(migration).toContain('new.close_reason := null')
 })
})
