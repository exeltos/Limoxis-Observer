// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { DemoEvaluationBar } from '../src/app/DemoEvaluationBar'
import { readSource } from './helpers/readSource'
import type { DemoAccess } from '../src/core/auth/authTypes'

const read = path => readSource(path)
const migration = read('supabase/migrations/20261231400000_demo_reset_by_evaluator.sql')
const tenantService = read('src/core/tenant/tenantService.js')
const shell = read('src/app/AppShell.jsx')

afterEach(() => cleanup())

describe('Demo: the evaluator resets their own Demo', () => {
  it('the database allows it only for an active member of an active Demo', () => {
    expect(migration).toContain('create or replace function public.demo_reset_my_organization(p_organization_id uuid)')
    expect(migration).toContain('auth.uid() is null')
    expect(migration).toContain('o.id = p_organization_id and o.is_demo')
    expect(migration).toContain("om.user_id = auth.uid() and om.status = 'active'")
    expect(migration).toContain('e.valid_until < current_date')
    expect(migration).toContain('perform private.demo_wipe_data(p_organization_id);')
    expect(migration).toContain('private.demo_seed_data(p_organization_id, auth.uid())')
    expect(migration).toContain('revoke all on function public.demo_reset_my_organization(uuid) from public, anon;')
  })
  it('the self-membership guard steps aside only inside a Demo reset', () => {
    expect(migration).toContain("current_setting('limoxis.test_reset', true), '') = 'on'")
    expect(migration).toContain('o.id = target_organization_id and o.is_demo')
    expect(migration).toContain("raise exception 'SELF_PRIVILEGE_CHANGE_FORBIDDEN'")
  })
  it('the client calls the RPC and the shell offers it to evaluators, not to the Owner', () => {
    expect(tenantService).toContain("supabase.rpc('demo_reset_my_organization', { p_organization_id: organizationId })")
    expect(shell).toContain('onResetData={isPlatformOwner?null:()=>void handleResetDemoData()}')
    expect(shell).toContain('danger:true')
  })
  it('the Demo line shows «Επαναφορά δεδομένων» and calls back', () => {
    const onResetData = vi.fn()
    render(<DemoEvaluationBar tenant={{ name: 'Demo' }} access={{ daysLeft: 10 } as DemoAccess} language="el" onResetData={onResetData}/>)
    fireEvent.click(screen.getByRole('button', { name: /Επαναφορά δεδομένων/ }))
    expect(onResetData).toHaveBeenCalledTimes(1)
  })
  it('has no reset button when no handler is given', () => {
    render(<DemoEvaluationBar tenant={{ name: 'Demo' }} access={{ daysLeft: 10 } as DemoAccess} language="en" isPlatformOwner/>)
    expect(screen.queryByRole('button', { name: /Reset data/ })).toBeNull()
  })
})
