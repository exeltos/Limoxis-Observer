import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Activity, History, KeyRound } from 'lucide-react'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { ModuleTabs } from '../../design-system/ModuleTabs'
import { PlatformHealthView } from './PlatformHealthView'
import { PlatformAuditSecurityView } from './PlatformAuditSecurityView'
import { PlatformLoginSessionsView } from './PlatformLoginSessionsView'

function usePlatformOrganizations(){
  const {memberships}=useTenant()
  return memberships.map(item=>item.organization).filter(Boolean)
}

// Operational events now live as a tab of the platform history.
export function PlatformHealthPage(){
  return <Navigate to="/platform/audit?view=events" replace/>
}

// The platform history: the audit trail of actions, the operational events (errors, blocks, warnings) of every
// organization and the sign-ins (who, from which IP and device, for how long; failed attempts and locks).
export function PlatformAuditSecurityPage(){
  const organizations=usePlatformOrganizations()
  const {language}=useLanguage()
  const navigate=useNavigate()
  const [params]=useSearchParams()
  const en=language==='en'
  const view=['events','sessions'].includes(params.get('view'))?params.get('view'):'actions'
  const tabs=<ModuleTabs
    className="platform-history-tabs"
    activeId={view}
    onChange={id=>navigate(id==='actions'?'/platform/audit':`/platform/audit?view=${id}`)}
    ariaLabel={en?'History & Health':'Ιστορικό & Υγεία'}
    tabs={[
      {id:'actions',label:en?'Actions & access':'Ενέργειες & πρόσβαση',icon:History},
      {id:'events',label:en?'Events & errors':'Συμβάντα & σφάλματα',icon:Activity},
      {id:'sessions',label:en?'Sign-ins':'Συνδέσεις',icon:KeyRound},
    ]}
  />
  if(view==='sessions')return <PlatformLoginSessionsView language={language} tabs={tabs}/>
  return view==='events'
    ?<PlatformHealthView organizations={organizations} language={language} tabs={tabs}/>
    :<PlatformAuditSecurityView organizations={organizations} language={language} tabs={tabs}/>
}

// The platform settings now sit where each is used (owner, 10/11/2026): the Demo defaults on the Demo screen, the
// deletion grace period and the support email on Organizations, the maintenance message among the Announcements.
// An old link to /platform/settings opens Organizations.
export function PlatformSettingsPage(){
  return <Navigate to="/platform#organizations" replace/>
}
