import { useCallback,useEffect,useMemo,useState } from 'react'
import { AlertTriangle,CheckCircle2,Info,RefreshCw,ShieldAlert,XCircle } from 'lucide-react'
import { IconButton } from '../../design-system/IconButton'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTotals } from '../../design-system/RegistryTotals'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { listRuntimeEvents } from '../../core/diagnostics/runtimeDiagnosticsService'
import { roleLabel } from '../../core/permissions/roleLabels'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { deviceLabel,durationText,sessionStatus } from './loginSessionsModel'
import { useEndLoginSessions } from './useEndLoginSessions'
import { athensDateTime } from './platformOverviewShared'
import { RecordLink } from './RecordLink'
import './loginSessions.css'

const severityMeta={error:{el:'Αποτυχία',en:'Error',icon:XCircle},blocked:{el:'Μη επιτρεπτή ενέργεια',en:'Blocked action',icon:ShieldAlert},warning:{el:'Προειδοποίηση',en:'Warning',icon:AlertTriangle},success:{el:'Επιτυχία',en:'Success',icon:CheckCircle2},info:{el:'Πληροφορία',en:'Information',icon:Info}}
const moduleLabels={indicators:{el:'Δείκτες',en:'Indicators'},laboratory:{el:'Εργαστήριο',en:'Laboratory'},management:{el:'Κέντρο Διαχείρισης',en:'Management Center'},surveillance:{el:'Επιτήρηση',en:'Surveillance'},quality:{el:'Ποιότητα',en:'Quality'},prevention:{el:'Πρόληψη',en:'Prevention'},controls:{el:'Έλεγχοι',en:'Controls'},employees:{el:'Εργαζόμενοι',en:'Employees'},patients:{el:'Ασθενείς',en:'Patients'},training:{el:'Εκπαίδευση',en:'Training'},committees:{el:'Επιτροπές',en:'Committees'},documents:{el:'Έγγραφα',en:'Documents'},platform:{el:'Πλατφόρμα',en:'Platform'},auth:{el:'Πρόσβαση',en:'Access'}}
const operationLabels={platform_organization_create:{el:'Δημιουργία οργανισμού',en:'Create organization'},platform_organization_update:{el:'Ενημέρωση οργανισμού',en:'Update organization'},platform_organization_delete:{el:'Διαγραφή οργανισμού',en:'Delete organization'},platform_organization_status:{el:'Αλλαγή κατάστασης οργανισμού',en:'Change organization status'},platform_users_load:{el:'Φόρτωση χρηστών',en:'Load users'},platform_diagnostics_load:{el:'Φόρτωση καταγραφής λειτουργίας',en:'Load activity log'}}
const messageLabels={'indicator access denied':{el:'Δεν επιτρέπεται η πρόσβαση στους δείκτες.',en:'Indicator access denied.'},'access denied':{el:'Δεν επιτρέπεται η πρόσβαση.',en:'Access denied.'},'permission denied':{el:'Δεν υπάρχουν τα απαιτούμενα δικαιώματα.',en:'Permission denied.'}}
function humanize(value){return String(value||'').replaceAll('_',' ').replace(/\b\w/g,ch=>ch.toUpperCase())}
export function localModule(value,language){return moduleLabels[value]?.[language==='en'?'en':'el']||humanize(value)||'—'}
const routeLabels={dashboard:{el:'Αρχική',en:'Home'},'my-department':{el:'Το τμήμα μου',en:'My department'},analysis:{el:'Αναφορές',en:'Reports'},executive:{el:'Διοικητική εικόνα',en:'Executive view'},kitchen:{el:'Κουζίνα',en:'Kitchen'},pharmacy:{el:'Φαρμακείο',en:'Pharmacy'},calendar:{el:'Ημερολόγιο',en:'Calendar'},library:{el:'Βιβλιοθήκη',en:'Library'},legislation:{el:'Νομοθεσία',en:'Legislation'},meetings:{el:'Συνεδριάσεις',en:'Meetings'},registers:{el:'Μητρώα',en:'Registers'},about:{el:'Σχετικά',en:'About'},login:{el:'Σύνδεση',en:'Sign in'},activate:{el:'Ενεργοποίηση',en:'Activation'},settings:{el:'Ρυθμίσεις',en:'Settings'}}
// The screen a route belongs to, by name (never the raw path): «Επιτήρηση · Νέα εγγραφή». Unknown screens read «—».
export function localRoute(route,language){const en=language==='en',parts=String(route||'').split('?')[0].split('#')[0].split('/').filter(Boolean);if(!parts.length)return '—';const key=parts[0],name=(routeLabels[key]||moduleLabels[key])?.[en?'en':'el'];if(!name)return '—';return parts[1]==='new'?`${name} · ${en?'New record':'Νέα εγγραφή'}`:name}
function localOperation(value,language){return operationLabels[value]?.[language==='en'?'en':'el']||humanize(value)||'—'}
function localMessage(value,language){const raw=String(value||'').trim(),localized=messageLabels[raw.toLowerCase()];return localized?.[language==='en'?'en':'el']||raw||'—'}
// dd/mm/yyyy, hh:mm in Athens time, as on every owner list.
const fmtDate=value=>athensDateTime(value)

const shortTime=athensDateTime

// «Δραστηριότητα» of an organization record (owner, 9/11/2026): Συμβάντα (technical and operational events, no
// clinical content) or Συνδέσεις (the sign-ins of its users, with the same «⋯» as Ιστορικό & Υγεία › Συνδέσεις).
export function HospitalDiagnosticsPanel({organization,language='el',sessions=[],loadingSessions=false,onReloadSessions,knownUserIds=null,onOpenUser}){
 const en=language==='en',tx=(elText,enText)=>en?enText:elText,{notifyError}=useFeedback()
 // A user of this organization opens that user's record; Back returns to this tab.
 const userLink=(userId,label)=>userId&&onOpenUser&&knownUserIds?.has(userId)?<RecordLink title={tx('Άνοιγμα καρτέλας χρήστη','Open user record')} onClick={()=>onOpenUser(userId)}>{label}</RecordLink>:label
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(null),[severity,setSeverity]=useState('all'),[module,setModule]=useState('all'),[query,setQuery]=useState(''),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(15)
 const [mode,setMode]=useState('events'),[sessionStatusFilter,setSessionStatusFilter]=useState('all'),[now,setNow]=useState(()=>Date.now())
 const {menuItems:sessionMenuItems}=useEndLoginSessions({tx,en,onDone:async()=>{await onReloadSessions?.();setNow(Date.now())}})
 const load=useCallback(async()=>{if(!organization?.id){setRows([]);setLoading(false);return}setLoading(true);setError(null);try{setRows(await listRuntimeEvents(organization.id,{limit:500}))}catch(err){setError(err);notifyError(err,'load',{operation:'platform_diagnostics_load'})}finally{setLoading(false)}},[organization?.id,notifyError])
 useEffect(()=>{void load()},[load])
 const modules=useMemo(()=>[...new Set(rows.map(x=>x.module).filter(Boolean))].sort(),[rows])
 const filtered=useMemo(()=>rows.filter(row=>{if(severity!=='all'&&row.severity!==severity)return false;if(module!=='all'&&row.module!==module)return false;const hay=`${row.message} ${row.actorName} ${row.role} ${row.module} ${row.operation} ${row.route} ${row.diagnosticCode}`.toLowerCase();return hay.includes(query.trim().toLowerCase())}),[rows,severity,module,query])
 const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)),safePage=Math.min(page,totalPages),pagedRows=filtered.slice((safePage-1)*pageSize,safePage*pageSize)
 const needle=query.trim().toLocaleLowerCase(en?'en-US':'el-GR')
 const filteredSessions=useMemo(()=>sessions.filter(row=>{if(sessionStatusFilter==='online'&&!row.online)return false;if(sessionStatusFilter==='active'&&!row.active)return false;if(sessionStatusFilter==='ended'&&row.active)return false;return !needle||`${row.fullName} ${row.username} ${row.email} ${row.ip} ${row.lastIp} ${deviceLabel(row.userAgent,en)}`.toLocaleLowerCase(en?'en-US':'el-GR').includes(needle)}).sort((a,b)=>String(b.startedAt||'').localeCompare(String(a.startedAt||''))),[sessions,sessionStatusFilter,needle,en])
 const listLength=mode==='sessions'?filteredSessions.length:filtered.length,listPages=Math.max(1,Math.ceil(listLength/pageSize)),listPage=Math.min(page,listPages),pagedSessions=filteredSessions.slice((listPage-1)*pageSize,listPage*pageSize)
 useEffect(()=>setPage(1),[query,severity,module,pageSize,mode,sessionStatusFilter]);useEffect(()=>{if(page>listPages)setPage(listPages)},[page,listPages])
 const count=key=>rows.filter(x=>x.severity===key).length,errorCount=count('error'),blockedCount=count('blocked'),warningCount=count('warning')
 const online=sessions.filter(row=>row.online).length,activeSessions=sessions.filter(row=>row.active).length
 const toggleSeverity=key=>setSeverity(current=>current===key?'all':key),toggleSession=key=>setSessionStatusFilter(current=>current===key?'all':key)
 const totals=mode==='sessions'?[
  {key:'online',value:online,always:true,label:tx('συνδεδεμένοι τώρα','online now'),tone:online?'good':undefined,active:sessionStatusFilter==='online',onClick:()=>toggleSession('online')},
  {key:'active',value:activeSessions,label:tx('ενεργές συνδέσεις','active sessions'),active:sessionStatusFilter==='active',onClick:()=>toggleSession('active')},
  {key:'all',value:sessions.length,always:true,label:tx('συνδέσεις 90 ημερών','sessions, 90 days')},
 ]:[
  {key:'all',value:rows.length,always:true,label:tx('συμβάντα','events')},
  {key:'error',value:errorCount,label:tx('αποτυχίες','errors'),tone:'danger',active:severity==='error',onClick:()=>toggleSeverity('error')},
  {key:'blocked',value:blockedCount,label:tx('αποκλεισμοί','blocked'),tone:'danger',active:severity==='blocked',onClick:()=>toggleSeverity('blocked')},
  {key:'warning',value:warningCount,label:tx('προειδοποιήσεις','warnings'),tone:'warning',active:severity==='warning',onClick:()=>toggleSeverity('warning')},
 ]
 const refresh=()=>{if(mode==='sessions'){setNow(Date.now());void onReloadSessions?.()}else void load()}

 let registryContent
 if(mode==='sessions'){
  registryContent=loadingSessions&&!sessions.length?<div className="inline-empty">{tx('Φόρτωση συνδέσεων…','Loading sign-ins…')}</div>:filteredSessions.length?<><div className="scroll-table diagnostics-table-wrap"><table className="data-table sticky-table diagnostics-table login-sessions-table"><thead><tr><th>{tx('Χρήστης','User')}</th><th>IP</th><th>{tx('Συσκευή','Device')}</th><th>{tx('Έναρξη','Start')}</th><th>{tx('Τελευταία δραστηριότητα','Last activity')}</th><th>{tx('Διάρκεια','Duration')}</th><th>{tx('Κατάσταση','Status')}</th><th><span className="lo-visually-hidden">{tx('Ενέργειες','Actions')}</span></th></tr></thead>
   <tbody>{pagedSessions.map(row=>{const state=sessionStatus(row,en);return <tr key={row.sessionId}><td><strong>{userLink(row.userId,row.fullName||row.username||'—')}</strong><small>{row.username||'—'}</small></td><td><span className="login-ip">{row.ip||'—'}</span>{row.lastIp&&row.lastIp!==row.ip&&<small>{tx('τώρα','now')} {row.lastIp}</small>}</td><td>{deviceLabel(row.userAgent,en)}</td><td className="login-when">{shortTime(row.startedAt)}</td><td className="login-when">{shortTime(row.endedAt||row.lastSeenAt)}</td><td className="login-when">{durationText(row,now,en)}</td><td><span className={`login-status is-${state.tone}`}>{state.label}</span></td><td className="login-actions">{row.active&&<OverflowMenu label={tx('Ενέργειες σύνδεσης','Session actions')} items={sessionMenuItems(row)}/>}</td></tr>})}</tbody></table></div><RegistryPagination language={language} page={listPage} totalPages={listPages} totalItems={filteredSessions.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/></>
   :<div className="registry-empty-state"><strong>{sessions.length?tx('Δεν υπάρχουν συνδέσεις για τα επιλεγμένα φίλτρα.','No sessions match the selected filters.'):tx('Κανένας χρήστης του οργανισμού δεν συνδέθηκε τις τελευταίες 90 ημέρες.','No user of this organization signed in during the last 90 days.')}</strong></div>
 }else if(loading){
  registryContent=<div className="inline-empty">{tx('Φόρτωση καταγραφής…','Loading activity log…')}</div>
 }else if(error){
  registryContent=<div className="data-access-state error" role="alert"><span>{tx('Δεν ήταν δυνατή η φόρτωση της καταγραφής.','Activity log could not be loaded.')}</span><button type="button" onClick={load}>{tx('Επανάληψη','Retry')}</button></div>
 }else{
  registryContent=<><div className="scroll-table diagnostics-table-wrap"><table className="data-table sticky-table diagnostics-table"><thead><tr><th>{tx('Ημερομηνία / ώρα','Date / time')}</th><th>{tx('Κατάσταση','Status')}</th><th>{tx('Ενότητα','Area')}</th><th>{tx('Περιγραφή','Description')}</th><th>{tx('Χρήστης','User')}</th><th>{tx('Ενέργεια','Action')}</th><th>{tx('Έκδοση','Version')}</th></tr></thead><tbody>{pagedRows.map(row=>{const meta=severityMeta[row.severity]||severityMeta.info,Icon=meta.icon;return <tr key={row.id}><td><strong>{fmtDate(row.occurredAt,language)}</strong></td><td><span className={`status-badge diagnostics-${row.severity}`}><Icon size={13}/>{meta[language]||meta.el}</span></td><td><strong>{localModule(row.module,language)}</strong>{localRoute(row.route,language)!==localModule(row.module,language)&&<small title={row.route||undefined}>{localRoute(row.route,language)}</small>}</td><td><strong>{localMessage(row.message,language)}</strong>{row.diagnosticCode&&<small>{tx('Αναφορά','Reference')}: {row.diagnosticCode}</small>}</td><td><strong>{userLink(row.actorId,row.actorName)}</strong><small>{roleLabel(row.role,language)}</small></td><td>{localOperation(row.operation,language)}</td><td>{row.appVersion||'—'}</td></tr>})}</tbody></table>{!filtered.length&&<div className="registry-empty-state"><strong>{tx('Δεν υπάρχουν συμβάντα που να αντιστοιχούν στα φίλτρα.','No events match the selected filters.')}</strong></div>}</div><RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/></>
 }

 // Clinical record content is never shown here: only technical and operational events and sign-ins.
 return <div className="platform-diagnostics-view workspace-column workspace-fill">
  <section className="surface registry-workspace workspace-column workspace-fill platform-diagnostics-registry">
   <FilterBar query={query} onQueryChange={setQuery} placeholder={mode==='sessions'?tx('Αναζήτηση χρήστη ή IP…','Search user or IP…'):tx('Αναζήτηση περιγραφής, χρήστη ή ενότητας…','Search description, user or area…')} activeAdvancedCount={mode==='sessions'?(sessionStatusFilter!=='all'?1:0):(severity!=='all'?1:0)+(module!=='all'?1:0)} onClear={()=>{setQuery('');setSeverity('all');setModule('all');setSessionStatusFilter('all')}}
    end={<div className="login-sessions-end"><ModeSwitch ariaLabel={tx('Προβολή','View')} value={mode} onChange={setMode} options={[{value:'events',label:tx('Συμβάντα','Events')},{value:'sessions',label:tx('Συνδέσεις','Sign-ins')}]}/><RegistryTotals label={mode==='sessions'?tx('Σύνολα συνδέσεων','Sign-in totals'):tx('Σύνολα συμβάντων','Event totals')} items={totals}/><IconButton label={tx('Ανανέωση','Refresh')} onClick={refresh} disabled={mode==='sessions'?loadingSessions:loading}><RefreshCw size={16}/></IconButton></div>}>
    {mode==='sessions'
     ?<FilterSelect label={tx('Κατάσταση','Status')} value={sessionStatusFilter} onChange={setSessionStatusFilter}><option value="all">{tx('Όλες','All')}</option><option value="online">{tx('Συνδεδεμένοι τώρα','Online now')}</option><option value="active">{tx('Ενεργές','Active')}</option><option value="ended">{tx('Έληξαν','Ended')}</option></FilterSelect>
     :<><FilterSelect label={tx('Κατάσταση','Status')} value={severity} onChange={setSeverity}><option value="all">{tx('Όλες','All')}</option>{Object.entries(severityMeta).map(([value,meta])=><option key={value} value={value}>{meta[language]||meta.el}</option>)}</FilterSelect><FilterSelect label={tx('Ενότητα','Area')} value={module} onChange={setModule}><option value="all">{tx('Όλες','All')}</option>{modules.map(value=><option key={value} value={value}>{localModule(value,language)}</option>)}</FilterSelect></>}
   </FilterBar>
   {registryContent}
  </section>
 </div>
}
