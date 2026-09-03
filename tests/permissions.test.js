import { describe, expect, it } from 'vitest'
import { ADD_ON_CAPABILITIES, CAPABILITIES, PREVIEWABLE_ROLES, ROLES, can, canForRecord, capabilitiesFor, isPreviewableRole, scopeFor } from '../src/core/permissions/roles'
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

  it('gives platform owner direct navigation to all current product modules', () => {
    const keys = navigationFor({ role: ROLES.PLATFORM_OWNER }).map((item) => item.key)
    expect(keys).toEqual(expect.arrayContaining(['dashboard','surveillance','laboratory','prevention','controls','quality','patients','employees','pharmacy','occupationalHealth','lira','management']))
  })

  it('does not show both Dashboard and My department to department roles', () => {
    const managerKeys = navigationFor({ role: ROLES.DEPARTMENT_MANAGER }).map((item) => item.key)
    const userKeys = navigationFor({ role: ROLES.DEPARTMENT_USER }).map((item) => item.key)
    expect(managerKeys).toContain('myDepartment')
    expect(managerKeys).not.toContain('dashboard')
    expect(userKeys).toContain('myDepartment')
    expect(userKeys).not.toContain('dashboard')
  })

  it('uses My department for Link Nurse but keeps Laboratory on its dashboard', () => {
    const linkNurseKeys = navigationFor({ role: ROLES.LINK_NURSE }).map((item) => item.key)
    const laboratoryKeys = navigationFor({ role: ROLES.LABORATORY }).map((item) => item.key)
    expect(linkNurseKeys).toContain('myDepartment')
    expect(linkNurseKeys).not.toContain('dashboard')
    expect(laboratoryKeys).toContain('dashboard')
    expect(laboratoryKeys).not.toContain('myDepartment')
  })

  it('never allows Platform Owner or Demo to be selected through role preview', () => {
    expect(PREVIEWABLE_ROLES).not.toContain(ROLES.PLATFORM_OWNER)
    expect(PREVIEWABLE_ROLES).not.toContain(ROLES.DEMO)
    expect(isPreviewableRole(ROLES.PLATFORM_OWNER)).toBe(false)
    expect(isPreviewableRole(ROLES.DEMO)).toBe(false)
    expect(isPreviewableRole(ROLES.HOSPITAL_ADMIN)).toBe(true)
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

  it('keeps sensitive occupational health restricted while Hospital Admin can operate Laboratory', () => {
    expect(can(ROLES.PLATFORM_OWNER, CAPABILITIES.VIEW_PATIENTS)).toBe(true)
    expect(can(ROLES.PLATFORM_OWNER, CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH)).toBe(true)
    expect(can(ROLES.HOSPITAL_ADMIN, CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH)).toBe(false)
    expect(can(ROLES.HOSPITAL_ADMIN, CAPABILITIES.VALIDATE_LAB_RESULTS)).toBe(true)
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

  it('separates document editing from lifecycle authority', () => {
    expect(can(ROLES.COMMITTEE_SECRETARIAT,CAPABILITIES.MANAGE_DOCUMENTS)).toBe(false)
    expect(can(ROLES.COMMITTEE_SECRETARIAT,CAPABILITIES.PUBLISH_DOCUMENT)).toBe(false)
    expect(can(ROLES.QUALITY_MANAGER,CAPABILITIES.PUBLISH_DOCUMENT)).toBe(true)
    expect(can(ROLES.QUALITY_MANAGER,CAPABILITIES.SUBMIT_DOCUMENT_REVIEW)).toBe(true)
    expect(can(ROLES.QUALITY_MANAGER,CAPABILITIES.APPROVE_DOCUMENT)).toBe(true)
    expect(can(ROLES.QUALITY_MANAGER,CAPABILITIES.ARCHIVE_DOCUMENT)).toBe(true)
    expect(capabilityCatalogue[CAPABILITIES.SUBMIT_DOCUMENT_REVIEW].customRoleClass).toBe('standard')
    expect(capabilityCatalogue[CAPABILITIES.APPROVE_DOCUMENT].customRoleClass).toBe('restricted')
    expect(capabilityCatalogue[CAPABILITIES.PUBLISH_DOCUMENT].governanceAction).toBe(true)
    expect(capabilityCatalogue[CAPABILITIES.PUBLISH_DOCUMENT].customRoleClass).toBe('restricted')
  })

  it('separates routine control work from governance authority', () => {
    expect(can(ROLES.DEPARTMENT_USER,CAPABILITIES.EXECUTE_CONTROL)).toBe(true)
    expect(can(ROLES.DEPARTMENT_USER,CAPABILITIES.EDIT_CONTROL_EXECUTION)).toBe(true)
    expect(can(ROLES.DEPARTMENT_USER,CAPABILITIES.VOID_CONTROL_EXECUTION)).toBe(false)
    expect(can(ROLES.DEPARTMENT_MANAGER,CAPABILITIES.VOID_CONTROL_EXECUTION)).toBe(true)
    expect(can(ROLES.QUALITY_MANAGER,CAPABILITIES.ARCHIVE_CONTROL_DEFINITION)).toBe(true)
    expect(capabilityCatalogue[CAPABILITIES.VOID_CONTROL_EXECUTION].customRoleClass).toBe('restricted')
  })

  it('requires a matching committee assignment for secretariat actions', () => {
    const committee={id:'committee-1',resourceType:'committee',organizationId:'org-1'}
    const context={role:ROLES.COMMITTEE_SECRETARIAT,organizationId:'org-1'}
    expect(can(ROLES.COMMITTEE_SECRETARIAT,CAPABILITIES.CREATE_COMMITTEE)).toBe(false)
    expect(canForRecord(CAPABILITIES.EDIT_COMMITTEE_MINUTES,committee,context)).toBe(false)
    expect(canForRecord(CAPABILITIES.EDIT_COMMITTEE_MINUTES,committee,{...context,assignments:[{sourceType:'committee',sourceId:'committee-1',status:'active'}]})).toBe(true)
    expect(canForRecord(CAPABILITIES.EDIT_COMMITTEE_MINUTES,committee,{...context,assignments:[{resourceType:'committee',resourceId:'committee-2',active:true}]})).toBe(false)
    expect(canForRecord(CAPABILITIES.FINALIZE_COMMITTEE_MINUTES,committee,{...context,assignments:[{committeeId:'committee-1',resourceType:'committee',active:true}]})).toBe(true)
    expect(capabilityCatalogue[CAPABILITIES.FINALIZE_COMMITTEE_MINUTES].customRoleClass).toBe('restricted')
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
    expect(canSeeSensitiveEmployeeHealth(ROLES.PLATFORM_OWNER)).toBe(true)
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
