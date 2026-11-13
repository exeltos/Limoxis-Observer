import { useEffect,useState } from 'react'
import { ArrowRight,ShieldAlert } from 'lucide-react'
import { listLoginAttempts,listLoginSessions } from './platformAuditService'
import { deviceLabel,durationText } from './loginSessionsModel'
import { athensTime } from './platformOverviewShared'
import { RecordLink } from './RecordLink'
import { useRecordLinks } from './useRecordLinks'
import './loginSessions.css'
import type { Translate } from '../../types/featureTypes'
import type { LoginAttempt,LoginLock,LoginSession,PlatformUserRef } from './platformTypes'

const LIVE_ROWS=5
const initialsOf=(name: string)=>String(name||'?').replace(/^Δρ\.\s*/,'').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toLocaleUpperCase('el-GR')||'?'
const hhmm=athensTime
// The sign-ins and attempts of the last 24 hours, read every minute; `failed` when they could not be read.
type LiveState = { sessions: LoginSession[], attempts: LoginAttempt[], locks: LoginLock[], now: number, failed?: boolean }

// Επισκόπηση › «Συνδεδεμένοι τώρα»: who is signed in right now, from which IP and device and since when,
// plus the failed sign-ins of the last 24 hours and the active locks (Ιστορικό & Υγεία › Συνδέσεις has the full list).
export function PlatformLiveSessionsCard({tx,en=false,onNavigate,users=[]}: {tx: Translate,en?: boolean,onNavigate: (to: string)=>void,users?: PlatformUserRef[]}){
  // Each person opens their record (not the Platform Owner, who has none); Back returns to the Overview.
  const {userOf,openUser}=useRecordLinks({users,returnTo:'/platform'})
  const nameOf=(row: LoginSession)=>{const name=row.fullName||row.username||'—',person=row.isPlatformOwner?null:userOf({userId:row.userId});return person?<RecordLink title={tx('Άνοιγμα καρτέλας χρήστη','Open user record')} onClick={()=>openUser(person)}>{name}</RecordLink>:name}
  const [state,setState]=useState<LiveState | null>(null)
  useEffect(()=>{
    let active=true
    const load=()=>Promise.all([listLoginSessions({days:1}),listLoginAttempts({days:1})])
      .then(([sessions,{attempts,locks}])=>{if(active)setState({sessions,attempts,locks,now:Date.now()})})
      .catch(()=>{if(active)setState(current=>current||{sessions:[],attempts:[],locks:[],now:Date.now(),failed:true})})
    void load()
    const timer=window.setInterval(load,60000)
    return()=>{active=false;window.clearInterval(timer)}
  },[])
  const online=(state?.sessions||[]).filter((row: LoginSession)=>row.online)
  const failed=(state?.attempts||[]).filter((row: LoginAttempt)=>!row.success).length
  const locks=(state?.locks||[]).filter((lock: LoginLock)=>!lock.releasedAt&&new Date(lock.lockedUntil).getTime()>(state?.now||0)).length
  const open=(view: string)=>onNavigate(`/platform/audit?view=sessions${view?`&mode=${view}`:''}`)
  return <section className="platform-dashboard-panel platform-live-sessions">
    <header><h3>{tx('Συνδεδεμένοι τώρα','Online now')}</h3><span className={`platform-live-count${online.length?' is-on':''}`}>{state==null?'…':online.length}</span></header>
    {(failed>0||locks>0)&&<button type="button" className="platform-live-alert" onClick={()=>open('attempts')}><ShieldAlert size={16} aria-hidden="true"/><span>{[failed?tx(`${failed} αποτυχίες σύνδεσης / 24ώρο`,`${failed} failed sign-ins / 24 h`):'',locks?tx(`${locks} κλείδωμα`,`${locks} lock(s)`):''].filter(Boolean).join(' · ')}</span><ArrowRight size={14} aria-hidden="true"/></button>}
    {state==null?<p className="platform-overview-empty">{tx('Φόρτωση…','Loading…')}</p>
      :online.length?<ul className="platform-live-list">{online.slice(0,LIVE_ROWS).map((row: LoginSession)=><li key={row.sessionId}>
        <span className="platform-overview-avatar" aria-hidden="true">{initialsOf(row.fullName||row.username)}</span>
        <span className="platform-live-copy"><strong>{nameOf(row)}</strong><small>{[row.isPlatformOwner?tx('Ιδιοκτήτης Πλατφόρμας','Platform Owner'):row.organizations,row.lastIp||row.ip,deviceLabel(row.userAgent,en)].filter(Boolean).join(' · ')}</small></span>
        <span className="platform-live-time">{tx('από','since')} {hhmm(row.startedAt)}<small>{durationText(row,state.now,en)}</small></span>
      </li>)}</ul>
      :<p className="platform-overview-empty">{state.failed?tx('Δεν ήταν δυνατή η φόρτωση των συνδέσεων.','Sign-ins could not be loaded.'):tx('Κανείς δεν είναι συνδεδεμένος αυτή τη στιγμή.','Nobody is signed in right now.')}</p>}
    <button type="button" className="platform-overview-link platform-live-more" onClick={()=>open('')}>{online.length>LIVE_ROWS?tx(`Όλες οι συνδέσεις (${online.length} τώρα)`,`All sign-ins (${online.length} now)`):tx('Όλες οι συνδέσεις','All sign-ins')}<ArrowRight size={14} aria-hidden="true"/></button>
  </section>
}
