import { useMemo } from 'react'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES, ROLES } from '../../core/permissions/roles'

// Who does what with a department register (as the database policies of
// 20261105100000_department_registers.sql):
// - Quality defines registers and reads every indicator, never the names;
// - the department records its cases and sees their case number and name;
// - a hospital administrator may record but, outside a department, sees no names.
export function useRegisterAccess() {
  const { role, membership, actualRole, isRolePreview, isDemo } = useTenant()
  const addOns = membership?.capabilities ?? []
  const custom = membership?.customCapabilities ?? []
  const ownerFullAccess = !isRolePreview && actualRole === ROLES.PLATFORM_OWNER
  const canDefine = ownerFullAccess || can(role, CAPABILITIES.MANAGE_QUALITY, addOns, custom)
  const seesAll = ownerFullAccess || can(role, CAPABILITIES.VIEW_QUALITY, addOns, custom)
  // The demo user (every role at once) works as a member of every department.
  const everyDepartment = ownerFullAccess || (isDemo && role === ROLES.DEMO)
  const departmentKey = [...(membership?.departmentIds || []), membership?.previewDepartment].filter(Boolean).join('|')
  // The same object while the user and role stay the same: lists filtered with it
  // (and screens that report their rows back) would otherwise render without end.
  return useMemo(() => {
    const ownDepartments = departmentKey ? departmentKey.split('|') : []
    const isMember = register => Boolean(register) && (everyDepartment || ownDepartments.includes(register.departmentId) || ownDepartments.includes(register.department))
    return {
      canDefine,
      seesAll,
      isMember,
      canSee: register => seesAll || isMember(register),
      canRecord: register => Boolean(register) && register.status === 'active' && (isMember(register) || role === ROLES.HOSPITAL_ADMIN),
      canSeeIdentity: register => isMember(register),
      // Reopening a closed period: Quality or the department's manager.
      canReopen: register => canDefine || (isMember(register) && [ROLES.DEPARTMENT_MANAGER, ROLES.HOSPITAL_ADMIN, ROLES.DEMO].includes(role)),
    }
  }, [canDefine, seesAll, everyDepartment, departmentKey, role])
}
