import { describe, expect, it } from 'vitest'
import { inactiveEmployeeCodes, isInactiveEmployee } from '../src/design-system/InactiveEmployeeBadge'

describe('inactive employee label', () => {
  it('marks only employees with the inactive status (not active, not on leave)', () => {
    expect(isInactiveEmployee({ employmentStatus: 'inactive' })).toBe(true)
    expect(isInactiveEmployee({ employmentStatus: 'active' })).toBe(false)
    expect(isInactiveEmployee({ employmentStatus: 'leave' })).toBe(false)
    expect(isInactiveEmployee(null)).toBe(false)
  })

  it('never matches an outside member or a name typed by hand (no employee code)', () => {
    const codes = inactiveEmployeeCodes([
      { id: '101', employmentStatus: 'inactive' },
      { id: '', employmentStatus: 'inactive' },
      { id: '102', employmentStatus: 'active' },
    ])
    expect(codes.has('101')).toBe(true)
    expect(codes.has('')).toBe(false)
    expect(codes.has('102')).toBe(false)
  })
})
