import { Navigate } from 'react-router-dom'
import { useTenant } from '../tenant/TenantContext'
import { can, canAny } from './roles'
import { RouteLoading } from '../../design-system/RouteLoading'

function denied() {
  return <Navigate to="/access-denied" replace />
}

export function RequireCapability({ capability, children }) {
  const { role, membership, loading } = useTenant()
  if (loading) return <RouteLoading />
  return can(role, capability, membership?.capabilities ?? [], membership?.customCapabilities ?? []) ? children : denied()
}

export function RequireAnyCapability({ capabilities=[], children }) {
  const { role, membership, loading } = useTenant()
  if (loading) return <RouteLoading />
  return canAny(role, capabilities, membership?.capabilities ?? [], membership?.customCapabilities ?? []) ? children : denied()
}
