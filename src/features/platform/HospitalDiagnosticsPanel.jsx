import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, RefreshCw, ShieldAlert, XCircle } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { listRuntimeEvents } from '../../core/diagnostics/runtimeDiagnosticsService'
import { useFeedback } from '../../core/feedback/FeedbackContext'

const severityMeta={
  error:{el:'Αποτυχία',en:'Error',icon:XCircle},
  blocked:{el:'Μη επιτρεπτή ενέργεια',en:'Blocked',icon:ShieldAlert},
  warning:{el:'Προειδοποίηση',en:'Warning',icon:AlertTriangle},
  success:{el:'Επιτυχία',en:'Success',icon:CheckCircle2},
  info:{el:'Πληροφορία',en:'Information',icon:Info},
}

function fmtDate(value,language){
  if(!value)return '—'
  try{return new Intl.DateTimeFormat(language==='en'?'en-GB':'el-GR',{dateStyle:'short',timeStyle:'medium'}).format(new Date(value))}catch{return value}
}

export function HospitalDiagnosticsPanel({organization,language='el'}){
  const en=language==='en'
  const {notifyError}=useFeedback()
  const [rows,setRows]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState(null)
  const [severity,setSeverity]=useState('all')
  const [module,setModule]=useState('all')
  const [query,setQuery]=useState('')

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
      <div><h3>{en?'System events':'Συμβάντα συστήματος'}</h3><p>{en?'Messages generated while users work in this hospital. No clinical record contents are collected here.':'Μηνύματα που δημιουργήθηκαν κατά τη χρήση της εφαρμογής στο συγκεκριμένο νοσοκομείο. Δεν συλλέγεται εδώ περιεχόμενο κλινικών φακέλων.'}</p></div>
      <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw size={15}/>{en?' Refresh':' Ανανέωση'}</Button>
    </div>
    <div className="module-summary-strip diagnostics-summary-strip">
      <div className="diagnostics-summary"><span>{en?'Total':'Σύνολο'}</span><strong>{rows.length}</strong></div>
      <div className="diagnostics-summary"><span>{en?'Errors / blocked':'Αποτυχίες / αποκλεισμοί'}</span><strong>{errorCount}</strong></div>
      <div className="diagnostics-summary"><span>{en?'Warnings':'Προειδοποιήσεις'}</span><strong>{warningCount}</strong></div>
    </div>
    <FilterBar query={query} onQueryChange={setQuery} placeholder={en?'Search message, user or module…':'Αναζήτηση μηνύματος, χρήστη ή ενότητας…'} activeAdvancedCount={(severity!=='all'?1:0)+(module!=='all'?1:0)} onClear={()=>{setQuery('');setSeverity('all');setModule('all')}}>
      <FilterSelect label={en?'Severity':'Κατηγορία'} value={severity} onChange={setSeverity}><option value="all">{en?'All':'Όλα'}</option>{Object.entries(severityMeta).map(([value,meta])=><option key={value} value={value}>{meta[language]||meta.el}</option>)}</FilterSelect>
      <FilterSelect label={en?'Module':'Ενότητα'} value={module} onChange={setModule}><option value="all">{en?'All':'Όλες'}</option>{modules.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>
    </FilterBar>
    {loading?<div className="inline-empty">{en?'Loading events…':'Φόρτωση συμβάντων…'}</div>:error?<div className="data-access-state error" role="alert"><span>{en?'Events could not be loaded.':'Δεν ήταν δυνατή η φόρτωση των συμβάντων.'}</span><button type="button" onClick={load}>{en?'Retry':'Επανάληψη'}</button></div>:filtered.length?<div className="scroll-table"><table className="data-table sticky-table diagnostics-table"><thead><tr><th>{en?'Time':'Ημερομηνία / ώρα'}</th><th>{en?'Type':'Τύπος'}</th><th>{en?'Module':'Ενότητα'}</th><th>{en?'Message shown':'Μήνυμα που εμφανίστηκε'}</th><th>{en?'User / role':'Χρήστης / ρόλος'}</th><th>{en?'Action':'Ενέργεια'}</th><th>{en?'Version':'Έκδοση'}</th></tr></thead><tbody>{filtered.map(row=>{const meta=severityMeta[row.severity]||severityMeta.info;const Icon=meta.icon;return <tr key={row.id}><td><strong>{fmtDate(row.occurredAt,language)}</strong></td><td><span className={`status-badge diagnostics-${row.severity}`}><Icon size={13}/>{meta[language]||meta.el}</span></td><td><strong>{row.module||'—'}</strong><small>{row.route||'—'}</small></td><td><strong>{row.message}</strong>{row.diagnosticCode&&<small>{en?'Reference':'Αναφορά'}: {row.diagnosticCode}</small>}</td><td><strong>{row.actorName}</strong><small>{row.role?.replaceAll('_',' ')||'—'}</small></td><td>{row.operation||'—'}</td><td>{row.appVersion||'—'}</td></tr>})}</tbody></table></div>:<div className="inline-empty">{en?'No matching system events.':'Δεν υπάρχουν αντίστοιχα συμβάντα συστήματος.'}</div>}
  </div>
}
