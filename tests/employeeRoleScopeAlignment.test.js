import { describe,expect,it } from 'vitest'
import { CAPABILITIES,ROLES,can } from '../src/core/permissions/roles'
import { recordWithinRoleScope,uxPolicyFor } from '../src/core/permissions/roleUxPolicy'
import { SCOPES } from '../src/core/permissions/accessModel'

const membership={organization:{id:'org-1'},departmentIds:['dept-lab']}
const labEmployee={organizationId:'org-1',departmentId:'dept-lab'}
const otherEmployee={organizationId:'org-1',departmentId:'dept-icu'}

describe('employee role/scope alignment',()=>{
  it('registers Link Nurse as a department-scoped system role',()=>{
    expect(ROLES.LINK_NURSE).toBe('link_nurse')
    expect(uxPolicyFor(ROLES.LINK_NURSE).scope).toBe(SCOPES.DEPARTMENT)
    expect(can(ROLES.LINK_NURSE,CAPABILITIES.VIEW_STAFF)).toBe(true)
  })

  it('keeps Laboratory employee access inside its department scope',()=>{
    expect(uxPolicyFor(ROLES.LABORATORY).scope).toBe(SCOPES.DEPARTMENT)
    expect(can(ROLES.LABORATORY,CAPABILITIES.VIEW_STAFF)).toBe(true)
    expect(recordWithinRoleScope({role:ROLES.LABORATORY,membership,record:labEmployee})).toBe(true)
    expect(recordWithinRoleScope({role:ROLES.LABORATORY,membership,record:otherEmployee})).toBe(false)
  })

  it('keeps Department Manager employee access inside its department scope',()=>{
    expect(can(ROLES.DEPARTMENT_MANAGER,CAPABILITIES.VIEW_STAFF)).toBe(true)
    expect(recordWithinRoleScope({role:ROLES.DEPARTMENT_MANAGER,membership,record:labEmployee})).toBe(true)
    expect(recordWithinRoleScope({role:ROLES.DEPARTMENT_MANAGER,membership,record:otherEmployee})).toBe(false)
  })

  it('fails closed when a department-scoped record has no department id',()=>{
    expect(recordWithinRoleScope({role:ROLES.LABORATORY,membership,record:{organizationId:'org-1'}})).toBe(false)
  })

  it('keeps Platform Owner global',()=>{
    expect(recordWithinRoleScope({role:ROLES.PLATFORM_OWNER,membership:null,record:{organizationId:'another-org',departmentId:'other'}})).toBe(true)
  })
})
