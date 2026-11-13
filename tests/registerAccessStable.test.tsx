// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

// A fresh object on every render made the Quality Center's register list report
// its rows back without end (thousands of renders a second, buttons late to respond).
const tenant = { role: 'quality_manager', membership: { departmentIds: ['d1'], capabilities: [] }, actualRole: 'quality_manager', isRolePreview: false, isDemo: false }
vi.mock('../src/core/tenant/TenantContext', () => ({ useTenant: () => ({ ...tenant, membership: { ...tenant.membership } }) }))

const { useRegisterAccess } = await import('../src/features/registers/registerAccess')

describe('Register access', () => {
  it('stays the same object while the user and role stay the same', () => {
    const { result, rerender } = renderHook(() => useRegisterAccess())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
    expect(first.isMember({ departmentId: 'd1' })).toBe(true)
  })
})
