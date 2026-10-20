import { Navigate, useLocation } from 'react-router-dom'
import { useTenant } from '../../core/tenant/TenantContext'
import { CAPABILITIES, can } from '../../core/permissions/roles'
import { AnalysisPage } from './AnalysisPage'
import { indicatorTabOf } from './analysisPageModel'

// /analysis: whoever opens «Δείκτες» (the Executive dashboard) finds the analysis
// there, one tab per area — an old link opens the matching tab. The others (e.g.
// the Infection Control Lead) keep the Analysis page itself.
export function AnalysisRoute() {
  const { role, membership } = useTenant()
  const location = useLocation()
  if (can(role, CAPABILITIES.VIEW_EXECUTIVE_DASHBOARD, membership?.capabilities ?? [], membership?.customCapabilities ?? [])) {
    const tab = indicatorTabOf(new URLSearchParams(location.search).get('tab') || '')
    return <Navigate to={{ pathname: '/executive', search: tab === 'summary' ? '' : `?tab=${tab}` }} replace />
  }
  return <AnalysisPage />
}
