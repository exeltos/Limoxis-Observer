import { useMemo } from 'react'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES, ROLES } from '../../core/permissions/roles'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import { SIGNING_ROLES } from './regulationModel'

const EDITORS = [ROLES.HOSPITAL_ADMIN, ROLES.QUALITY_MANAGER, ROLES.INFECTION_CONTROL_LEAD]

// Who writes and approves regulations (as the database allows it: Quality,
// infection control, the administration, or whoever manages documents) and who
// keeps the platform's templates (the platform owner). An edition is signed by
// the hospital administrator and the infection control lead, each in their own
// role; the demo lets one person try both.
export function useRegulationAccess() {
  const { role, actualRole, isRolePreview, membership } = useTenant()
  const addOns = membership?.capabilities ?? [], custom = membership?.customCapabilities ?? []
  const isPlatformOwner = !isRolePreview && actualRole === ROLES.PLATFORM_OWNER
  const canManage = isPlatformOwner || EDITORS.includes(role) || can(role, CAPABILITIES.MANAGE_QUALITY, addOns, custom) || can(role, CAPABILITIES.MANAGE_DOCUMENTS, addOns, custom)
  const demo = isDemoDataEnvironment() || isOwnerPreview()
  const signRoles = SIGNING_ROLES.filter(item => isPlatformOwner || demo || role === item.appRole).map(item => item.value).join(',')
  return useMemo(() => ({ canManage, isPlatformOwner, signRoles: signRoles ? signRoles.split(',') : [] }), [canManage, isPlatformOwner, signRoles])
}
