// What the user may do on one control record, which department the record opens
// on, and the record's overall status across the user's departments.
import { CAPABILITIES, ROLES, can } from '../../core/permissions/roles'
import { assignmentStatus, getAssignment, isControlDue } from './controlScheduling'

// The department the record opens on: the one asked for in the link, else the
// user's own, else the first one the user can see. Only visible ones qualify.
export function pickControlDepartment(visibleDepartments = [], requested = '', own = '') {
  if (requested && visibleDepartments.includes(requested)) return requested
  if (own && visibleDepartments.includes(own)) return own
  return visibleDepartments[0] || ''
}

// Overdue in any department wins, then due soon, otherwise scheduled.
export function controlOverallStatus(record, departments = []) {
  const states = departments.map(department => assignmentStatus(record, department))
  if (states.includes('overdue')) return 'overdue'
  if (states.includes('dueSoon')) return 'dueSoon'
  return 'scheduled'
}

export function controlRecordPermissions({ role, membership, record, actorId }) {
  const addOns = membership?.capabilities ?? []
  const custom = membership?.customCapabilities ?? []
  const has = capability => can(role, capability, addOns, custom)

  const canManageControls = has(CAPABILITIES.MANAGE_CONTROLS)
  const hasExecuteCapability = has(CAPABILITIES.EXECUTE_CONTROL)
  const canEditDefinition = has(CAPABILITIES.EDIT_CONTROL_DEFINITION)
  const canVoidExecution = has(CAPABILITIES.VOID_CONTROL_EXECUTION)
  const canEditExecution = has(CAPABILITIES.EDIT_CONTROL_EXECUTION)

  // The infection control lead may edit the controls the infection control team defined.
  const canEditCentral = canEditDefinition && role === ROLES.INFECTION_CONTROL_LEAD && record.createdByScope === 'infection_control'
  const canModifyDefinition = canEditDefinition && (canManageControls || canEditCentral)
  const canDeleteDraft = record.status === 'draft' && has(CAPABILITIES.DELETE_CONTROL_DRAFT)

  // A department's control can be executed when it is assigned there and is due,
  // or when a draft execution is waiting; control managers may execute any time.
  const canExecuteDepartment = department => {
    const assignment = getAssignment(record, department)
    return Boolean(assignment) && hasExecuteCapability && (Boolean(assignment.hasDraft) || canManageControls || isControlDue(record, department))
  }

  // Only completed executions can be voided or corrected. A correction is open
  // to control managers, or to the person who carried the execution out.
  const canVoidHistory = entry => entry.status === 'completed' && canVoidExecution
  const canEditHistory = entry => entry.status === 'completed' && canEditExecution && (canManageControls || entry.actorId === actorId)

  return {
    canManageControls,
    canModifyDefinition,
    canDeleteDraft,
    canRemoveDefinition: canDeleteDraft || canModifyDefinition,
    canExecuteDepartment,
    canCancelHistory: canVoidHistory,
    canDeleteHistory: canVoidHistory,
    canEditHistory,
  }
}
