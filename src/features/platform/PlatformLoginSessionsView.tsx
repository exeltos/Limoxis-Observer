import { useCallback,useEffect,useMemo,useState,type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle,LockKeyhole,RefreshCw,ShieldAlert } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { IconButton } from '../../design-system/IconButton'
import { Button } from '../../design-system/Button'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RegistryTotals } from '../../design-system/RegistryTotals'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { ExportMenu } from '../../design-system/ExportMenu'
import { exportRegistry } from '../../core/export/registryExports'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { listLoginAttempts,listLoginSessions,releaseLoginLock } from './platformAuditService'
import { athensDateTime,athensTime } from './platformOverviewShared'
import { RecordLink } from './RecordLink'
import { useRecordLinks,usePlatformUsers } from './useRecordLinks'
import { useEndLoginSessions } from './useEndLoginSessions'
import { deviceLabel,durationText,sessionStatus } from './loginSessionsModel'
import './loginSessions.css'
import type { LoginAttempt,LoginLock,LoginSession,UserRef } from './platformTypes'

// One date format everywhere: dd/mm/yyyy, hh:mm in Athens time.
const fmt=athensDateTime
const short=athensDateTime
const hhmm=(value: unknown)=>athensTime(value)

// Ιστορικό & Υγεία › Συνδέσεις (Ιδιοκτήτης Πλατφόρμας, 9/11/2026): ποιος συνδέθηκε, από ποια IP και συσκευή,
// πότε και για πόση ώρα· οι αποτυχημένες προσπάθειες και τα κλειδώματα. Ο Ιδιοκτήτης τερματίζει μια σύνδεση
// ή όλες τις συνδέσεις ενός χρήστη και ξεκλειδώνει πριν λήξει το κλείδωμα.
export function PlatformLoginSessionsView({language='el',tabs=null}: {language?: string,tabs?: ReactNode}){
  const en=language==='en'
  const tx=(elText: string,enText: string)=>en?enText:elText
  const {confirm,notify,notifyError}=useFeedback()
  const [params]=useSearchParams()
  const [mode,setMode]=useState(()=>params.get('mode')==='attempts'?'attempts':'sessions')
  const [sessions,setSessions]=useState<LoginSession[]>([])
  const [attempts,setAttempts]=useState<LoginAttempt[]>([])
  const [locks,setLocks]=useState<LoginLock[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<unknown>(null)
  const [query,setQuery]=useState('')
  const [status,setStatus]=useState('all')
  const [result,setResult]=useState('all')
  const [page,setPage]=useState(1)
  const [pageSize,setPageSize]=useState(15)
  const [now,setNow]=useState(()=>Date.now())
  // A name opens that user's record (not the Platform Owner, who has none); Back returns here, in the same view.
  const users=usePlatformUsers()
  const {userOf,openUser}=useRecordLinks({users,returnTo:`/platform/audit?view=sessions${mode==='attempts'?'&mode=attempts':''}`})
  const userLink=(ref: UserRef,label: string)=>{const person=userOf(ref);return person?<RecordLink title={tx('Άνοιγμα καρτέλας χρήστη','Open user record')} onClick={()=>openUser(person)}>{label}</RecordLink>:label}

  const load=useCallback(async()=>{
    setLoading(true);setError(null)
    try{
      const [nextSessions,nextAttempts]=await Promise.all([listLoginSessions({days:30}),listLoginAttempts({days:30})])
      setSessions([...nextSessions].sort((a,b)=>String(b.startedAt||'').localeCompare(String(a.startedAt||''))));setAttempts([...nextAttempts.attempts].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))));setLocks(nextAttempts.locks);setNow(Date.now())
    }catch(err){setSessions([]);setAttempts([]);setLocks([]);setError(err)}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{void load()},[load])
  useEffect(()=>{const id=window.setInterval(()=>void load(),60000);return()=>window.clearInterval(id)},[load])
  useEffect(()=>setPage(1),[mode,query,status,result,pageSize])

  const activeLocks=locks.filter(lock=>!lock.releasedAt&&new Date(lock.lockedUntil).getTime()>now)
  const online=sessions.filter(row=>row.online).length
  const active=sessions.filter(row=>row.active).length
  const failed24=attempts.filter(row=>!row.success&&now-new Date(row.createdAt).getTime()<86400000).length
  const needle=query.trim().toLocaleLowerCase(en?'en-US':'el-GR')
  const matches=(text: string)=>!needle||String(text).toLocaleLowerCase(en?'en-US':'el-GR').includes(needle)

  const filteredSessions=useMemo(()=>sessions.filter(row=>{
    if(status==='online'&&!row.online)return false
    if(status==='active'&&!row.active)return false
    if(status==='ended'&&row.active)return false
    return matches(`${row.fullName} ${row.username} ${row.email} ${row.organizations} ${row.ip} ${row.lastIp} ${deviceLabel(row.userAgent,en)}`)
  }),[sessions,status,needle,en]) // eslint-disable-line react-hooks/exhaustive-deps
  const filteredAttempts=useMemo(()=>attempts.filter(row=>{
    if(result==='failed'&&row.success)return false
    if(result==='success'&&!row.success)return false
    return matches(`${row.identifier} ${row.ip} ${deviceLabel(row.userAgent,en)}`)
  }),[attempts,result,needle,en]) // eslint-disable-line react-hooks/exhaustive-deps
  const list=mode==='sessions'?filteredSessions:filteredAttempts
  const totalPages=Math.max(1,Math.ceil(list.length/pageSize)),safePage=Math.min(page,totalPages),paged=list.slice((safePage-1)*pageSize,safePage*pageSize)

  const {menuItems:sessionMenuItems}=useEndLoginSessions({tx,en,onDone:load})
  async function unlock(lock: LoginLock){
    const ok=await confirm({title:tx('Ξεκλείδωμα','Unlock'),message:lock.kind==='ip'?tx(`Η IP ${lock.subject} μπορεί να δοκιμάσει ξανά σύνδεση αμέσως.`,`IP ${lock.subject} may try to sign in again right away.`):tx(`Ο λογαριασμός «${lock.subject}» μπορεί να συνδεθεί ξανά αμέσως.`,`The account “${lock.subject}” may sign in again right away.`),confirmLabel:tx('Ξεκλείδωμα','Unlock')})
    if(!ok)return
    try{await releaseLoginLock(lock.id);notify(tx('Ξεκλειδώθηκε.','Unlocked.'));await load()}
    catch(err){notifyError(err,'save',{operation:'platform_release_login_lock'})}
  }

  const resultLabel=(row: LoginAttempt)=>row.success?tx('Επιτυχία','Success'):row.reason==='locked'?tx('Κλειδωμένο','Locked'):row.reason==='unknown_user'?tx('Άγνωστος χρήστης','Unknown user'):tx('Λάθος κωδικός','Wrong password')
  const exportItems=[
    {id:'sessions',label:tx('Excel: συνδέσεις','Excel: sessions'),disabled:!filteredSessions.length,onClick:()=>exportRegistry({name:tx('syndeseis','sign-ins'),headers:[tx('Χρήστης','User'),tx('Όνομα χρήστη','Username'),tx('Οργανισμός','Organization'),'IP',tx('Τελευταία IP','Last IP'),tx('Συσκευή','Device'),tx('Έναρξη','Start'),tx('Τελευταία δραστηριότητα','Last activity'),tx('Λήξη','End'),tx('Διάρκεια','Duration'),tx('Κατάσταση','Status')],rows:filteredSessions.map(row=>[row.fullName,row.username,row.isPlatformOwner?tx('Ιδιοκτήτης Πλατφόρμας','Platform Owner'):row.organizations,row.ip,row.lastIp,deviceLabel(row.userAgent,en),fmt(row.startedAt),fmt(row.lastSeenAt),fmt(row.endedAt),durationText(row,now,en),sessionStatus(row,en).label])})},
    {id:'attempts',label:tx('Excel: προσπάθειες σύνδεσης','Excel: sign-in attempts'),disabled:!filteredAttempts.length,onClick:()=>exportRegistry({name:tx('prospatheies-syndesis','sign-in-attempts'),headers:[tx('Ημερομηνία / ώρα','Date / time'),tx('Όνομα χρήστη / email','Username / e-mail'),'IP',tx('Συσκευή','Device'),tx('Αποτέλεσμα','Result')],rows:filteredAttempts.map(row=>[fmt(row.createdAt),row.identifier,row.ip,deviceLabel(row.userAgent,en),resultLabel(row)])})},
  ]

  return <Page title={tx('Ιστορικό & Υγεία','History & Health')} actions={<div className="row-actions"><ExportMenu items={exportItems}/><IconButton label={tx('Ανανέωση','Refresh')} onClick={load} disabled={loading}><RefreshCw size={16}/></IconButton></div>}>
    {tabs}
    {activeLocks.length>0&&<div className="login-locks" role="status">
      <ShieldAlert size={18} aria-hidden="true"/>
      <div className="login-locks-list">
        <strong>{tx('Κλειδωμένες συνδέσεις λόγω αποτυχημένων προσπαθειών','Sign-ins locked after failed attempts')}</strong>
        {activeLocks.map(lock=><div key={lock.id} className="login-lock-row">
          <span><LockKeyhole size={14} aria-hidden="true"/>{lock.kind==='ip'?tx(`IP ${lock.subject}`,`IP ${lock.subject}`):<span>{tx('Λογαριασμός «','Account “')}{userLink({identifier:lock.subject},lock.subject)}{tx('»','”')}</span>} · {lock.failures} {tx('λάθη','failures')} · {tx('έως','until')} {hhmm(lock.lockedUntil)}</span>
          <Button variant="secondary" onClick={()=>void unlock(lock)}>{tx('Ξεκλείδωμα','Unlock')}</Button>
        </div>)}
      </div>
    </div>}
    <div className="platform-registry-shell workspace-column">
      <FilterBar query={query} onQueryChange={setQuery} placeholder={tx('Αναζήτηση χρήστη, οργανισμού ή IP…','Search user, organization or IP…')} activeAdvancedCount={mode==='sessions'?(status!=='all'?1:0):(result!=='all'?1:0)} onClear={()=>{setQuery('');setStatus('all');setResult('all')}}
        end={<div className="login-sessions-end"><ModeSwitch ariaLabel={tx('Προβολή','View')} value={mode} onChange={setMode} options={[{value:'sessions',label:tx('Συνδέσεις','Sessions')},{value:'attempts',label:tx('Προσπάθειες','Attempts')}]}/><RegistryTotals label={tx('Σύνολα συνδέσεων','Sign-in totals')} items={mode==='sessions'?[
          {key:'online',value:online,always:true,label:tx('συνδεδεμένοι τώρα','online now'),tone:online?'good':undefined,active:status==='online',onClick:()=>setStatus(status==='online'?'all':'online')},
          {key:'active',value:active,label:tx('ενεργές συνδέσεις','active sessions'),active:status==='active',onClick:()=>setStatus(status==='active'?'all':'active')},
          {key:'all',value:sessions.length,always:true,label:tx('συνδέσεις 30 ημερών','sessions, 30 days')},
        ]:[
          {key:'failed',value:failed24,always:true,label:tx('αποτυχίες 24ώρου','failures, 24 h'),tone:failed24?'warning':undefined,active:result==='failed',onClick:()=>setResult(result==='failed'?'all':'failed')},
          {key:'locks',value:activeLocks.length,label:tx('κλειδώματα σε ισχύ','active locks'),tone:'danger'},
          {key:'all',value:attempts.length,always:true,label:tx('προσπάθειες 30 ημερών','attempts, 30 days')},
        ]}/></div>}>
        {mode==='sessions'
          ?<FilterSelect label={tx('Κατάσταση','Status')} value={status} onChange={setStatus}><option value="all">{tx('Όλες','All')}</option><option value="online">{tx('Συνδεδεμένοι τώρα','Online now')}</option><option value="active">{tx('Ενεργές','Active')}</option><option value="ended">{tx('Έληξαν','Ended')}</option></FilterSelect>
          :<FilterSelect label={tx('Αποτέλεσμα','Result')} value={result} onChange={setResult}><option value="all">{tx('Όλα','All')}</option><option value="failed">{tx('Αποτυχίες','Failures')}</option><option value="success">{tx('Επιτυχίες','Successes')}</option></FilterSelect>}
      </FilterBar>
      {loading&&!list.length?<div className="inline-empty">{tx('Φόρτωση συνδέσεων…','Loading sign-ins…')}</div>:list.length?<>
        <div className="table-wrap scroll-table diagnostics-table-wrap">{mode==='sessions'
          ?<table className="data-table sticky-table diagnostics-table login-sessions-table"><thead><tr><th>{tx('Χρήστης','User')}</th><th>IP</th><th>{tx('Συσκευή','Device')}</th><th>{tx('Έναρξη','Start')}</th><th>{tx('Τελευταία δραστηριότητα','Last activity')}</th><th>{tx('Διάρκεια','Duration')}</th><th>{tx('Κατάσταση','Status')}</th><th><span className="lo-visually-hidden">{tx('Ενέργειες','Actions')}</span></th></tr></thead>
            <tbody>{(paged as LoginSession[]).map(row=>{const state=sessionStatus(row,en);return <tr key={row.sessionId}>
              <td><strong>{row.isPlatformOwner?(row.fullName||row.username||'—'):userLink({userId:row.userId},row.fullName||row.username||'—')}</strong><small>{row.isPlatformOwner?tx('Ιδιοκτήτης Πλατφόρμας','Platform Owner'):(row.organizations||row.username||'—')}</small></td>
              <td><span className="login-ip">{row.ip||'—'}</span>{row.lastIp&&row.lastIp!==row.ip&&<small>{tx('τώρα','now')} {row.lastIp}</small>}</td>
              <td>{deviceLabel(row.userAgent,en)}</td>
              <td className="login-when">{short(row.startedAt)}</td>
              <td className="login-when">{short(row.endedAt||row.lastSeenAt)}</td>
              <td className="login-when">{durationText(row,now,en)}</td>
              <td><span className={`login-status is-${state.tone}`}>{state.label}</span></td>
              <td className="login-actions">{row.active&&<OverflowMenu label={tx('Ενέργειες σύνδεσης','Session actions')} items={sessionMenuItems(row)}/>}</td>
            </tr>})}</tbody></table>
          :<table className="data-table sticky-table diagnostics-table"><thead><tr><th>{tx('Ημερομηνία / ώρα','Date / time')}</th><th>{tx('Όνομα χρήστη / email','Username / e-mail')}</th><th>IP</th><th>{tx('Συσκευή','Device')}</th><th>{tx('Αποτέλεσμα','Result')}</th></tr></thead>
            <tbody>{(paged as LoginAttempt[]).map(row=><tr key={row.id}><td className="login-when"><strong>{short(row.createdAt)}</strong></td><td>{userLink({identifier:row.identifier},row.identifier)}</td><td><span className="login-ip">{row.ip||'—'}</span></td><td>{deviceLabel(row.userAgent,en)}</td><td><span className={`login-status is-${row.success?'good':row.reason==='locked'?'danger':'warning'}`}>{resultLabel(row)}</span></td></tr>)}</tbody></table>}
        </div>
        <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={list.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
      </>:error?null:<div className="registry-empty-state"><strong>{mode==='sessions'?tx('Δεν υπάρχουν συνδέσεις για τα επιλεγμένα φίλτρα.','No sessions match the selected filters.'):tx('Δεν υπάρχουν προσπάθειες σύνδεσης για τα επιλεγμένα φίλτρα.','No sign-in attempts match the selected filters.')}</strong></div>}
      {Boolean(error)&&!loading&&<div className="data-access-state warning" role="status"><AlertTriangle size={16}/><span>{tx('Δεν ήταν δυνατή η φόρτωση των συνδέσεων.','Sign-ins could not be loaded.')}</span></div>}
      <p className="login-sessions-note">{tx('Μετά από 5 λάθος κωδικούς σε 15 λεπτά ο λογαριασμός κλειδώνει για 15 λεπτά· μετά από 20 λάθη από την ίδια IP κλειδώνει η IP. Ο τερματισμός μιας σύνδεσης ισχύει μέσα σε 1–2 λεπτά.','After 5 wrong passwords in 15 minutes the account is locked for 15 minutes; after 20 from one IP, the IP is locked. Ending a session takes effect within 1–2 minutes.')}</p>
    </div>
  </Page>
}
