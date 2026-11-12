// Shared types for the permission model (checked by `npm run typecheck:strict`).
// The capability and role ids are the values of CAPABILITIES and ROLES.
import type { CAPABILITIES } from './capabilityCatalogue'
import type { ROLES } from './systemRoleMatrix'
import type { DATA_SCOPES } from './scopeTypes'

export type Capability = typeof CAPABILITIES[keyof typeof CAPABILITIES]
export type Role = typeof ROLES[keyof typeof ROLES]
export type DataScope = typeof DATA_SCOPES[keyof typeof DATA_SCOPES]

/** One capability of the catalogue. */
export interface CapabilityDefinition {
  id: string
  domain: string
  actionType: string
  descriptionEl: string
  descriptionEn: string
  allowedScopes: readonly DataScope[]
  defaultScope: DataScope
  maximumScope: DataScope
  customRoleClass: string
  sensitivity: string
  requiresOwnership?: boolean
  requiresAssignment?: boolean
}

/** Who is asking: the inputs of the permission checks. */
export interface AccessContext {
  role?: string | null
  addOns?: string[]
  customCapabilities?: string[]
  scopeOverrides?: Record<string, string>
  organizationId?: string | null
  userId?: string | null
  employeeId?: string | null
  departmentIds?: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- assignment rows of several tables
  assignments?: Array<Record<string, any>>
}

/** The parts of a record the permission checks read. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any record of any module
export type AccessRecord = Record<string, any> & {
  id?: string
  dbId?: string
  organizationId?: string | null
  departmentId?: string | null
  employeeId?: string | null
  ownerId?: string | null
  createdBy?: string | null
  resourceType?: string
  finalized?: boolean
}
