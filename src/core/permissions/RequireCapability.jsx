import { Navigate } from 'react-router-dom'
import { useTenant } from '../tenant/TenantContext'
import { can } from './roles'

export function RequireCapability({ capability, children }) {
  const { role, membership } = useTenant()
  return can(role, capability, membership?.capabilities ?? [], membership?.customCapabilities ?? []) ? children : <Navigate to="/" replace />
}
