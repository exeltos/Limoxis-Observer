import { describe, expect, it } from 'vitest'
import { ADD_ON_CAPABILITIES, CAPABILITIES, ROLES, can, canForRecord, capabilitiesFor, scopeFor } from '../src/core/permissions/roles'
import { DATA_SCOPES } from '../src/core/permissions/scopeTypes'
import { capabilityCatalogue,isCustomRoleEligible } from '../src/core/permissions/capabilityCatalogue'
import { systemRoleMatrix } from '../src/core/permissions/systemRoleMatrix'
import { canSeeSensitiveEmployeeHealth } from '../src/core/permissions/roleUxPolicy'
import { navigationFor } from '../src/app/navigation'

describe('role + scope access foundation', () => {
  it('keeps a department user on the quiet employee workspace', () => {
    expect(can(ROLES.DEPARTMENT_USER, CAPABILITIES.VIEW_MY_DEPARTMENT)).toBe(true)
    expect(can(ROLES.DEPARTMENT_USER, CAPABILITIES.VIEW_LAB)).toBe(false)
    expect(can(ROLES.DEPARTMENT_USER, CAPABILITIES.MANAGE_ORGANIZATION)).toBe(false)
  })

  it('adds capability-driven modules without inventing a new role', () => {
    const caps = capabilitiesFor(ROLES.DEPARTMENT_USER, [ADD_ON_CAPABILITIES.HAND_HYGIENE_OBSERVER])
    expect(caps).toContain(CAPABILITIES.VIEW_PREVENTION)
    expect(caps).not.toContain(CAPABILITIES.MANAGE_ORGANIZATION)
  })

  it('keeps platform owner navigation separate from hospital operational navigation', () => {
    const keys = navigationFor({ role: ROLES.PLATFORM_OWNER }).map((item) => item.key)
    expect(keys).toEqual(['platformCenter', 'management'])
  })

  it('shows controls when assigned even for a role whose normal workspace is restricted', () => {
    const keys = navigationFor({ role: ROLES.COMMITTEE_SECRETARIAT, hasAssignments: true }).map((item) => item.key)
    expect(keys).toContain('controls')
  })

  it('separates HR administration from occupational clinical access', () => {
    expect(can(ROLES.HR_OFFICE, CAPABILITIES.MANAGE_STAFF_ADMIN)).toBe(true)
    expect(can(ROLES.HR_OFFICE, CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH)).toBe(false)
    expect(can(ROLES.OCCUPATIONAL_PHYSICIAN, CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH)).toBe(true)
    expect(can(ROLES.OCCUPATIONAL_PHYSICIAN, CAPABILITIES.MANAGE_STAFF_ADMIN)).toBe(false)
  })

  it('does not turn platform or hospital administration into a clinical bypass', () => {
    expect(can(ROLES.PLATFORM_OWNER, CAPABILITIES.VIEW_PATIENTS)).toBe(false)
    expect(can(ROLES.HOSPITAL_ADMIN, CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH)).toBe(false)
    expect(can(ROLES.HOSPITAL_ADMIN, CAPABILITIES.VALIDATE_LAB_RESULTS)).toBe(false)
  })

  it('keeps the isolated demo role broad enough to demonstrate hospital workflows', () => {
    expect(can(ROLES.DEMO, CAPABILITIES.VIEW_PATIENTS)).toBe(true)
    expect(can(ROLES.DEMO, CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH)).toBe(true)
    expect(can(ROLES.DEMO, CAPABILITIES.MANAGE_PLATFORM)).toBe(false)
  })

  it('keeps department roles inside their maximum scope', () => {
    expect(scopeFor(CAPABILITIES.VIEW_CONTROLS,{role:ROLES.DEPARTMENT_MANAGER})).toBe(DATA_SCOPES.DEPARTMENT)
    expect(scopeFor(CAPABILITIES.VIEW_CONTROLS,{role:ROLES.DEPARTMENT_MANAGER,scopeOverrides:{[CAPABILITIES.VIEW_CONTROLS]:DATA_SCOPES.ORGANIZATION}})).toBe(null)
    expect(canForRecord(CAPABILITIES.VIEW_CONTROLS,{organizationId:'org-1',departmentId:'dept-2'},{role:ROLES.DEPARTMENT_MANAGER,organizationId:'org-1',departmentIds:['dept-1']})).toBe(false)
  })

  it('classifies security administration as system-only', () => {
    expect(capabilityCatalogue[CAPABILITIES.MANAGE_USERS].customRoleClass).toBe('system_only')
    expect(isCustomRoleEligible(CAPABILITIES.MANAGE_USERS)).toBe(false)
    expect(isCustomRoleEligible(CAPABILITIES.RECORD_WASTE)).toBe(true)
  })

  it('keeps every matrix row attached to canonical metadata', () => {
    expect(systemRoleMatrix.length).toBeGreaterThan(0)
    for(const row of systemRoleMatrix){
      expect(capabilityCatalogue[row.capability]).toBeTruthy()
      expect(Object.values(DATA_SCOPES)).toContain(row.defaultScope)
      expect(Object.values(DATA_SCOPES)).toContain(row.maximumScope)
    }
  })

  it('requires both a sensitive capability and an allowed role family', () => {
    expect(canSeeSensitiveEmployeeHealth(ROLES.HOSPITAL_ADMIN)).toBe(false)
    expect(canSeeSensitiveEmployeeHealth(ROLES.LABORATORY,[],[CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH])).toBe(false)
    expect(canSeeSensitiveEmployeeHealth(ROLES.OCCUPATIONAL_PHYSICIAN)).toBe(true)
    expect(canSeeSensitiveEmployeeHealth(ROLES.DEMO)).toBe(true)
  })
})

describe('clinical domain capability split', () => {
  it('keeps laboratory and pharmacy write responsibilities separated', () => {
    expect(can(ROLES.LABORATORY, CAPABILITIES.MANAGE_LAB_SAMPLES)).toBe(true)
    expect(can(ROLES.LABORATORY, CAPABILITIES.MANAGE_ANTIMICROBIAL_THERAPY)).toBe(false)
    expect(can(ROLES.PHARMACY, CAPABILITIES.MANAGE_ANTIMICROBIAL_THERAPY)).toBe(true)
    expect(can(ROLES.PHARMACY, CAPABILITIES.MANAGE_LAB_SAMPLES)).toBe(false)
  })

  it('keeps isolation and reassessment with infection-control roles', () => {
    expect(can(ROLES.INFECTION_CONTROL_LEAD, CAPABILITIES.MANAGE_ISOLATION)).toBe(true)
    expect(can(ROLES.INFECTION_CONTROL_MEMBER, CAPABILITIES.REASSESS_SURVEILLANCE)).toBe(true)
    expect(can(ROLES.DEPARTMENT_MANAGER, CAPABILITIES.MANAGE_ISOLATION)).toBe(false)
  })
})
