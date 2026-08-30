import { describe, expect, it } from 'vitest'
import {
  ADD_ON_CAPABILITIES,
  CAPABILITIES,
  ROLES,
  addonCapabilityMap,
  can,
  canForRecord,
  capabilitiesFor,
  isCustomRoleEligible,
  roleCapabilities,
  scopeFor,
  systemRoleMatrix,
} from '../src/core/permissions/roles'
import { capabilityCatalogue, capabilityDefinition } from '../src/core/permissions/capabilityCatalogue'
import { DATA_SCOPES, SENSITIVITY, CUSTOM_ROLE_CLASSES, scopeWithin } from '../src/core/permissions/scopeTypes'

// This suite implements the verification checklist from docs/AUTHORIZATION_MODEL.md
// ("Required verification before production Supabase rollout") against the
// frontend authorization engine. It is a guardrail, not a substitute for
// testing the equivalent Supabase RLS policies.

const allCapabilityIds = Object.values(CAPABILITIES)
const allRoleIds = Object.values(ROLES)

describe('capability catalogue and role matrix integrity', () => {
  it('keeps every capability and role id unique', () => {
    expect(new Set(allCapabilityIds).size).toBe(allCapabilityIds.length)
    expect(new Set(allRoleIds).size).toBe(allRoleIds.length)
  })

  it('keeps every role capability list free of unknown capability ids', () => {
    for (const role of allRoleIds) {
      for (const capability of roleCapabilities[role] ?? []) {
        expect(allCapabilityIds).toContain(capability)
      }
    }
  })

  it('keeps every system role matrix row attached to a valid capability and in-range scopes', () => {
    expect(systemRoleMatrix.length).toBeGreaterThan(0)
    for (const row of systemRoleMatrix) {
      expect(allRoleIds).toContain(row.role)
      expect(capabilityDefinition(row.capability)).toBeTruthy()
      expect(Object.values(DATA_SCOPES)).toContain(row.defaultScope)
      expect(Object.values(DATA_SCOPES)).toContain(row.maximumScope)
      expect(scopeWithin(row.defaultScope, row.maximumScope)).toBe(true)
    }
  })

  it('keeps every catalogue entry self-consistent', () => {
    for (const definition of Object.values(capabilityCatalogue)) {
      expect(definition.allowedScopes).toContain(definition.defaultScope)
      expect(scopeWithin(definition.defaultScope, definition.maximumScope)).toBe(true)
      expect(Object.values(CUSTOM_ROLE_CLASSES)).toContain(definition.customRoleClass)
      expect(Object.values(SENSITIVITY)).toContain(definition.sensitivity)
    }
  })
})

describe('system-only capabilities never leak into custom roles or add-ons', () => {
  const systemOnlyCapabilities = allCapabilityIds.filter(
    (id) => capabilityDefinition(id).customRoleClass === CUSTOM_ROLE_CLASSES.SYSTEM_ONLY,
  )

  it('marks platform administration as system-only and ineligible for custom roles', () => {
    expect(systemOnlyCapabilities).toContain(CAPABILITIES.MANAGE_PLATFORM)
    expect(systemOnlyCapabilities).toContain(CAPABILITIES.VIEW_PLATFORM)
    for (const id of systemOnlyCapabilities) {
      expect(isCustomRoleEligible(id)).toBe(false)
    }
  })

  it('never grants a system-only capability through an add-on', () => {
    for (const capabilities of Object.values(addonCapabilityMap)) {
      for (const capability of capabilities) {
        expect(capabilityDefinition(capability).customRoleClass).not.toBe(CUSTOM_ROLE_CLASSES.SYSTEM_ONLY)
        expect(capabilityDefinition(capability).addOnEligible).toBe(true)
      }
    }
    expect(Object.keys(addonCapabilityMap)).toEqual(expect.arrayContaining(Object.values(ADD_ON_CAPABILITIES)))
  })

  it('restricts manage_platform and view_platform to the platform owner role only', () => {
    for (const role of allRoleIds) {
      if (role === ROLES.PLATFORM_OWNER) continue
      expect(can(role, CAPABILITIES.MANAGE_PLATFORM)).toBe(false)
      expect(can(role, CAPABILITIES.VIEW_PLATFORM)).toBe(false)
    }
  })

  // Documented as an open item, not a passing invariant: docs/AUTHORIZATION_MODEL.md
  // ("Known legacy gaps to remove during migration") states that manage_users,
  // manage_roles and manage_organization are system-only in the first production
  // version, but the current hospital_admin compatibility grant still includes
  // them. This test pins today's (non-compliant) behavior so the gap can only be
  // closed on purpose, not silently reopened once someone starts fixing it.
  it('still grants hospital_admin the system-only user/role/org capabilities (legacy gap, see AUTHORIZATION_MODEL.md)', () => {
    expect(can(ROLES.HOSPITAL_ADMIN, CAPABILITIES.MANAGE_USERS)).toBe(true)
    expect(can(ROLES.HOSPITAL_ADMIN, CAPABILITIES.MANAGE_ROLES)).toBe(true)
    expect(can(ROLES.HOSPITAL_ADMIN, CAPABILITIES.MANAGE_ORGANIZATION)).toBe(true)
  })
})

describe('sensitive domain isolation', () => {
  const sensitiveCapabilities = allCapabilityIds.filter(
    (id) => capabilityDefinition(id).sensitivity === SENSITIVITY.SENSITIVE,
  )

  it('lists occupational health and clinical review as sensitive', () => {
    expect(sensitiveCapabilities).toEqual(
      expect.arrayContaining([
        CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH,
        CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH,
        CAPABILITIES.REVIEW_CLINICAL,
        CAPABILITIES.RECORD_CLINICAL_ASSESSMENT,
      ]),
    )
  })

  it('keeps hospital_admin out of sensitive capabilities while platform_owner has explicit full control', () => {
    for (const capability of sensitiveCapabilities) {
      expect(can(ROLES.HOSPITAL_ADMIN, capability)).toBe(false)
      expect(can(ROLES.PLATFORM_OWNER, capability)).toBe(true)
    }
  })

  it('keeps occupational health limited to the occupational physician and the isolated demo role', () => {
    for (const role of allRoleIds) {
      if (role === ROLES.PLATFORM_OWNER || role === ROLES.OCCUPATIONAL_PHYSICIAN || role === ROLES.DEMO) continue
      expect(can(role, CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH)).toBe(false)
      expect(can(role, CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH)).toBe(false)
    }
  })
})

describe('canForRecord: cross-tenant isolation', () => {
  it('denies access to a record owned by a different organization', () => {
    const context = { role: ROLES.QUALITY_MANAGER, organizationId: 'org-1' }
    const ownRecord = { organizationId: 'org-1' }
    const otherOrgRecord = { organizationId: 'org-2' }
    expect(canForRecord(CAPABILITIES.VIEW_QUALITY, ownRecord, context)).toBe(true)
    expect(canForRecord(CAPABILITIES.VIEW_QUALITY, otherOrgRecord, context)).toBe(false)
  })

  it('does not require an organization match for a platform-scoped capability', () => {
    const context = { role: ROLES.PLATFORM_OWNER, organizationId: 'org-1' }
    const record = { organizationId: 'org-2' }
    expect(canForRecord(CAPABILITIES.VIEW_PLATFORM, record, context)).toBe(true)
  })
})

describe('canForRecord: department scoping', () => {
  it('denies a department manager access to another department\'s record', () => {
    const context = { role: ROLES.DEPARTMENT_MANAGER, organizationId: 'org-1', departmentIds: ['dept-1'] }
    const ownDeptRecord = { organizationId: 'org-1', departmentId: 'dept-1' }
    const otherDeptRecord = { organizationId: 'org-1', departmentId: 'dept-2' }
    expect(canForRecord(CAPABILITIES.EXECUTE_CONTROL, ownDeptRecord, context)).toBe(true)
    expect(canForRecord(CAPABILITIES.EXECUTE_CONTROL, otherDeptRecord, context)).toBe(false)
  })

  it('cannot escalate a department-scoped capability to organization scope via an override', () => {
    const escalated = { role: ROLES.DEPARTMENT_MANAGER, scopeOverrides: { [CAPABILITIES.EXECUTE_CONTROL]: DATA_SCOPES.ORGANIZATION } }
    expect(scopeFor(CAPABILITIES.EXECUTE_CONTROL, escalated)).toBe(null)
    const otherDeptRecord = { organizationId: 'org-1', departmentId: 'dept-2' }
    const context = { role: ROLES.DEPARTMENT_MANAGER, organizationId: 'org-1', departmentIds: ['dept-1'], scopeOverrides: { [CAPABILITIES.EXECUTE_CONTROL]: DATA_SCOPES.ORGANIZATION } }
    expect(canForRecord(CAPABILITIES.EXECUTE_CONTROL, otherDeptRecord, context)).toBe(false)
  })
})

describe('canForRecord: self scope', () => {
  it('enforces the self relationship whenever a capability actually resolves to SELF scope', () => {
    // No system role has a matrix row here, so scopeFor falls back to the
    // catalogue's own default scope (SELF, because the id contains "my_").
    const roleWithNoMatrixRow = 'role_outside_the_system_matrix'
    const context = { role: roleWithNoMatrixRow, employeeId: 'emp-1', customCapabilities: [CAPABILITIES.VIEW_MY_PROFILE] }
    expect(scopeFor(CAPABILITIES.VIEW_MY_PROFILE, context)).toBe(DATA_SCOPES.SELF)
    const ownRecord = { employeeId: 'emp-1' }
    const someoneElsesRecord = { employeeId: 'emp-2' }
    expect(canForRecord(CAPABILITIES.VIEW_MY_PROFILE, ownRecord, context)).toBe(true)
    expect(canForRecord(CAPABILITIES.VIEW_MY_PROFILE, someoneElsesRecord, context)).toBe(false)
  })

  // Documented gap: the two real "my_" capabilities (VIEW_MY_PROFILE,
  // VIEW_MY_DEPARTMENT) are only ever granted to department_user/department_manager,
  // and systemRoleMatrix assigns every capability held by a department role
  // DEPARTMENT scope regardless of what the catalogue declares. So in practice
  // these two capabilities never resolve to SELF through canForRecord — the
  // self-relationship branch above is exercised by no real system role today.
  // The app currently only gates the /my-department route with a plain can()
  // check (no record, no canForRecord), so this has no known runtime impact,
  // but canForRecord should not be assumed to restrict "my profile" access to
  // the caller's own employee record.
  it('resolves VIEW_MY_PROFILE to DEPARTMENT (not SELF) for the department roles that actually hold it', () => {
    expect(scopeFor(CAPABILITIES.VIEW_MY_PROFILE, { role: ROLES.DEPARTMENT_USER })).toBe(DATA_SCOPES.DEPARTMENT)
    const context = { role: ROLES.DEPARTMENT_USER, organizationId: 'org-1', departmentIds: ['dept-1'], employeeId: 'emp-1' }
    const someoneElsesRecordInMyDepartment = { organizationId: 'org-1', departmentId: 'dept-1', employeeId: 'emp-2' }
    expect(canForRecord(CAPABILITIES.VIEW_MY_PROFILE, someoneElsesRecordInMyDepartment, context)).toBe(true)
  })
})

describe('canForRecord: assignment enforcement', () => {
  it('requires an active, matching assignment for every capability held by an assignment-only role', () => {
    const patient = { id: 'patient-1', resourceType: 'patient', organizationId: 'org-1' }
    const baseContext = { role: ROLES.DOCTOR_REVIEWER, organizationId: 'org-1' }
    expect(canForRecord(CAPABILITIES.REVIEW_CLINICAL, patient, baseContext)).toBe(false)
    expect(
      canForRecord(CAPABILITIES.REVIEW_CLINICAL, patient, {
        ...baseContext,
        assignments: [{ resourceType: 'patient', resourceId: 'patient-1', active: true }],
      }),
    ).toBe(true)
    expect(
      canForRecord(CAPABILITIES.REVIEW_CLINICAL, patient, {
        ...baseContext,
        assignments: [{ resourceType: 'patient', resourceId: 'patient-2', active: true }],
      }),
    ).toBe(false)
  })

  it('treats a cancelled, completed or expired assignment as inactive', () => {
    const committee = { id: 'committee-1', resourceType: 'committee', organizationId: 'org-1' }
    const context = { role: ROLES.COMMITTEE_SECRETARIAT, organizationId: 'org-1' }
    for (const status of ['cancelled', 'completed', 'expired']) {
      expect(
        canForRecord(CAPABILITIES.EDIT_COMMITTEE_MINUTES, committee, {
          ...context,
          assignments: [{ resourceType: 'committee', resourceId: 'committee-1', status }],
        }),
      ).toBe(false)
    }
    expect(
      canForRecord(CAPABILITIES.EDIT_COMMITTEE_MINUTES, committee, {
        ...context,
        assignments: [{ resourceType: 'committee', resourceId: 'committee-1', active: false }],
      }),
    ).toBe(false)
  })
})

describe('canForRecord: governed lifecycle', () => {
  it('blocks edit actions on a finalized record regardless of role', () => {
    const context = { role: ROLES.QUALITY_MANAGER, organizationId: 'org-1' }
    const draft = { organizationId: 'org-1' }
    const finalized = { organizationId: 'org-1', finalized: true }
    expect(canForRecord(CAPABILITIES.EDIT_RECORDS, draft, context)).toBe(true)
    expect(canForRecord(CAPABILITIES.EDIT_RECORDS, finalized, context)).toBe(false)
  })

  it('does not block a non-edit governance action on a finalized record', () => {
    const context = { role: ROLES.QUALITY_MANAGER, organizationId: 'org-1' }
    const finalized = { organizationId: 'org-1', finalized: true }
    expect(capabilityDefinition(CAPABILITIES.VOID_CONTROL_EXECUTION).actionType).not.toBe('edit')
    expect(canForRecord(CAPABILITIES.VOID_CONTROL_EXECUTION, finalized, context)).toBe(true)
  })
})

describe('canForRecord: ownership (currently unenforced)', () => {
  // Documented gap: docs/AUTHORIZATION_MODEL.md requires an OWNER record
  // relationship, and permissionEngine.js implements it, but no capability in
  // the catalogue currently sets requiresOwnership to true, so the branch is
  // dead code today. This test is a canary: it should start failing the day a
  // capability opts into ownership, which is the signal to add real
  // owner-vs-non-owner coverage for that capability here.
  it('has no capability that currently requires ownership', () => {
    const ownershipCapabilities = allCapabilityIds.filter((id) => capabilityDefinition(id).requiresOwnership)
    expect(ownershipCapabilities).toEqual([])
  })
})

describe('capabilitiesFor: add-ons extend but never replace the base role', () => {
  it('keeps add-on grants additive and free of duplicates', () => {
    const base = capabilitiesFor(ROLES.DEPARTMENT_USER)
    const withAddOn = capabilitiesFor(ROLES.DEPARTMENT_USER, [ADD_ON_CAPABILITIES.WASTE_MANAGEMENT])
    for (const capability of base) {
      expect(withAddOn).toContain(capability)
    }
    expect(withAddOn).toContain(CAPABILITIES.RECORD_WASTE)
    expect(new Set(withAddOn).size).toBe(withAddOn.length)
  })

  it('ignores an unknown add-on id instead of throwing', () => {
    expect(() => capabilitiesFor(ROLES.DEPARTMENT_USER, ['not_a_real_add_on'])).not.toThrow()
    expect(capabilitiesFor(ROLES.DEPARTMENT_USER, ['not_a_real_add_on'])).toEqual(capabilitiesFor(ROLES.DEPARTMENT_USER))
  })
})
