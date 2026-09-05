import { useCallback,useEffect,useMemo,useState } from 'react'
import { Activity,AlertTriangle,CheckCircle2,RefreshCw,ShieldAlert,XCircle } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { BackButton } from '../../design-system/BackButton'
import { IconButton } from '../../design-system/IconButton'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { listRuntimeEvents } from '../../core/diagnostics/runtimeDiagnosticsService'

const severityMeta={
  error:{el:'Αποτυχία',en:'Error',icon:XCircle},
  blocked:{el:'Αποκλεισμός',en:'Blocked',icon:ShieldAlert},
  warning:{el:'Προειδοποίηση',en:'Warning',icon:AlertTriangle},
  success:{el:'Επιτυχία',en:'Success',icon:CheckCircle2},
  info:{el:'Πληροφορία',en:'Information',icon:Activity},
}

function fmtDate(value){
  if(!value)return '—'
  const date=new Date(value)
  if(Number.isNaN(date.getTime()))return value
  const dd=String(date.getDate()).padStart(2,'0')
  const mm=String(date.getMonth()+1).padStart(2,'0')
  const yyyy=date.getFullYear()
  const hh=String(date.getHours()).padStart(2,'0')
  const min=String(date.getMinutes()).padStart(2,'0')
  return `${dd}/${mm}/${yyyy}, ${hh}:${min}`
}

export function PlatformHealthView({organizations=[],language='el',onBack}){
  const en=language==='en'
  const tx=(elText,enText)=>en?enText:elText
  const [rows,setRows]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState(null)
  const [organizationId,setOrganizationId]=useState('all')
  const [severity,setSeverity]=useState('all')
  const [query,setQuery]=useState('')
  const [page,setPage]=useState(1)
  const [pageSize,setPageSize]=useState(15)

  const organizationMap=useMemo(()=>new Map(organizations.map(org=>[org.id,org])),[organizations])

  const load=useCallback(async()=>{
    setLoading(true)
    setError(null)
    try{
      const settled=await Promise.allSettled(
        organizations.map(async organization=>{
          const events=await listRuntimeEvents(organization.id,{limit:120})
          return events.map(event=>({...event,organizationId:organization.id,organizationName:organization.name||organization.code||'—'}))
        })
      )
      const next=settled.flatMap(result=>result.status==='fulfilled'?result.value:[])
        .sort((a,b)=>String(b.occurredAt||'').localeCompare(String(a.occurredAt||'')))
      setRows(next)
      if(settled.some(result=>result.status==='rejected'))setError(new Error('partial'))
    }catch(err){
      setRows([])
      setError(err)
    }finally{
      setLoading(false)
    }
  },[organizations])

  useEffect(()=>{void load()},[load])

  const filtered=useMemo(()=>rows.filter(row=>{
    if(organizationId!=='all'&&row.organizationId!==organizationId)return false
    if(severity!=='all'&&row.severity!==severity)return false
    const needle=query.trim().toLowerCase()
    if(!needle)return true
    return `${row.organizationName} ${row.message} ${row.module} ${row.operation} ${row.actorName} ${row.diagnosticCode}`.toLowerCase().includes(needle)
  }),[rows,organizationId,severity,query])
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)),safePage=Math.min(page,totalPages),pagedRows=filtered.slice((safePage-1)*pageSize,safePage*pageSize)
  useEffect(()=>setPage(1),[query,organizationId,severity,pageSize])
  useEffect(()=>{if(page>totalPages)setPage(totalPages)},[page,totalPages])

  const failures=rows.filter(row=>row.severity==='error'||row.severity==='blocked').length
  const warnings=rows.filter(row=>row.severity==='warning').length
  const affectedOrganizations=new Set(rows.filter(row=>['error','blocked','warning'].includes(row.severity)).map(row=>row.organizationId)).size
  const healthLabel=failures>0?tx('Χρειάζεται έλεγχος','Needs review'):warnings>0?tx('Με προειδοποιήσεις','Warnings present'):tx('Ομαλή λειτουργία','Operating normally')

  return <Page
    title={tx('Υγεία Πλατφόρμας','Platform Health')}
    subtitle={tx('Συγκεντρωτική λειτουργική εικόνα όλων των production οργανισμών χωρίς πρόσβαση σε κλινικό περιεχόμενο.','Aggregated operational health across production organizations without clinical-record content.')}
  >
    <div className="platform-registry-shell workspace-column">
      <div className="platform-registry-navigation"><BackButton onClick={onBack} label={tx('Dashboard','Dashboard')}/></div>
      <div className="platform-section-tools">
        <IconButton label={tx('Ανανέωση','Refresh')} onClick={load} disabled={loading}><RefreshCw size={16}/></IconButton>
      </div>
      <div className="diagnostics-summary-strip platform-summary-strip">
        <div className="diagnostics-summary"><span>{tx('Κατάσταση','Status')}</span><strong>{healthLabel}</strong></div>
        <div className="diagnostics-summary"><span>{tx('Αποτυχίες / αποκλεισμοί','Errors / blocked')}</span><strong>{failures}</strong></div>
        <div className="diagnostics-summary"><span>{tx('Προειδοποιήσεις','Warnings')}</span><strong>{warnings}</strong></div>
        <div className="diagnostics-summary"><span>{tx('Οργανισμοί με συμβάντα','Organizations affected')}</span><strong>{affectedOrganizations}/{organizations.length}</strong></div>
      </div>
      <FilterBar query={query} onQueryChange={setQuery} placeholder={tx('Αναζήτηση οργανισμού, περιγραφής ή ενότητας…','Search organization, description or area…')} activeAdvancedCount={(organizationId!=='all'?1:0)+(severity!=='all'?1:0)} onClear={()=>{setQuery('');setOrganizationId('all');setSeverity('all')}}>
        <FilterSelect label={tx('Οργανισμός','Organization')} value={organizationId} onChange={setOrganizationId}>
          <option value="all">{tx('Όλοι','All')}</option>
          {organizations.map(org=><option key={org.id} value={org.id}>{org.name||org.code}</option>)}
        </FilterSelect>
        <FilterSelect label={tx('Κατάσταση','Status')} value={severity} onChange={setSeverity}>
          <option value="all">{tx('Όλες','All')}</option>
          {Object.entries(severityMeta).map(([value,meta])=><option key={value} value={value}>{meta[en?'en':'el']}</option>)}
        </FilterSelect>
      </FilterBar>
      {loading?<div className="inline-empty">{tx('Φόρτωση λειτουργικής εικόνας…','Loading platform health…')}</div>:filtered.length?<><div className="table-wrap scroll-table diagnostics-table-wrap"><table className="data-table sticky-table diagnostics-table"><thead><tr><th>{tx('Ημερομηνία / ώρα','Date / time')}</th><th>{tx('Οργανισμός','Organization')}</th><th>{tx('Κατάσταση','Status')}</th><th>{tx('Ενότητα','Area')}</th><th>{tx('Περιγραφή','Description')}</th><th>{tx('Χρήστης','User')}</th><th>{tx('Έκδοση','Version')}</th></tr></thead><tbody>{pagedRows.map(row=>{const meta=severityMeta[row.severity]||severityMeta.info;const Icon=meta.icon;return <tr key={`${row.organizationId}-${row.id}`}><td><strong>{fmtDate(row.occurredAt)}</strong></td><td><strong>{organizationMap.get(row.organizationId)?.name||row.organizationName||'—'}</strong><small>{organizationMap.get(row.organizationId)?.code||'—'}</small></td><td><span className={`status-badge diagnostics-${row.severity}`}><Icon size={13}/>{meta[en?'en':'el']}</span></td><td><strong>{row.module||'—'}</strong><small>{row.route||'—'}</small></td><td><strong>{row.message||'—'}</strong>{row.diagnosticCode&&<small>{tx('Αναφορά','Reference')}: {row.diagnosticCode}</small>}</td><td>{row.actorName||'—'}</td><td>{row.appVersion||'—'}</td></tr>})}</tbody></table></div><RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/></>:<div className="inline-empty">{tx('Δεν υπάρχουν συμβάντα που να αντιστοιχούν στα φίλτρα.','No events match the selected filters.')}</div>}
      {error&&!loading&&<div className="data-access-state warning" role="status"><span>{tx('Ορισμένοι οργανισμοί δεν επέστρεψαν λειτουργικά συμβάντα. Τα διαθέσιμα δεδομένα εμφανίζονται κανονικά.','Some organizations did not return operational events. Available data is still shown.')}</span></div>}
    </div>
  </Page>
}
