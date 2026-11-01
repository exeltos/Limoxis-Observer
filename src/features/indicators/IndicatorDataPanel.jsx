import { Building2, Search } from 'lucide-react'
import { useLanguage, translate } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { CAPABILITIES, can } from '../../core/permissions/roles'
import { ManagementRail } from '../management/ManagementRail'
import { HospitalStructurePanel } from '../management/HospitalStructurePanel'
import { PrevalenceSurveyPanel } from '../management/PrevalenceSurveyPanel'
import '../management/managementCenter.css'

// «Δεδομένα» of the Indicators: what the indicators are calculated from and is entered by hand (structural
// indicators, the point prevalence survey). The bed days have a tab of their own in the Management Center.
export function indicatorDataItems({ role, membership, language }) {
  const ok = capability => can(role, capability, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  const lang = language === 'en' ? 'en' : 'el'
  return [
    ...(ok(CAPABILITIES.MANAGE_HOSPITAL_STRUCTURE) ? [{ id: 'hospitalStructure', label: translate('copy.managementCopy.structuralIndicators', lang), icon: Building2, tone: 'indigo', render: () => <HospitalStructurePanel /> }] : []),
    ...(ok(CAPABILITIES.RECORD_PREVALENCE_SURVEY) ? [{ id: 'prevalenceSurvey', label: translate('copy.managementCopy.prevalenceSurveyPps', lang), icon: Search, tone: 'teal', render: () => <PrevalenceSurveyPanel /> }] : []),
  ]
}

export function useIndicatorDataItems() {
  const { language } = useLanguage()
  const { role, membership } = useTenant()
  return indicatorDataItems({ role, membership, language })
}

export function IndicatorDataPanel({ initial = null }) {
  const { language } = useLanguage()
  const items = useIndicatorDataItems()
  return <ManagementRail items={items} initial={initial} ariaLabel={language === 'en' ? 'Indicator data' : 'Δεδομένα δεικτών'} />
}
