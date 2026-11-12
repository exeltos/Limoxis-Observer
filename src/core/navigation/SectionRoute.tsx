import { useMemo, type ComponentType, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { SectionTabsProvider, type SectionTabsValue } from '../../design-system/SectionTabs'
import type { CanonicalTab } from '../../design-system/CanonicalTabs'
import { useLanguage } from '../i18n/LanguageContext'
import { useTenant } from '../tenant/TenantContext'
import { SECTION_TABS, resolveSectionTab, sectionTabPath, sectionTabsFor } from './sectionTabs'

// One menu entry, several screens: reads ?tab=, keeps only the tabs the role
// may open (plus `allow`, a screen's own extra rule) and renders the chosen
// screen inside the section's frame (its name and tabs, see design-system/SectionTabs).
interface SectionRouteProps {
  sectionId: string
  icons?: Record<string, CanonicalTab['icon'] | ComponentType>
  allow?: ((tabId: string) => boolean) | null
  render: (tabId: string) => ReactNode
}

export function SectionRoute({ sectionId, icons = {}, allow = null, render }: SectionRouteProps) {
  const { t } = useLanguage()
  const { role, membership } = useTenant()
  const location = useLocation()
  const navigate = useNavigate()
  const section = SECTION_TABS[sectionId]
  const addOns = membership?.capabilities, customCapabilities = membership?.customCapabilities
  const allowed = useMemo(() => sectionTabsFor(sectionId, { role, addOns: addOns ?? [], customCapabilities: customCapabilities ?? [] }).filter(tab => !allow || allow(tab.id)), [sectionId, role, addOns, customCapabilities, allow])
  const params = new URLSearchParams(location.search)
  const current = resolveSectionTab(sectionId, params.get('tab'), allowed)
  const value = useMemo<SectionTabsValue | null>(() => current ? ({
    title: t(section.title),
    ariaLabel: t('sidebarNav.sectionTabs'),
    items: allowed.map(tab => ({ value: tab.id, label: t(tab.label), icon: icons[tab.id] as CanonicalTab['icon'] })),
    value: current,
    onChange: (id: string) => { if (id !== current) navigate(sectionTabPath(sectionId, id), { replace: true }) },
  }) : null, [t, section, allowed, icons, current, navigate, sectionId])
  if (!current) return <Navigate to="/access-denied" replace />
  return <SectionTabsProvider value={value}>{render(current)}</SectionTabsProvider>
}

// An old address of a merged screen: the same section, on the right tab, keeping its other query values.
export function SectionRedirect({ sectionId, tab, keep = true }: { sectionId: string; tab: string; keep?: boolean }) {
  const location = useLocation()
  const params = new URLSearchParams(keep ? location.search : '')
  // The screen's own ?tab= (e.g. the legislation register's) travels as ?view=.
  if (params.has('tab')) { params.set('view', params.get('tab') as string); params.delete('tab') }
  return <Navigate to={sectionTabPath(sectionId, tab, params.toString())} replace state={location.state} />
}
