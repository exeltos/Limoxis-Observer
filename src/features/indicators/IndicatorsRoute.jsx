import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Database, LineChart } from 'lucide-react'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { CAPABILITIES, can } from '../../core/permissions/roles'
import { Page } from '../../design-system/Page'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { IndicatorsPage } from './IndicatorsPage'
import { IndicatorDataPanel, useIndicatorDataItems } from './IndicatorDataPanel'

// /indicators: for whoever opens the executive dashboard, «Δείκτες» is that
// dashboard and this list lives in Management › Lists › Indicator definitions; an old
// link goes there (or to the dashboard for view-only roles). Everyone else keeps the list here,
// with a «Δεδομένα» tab (bed days, structural indicators, PPS) for those who enter them.
export function IndicatorsRoute() {
  const { role, membership } = useTenant()
  const { t, language } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const dataItems = useIndicatorDataItems()
  const addOns = membership?.capabilities ?? [], custom = membership?.customCapabilities ?? []
  if (can(role, CAPABILITIES.VIEW_EXECUTIVE_DASHBOARD, addOns, custom) && new URLSearchParams(location.search).get('tab') === 'data') return <Navigate to={`/executive${location.search}`} replace />
  if (can(role, CAPABILITIES.VIEW_EXECUTIVE_DASHBOARD, addOns, custom)) return <Navigate to={can(role, CAPABILITIES.MANAGE_INDICATORS, addOns, custom) && can(role, CAPABILITIES.VIEW_QUALITY, addOns, custom) ? '/quality/measures' : '/executive'} replace />
  if (!dataItems.length) return <IndicatorsPage />
  const params = new URLSearchParams(location.search)
  const view = params.get('tab') === 'data' ? 'data' : 'list'
  const tabs = <CanonicalTabs value={view} onChange={next => navigate({ pathname: location.pathname, search: next === 'data' ? '?tab=data' : '' }, { replace: true })} ariaLabel={t('indicators')}
    items={[{ value: 'list', label: t('indicators'), icon: LineChart }, { value: 'data', label: language === 'en' ? 'Data' : 'Δεδομένα', icon: Database }]} />
  if (view === 'data') return <Page fill title={t('indicators')} subtitle={language === 'en' ? 'What the indicators are calculated from and is entered by hand.' : 'Όσα καταχωρούνται με το χέρι και από αυτά υπολογίζονται οι δείκτες.'}>{tabs}<IndicatorDataPanel initial={params.get('item')} /></Page>
  return <IndicatorsPage tabsBar={tabs} />
}
