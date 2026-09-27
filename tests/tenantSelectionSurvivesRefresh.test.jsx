// @vitest-environment jsdom
// A page refresh must keep the user where they were: the organization chosen in
// this tab (and a Platform Owner's demo mode or role preview) is restored from
// sessionStorage instead of falling back to the first organization / the
// Platform Center.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'

const auth = vi.hoisted(() => ({ value: null }))
vi.mock('../src/core/auth/AuthContext', () => ({ useAuth: () => auth.value }))
vi.mock('../src/core/data/dataEnvironment', () => ({ configureDataEnvironment: () => {} }))
const orgs = [
  { id: 'm-1', role: 'hospital_admin', status: 'active', organization: { id: 'org-1', name: 'Alpha' } },
  { id: 'm-2', role: 'hospital_admin', status: 'active', organization: { id: 'org-2', name: 'Beta' } },
]
vi.mock('../src/core/tenant/tenantService', () => ({ listMemberships: async () => orgs, listPlatformOwnerOrganizations: async () => orgs }))
const { TenantProvider, useTenant } = await import('../src/core/tenant/TenantContext')

const owner = { user: { id: 'owner-1' }, profile: { id: 'owner-1', isPlatformOwner: true }, isAuthenticated: true, isDemoSession: false, loading: false }
const member = { user: { id: 'user-1' }, profile: { id: 'user-1', isPlatformOwner: false }, isAuthenticated: true, isDemoSession: false, loading: false }

function mount() {
  const ref = { current: null }
  function Probe() { ref.current = useTenant(); return null }
  render(<TenantProvider><Probe/></TenantProvider>)
  return ref
}
const hydrated = ref => waitFor(() => expect(ref.current.loading).toBe(false))

beforeEach(() => { sessionStorage.clear() })
afterEach(() => cleanup())

describe('tenant selection survives a page refresh', () => {
  it('restores the organization a member switched to', async () => {
    auth.value = member
    let ref = mount(); await hydrated(ref)
    expect(ref.current.activeMembershipId).toBe('m-1')
    act(() => { ref.current.setTenantByMembership('m-2') })
    cleanup()
    ref = mount(); await hydrated(ref)
    expect(ref.current.activeMembershipId).toBe('m-2')
    expect(ref.current.tenant.name).toBe('Beta')
  })

  it('restores the organization a Platform Owner entered, and the demo mode', async () => {
    auth.value = owner
    let ref = mount(); await hydrated(ref)
    expect(ref.current.activeMembershipId).toBe(null)
    act(() => { ref.current.setTenantByMembership('m-2') })
    cleanup()
    ref = mount(); await hydrated(ref)
    expect(ref.current.tenant.name).toBe('Beta')
    act(() => { ref.current.enterPlatformDemo() })
    cleanup()
    ref = mount(); await hydrated(ref)
    expect(ref.current.isDemo).toBe(true)
    expect(ref.current.tenant.name).toBe('Demo Hospital')
    act(() => { ref.current.returnToPlatform() })
    cleanup()
    ref = mount(); await hydrated(ref)
    expect(ref.current.tenant).toBe(null)
    expect(ref.current.isDemo).toBe(false)
  })

  it('restores the Platform Owner demo preview toggle on its own', async () => {
    auth.value = owner
    let ref = mount(); await hydrated(ref)
    act(() => { ref.current.togglePlatformDemoPreview() })
    cleanup()
    ref = mount(); await hydrated(ref)
    expect(ref.current.platformDemoPreview).toBe(true)
    expect(ref.current.tenant).toBe(null)
  })

  it('restores a Platform Owner role preview', async () => {
    auth.value = owner
    let ref = mount(); await hydrated(ref)
    act(() => { ref.current.setTenantByMembership('m-1') })
    act(() => { ref.current.startRolePreview('laboratory') })
    cleanup()
    ref = mount(); await hydrated(ref)
    expect(ref.current.role).toBe('laboratory')
  })

  it('ignores another user\'s selection and forgets it on sign-out', async () => {
    auth.value = member
    let ref = mount(); await hydrated(ref)
    act(() => { ref.current.setTenantByMembership('m-2') })
    cleanup()
    auth.value = { ...member, user: { id: 'user-2' }, profile: { id: 'user-2', isPlatformOwner: false } }
    ref = mount(); await hydrated(ref)
    expect(ref.current.activeMembershipId).toBe('m-1')
    cleanup()
    auth.value = { user: null, profile: null, isAuthenticated: false, isDemoSession: false, loading: false }
    ref = mount(); await hydrated(ref)
    expect(sessionStorage.getItem('limoxis.tenant-selection')).toBe(null)
  })
})
