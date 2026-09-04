import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { PlatformHealthView } from './PlatformHealthView'
import { PlatformAuditSecurityView } from './PlatformAuditSecurityView'

function usePlatformOrganizations(){
  const {memberships}=useTenant()
  return memberships.map(item=>item.organization).filter(Boolean)
}

export function PlatformHealthPage(){
  const organizations=usePlatformOrganizations()
  const {language}=useLanguage()
  const navigate=useNavigate()
  return <PlatformHealthView organizations={organizations} language={language} onBack={()=>navigate('/platform')} />
}

export function PlatformAuditSecurityPage(){
  const organizations=usePlatformOrganizations()
  const {language}=useLanguage()
  const navigate=useNavigate()
  return <PlatformAuditSecurityView organizations={organizations} language={language} onBack={()=>navigate('/platform')} />
}
