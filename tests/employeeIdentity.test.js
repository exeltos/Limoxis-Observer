import { describe, it, expect } from 'vitest'
import { isOwnEmployeeRecord, platformOwnerEmployee, resolveSelfEmployee } from '../src/features/employees/employeeIdentity'

const rows = [
  { id: 'EMP-001', userId: null, email: 'first@hospital.gr' },
  { id: 'EMP-002', userId: 'user-2', email: 'second@hospital.gr' },
  { id: 'EMP-003', userId: null, email: ' Third@Hospital.gr ' },
]

describe('resolveSelfEmployee', () => {
  it('prefers the employee id on the membership over every other link', () => {
    const found = resolveSelfEmployee({ employeeRows: rows, membership: { employee_id: 'EMP-001' }, profile: { id: 'user-2' } })
    expect(found.id).toBe('EMP-001')
  })

  it('falls back to the user account linked to the employee when the explicit id is unknown', () => {
    const found = resolveSelfEmployee({ employeeRows: rows, membership: { employeeId: 'EMP-404' }, profile: { id: 'user-2' } })
    expect(found.id).toBe('EMP-002')
  })

  it('matches the sign-in e-mail ignoring case and surrounding spaces', () => {
    const found = resolveSelfEmployee({ employeeRows: rows, profile: { id: 'user-9', email: 'THIRD@hospital.gr' } })
    expect(found.id).toBe('EMP-003')
  })

  it('does not match on the contact e-mail, which the user can change', () => {
    const found = resolveSelfEmployee({ employeeRows: rows, profile: { id: 'user-9', email: 'login@hospital.gr', contactEmail: 'first@hospital.gr' } })
    expect(found).toBeNull()
  })

  it('gives the Platform Owner a synthetic identity when no employee matches', () => {
    const found = resolveSelfEmployee({ employeeRows: rows, profile: { id: 'owner', fullName: 'Maria Papadopoulou Ioannou', isPlatformOwner: true } })
    expect(found).toMatchObject({ id: 'PLATFORM-OWNER', userId: 'owner', firstName: 'Maria', lastName: 'Papadopoulou Ioannou', dbId: null })
  })

  it('uses the first sample employee in the browser-only demo, and nothing otherwise', () => {
    expect(resolveSelfEmployee({ employeeRows: rows, user: { id: 'demo' }, isDemo: true }).id).toBe('EMP-001')
    expect(resolveSelfEmployee({ employeeRows: [{ id: 'EMP-7' }], user: { id: 'demo' }, isDemo: true }).id).toBe('EMP-7')
    expect(resolveSelfEmployee({ employeeRows: rows, user: { id: 'stranger' } })).toBeNull()
    expect(resolveSelfEmployee({ employeeRows: [], isDemo: true })).toBeNull()
  })
})

describe('platformOwnerEmployee', () => {
  it('fills a missing name with neutral defaults', () => {
    expect(platformOwnerEmployee({}, {})).toMatchObject({ firstName: 'Platform', lastName: 'Owner', email: '', userId: null })
    expect(platformOwnerEmployee({ contactEmail: 'c@x.gr', email: 'l@x.gr' }, {}).email).toBe('c@x.gr')
  })
})

describe('isOwnEmployeeRecord', () => {
  it('is true for the record linked to the user account', () => {
    expect(isOwnEmployeeRecord(rows[1], { profile: { id: 'user-2' } })).toBe(true)
  })

  it('matches either the contact or the sign-in e-mail, so an own record is always read-only', () => {
    expect(isOwnEmployeeRecord(rows[2], { profile: { id: 'x', contactEmail: 'third@hospital.gr' } })).toBe(true)
    expect(isOwnEmployeeRecord(rows[0], { profile: { id: 'x' }, user: { email: 'FIRST@hospital.gr' } })).toBe(true)
    expect(isOwnEmployeeRecord(rows[0], { profile: { id: 'x', contactEmail: 'other@x.gr', email: 'first@hospital.gr' } })).toBe(true)
    expect(isOwnEmployeeRecord(rows[0], { profile: { id: 'x', contactEmail: 'other@x.gr', email: 'login@x.gr' } })).toBe(false)
  })

  it('is false without a record or without anything to compare', () => {
    expect(isOwnEmployeeRecord(null, { profile: { id: 'user-2' } })).toBe(false)
    expect(isOwnEmployeeRecord({ id: 'EMP-9', userId: null, email: '' }, { profile: {}, user: {} })).toBe(false)
  })
})
