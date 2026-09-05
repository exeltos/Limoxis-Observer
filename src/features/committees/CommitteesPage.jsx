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
 const {data:rows,loading,error,reload}=useCommitteesData();const [query,setQuery]=useState('');const [status,setStatus]=useState('all');const [page,setPage]=useState(1);const [pageSize,setPageSize]=useState(15)
 const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[]
 const canCreate=can(role,CAPABILITIES.CREATE_COMMITTEE,addOns,custom)
 const filtered=useMemo(()=>rows.filter(x=>(status==='all'||x.status===status)&&`${x.name} ${x.shortName} ${x.chair}`.toLowerCase().includes(query.toLowerCase())),[rows,query,status])
 useEffect(()=>setPage(1),[query,status,pageSize])
 const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)),safePage=Math.min(page,totalPages),pagedRows=filtered.slice((safePage-1)*pageSize,safePage*pageSize)
 const meetings=rows.flatMap(x=>x.meetings||[]),decisions=rows.flatMap(x=>x.decisions||[])
 const overdue=decisions.filter(x=>!['completed','closed'].includes(x.status)&&x.dueDate&&new Date(x.dueDate)<new Date()).length
 if(loading)return <RouteLoading/>
 if(error)return <div className="data-access-state error" role="alert"><span>{en?'Could not load committees.':'Δεν ήταν δυνατή η φόρτωση των επιτροπών.'}</span><button type="button" onClick={reload}>{en?'Retry':'Επανάληψη'}</button></div>
 function pageAction(action){if(action===UI_ACTIONS.CREATE)navigate('/committees/new')}
 function openCommittee(row){registry.openRecord(navigate,`/committees/${row.id}`,row.id,filtered.map(x=>x.id))}
 return <Page fill title={en?'Committees':'Επιτροπές'} subtitle={en?'Governance of committees, meetings, minutes, decisions and actions.':'Διακυβέρνηση επιτροπών, συνεδριάσεων, πρακτικών, αποφάσεων και ενεργειών.'} actions={<RecordActions actions={canCreate?[UI_ACTIONS.CREATE]:[]} resourceCapability={CAPABILITIES.VIEW_COMMITTEES} actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.CREATE_COMMITTEE}} onAction={pageAction}/>}>
  <div className="module-summary-strip"><MetricCard icon={BookOpenCheck} label={en?'Active committees':'Ενεργές επιτροπές'} value={rows.filter(x=>x.status==='active').length}/><MetricCard icon={CalendarDays} label={en?'Meetings':'Συνεδριάσεις'} value={meetings.length}/><MetricCard icon={CheckCircle2} label={en?'Open decisions':'Ανοιχτές αποφάσεις'} value={decisions.filter(x=>!['completed','closed'].includes(x.status)).length}/><MetricCard icon={Clock3} label={en?'Overdue actions':'Εκπρόθεσμες ενέργειες'} value={overdue}/></div>
  <section className="surface registry-workspace committee-registry workspace-column workspace-fill">
   <FilterBar query={query} onQueryChange={setQuery} placeholder={en?'Search committee or chair...':'Αναζήτηση επιτροπής ή προέδρου...'} activeAdvancedCount={status!=='all'?1:0} onClear={()=>{setQuery('');setStatus('all')}}><FilterSelect label={en?'Status':'Κατάσταση'} value={status} onChange={setStatus}><option value="all">{en?'All':'Όλες'}</option><option value="active">{en?'Active':'Ενεργή'}</option><option value="inactive">{en?'Inactive':'Ανενεργή'}</option></FilterSelect></FilterBar>
   <div className="scroll-table" ref={registry.scrollRef}><table className="data-table sticky-table"><thead><tr><th>{en?'Code':'Κωδικός'}</th><th>{en?'Committee':'Επιτροπή'}</th><th>{en?'Chair':'Πρόεδρος'}</th><th>{en?'Term':'Θητεία'}</th><th>{en?'Members':'Μέλη'}</th><th>{en?'Pending decisions':'Εκκρεμείς αποφάσεις'}</th><th>{en?'Status':'Κατάσταση'}</th></tr></thead><tbody>{pagedRows.map(row=><tr key={row.id} {...registry.rowProps(row.id,()=>openCommittee(row))}><td><strong>{row.id}</strong></td><td><strong>{row.name}</strong><small>{row.shortName}</small></td><td>{row.chair||'—'}</td><td>{row.termStart||'—'} → {row.termEnd||'—'}</td><td>{row.members?.length||0}</td><td>{row.decisions?.filter(x=>!['completed','closed'].includes(x.status)).length||0}</td><td><span className={`status-badge ${row.status==='active'?'active':''}`}>{row.status==='active'?(en?'Active':'Ενεργή'):(en?'Inactive':'Ανενεργή')}</span></td></tr>)}</tbody></table>{!filtered.length&&<div className="registry-empty-state"><strong>{en?'No committees':'Δεν υπάρχουν επιτροπές'}</strong></div>}</div>
   <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
  </section>
 </Page>
}
