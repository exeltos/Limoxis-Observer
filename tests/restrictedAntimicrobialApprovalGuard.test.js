import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { demoLibrarySeed } from '../src/features/management/managementData'

const migration = fs.readFileSync('supabase/migrations/20261024120000_restricted_antimicrobial_approval_guard.sql', 'utf8')
const functionBody = migration.slice(migration.indexOf('create or replace function public.enforce_restricted_antimicrobial_approval'))
const defaultList = [...functionBody.slice(functionBody.indexOf('array['), functionBody.indexOf(']);')).matchAll(/'([^']+)'/g)].map(m => m[1])

describe('restricted antimicrobial approval is enforced by the database', () => {
  it('the database default list is the application\'s restricted list, in both languages', () => {
    const appList = demoLibrarySeed.advancedAntibiotics.flatMap(([el, en]) => [el.toLowerCase(), en.toLowerCase()])
    expect([...defaultList].sort()).toEqual([...appList].sort())
  })

  it('applies to API requests only, so trusted server code keeps the status it writes', () => {
    expect(functionBody).toContain('security invoker')
    expect(functionBody).toContain("if current_user not in ('authenticated', 'anon')")
  })

  it('uses the organization\'s own restricted library when it has one', () => {
    expect(functionBody).toContain("library_key = 'advancedAntibiotics' and is_active")
  })

  it('a restricted therapy becomes pending on insert, on a change of medicine and instead of not_required', () => {
    expect(functionBody).toMatch(/tg_op = 'INSERT'\s+or new\.antimicrobial is distinct from old\.antimicrobial\s+or new\.approval_status = 'not_required' then\s+new\.approval_status := 'pending';/)
    expect(migration).toContain('before insert or update of antimicrobial, approval_status on public.antimicrobial_therapies')
  })

  it('the trigger function cannot be called through the API', () => {
    expect(migration).toContain('revoke execute on function public.enforce_restricted_antimicrobial_approval() from public, anon, authenticated;')
  })
})
