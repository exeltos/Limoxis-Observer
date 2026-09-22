import { useEffect,useMemo,useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpenCheck,CalendarDays,CheckCircle2,Clock3 } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { RouteLoading } from '../../design-system/RouteLoading'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { useTenant } from '../../core/tenant/TenantContext'
import { can,CAPABILITIES } from '../../core/permissions/roles'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { useCommitteesData } from './useCommitteesData'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { MetricCard } from '../../design-system/MetricCard'

export function CommitteesPage(){
 const navigate=useNavigate();const registry=useRegistryMemory('committees');const {role,membership}=useTenant();const {language}=useLanguage();const en=language==='en'
 const {data:rows,loading,error,reload}=useCommitteesData();const [query,setQuery]=useState('');const [status,setStatus]=useState('all');const [overdueOnly,setOverdueOnly]=useState(false);const [sort,setSort]=useState({key:'name',dir:'asc'});const [page,setPage]=useState(1);const [pageSize,setPageSize]=useState(15)
 const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[]
 const canCreate=can(role,CAPABILITIES.CREATE_COMMITTEE,addOns,custom)
 const isOverdue=row=>(row.decisions||[]).some(x=>!['completed','closed'].includes(x.status)&&x.dueDate&&new Date(x.dueDate)<new Date())
 const filtered=useMemo(()=>rows.filter(x=>(status==='all'||x.status===status)&&(!overdueOnly||isOverdue(x))&&`${x.name} ${x.shortName} ${x.chair}`.toLowerCase().includes(query.toLowerCase())),[rows,query,status,overdueOnly])
 const sortAccessors=useMemo(()=>({code:row=>row.id||'',name:row=>row.name||'',chair:row=>row.chair||'',term:row=>row.termStart||'',members:row=>row.members?.length||0,pending:row=>row.decisions?.filter(x=>!['completed','closed'].includes(x.status)).length||0,status:row=>row.status==='active'?(en?'Active':'Ενεργή'):(en?'Inactive':'Ανενεργή')}),[en])
 const sorted=useMemo(()=>{const list=[...filtered];const get=sortAccessors[sort.key]||sortAccessors.name;list.sort((a,b)=>{const av=get(a),bv=get(b);const cmp=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),language);return sort.dir==='asc'?cmp:-cmp});return list},[filtered,sort,sortAccessors,language])
 function toggleSort(key){setSort(current=>current.key===key?{key,dir:current.dir==='asc'?'desc':'asc'}:{key,dir:'asc'})}
 function sortIndicator(key){return sort.key===key?(sort.dir==='asc'?' ▲':' ▼'):''}
 useEffect(()=>setPage(1),[query,status,overdueOnly,pageSize])
 const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)),safePage=Math.min(page,totalPages),pagedRows=sorted.slice((safePage-1)*pageSize,safePage*pageSize)
 const meetings=rows.flatMap(x=>x.meetings||[]),decisions=rows.flatMap(x=>x.decisions||[])
 const overdue=rows.filter(isOverdue).length
 if(loading)return <RouteLoading/>
 if(error)return <div className="data-access-state error" role="alert"><span>{en?'Could not load committees.':'Δεν ήταν δυνατή η φόρτωση των επιτροπών.'}</span><button type="button" onClick={reload}>{en?'Retry':'Επανάληψη'}</button></div>
 function pageAction(action){if(action===UI_ACTIONS.CREATE)navigate('/committees/new')}
 function openCommittee(row){registry.openRecord(navigate,`/committees/${row.id}`,row.id,filtered.map(x=>x.id))}
 return <Page fill title={en?'Committees':'Επιτροπές'} subtitle={en?'Governance of committees, meetings, minutes, decisions and actions.':'Διακυβέρνηση επιτροπών, συνεδριάσεων, πρακτικών, αποφάσεων και ενεργειών.'} actions={<RecordActions actions={canCreate?[UI_ACTIONS.CREATE]:[]} resourceCapability={CAPABILITIES.VIEW_COMMITTEES} actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.CREATE_COMMITTEE}} onAction={pageAction}/>}>
  <div className="module-summary-strip"><MetricCard icon={BookOpenCheck} label={en?'Active committees':'Ενεργές επιτροπές'} value={rows.filter(x=>x.status==='active').length}/><MetricCard icon={CalendarDays} label={en?'Meetings':'Συνεδριάσεις'} value={meetings.length}/><MetricCard icon={CheckCircle2} label={en?'Open decisions':'Ανοιχτές αποφάσεις'} value={decisions.filter(x=>!['completed','closed'].includes(x.status)).length}/><MetricCard icon={Clock3} label={en?'Overdue actions':'Εκπρόθεσμες ενέργειες'} value={overdue} tone={overdueOnly?'active':(overdue>0?'warning':'neutral')} onClick={()=>setOverdueOnly(v=>!v)} active={overdueOnly}/></div>
  <section className="surface registry-workspace committee-registry workspace-column workspace-fill">
   <FilterBar query={query} onQueryChange={setQuery} placeholder={en?'Search committee or chair...':'Αναζήτηση επιτροπής ή προέδρου...'} activeAdvancedCount={(status!=='all'?1:0)+(overdueOnly?1:0)} onClear={()=>{setQuery('');setStatus('all');setOverdueOnly(false)}}><FilterSelect label={en?'Status':'Κατάσταση'} value={status} onChange={setStatus}><option value="all">{en?'All':'Όλες'}</option><option value="active">{en?'Active':'Ενεργή'}</option><option value="inactive">{en?'Inactive':'Ανενεργή'}</option></FilterSelect></FilterBar>
   <div className="scroll-table" ref={registry.scrollRef}><table className="data-table sticky-table"><thead><tr><th style={{cursor:'pointer'}} onClick={()=>toggleSort('code')}>{en?'Code':'Κωδικός'}{sortIndicator('code')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('name')}>{en?'Committee':'Επιτροπή'}{sortIndicator('name')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('chair')}>{en?'Chair':'Πρόεδρος'}{sortIndicator('chair')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('term')}>{en?'Term':'Θητεία'}{sortIndicator('term')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('members')}>{en?'Members':'Μέλη'}{sortIndicator('members')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('pending')}>{en?'Pending decisions':'Εκκρεμείς αποφάσεις'}{sortIndicator('pending')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('status')}>{en?'Status':'Κατάσταση'}{sortIndicator('status')}</th></tr></thead><tbody>{pagedRows.map(row=><tr key={row.id} {...registry.rowProps(row.id,()=>openCommittee(row))}><td><strong>{row.id}</strong></td><td><strong>{row.name}</strong><small>{row.shortName}</small></td><td>{row.chair||'—'}</td><td>{row.termStart||'—'} → {row.termEnd||'—'}</td><td>{row.members?.length||0}</td><td>{row.decisions?.filter(x=>!['completed','closed'].includes(x.status)).length||0}</td><td><span className={`status-badge ${row.status==='active'?'active':''}`}>{row.status==='active'?(en?'Active':'Ενεργή'):(en?'Inactive':'Ανενεργή')}</span></td></tr>)}</tbody></table>{!filtered.length&&<div className="registry-empty-state"><strong>{en?'No committees':'Δεν υπάρχουν επιτροπές'}</strong></div>}</div>
   <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
  </section>
 </Page>
}
