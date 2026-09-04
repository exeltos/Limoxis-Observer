import { CAPABILITIES,ROLES,can } from './roles'
import { SCOPES } from './accessModel'

// Front-end UX scope. Supabase RLS is the authority; this policy mirrors the
// same boundaries so the UI never advertises records/actions a role cannot use.
export const ROLE_UX_POLICY = Object.freeze({
  [ROLES.PLATFORM_OWNER]: { scope: SCOPES.PLATFORM, sensitiveEmployeeHealth: true, label: 'Platform Owner' },
  [ROLES.HOSPITAL_ADMIN]: { scope: SCOPES.ORGANIZATION, sensitiveEmployeeHealth: false, label: 'Hospital Admin' },
  [ROLES.INFECTION_CONTROL_LEAD]: { scope: SCOPES.ORGANIZATION, sensitiveEmployeeHealth: false, label: 'Infection Control Lead' },
  [ROLES.INFECTION_CONTROL_MEMBER]: { scope: SCOPES.ORGANIZATION, sensitiveEmployeeHealth: false, label: 'Infection Control Member' },
  [ROLES.LINK_NURSE]: { scope: SCOPES.DEPARTMENT, sensitiveEmployeeHealth: false, label: 'Link Nurse' },
  [ROLES.DEPARTMENT_MANAGER]: { scope: SCOPES.DEPARTMENT, sensitiveEmployeeHealth: false, label: 'Department Manager' },
  [ROLES.DEPARTMENT_USER]: { scope: SCOPES.DEPARTMENT, sensitiveEmployeeHealth: false, label: 'Department User' },
  [ROLES.LABORATORY]: { scope: SCOPES.DEPARTMENT, sensitiveEmployeeHealth: false, label: 'Laboratory' },
  [ROLES.COMMITTEE_SECRETARIAT]: { scope: SCOPES.ORGANIZATION, sensitiveEmployeeHealth: false, label: 'Committee Secretariat' },
  [ROLES.HR_OFFICE]: { scope: SCOPES.ORGANIZATION, sensitiveEmployeeHealth: false, label: 'HR Office' },
  [ROLES.PHARMACY]: { scope: SCOPES.ORGANIZATION, sensitiveEmployeeHealth: false, label: 'Pharmacy' },
  [ROLES.OCCUPATIONAL_PHYSICIAN]: { scope: SCOPES.ORGANIZATION, sensitiveEmployeeHealth: true, label: 'Occupational Physician' },
  [ROLES.DOCTOR_REVIEWER]: { scope: SCOPES.ORGANIZATION, sensitiveEmployeeHealth: false, label: 'Doctor Reviewer' },
  [ROLES.QUALITY_MANAGER]: { scope: SCOPES.ORGANIZATION, sensitiveEmployeeHealth: false, label: 'Quality Manager' },
  [ROLES.DEMO]: { scope: SCOPES.ORGANIZATION, sensitiveEmployeeHealth: true, label: 'Demo' },
})

export function uxPolicyFor(role){ return ROLE_UX_POLICY[role] ?? {scope:SCOPES.SELF,sensitiveEmployeeHealth:false,label:'User'} }

export function recordWithinRoleScope({role, membership, userId, record}={}){
  if(!record) return true
  const policy=uxPolicyFor(role)
  if(policy.scope===SCOPES.PLATFORM) return true
  const orgId=membership?.organization?.id ?? membership?.organization_id ?? membership?.organizationId
  if(record.organizationId && orgId && record.organizationId!==orgId) return false
  if(policy.scope===SCOPES.ORGANIZATION) return true
  if(policy.scope===SCOPES.DEPARTMENT){
    const allowed=[...(membership?.departmentIds??[]), membership?.departmentId].filter(Boolean)
    const recordDepartment=record.departmentId ?? null
    const previewDepartment=membership?.previewDepartment ?? null
    if(previewDepartment && recordDepartment) return recordDepartment===previewDepartment
    // Department-scoped roles must never gain access merely because a record is
    // missing its department key. RLS follows the same fail-closed principle.
    return Boolean(recordDepartment) && allowed.includes(recordDepartment)
  }
  return !record.userId || record.userId===userId
}

export function canSeeSensitiveEmployeeHealth(role,addOns=[],customCapabilities=[]){
  return Boolean(uxPolicyFor(role).sensitiveEmployeeHealth)&&can(role,CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH,addOns,customCapabilities)
}
