import { Navigate } from 'react-router-dom'
import { useTenant } from '../../core/tenant/TenantContext'
import { CAPABILITIES, can } from '../../core/permissions/roles'
import { IndicatorsPage } from './IndicatorsPage'

// /indicators: for whoever opens the executive dashboard, «Δείκτες» is that
// dashboard and this list lives in Management › Indicator definitions; an old
// link goes there (or to the dashboard for view-only roles). Everyone else keeps the list here.
export function IndicatorsRoute() {
  const { role, membership } = useTenant()
  const addOns = membership?.capabilities ?? [], custom = membership?.customCapabilities ?? []
  if (can(role, CAPABILITIES.VIEW_EXECUTIVE_DASHBOARD, addOns, custom)) return <Navigate to={can(role, CAPABILITIES.MANAGE_INDICATORS, addOns, custom) ? '/management?tab=indicatorDefinitions' : '/executive'} replace />
  return <IndicatorsPage />
}
