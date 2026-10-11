import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Activity, History } from 'lucide-react'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { ModuleTabs } from '../../design-system/ModuleTabs'
import { PlatformHealthView } from './PlatformHealthView'
import { PlatformAuditSecurityView } from './PlatformAuditSecurityView'
import { PlatformSettingsPage as PlatformSettingsWorkspace } from './PlatformSettingsPage'

function usePlatformOrganizations(){
  const {memberships}=useTenant()
  return memberships.map(item=>item.organization).filter(Boolean)
}

// Operational events now live as a tab of the platform history.
export function PlatformHealthPage(){
  return <Navigate to="/platform/audit?view=events" replace/>
}

// The platform history: the audit trail of actions and, in a second tab, the
// operational events (errors, blocks, warnings) of every organization.
export function PlatformAuditSecurityPage(){
  const organizations=usePlatformOrganizations()
  const {language}=useLanguage()
  const navigate=useNavigate()
  const [params]=useSearchParams()
  const en=language==='en'
  const view=params.get('view')==='events'?'events':'actions'
  const tabs=<ModuleTabs
    className="platform-history-tabs"
    activeId={view}
    onChange={id=>navigate(id==='events'?'/platform/audit?view=events':'/platform/audit')}
    ariaLabel={en?'Audit & Security':'Ιστορικό & Ασφάλεια'}
    tabs={[
      {id:'actions',label:en?'Actions & access':'Ενέργειες & πρόσβαση',icon:History},
      {id:'events',label:en?'Events & errors':'Συμβάντα & σφάλματα',icon:Activity},
    ]}
  />
  return view==='events'
    ?<PlatformHealthView organizations={organizations} language={language} tabs={tabs}/>
    :<PlatformAuditSecurityView organizations={organizations} language={language} tabs={tabs}/>
}

export function PlatformSettingsPage(){
  return <PlatformSettingsWorkspace />
}
