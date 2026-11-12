import { useMemo } from 'react'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES, ROLES } from '../../core/permissions/roles'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'

// Who reads the hospital's legislation register (Quality), who keeps it
// (Quality management) and who keeps the platform's library (the Platform Owner).
export function useLegislationAccess() {
  const { role, actualRole, isRolePreview, membership } = useTenant()
  const addOns = membership?.capabilities ?? [], custom = membership?.customCapabilities ?? []
  const isPlatformOwner = !isRolePreview && actualRole === ROLES.PLATFORM_OWNER
  const canManage = isPlatformOwner || can(role, CAPABILITIES.MANAGE_QUALITY, addOns, custom)
  const isDemo = isDemoDataEnvironment()
  return useMemo(() => ({ isPlatformOwner, canManage, isDemo }), [isPlatformOwner, canManage, isDemo])
}
