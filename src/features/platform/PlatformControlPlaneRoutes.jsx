import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { PlatformHealthView } from './PlatformHealthView'
import { PlatformAuditSecurityView } from './PlatformAuditSecurityView'
import { PlatformSettingsPage as PlatformSettingsWorkspace } from './PlatformSettingsPage'

function usePlatformOrganizations(){
  const {memberships}=useTenant()
  return memberships.map(item=>item.organization).filter(Boolean)
}

export function PlatformHealthPage(){
  const organizations=usePlatformOrganizations()
  const {language}=useLanguage()
  return <PlatformHealthView organizations={organizations} language={language} />
}

export function PlatformAuditSecurityPage(){
  const organizations=usePlatformOrganizations()
  const {language}=useLanguage()
  return <PlatformAuditSecurityView organizations={organizations} language={language} />
}

export function PlatformSettingsPage(){
  return <PlatformSettingsWorkspace />
}
