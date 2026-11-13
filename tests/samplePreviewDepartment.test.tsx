// @vitest-environment jsdom
// In the sample Demo a department-scoped role previews one department: the one
// chosen, else the ICU (as the database places a Demo evaluator), by the name
// the sample records carry, so its department's records show.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, render, waitFor } from '@testing-library/react'

let profile
vi.mock('../src/core/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: profile.id, email: profile.email }, profile, isAuthenticated: true, isDemoSession: false, loading: false }),
}))
const { TenantProvider, useTenant } = await import('../src/core/tenant/TenantContext')

async function sample() {
  let api
  function Capture() { api = useTenant(); return null }
  render(<TenantProvider><Capture/></TenantProvider>)
  await waitFor(() => expect(api?.enterSampleDemo).toBeTypeOf('function'))
  act(() => { api.enterSampleDemo() })
  await waitFor(() => expect(api.isDemo).toBe(true))
  return () => api
}

beforeEach(() => { localStorage.clear(); profile = { id: 'owner-1', isPlatformOwner: true, fullName: 'Platform Owner', isDemo: false } })
afterEach(() => { cleanup(); localStorage.clear() })

describe('sample Demo role preview department', () => {
  it('puts a department-scoped role in the ICU unless another department is chosen', async () => {
    const api = await sample()
    act(() => { api().startRolePreview('department_manager') })
    expect(api().membership.previewDepartment).toBe('ΜΕΘ')
    expect(api().canAccessRecord({ departmentId: 'ΜΕΘ' })).toBe(true)
    expect(api().canAccessRecord({ departmentId: 'Χειρουργική' })).toBe(false)
    act(() => { api().startRolePreview('department_manager', 'Χειρουργική') })
    expect(api().membership.previewDepartment).toBe('Χειρουργική')
  })

  it('leaves hospital-wide roles without a department', async () => {
    const api = await sample()
    act(() => { api().startRolePreview('quality_manager') })
    expect(api().membership.previewDepartment).toBeNull()
  })
})
