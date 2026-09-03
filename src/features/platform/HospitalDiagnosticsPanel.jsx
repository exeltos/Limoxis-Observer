import { useCallback,useEffect,useMemo,useState } from 'react'
import { AlertTriangle,CheckCircle2,Info,RefreshCw,ShieldAlert,XCircle } from 'lucide-react'
import { IconButton } from '../../design-system/IconButton'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { listRuntimeEvents } from '../../core/diagnostics/runtimeDiagnosticsService'
import { roleLabel } from '../../core/permissions/roleLabels'
import { useFeedback } from '../../core/feedback/FeedbackContext'

const severityMeta={
  error:{el:'Αποτυχία',en:'Error',icon:XCircle},
  blocked:{el:'Μη επιτρεπτή ενέργεια',en:'Blocked action',icon:ShieldAlert},
  warning:{el:'Προειδοποίηση',en:'Warning',icon:AlertTriangle},
  success:{el:'Επιτυχία',en:'Success',icon:CheckCircle2},
  info:{el:'Πληροφορία',en:'Information',icon:Info},
}
const moduleLabels={
  indicators:{el:'Δείκτες',en:'Indicators'},laboratory:{el:'Εργαστήριο',en:'Laboratory'},management:{el:'Κέντρο Διαχείρισης',en:'Management Center'},surveillance:{el:'Επιτήρηση',en:'Surveillance'},quality:{el:'Ποιότητα',en:'Quality'},prevention:{el:'Πρόληψη',en:'Prevention'},controls:{el:'Έλεγχοι',en:'Controls'},employees:{el:'Εργαζόμενοι',en:'Employees'},patients:{el:'Ασθενείς',en:'Patients'},training:{el:'Εκπαίδευση',en:'Training'},committees:{el:'Επιτροπές',en:'Committees'},documents:{el:'Έγγραφα',en:'Documents'},platform:{el:'Πλατφόρμα',en:'Platform'},auth:{el:'Πρόσβαση',en:'Access'},
}
const operationLabels={
  platform_organization_create:{el:'Δημιουργία οργανισμού',en:'Create organization'},platform_organization_update:{el:'Ενημέρωση οργανισμού',en:'Update organization'},platform_organization_delete:{el:'Διαγραφή οργανισμού',en:'Delete organization'},platform_organization_status:{el:'Αλλαγή κατάστασης οργανισμού',en:'Change organization status'},platform_users_load:{el:'Φόρτωση χρηστών',en:'Load users'},platform_diagnostics_load:{el:'Φόρτωση καταγραφής λειτουργίας',en:'Load activity log'},
}
function humanize(value){return String(value||'').replaceAll('_',' ').replace(/\b\w/g,ch=>ch.toUpperCase())}
function localModule(value,language){return moduleLabels[value]?.[language==='en'?'en':'el']||humanize(value)||'—'}
function localOperation(value,language){return operationLabels[value]?.[language==='en'?'en':'el']||humanize(value)||'—'}
function fmtDate(value,language){if(!value)return '—';try{return new Intl.DateTimeFormat(language==='en'?'en-GB':'el-GR',{dateStyle:'short',timeStyle:'medium'}).format(new Date(value))}catch{return value}}

export function HospitalDiagnosticsPanel({organization,language='el'}){
  const en=language==='en',tx=(elText,enText)=>en?enText:elText
  const {notifyError}=useFeedback()
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(null),[severity,setSeverity]=useState('all'),[module,setModule]=useState('all'),[query,setQuery]=useState('')

  const load=useCallback(async()=>{
    if(!organization?.id){setRows([]);setLoading(false);return}
    setLoading(true);setError(null)
    try{setRows(await listRuntimeEvents(organization.id,{limit:500}))}
    catch(err){setError(err);notifyError(err,'load',{operation:'platform_diagnostics_load'})}
    finally{setLoading(false)}
  },[organization?.id,notifyError])
  useEffect(()=>{void load()},[load])

  const modules=useMemo(()=>[...new Set(rows.map(x=>x.module).filter(Boolean))].sort(),[rows])
  const filtered=useMemo(()=>rows.filter(row=>{
    if(severity!=='all'&&row.severity!==severity)return false
    if(module!=='all'&&row.module!==module)return false
    const hay=`${row.message} ${row.actorName} ${row.role} ${row.module} ${row.operation} ${row.route} ${row.diagnosticCode}`.toLowerCase()
    return hay.includes(query.trim().toLowerCase())
  }),[rows,severity,module,query])
  const errorCount=rows.filter(x=>x.severity==='error'||x.severity==='blocked').length
  const warningCount=rows.filter(x=>x.severity==='warning').length

  return <div className="platform-diagnostics-panel">
    <div className="platform-section-heading">
      <div><h3>{tx('Καταγραφή λειτουργίας & συμβάντων','System activity & events')}</h3><p>{tx('Τεχνικά και λειτουργικά συμβάντα που καταγράφηκαν κατά τη χρήση του οργανισμού. Δεν εμφανίζεται περιεχόμενο κλινικών φακέλων.','Technical and operational events recorded while this organization is used. Clinical record content is not shown here.')}</p></div>
      <IconButton label={tx('Ανανέωση','Refresh')} onClick={load} disabled={loading}><RefreshCw size={16}/></IconButton>
    </div>
    <div className="diagnostics-summary-strip">
      <div className="diagnostics-summary"><span>{tx('Σύνολο συμβάντων','Total events')}</span><strong>{rows.length}</strong></div>
      <div className="diagnostics-summary"><span>{tx('Αποτυχίες / αποκλεισμοί','Errors / blocked')}</span><strong>{errorCount}</strong></div>
      <div className="diagnostics-summary"><span>{tx('Προειδοποιήσεις','Warnings')}</span><strong>{warningCount}</strong></div>
    </div>
    <FilterBar query={query} onQueryChange={setQuery} placeholder={tx('Αναζήτηση περιγραφής, χρήστη ή ενότητας…','Search description, user or area…')} activeAdvancedCount={(severity!=='all'?1:0)+(module!=='all'?1:0)} onClear={()=>{setQuery('');setSeverity('all');setModule('all')}}>
      <FilterSelect label={tx('Κατάσταση','Status')} value={severity} onChange={setSeverity}><option value="all">{tx('Όλες','All')}</option>{Object.entries(severityMeta).map(([value,meta])=><option key={value} value={value}>{meta[language]||meta.el}</option>)}</FilterSelect>
      <FilterSelect label={tx('Ενότητα','Area')} value={module} onChange={setModule}><option value="all">{tx('Όλες','All')}</option>{modules.map(value=><option key={value} value={value}>{localModule(value,language)}</option>)}</FilterSelect>
    </FilterBar>
    {loading?<div className="inline-empty">{tx('Φόρτωση καταγραφής…','Loading activity log…')}</div>:error?<div className="data-access-state error" role="alert"><span>{tx('Δεν ήταν δυνατή η φόρτωση της καταγραφής.','Activity log could not be loaded.')}</span><button type="button" onClick={load}>{tx('Επανάληψη','Retry')}</button></div>:filtered.length?<div className="table-wrap scroll-table diagnostics-table-wrap"><table className="data-table sticky-table diagnostics-table"><thead><tr><th>{tx('Ημερομηνία / ώρα','Date / time')}</th><th>{tx('Κατάσταση','Status')}</th><th>{tx('Ενότητα','Area')}</th><th>{tx('Περιγραφή','Description')}</th><th>{tx('Χρήστης','User')}</th><th>{tx('Ενέργεια','Action')}</th><th>{tx('Έκδοση','Version')}</th></tr></thead><tbody>{filtered.map(row=>{const meta=severityMeta[row.severity]||severityMeta.info;const Icon=meta.icon;return <tr key={row.id}><td><strong>{fmtDate(row.occurredAt,language)}</strong></td><td><span className={`status-badge diagnostics-${row.severity}`}><Icon size={13}/>{meta[language]||meta.el}</span></td><td><strong>{localModule(row.module,language)}</strong><small>{row.route||'—'}</small></td><td><strong>{row.message}</strong>{row.diagnosticCode&&<small>{tx('Αναφορά','Reference')}: {row.diagnosticCode}</small>}</td><td><strong>{row.actorName}</strong><small>{roleLabel(row.role,language)}</small></td><td>{localOperation(row.operation,language)}</td><td>{row.appVersion||'—'}</td></tr>})}</tbody></table></div>:<div className="inline-empty">{tx('Δεν υπάρχουν συμβάντα που να αντιστοιχούν στα φίλτρα.','No events match the selected filters.')}</div>}
  </div>
}
