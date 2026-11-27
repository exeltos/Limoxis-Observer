// The staff of a kitchen department (departments.is_kitchen) take the kitchen's capabilities from their department, as the
// database does in private.current_user_kitchen_orgs (owner, 27/11/2026): the Department Manager manages the kitchen
// (catalogue, limits, HACCP, sign-off), the Department User records receipts and production days; both read it.
import { CAPABILITIES } from './capabilityCatalogue.js'
import { ROLES } from './systemRoleMatrix.js'

type Scope = { department?: { is_kitchen?: boolean | null, is_active?: boolean | null } | null } | null | undefined

export function kitchenDepartmentCapabilities(role: string | null | undefined, scopes: readonly Scope[] | null | undefined): string[] {
  // An inactive department grants nothing, as in the database (d.is_active).
  if (!(scopes || []).some(scope => scope?.department?.is_kitchen && scope.department.is_active !== false)) return []
  if (role === ROLES.DEPARTMENT_MANAGER) return [CAPABILITIES.VIEW_KITCHEN, CAPABILITIES.RECORD_KITCHEN, CAPABILITIES.MANAGE_KITCHEN]
  if (role === ROLES.DEPARTMENT_USER) return [CAPABILITIES.VIEW_KITCHEN, CAPABILITIES.RECORD_KITCHEN]
  return []
}
