// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { DemoClosedScreen, DemoEvaluationBar } from '../src/app/DemoEvaluationBar'

const read = path => fs.readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20261012120000_demo_roles_owner_demo_access.sql')
const tenantService = read('src/core/tenant/tenantService.js')
const tenantContext = read('src/core/tenant/TenantContext.jsx')
const authContext = read('src/core/auth/AuthContext.jsx')
const center = read('src/features/workspaces/PlatformCenterPage.jsx')
const acceptInvitation = read('supabase/functions/accept-account-invitation/index.ts')

afterEach(() => cleanup())

describe('Demo data pack: prevention', () => {
  it('adds waste, antiseptic consumption and care bundle audits, and the orchestrator calls it', () => {
    for (const table of ['waste_measurements', 'antiseptic_consumption_periods', 'prevention_bundle_assessments']) expect(migration).toContain(`insert into public.${table}(`)
    expect(migration).toContain('perform private.demo_seed_prevention(v_org, p_actor);')
    expect(migration).toContain("'bundleAudits'")
  })
  it('never stores a query result with SELECT ... INTO', () => {
    const body = migration.replace(/--[^\n]*/g, '')
    expect(body).not.toMatch(/\bselect\b[^;]*\binto\b(?!\s+public\.)/i)
    expect(body).not.toMatch(/\b(execute|returning)\b[^;]*\binto\b(?!\s+public\.)/i)
  })
})

describe("The Platform Owner's Demo", () => {
  it('is a real Demo organization filled with the same data pack, Platform Owner only', () => {
    expect(migration).toMatch(/create or replace function public\.platform_open_owner_demo\(\)[\s\S]*Platform Owner access required[\s\S]*'DEMO-OWNER'[\s\S]*private\.demo_seed_data\(v_org, auth\.uid\(\)\)/)
    expect(tenantService).toContain("supabase.rpc('platform_open_owner_demo')")
    expect(tenantContext).toContain('return enterDemoOrganization(await openPlatformOwnerDemo())')
  })
  it('keeps the browser-only sample hospital only for the Help preview', () => {
    expect(tenantContext).toContain('if (isOwnerPreview()) return enterSampleDemo()')
  })
  it('"Enter" on an evaluator\'s Demo opens that Demo organization', () => {
    expect(center).toContain('await enterDemoOrganization(demo?.organization_id)')
    expect(tenantService).toMatch(/getPlatformOwnerDemoMembership[\s\S]*\.eq\('is_demo', true\)/)
  })
  it('lets users of a real Demo organization look at the application as another role', () => {
    expect(tenantContext).toContain('const canRolePreview = Boolean(profile?.isPlatformOwner || isDemoSession || realDemoTenant)')
  })
})

describe('Demo access enforcement', () => {
  it('puts members on hold when the organization is paused or the Demo is closed, and lifts only that hold', () => {
    expect(migration).toContain("update public.organization_members om set status = 'disabled', access_hold = 'access_closed'")
    expect(migration).toContain("update public.organization_members om set status = 'active', access_hold = null\n    where om.organization_id = p_organization_id and om.access_hold is not null;")
    expect(migration).toMatch(/e\.status = 'active' and current_date between e\.valid_from and e\.valid_until/)
    expect(migration).toContain('after insert or update of status, valid_from, valid_until on public.platform_demo_entitlements')
    expect(migration).toContain('after update of status on public.organizations')
    expect(migration).toContain("cron.schedule('limoxis-org-access', '7 * * * *', 'select private.apply_all_org_access()')")
  })
  it('never puts a Platform Owner on hold', () => {
    expect(migration).toMatch(/access_hold is null\s+and not exists \(select 1 from public\.profiles p where p\.id = om\.user_id and coalesce\(p\.is_platform_owner, false\)\)/)
  })
  it('evaluators read their Demo state through current_demo_access, never the entitlements table', () => {
    expect(authContext).not.toContain("from('platform_demo_entitlements')")
    expect(authContext).toContain('demoAccess=await loadCurrentDemoAccess()')
    expect(tenantService).toContain("supabase.rpc('current_demo_access')")
  })
  it('refuses to activate an invitation into a paused organization or a closed Demo', () => {
    expect(acceptInvitation).toContain("code:'DEMO_CLOSED'")
    expect(acceptInvitation).toContain("code:'ORGANIZATION_PAUSED'")
  })
})

describe('Demo bar and "Demo ended" screen', () => {
  it('shows the days left and opens the role preview', () => {
    const onPreviewRoles = vi.fn()
    render(<DemoEvaluationBar tenant={{ name: 'Γενικό Νοσοκομείο Demo' }} access={{ daysLeft: 9, validUntil: '2026-10-22' }} isPlatformOwner={false} language="el" onPreviewRoles={onPreviewRoles} onExit={vi.fn()}/>)
    expect(screen.getByText('Γενικό Νοσοκομείο Demo')).toBeInTheDocument()
    expect(screen.getByText(/απομένουν 9 ημέρες · έως 22\/10\/2026/)).toBeInTheDocument()
    expect(screen.queryByText('Έξοδος από Demo')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Δείτε την εφαρμογή ως άλλος ρόλος'))
    expect(onPreviewRoles).toHaveBeenCalled()
  })
  it('gives the Platform Owner a way out of their Demo', () => {
    const onExit = vi.fn()
    render(<DemoEvaluationBar tenant={{ name: 'Demo' }} access={null} isPlatformOwner language="el" onPreviewRoles={vi.fn()} onExit={onExit}/>)
    fireEvent.click(screen.getByText('Έξοδος από Demo'))
    expect(onExit).toHaveBeenCalled()
  })
  it('tells an evaluator the Demo has ended or is paused', () => {
    const { rerender } = render(<DemoClosedScreen access={{ status: 'active', validUntil: '2026-10-01', open: false }} language="el" onLogout={vi.fn()}/>)
    expect(screen.getByRole('heading', { name: 'Το Demo έληξε' })).toBeInTheDocument()
    rerender(<DemoClosedScreen access={{ status: 'paused', open: false }} language="el" onLogout={vi.fn()}/>)
    expect(screen.getByRole('heading', { name: 'Το Demo είναι σε παύση' })).toBeInTheDocument()
  })
})
