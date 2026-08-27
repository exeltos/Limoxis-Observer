import { CAPABILITIES, can } from '../permissions/roles.js'

export const UI_ACTIONS = Object.freeze({
  CREATE: 'create', EDIT: 'edit', DELETE: 'delete', COMPLETE: 'complete', APPROVE: 'approve',
  ATTACH: 'attach', PRINT: 'print', EXPORT: 'export', ASSIGN: 'assign', MANAGE: 'manage',
})

export const ACTION_CAPABILITY = Object.freeze({
  [UI_ACTIONS.CREATE]: CAPABILITIES.CREATE_RECORDS,
  [UI_ACTIONS.EDIT]: CAPABILITIES.EDIT_RECORDS,
  [UI_ACTIONS.DELETE]: CAPABILITIES.DELETE_RECORDS,
  [UI_ACTIONS.COMPLETE]: CAPABILITIES.COMPLETE_RECORDS,
  [UI_ACTIONS.APPROVE]: CAPABILITIES.APPROVE_RECORDS,
  [UI_ACTIONS.ATTACH]: CAPABILITIES.ATTACH_FILES,
  [UI_ACTIONS.PRINT]: CAPABILITIES.PRINT_RECORDS,
  [UI_ACTIONS.EXPORT]: CAPABILITIES.EXPORT_RECORDS,
  [UI_ACTIONS.ASSIGN]: CAPABILITIES.ASSIGN_RECORDS,
  [UI_ACTIONS.MANAGE]: CAPABILITIES.MANAGE_ORGANIZATION,
})

export function canPerform({ role, addOns = [], customCapabilities = [], action, resourceCapability, locked = false } = {}) {
  if (!role || !action) return false
  if (locked && [UI_ACTIONS.EDIT, UI_ACTIONS.DELETE].includes(action)) return false
  const generic = ACTION_CAPABILITY[action]
  if (resourceCapability) return can(role, resourceCapability, addOns, customCapabilities)
  return generic ? can(role, generic, addOns, customCapabilities) : true
}
