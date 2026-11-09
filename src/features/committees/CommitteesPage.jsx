import { formatDay } from '../../core/i18n/formatDay'
import { useEffect,useMemo,useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpenCheck,Plus } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { RouteLoading } from '../../design-system/RouteLoading'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { useTenant } from '../../core/tenant/TenantContext'
import { can,CAPABILITIES } from '../../core/permissions/roles'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { useCommitteesData } from './useCommitteesData'
import { frequencyLabel,termText } from './committeeRecordFormat'
import { committeeSchedule } from './committeeSchedule'
import { StatusBadge } from '../../design-system/StatusBadge'
import { RegistryTotals } from '../../design-system/RegistryTotals'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { ExportMenu } from '../../design-system/ExportMenu'
import { exportRegistry,printRegistry } from '../../core/export/registryExports'
import { useFeedback } from '../../core/feedback/FeedbackContext'

export function CommitteesPage(){
 const navigate=useNavigate();const registry=useRegistryMemory('committees');const {role,membership}=useTenant();const {language}=useLanguage();const {notify}=useFeedback();const en=language==='en'
 const {data:rows,loading,error,reload}=useCommitteesData();const [query,setQuery]=useState('');const [status,setStatus]=useState('all');const [overdueOnly,setOverdueOnly]=useState(false);const [meetingState,setMeetingState]=useState('all');const [sort,setSort]=useState({key:'name',dir:'asc'});const [page,setPage]=useState(1);const [pageSize,setPageSize]=useState(15)
 const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[]
 const canCreate=can(role,CAPABILITIES.CREATE_COMMITTEE,addOns,custom)
 const isOverdue=row=>(row.decisions||[]).some(x=>!['completed','closed'].includes(x.status)&&x.dueDate&&new Date(x.dueDate)<new Date())
 // When each committee should meet next: last meeting held + its frequency, or the meeting already planned.
 const schedules=useMemo(()=>new Map(rows.map(row=>[row.id,committeeSchedule(row)])),[rows])
 const base=useMemo(()=>rows.filter(x=>(status==='all'||x.status===status)&&(!overdueOnly||isOverdue(x))&&`${x.name} ${x.shortName} ${x.chair}`.toLowerCase().includes(query.toLowerCase())),[rows,query,status,overdueOnly])
 const filtered=useMemo(()=>base.filter(x=>meetingState==='all'||schedules.get(x.id)?.state===meetingState),[base,meetingState,schedules])
 const sortAccessors=useMemo(()=>({code:row=>row.id||'',name:row=>row.name||'',chair:row=>row.chair||'',term:row=>row.termStart||'',members:row=>row.members?.length||0,pending:row=>row.decisions?.filter(x=>!['completed','closed'].includes(x.status)).length||0,next:row=>schedules.get(row.id)?.due||'9999',status:row=>row.status==='active'?(en?'Active':'Ενεργή'):(en?'Inactive':'Ανενεργή')}),[en,schedules])
 const sorted=useMemo(()=>{const list=[...filtered];const get=sortAccessors[sort.key]||sortAccessors.name;list.sort((a,b)=>{const av=get(a),bv=get(b);const cmp=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),language);return sort.dir==='asc'?cmp:-cmp});return list},[filtered,sort,sortAccessors,language])
 function toggleSort(key){setSort(current=>current.key===key?{key,dir:current.dir==='asc'?'desc':'asc'}:{key,dir:'asc'})}
 function sortIndicator(key){return sort.key===key?(sort.dir==='asc'?' ▲':' ▼'):''}
 useEffect(()=>setPage(1),[query,status,overdueOnly,meetingState,pageSize])
 const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)),safePage=Math.min(page,totalPages),pagedRows=sorted.slice((safePage-1)*pageSize,safePage*pageSize)
 if(loading)return <RouteLoading/>
 if(error)return <div className="data-access-state error" role="alert"><span>{en?'Could not load committees.':'Δεν ήταν δυνατή η φόρτωση των επιτροπών.'}</span><button type="button" onClick={reload}>{en?'Retry':'Επανάληψη'}</button></div>
 function clearFilters(){setQuery('');setStatus('all');setOverdueOnly(false);setMeetingState('all')}
 const toggleMeeting=state=>()=>setMeetingState(current=>current===state?'all':state)
 const totals=<RegistryTotals label={en?'Totals':'Σύνολα'} items={[
  {key:'all',always:true,value:base.length,label:en?'committees':'επιτροπές',active:meetingState==='all',onClick:()=>setMeetingState('all')},
  {key:'overdue',value:base.filter(x=>schedules.get(x.id)?.state==='overdue').length,label:en?'meeting overdue':'εκπρόθεσμες',active:meetingState==='overdue',onClick:toggleMeeting('overdue')},
  {key:'soon',value:base.filter(x=>schedules.get(x.id)?.state==='soon').length,label:en?'meet within 30 days':'μέσα σε 30 ημέρες',active:meetingState==='soon',onClick:toggleMeeting('soon')},
 ]}/>
 const nextText=row=>{const item=schedules.get(row.id);return item?.due?formatDay(item.due,language):''}
 // The list as filtered and sorted, for print and Excel.
 function committeesList(){return {name:en?'committees':'epitropes',headers:en?['Code','Committee','Short name','Chair','Term start','Term end','Members','Pending decisions','Frequency','Last meeting','Next meeting','Status']:['Κωδικός','Επιτροπή','Συντομογραφία','Πρόεδρος','Έναρξη θητείας','Λήξη θητείας','Μέλη','Εκκρεμείς αποφάσεις','Συχνότητα','Τελευταία συνεδρίαση','Επόμενη συνεδρίαση','Κατάσταση'],rows:sorted.map(row=>[row.id,row.name,row.shortName||'',row.chair||'',formatDay(row.termStart,language),formatDay(row.termEnd,language),row.members?.length||0,row.decisions?.filter(x=>!['completed','closed'].includes(x.status)).length||0,frequencyLabel(row.meetingFrequency,en),formatDay(schedules.get(row.id)?.last,language),nextText(row),row.status==='active'?(en?'Active':'Ενεργή'):(en?'Inactive':'Ανενεργή')])}}
 function pageAction(action){if(action===UI_ACTIONS.CREATE)navigate('/committees/new')}
 function openCommittee(row){registry.openRecord(navigate,`/committees/${row.id}`,row.id,filtered.map(x=>x.id))}
 return <Page fill title={en?'Committees':'Επιτροπές'} subtitle={en?'Governance of committees, meetings, minutes, decisions and actions.':'Διακυβέρνηση επιτροπών, συνεδριάσεων, πρακτικών, αποφάσεων και ενεργειών.'} actions={<div className="row-actions"><ExportMenu disabled={!sorted.length} onPrint={()=>{if(!printRegistry(committeesList(),{language,kind:en?'Committees':'Επιτροπές',title:en?'Committees':'Επιτροπές'}))notify(en?'Allow pop-ups to print.':'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','error')}} onExcel={()=>exportRegistry(committeesList())}/><RecordActions actions={canCreate?[UI_ACTIONS.CREATE]:[]} resourceCapability={CAPABILITIES.VIEW_COMMITTEES} actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.CREATE_COMMITTEE}} onAction={pageAction}/></div>}>
  <section className="surface registry-workspace committee-registry workspace-column workspace-fill">
   <FilterBar query={query} onQueryChange={setQuery} placeholder={en?'Search committee or chair...':'Αναζήτηση επιτροπής ή προέδρου...'} activeAdvancedCount={(status!=='all'?1:0)+(overdueOnly?1:0)} onClear={clearFilters} end={totals}><FilterSelect label={en?'Status':'Κατάσταση'} value={status} onChange={setStatus}><option value="all">{en?'All':'Όλες'}</option><option value="active">{en?'Active':'Ενεργή'}</option><option value="inactive">{en?'Inactive':'Ανενεργή'}</option></FilterSelect><FilterSelect label={en?'Actions':'Ενέργειες'} value={overdueOnly?'overdue':'all'} onChange={value=>setOverdueOnly(value==='overdue')}><option value="all">{en?'All':'Όλες'}</option><option value="overdue">{en?'With overdue actions':'Με εκπρόθεσμες ενέργειες'}</option></FilterSelect></FilterBar>
   <div className="scroll-table" ref={registry.scrollRef}><table className="data-table sticky-table"><thead><tr><th style={{cursor:'pointer'}} onClick={()=>toggleSort('code')}>{en?'Code':'Κωδικός'}{sortIndicator('code')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('name')}>{en?'Committee':'Επιτροπή'}{sortIndicator('name')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('chair')}>{en?'Chair':'Πρόεδρος'}{sortIndicator('chair')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('term')}>{en?'Term':'Θητεία'}{sortIndicator('term')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('members')}>{en?'Members':'Μέλη'}{sortIndicator('members')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('next')}>{en?'Next meeting':'Επόμενη συνεδρίαση'}{sortIndicator('next')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('pending')}>{en?'Pending decisions':'Εκκρεμείς αποφάσεις'}{sortIndicator('pending')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('status')}>{en?'Status':'Κατάσταση'}{sortIndicator('status')}</th></tr></thead><tbody>{pagedRows.map(row=><tr key={row.id} {...registry.rowProps(row.id,()=>openCommittee(row))}><td><strong>{row.id}</strong></td><td><strong>{row.name}</strong><small>{row.shortName}</small></td><td>{row.chair||'—'}</td><td className="nowrap-cell">{termText(row.termStart,row.termEnd,en,value=>formatDay(value,language))}</td><td>{row.members?.length||0}</td><td className="nowrap-cell">{(item=>item?.due?<>{item.state==='overdue'||item.state==='soon'?<StatusBadge tone={item.state==='overdue'?'danger':'warning'}>{formatDay(item.due,language)}</StatusBadge>:<span>{formatDay(item.due,language)}</span>}<small>{frequencyLabel(row.meetingFrequency,en)}{item.last?` · ${en?'last':'τελευταία'} ${formatDay(item.last,language)}`:''}</small></>:item?.state==='overdue'?<><StatusBadge tone="danger">{en?'No meeting yet':'Καμία συνεδρίαση'}</StatusBadge><small>{frequencyLabel(row.meetingFrequency,en)}</small></>:<span>{row.meetingFrequency==='as_needed'?frequencyLabel('as_needed',en):'—'}</span>)(schedules.get(row.id))}</td><td>{row.decisions?.filter(x=>!['completed','closed'].includes(x.status)).length||0}</td><td><span className={`status-badge ${row.status==='active'?'active':''}`}>{row.status==='active'?(en?'Active':'Ενεργή'):(en?'Inactive':'Ανενεργή')}</span></td></tr>)}</tbody></table>{!filtered.length&&(rows.length?<RegistryEmptyState filtered onClearFilters={clearFilters}/>:<RegistryEmptyState icon={BookOpenCheck} title={en?'No committees yet':'Δεν υπάρχουν ακόμη επιτροπές'} text={en?'A committee keeps its members, meetings, minutes and decisions in one record.':'Μια επιτροπή κρατά σε μία καρτέλα μέλη, συνεδριάσεις, πρακτικά και αποφάσεις.'} action={canCreate?{label:en?'New committee':'Νέα επιτροπή',icon:Plus,onClick:()=>pageAction(UI_ACTIONS.CREATE)}:null}/>)}</div>
   <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
  </section>
 </Page>
}
