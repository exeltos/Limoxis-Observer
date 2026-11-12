import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useTenant } from '../tenant/TenantContext'
import { can, canAny, ROLES } from './roles'
import { RouteLoading } from '../../design-system/RouteLoading'
import type { TenantContextValue } from '../tenant/tenantTypes'

function denied() {
  return <Navigate to="/access-denied" replace />
}

function unresolvedTenantContext({ role, membership, loading }: Pick<TenantContextValue, 'role' | 'membership' | 'loading'>) {
  if (loading) return true
  if (!role) return true
  // Platform Owner may legitimately operate without an organization while in
  // the platform control plane. Every organization-scoped/preview role needs
  // a resolved membership before permissions can be evaluated safely.
  return role !== ROLES.PLATFORM_OWNER && !membership
}

export function RequireCapability({ capability, children }: { capability: string; children?: ReactNode }) {
  const { role, membership, loading } = useTenant()
  if (unresolvedTenantContext({ role, membership, loading })) return <RouteLoading />
  return can(role, capability, membership?.capabilities ?? [], membership?.customCapabilities ?? []) ? children : denied()
}

// excludeRoles: roles kept out even when they hold one of the capabilities (e.g. the HR office from the shift roster).
export function RequireAnyCapability({ capabilities=[], excludeRoles=[], children }: { capabilities?: readonly string[]; excludeRoles?: readonly string[]; children?: ReactNode }) {
  const { role, membership, loading } = useTenant()
  if (unresolvedTenantContext({ role, membership, loading })) return <RouteLoading />
  if (role && excludeRoles.includes(role)) return denied()
  return canAny(role, capabilities, membership?.capabilities ?? [], membership?.customCapabilities ?? []) ? children : denied()
}
