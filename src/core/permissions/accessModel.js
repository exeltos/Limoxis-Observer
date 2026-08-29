export const ACTIONS = Object.freeze({
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  COMPLETE: 'complete',
  APPROVE: 'approve',
  DELETE: 'delete',
  EXPORT: 'export',
  ASSIGN: 'assign',
  MANAGE: 'manage',
})

export const SCOPES = Object.freeze({
  SELF: 'self',
  DEPARTMENT: 'department',
  ORGANIZATION: 'organization',
  PLATFORM: 'platform',
})

export function normalizeAccessContext({ role, departmentIds = [], addOns = [], assignments = [] } = {}) {
  return {
    role: role ?? null,
    departmentIds: [...new Set(departmentIds.filter(Boolean))],
    addOns: [...new Set(addOns.filter(Boolean))],
    assignments: assignments.filter(Boolean),
  }
}

export function isWithinScope(record, context) {
  if (!record || !context) return false
  if (record.scope === SCOPES.SELF) return record.userId === context.userId
  if (record.scope === SCOPES.DEPARTMENT) return context.departmentIds?.includes(record.departmentId)
  if (record.scope === SCOPES.ORGANIZATION) return record.organizationId === context.organizationId
  return false
}
