import { Navigate } from 'react-router-dom'
import { useTenant } from '../tenant/TenantContext'
import { can, canAny } from './roles'

export function RequireCapability({ capability, children }) {
  const { role, membership } = useTenant()
  return can(role, capability, membership?.capabilities ?? [], membership?.customCapabilities ?? []) ? children : <Navigate to="/" replace />
}

export function RequireAnyCapability({ capabilities=[], children }) {
  const { role, membership } = useTenant()
  return canAny(role, capabilities, membership?.capabilities ?? [], membership?.customCapabilities ?? []) ? children : <Navigate to="/" replace />
}
