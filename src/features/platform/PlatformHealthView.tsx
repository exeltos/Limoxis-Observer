import './platformDashboard.css'
import { useCallback,useEffect,useMemo,useState,type ReactNode } from 'react'
import { Activity,AlertTriangle,CheckCircle2,RefreshCw,ShieldAlert,XCircle,type LucideIcon } from 'lucide-react'
import { RegistryTotals } from '../../design-system/RegistryTotals'
import { Page } from '../../design-system/Page'
import { IconButton } from '../../design-system/IconButton'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { ExportMenu } from '../../design-system/ExportMenu'
import { exportRegistry } from '../../core/export/registryExports'
import { listRuntimeEvents } from '../../core/diagnostics/runtimeDiagnosticsService'
import { localModule, localRoute } from './HospitalDiagnosticsPanel'
import { athensDateTime } from './platformOverviewShared'
import { RecordLink } from './RecordLink'
import { useRecordLinks, usePlatformUsers } from './useRecordLinks'
import type { AnyRecord } from '../../types/featureTypes'

const severityMeta: Record<string,{el: string,en: string,icon: LucideIcon}>={
  error:{el:'Αποτυχία',en:'Error',icon:XCircle},
  blocked:{el:'Αποκλεισμός',en:'Blocked',icon:ShieldAlert},
  warning:{el:'Προειδοποίηση',en:'Warning',icon:AlertTriangle},
  success:{el:'Επιτυχία',en:'Success',icon:CheckCircle2},
  info:{el:'Πληροφορία',en:'Information',icon:Activity},
}

const fmtDate=athensDateTime

export function PlatformHealthView({organizations=[],language='el',tabs=null}: {organizations?: AnyRecord[],language?: string,tabs?: ReactNode}){
  const en=language==='en'
  const tx=(elText: string,enText: string)=>en?enText:elText
  const [rows,setRows]=useState<AnyRecord[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<unknown>(null)
  const [organizationId,setOrganizationId]=useState('all')
  const [severity,setSeverity]=useState('all')
  const [query,setQuery]=useState('')
  const [page,setPage]=useState(1)
  const [pageSize,setPageSize]=useState(15)

  const organizationMap=useMemo(()=>new Map(organizations.map(org=>[org.id,org])),[organizations])
  // The organization and the user of an event open their records; Back returns to these events.
  const users=usePlatformUsers()
  const {userOf,openUser,canOpenOrganization,openOrganization}=useRecordLinks({users,returnTo:'/platform/audit?view=events'})
  const userLink=(ref: AnyRecord,label: string)=>{const person=userOf(ref);return person?<RecordLink title={tx('Άνοιγμα καρτέλας χρήστη','Open user record')} onClick={()=>openUser(person)}>{label}</RecordLink>:label}
  const organizationLink=(id: string,label: string)=>canOpenOrganization(id)?<RecordLink title={tx('Άνοιγμα καρτέλας οργανισμού','Open organization record')} onClick={()=>openOrganization(id)}>{label}</RecordLink>:label

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
    title={tx('Ιστορικό & Υγεία','History & Health')}
    actions={<div className="row-actions"><ExportMenu items={[{id:'events',label:tx('Excel: συμβάντα','Excel: events'),disabled:!filtered.length,onClick:()=>exportRegistry({name:tx('symvanta-leitourgias','platform-events'),headers:[tx('Ημερομηνία / ώρα','Date / time'),tx('Οργανισμός','Organization'),tx('Κατάσταση','Status'),tx('Ενότητα','Area'),tx('Οθόνη','Screen'),tx('Περιγραφή','Description'),tx('Αναφορά','Reference'),tx('Χρήστης','User'),tx('Έκδοση','Version')],rows:filtered.map(row=>[fmtDate(row.occurredAt),organizationMap.get(row.organizationId)?.name||row.organizationName||'',(severityMeta[row.severity]||severityMeta.info)[en?'en':'el'],localModule(row.module,language),localRoute(row.route,language),row.message||'',row.diagnosticCode||'',row.actorName||'',row.appVersion||''])})}]}/><IconButton label={tx('Ανανέωση','Refresh')} onClick={load} disabled={loading}><RefreshCw size={16}/></IconButton></div>}
  >
    {tabs}
    <div className="platform-registry-shell workspace-column">
      <FilterBar query={query} onQueryChange={setQuery} placeholder={tx('Αναζήτηση οργανισμού, περιγραφής ή ενότητας…','Search organization, description or area…')} end={<RegistryTotals label={healthLabel} items={[{key:'failures',value:failures,always:true,label:tx('αποτυχίες / αποκλεισμοί','errors / blocked'),tone:failures?'danger':'good',title:healthLabel},{key:'warnings',value:warnings,always:true,label:tx('προειδοποιήσεις','warnings'),tone:warnings?'warning':undefined},{key:'organizations',value:affectedOrganizations,always:true,display:`${affectedOrganizations}/${organizations.length}`,label:tx('οργανισμοί με συμβάντα','organizations affected')}]}/>} activeAdvancedCount={(organizationId!=='all'?1:0)+(severity!=='all'?1:0)} onClear={()=>{setQuery('');setOrganizationId('all');setSeverity('all')}}>
        <FilterSelect label={tx('Οργανισμός','Organization')} value={organizationId} onChange={setOrganizationId}>
          <option value="all">{tx('Όλοι','All')}</option>
          {organizations.map(org=><option key={org.id} value={org.id}>{org.name||org.code}</option>)}
        </FilterSelect>
        <FilterSelect label={tx('Κατάσταση','Status')} value={severity} onChange={setSeverity}>
          <option value="all">{tx('Όλες','All')}</option>
          {Object.entries(severityMeta).map(([value,meta])=><option key={value} value={value}>{meta[en?'en':'el']}</option>)}
        </FilterSelect>
      </FilterBar>
      {loading?<div className="inline-empty">{tx('Φόρτωση λειτουργικής εικόνας…','Loading platform health…')}</div>:filtered.length?<><div className="table-wrap scroll-table diagnostics-table-wrap"><table className="data-table sticky-table diagnostics-table"><thead><tr><th>{tx('Ημερομηνία / ώρα','Date / time')}</th><th>{tx('Οργανισμός','Organization')}</th><th>{tx('Κατάσταση','Status')}</th><th>{tx('Ενότητα','Area')}</th><th>{tx('Περιγραφή','Description')}</th><th>{tx('Χρήστης','User')}</th><th>{tx('Έκδοση','Version')}</th></tr></thead><tbody>{pagedRows.map(row=>{const meta=severityMeta[row.severity]||severityMeta.info;const Icon=meta.icon;return <tr key={`${row.organizationId}-${row.id}`}><td><strong>{fmtDate(row.occurredAt)}</strong></td><td><strong>{organizationLink(row.organizationId,organizationMap.get(row.organizationId)?.name||row.organizationName||'—')}</strong><small>{organizationMap.get(row.organizationId)?.code||'—'}</small></td><td><span className={`status-badge diagnostics-${row.severity}`}><Icon size={13}/>{meta[en?'en':'el']}</span></td><td><strong>{localModule(row.module,language)}</strong>{localRoute(row.route,language)!==localModule(row.module,language)&&<small title={row.route||undefined}>{localRoute(row.route,language)}</small>}</td><td><strong>{row.message||'—'}</strong>{row.diagnosticCode&&<small>{tx('Αναφορά','Reference')}: {row.diagnosticCode}</small>}</td><td>{userLink({userId:row.actorId},row.actorName||'—')}</td><td>{row.appVersion||'—'}</td></tr>})}</tbody></table></div><RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/></>:<div className="inline-empty">{tx('Δεν υπάρχουν συμβάντα που να αντιστοιχούν στα φίλτρα.','No events match the selected filters.')}</div>}
      {Boolean(error)&&!loading&&<div className="data-access-state warning" role="status"><span>{tx('Ορισμένοι οργανισμοί δεν επέστρεψαν λειτουργικά συμβάντα. Τα διαθέσιμα δεδομένα εμφανίζονται κανονικά.','Some organizations did not return operational events. Available data is still shown.')}</span></div>}
    </div>
  </Page>
}
