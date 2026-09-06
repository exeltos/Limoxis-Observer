import { useEffect,useMemo,useState } from 'react'
import { AlertTriangle,CheckCircle2,ClipboardCheck,Clock3,PlayCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { useTenant } from '../../core/tenant/TenantContext'
import { useAuth } from '../../core/auth/AuthContext'
import { CAPABILITIES,ROLES,can } from '../../core/permissions/roles'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { ControlEditor } from './ControlEditor'
import { ControlExecutionModal } from './ControlExecutionModal'
import { controlActorFromAuth } from './controlActor'
import { MetricCard } from '../../design-system/MetricCard'
import { assignmentStatus,frequencyLabel,getAssignment,isControlDue } from './controlScheduling'
import { completeControlExecution,loadControlProgramme,saveControlDefinition } from './controlCloudService'

const PAGE_SIZE_OPTIONS=[15,25,50]
const controlsText={
 el:{created:'Ο έλεγχος δημιουργήθηκε.',centralSubtitle:'Κεντρικός προγραμματισμός και παρακολούθηση ελέγχων ανά τμήμα.',departmentSubtitle:'Οι προγραμματισμένοι έλεγχοι που αφορούν το τμήμα σας.',active:'Ενεργές αναθέσεις',dueSoon:'Πλησιάζουν',overdue:'Εκπρόθεσμοι',today:'Καταχωρήσεις σήμερα',search:'Αναζήτηση ελέγχων',department:'Τμήμα',allDepartments:'Όλα τα τμήματα',status:'Κατάσταση',all:'Όλες',temporary:'Προσωρινή',scheduled:'Εντός προγράμματος',frequency:'Συχνότητα',daily:'Ημερήσια',weekly:'Εβδομαδιαία',monthly:'Μηνιαία / ανά μήνες',yearly:'Ετήσια',control:'Έλεγχος',last:'Τελευταίος',next:'Επόμενος',within:'Εντός',continueDraft:'Συνέχιση προσωρινής καταχώρησης',execute:'Καταχώρηση ελέγχου',availableFrom:'Διαθέσιμο από',draftSaved:'Η καταχώρηση αποθηκεύτηκε προσωρινά. Μπορείτε να τη συνεχίσετε από τη λίστα.',saved:'Ο έλεγχος αποθηκεύτηκε επιτυχώς.',emptyTitle:'Δεν υπάρχουν καταγραφές ελέγχων',emptyText:'Δεν υπάρχουν έλεγχοι που να αντιστοιχούν στα επιλεγμένα φίλτρα.'},
 en:{created:'Control created.',centralSubtitle:'Central scheduling and monitoring of controls by department.',departmentSubtitle:'Scheduled controls assigned to your department.',active:'Active assignments',dueSoon:'Due soon',overdue:'Overdue',today:'Entries today',search:'Search controls',department:'Department',allDepartments:'All departments',status:'Status',all:'All',temporary:'Draft',scheduled:'On schedule',frequency:'Frequency',daily:'Daily',weekly:'Weekly',monthly:'Monthly / every N months',yearly:'Yearly',control:'Control',last:'Last',next:'Next',within:'On schedule',continueDraft:'Continue draft entry',execute:'Record control',availableFrom:'Available from',draftSaved:'The entry was saved as a draft. You can continue it from the list.',saved:'Control saved successfully.',emptyTitle:'No control records',emptyText:'No controls match the selected filters.'}
}

export function ControlsPage(){
 const {role,membership,tenant,canAccessRecord}=useTenant()
 const {profile,user}=useAuth()
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const {t,language,locale}=useLanguage(); const tx=controlsText[language==='en'?'en':'el']
 const {notify,notifyError}=useFeedback()
 const navigate=useNavigate(),registry=useRegistryMemory('controls')
 const savedView=registry.loadViewState({query:'',department:'all',status:'all',frequency:'all'})
 const [query,setQuery]=useState(savedView.query),[department,setDepartment]=useState(savedView.department),[status,setStatus]=useState(savedView.status),[frequency,setFrequency]=useState(savedView.frequency)
 const [editorOpen,setEditorOpen]=useState(false),[executeRow,setExecuteRow]=useState(null)
 const [programme,setProgramme]=useState([]),[loading,setLoading]=useState(true)
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(15)
 const ownDepartment=membership?.previewDepartment||membership?.departmentName||membership?.department||''
 const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[]
 const canManage=can(role,CAPABILITIES.MANAGE_CONTROLS,addOns,custom)
 const canCreate=canManage
 const canExecuteRole=can(role,CAPABILITIES.EXECUTE_CONTROL,addOns,custom)

 async function reload(){
  if(!tenant?.id){setProgramme([]);setLoading(false);return}
  setLoading(true)
  try{setProgramme(await loadControlProgramme(tenant.id))}
  catch(error){setProgramme([]);notifyError(error,'load',{operation:'controls_programme_load'})}
  finally{setLoading(false)}
 }
 useEffect(()=>{void reload()},[tenant?.id])

 const scopedRows=useMemo(()=>programme.flatMap(item=>item.departments.filter(dep=>canAccessRecord({department:dep})).map(dep=>({item,department:dep,assignment:getAssignment(item,dep)}))),[programme,canAccessRecord])
 const departments=[...new Set(scopedRows.map(x=>x.department))]
 const rows=useMemo(()=>scopedRows.filter(({item})=>`${item.id} ${item.title} ${item.category} ${item.owner}`.toLowerCase().includes(query.toLowerCase())).filter(x=>department==='all'||x.department===department).filter(({item,department:dep,assignment})=>status==='all'||(status==='temporary'?Boolean(assignment?.hasDraft):assignmentStatus(item,dep)===status)).filter(({item})=>frequency==='all'||item.frequency.kind===frequency),[scopedRows,query,department,status,frequency])
 useEffect(()=>{setPage(1)},[query,department,status,frequency,pageSize])
 const totalPages=Math.max(1,Math.ceil(rows.length/pageSize));const safePage=Math.min(page,totalPages);const pagedRows=rows.slice((safePage-1)*pageSize,safePage*pageSize)
 const fmt=v=>v?new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short',hour12:false}).format(new Date(v)):'—'
 const overdue=scopedRows.filter(({item,department:dep})=>assignmentStatus(item,dep)==='overdue').length
 const dueSoon=scopedRows.filter(({item,department:dep})=>assignmentStatus(item,dep)==='dueSoon').length
 const createdByScope=role===ROLES.PLATFORM_OWNER?'platform':role===ROLES.HOSPITAL_ADMIN?'hospital_admin':role===ROLES.QUALITY_MANAGER?'quality':'infection_control'

 async function saveNew(draft){
  try{
   const saved=await saveControlDefinition(tenant.id,{...draft,createdByScope},{actorName:actor.name,createdByScope})
   setEditorOpen(false);notify(tx.created,'success');await reload()
   const dep=saved.departments[0]
   if(dep)registry.openRecord(navigate,`/controls/${saved.id}?department=${encodeURIComponent(dep)}`,`${saved.id}:${dep}`)
  }catch(error){notifyError(error,'save',{operation:'control_definition_create'})}
 }
 function execute(row,e){
  e?.stopPropagation();const hasDraft=Boolean(row.assignment?.hasDraft);const allowed=hasDraft||canManage||(canExecuteRole&&isControlDue(row.item,row.department));if(!allowed)return;setExecuteRow(row)
 }
 function pageAction(action){if(action===UI_ACTIONS.CREATE&&canCreate)setEditorOpen(true)}

 if(editorOpen)return <ControlEditor onCancel={()=>setEditorOpen(false)} onSave={saveNew}/>

 return <Page fill className="controls-page registry-fill-page" title={t('controls')} subtitle={canManage?tx.centralSubtitle:tx.departmentSubtitle} actions={canCreate?<RecordActions actions={[UI_ACTIONS.CREATE]} onAction={pageAction}/>:null}>
  <div className="workspace-summary"><div className="module-summary-strip"><Kpi icon={ClipboardCheck} label={tx.active} value={scopedRows.length}/><Kpi icon={Clock3} label={tx.dueSoon} value={dueSoon}/><Kpi icon={AlertTriangle} label={tx.overdue} value={overdue}/><Kpi icon={CheckCircle2} label={tx.today} value={scopedRows.reduce((n,x)=>n+(x.assignment?.history||[]).filter(h=>h.at?.slice(0,10)===new Date().toISOString().slice(0,10)).length,0)}/></div></div>
  <section className="surface registry-workspace workspace-fill workspace-column controls-surface">
   <FilterBar query={query} onQueryChange={setQuery} placeholder={tx.search} activeAdvancedCount={(department!=='all')+(status!=='all')+(frequency!=='all')} onClear={()=>{setQuery('');setDepartment('all');setStatus('all');setFrequency('all')}}>
    <FilterSelect label={tx.department} value={department} onChange={setDepartment}><option value="all">{tx.allDepartments}</option>{departments.map(x=><option key={x}>{x}</option>)}</FilterSelect>
    <FilterSelect label={tx.status} value={status} onChange={setStatus}><option value="all">{tx.all}</option><option value="temporary">{tx.temporary}</option><option value="scheduled">{tx.scheduled}</option><option value="dueSoon">{tx.dueSoon}</option><option value="overdue">{tx.overdue}</option></FilterSelect>
    <FilterSelect label={tx.frequency} value={frequency} onChange={setFrequency}><option value="all">{tx.all}</option><option value="daily">{tx.daily}</option><option value="weekly">{tx.weekly}</option><option value="monthly">{tx.monthly}</option><option value="yearly">{tx.yearly}</option></FilterSelect>
   </FilterBar>
   <div className="scroll-table" ref={registry.scrollRef}><table className="data-table sticky-table controls-table"><thead><tr><th>{tx.control}</th><th>{tx.department}</th><th>{tx.frequency}</th><th>{tx.last}</th><th>{tx.next}</th><th>{tx.status}</th><th className="control-action-col"></th></tr></thead><tbody>{pagedRows.map(row=>{const {item,department:dep,assignment}=row,due=isControlDue(item,dep),state=assignmentStatus(item,dep),hasDraft=Boolean(assignment?.hasDraft),canQuick=hasDraft||canManage||(due&&canExecuteRole);return <tr key={`${item.id}:${dep}`} {...registry.rowProps(`${item.id}:${dep}`)} onClick={()=>{registry.saveViewState({query,department,status,frequency});registry.openRecord(navigate,`/controls/${item.id}?department=${encodeURIComponent(dep)}`,`${item.id}:${dep}`,rows.map(x=>`${x.item.id}:${x.department}`))}}><td><strong>{language==='el'?item.title:item.titleEn}</strong><small>{item.category}</small></td><td>{dep}</td><td>{frequencyLabel(item.frequency,language)}</td><td>{fmt(assignment?.lastCompletedAt)}</td><td>{fmt(assignment?.nextDueAt)}</td><td><div className="control-status-stack">{hasDraft&&<span className="status-badge temporary">{tx.temporary}</span>}<span className={`status-badge ${state==='overdue'?'danger':state==='dueSoon'?'warning':'active'}`}>{state==='overdue'?tx.overdue:state==='dueSoon'?tx.dueSoon:tx.within}</span></div></td><td className="control-action-col"><button type="button" className={`control-quick-execute ${canQuick?'ready':''}`} disabled={!canQuick} title={hasDraft?tx.continueDraft:canQuick?tx.execute:`${tx.availableFrom} ${fmt(assignment?.nextDueAt)}`} aria-label={tx.execute} onClick={e=>execute(row,e)}><PlayCircle size={17}/></button></td></tr>})}</tbody></table>{loading&&<div className="registry-empty-state"><strong>{language==='en'?'Loading controls…':'Φόρτωση ελέγχων…'}</strong></div>}{!loading&&!rows.length&&<div className="registry-empty-state"><strong>{tx.emptyTitle}</strong><span>{tx.emptyText}</span></div>}</div>
   <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
  </section>
  {executeRow&&<ControlExecutionModal organizationId={tenant?.id} record={executeRow.item} department={executeRow.department} onClose={()=>setExecuteRow(null)} onDraftSaved={async()=>{setExecuteRow(null);await reload();notify(tx.draftSaved,'success')}} onSave={async payload=>{try{await completeControlExecution(tenant.id,executeRow.item,executeRow.department,payload);setExecuteRow(null);await reload();notify(tx.saved,'success')}catch(error){notifyError(error,'save',{operation:'control_execution_create'})}}}/>} 
 </Page>
}
function Kpi({icon:Icon,label,value}){return <MetricCard icon={Icon} value={value} label={label}/>}
function RegistryPagination({language,page,totalPages,totalItems,pageSize,onPageChange,onPageSizeChange}){const en=language==='en';const start=totalItems?((page-1)*pageSize)+1:0;const end=Math.min(page*pageSize,totalItems);return <div className="registry-pagination"><div>{totalItems?`${start}–${end} ${en?'of':'από'} ${totalItems}`:(en?'0 records':'0 εγγραφές')}</div><div className="registry-pagination-controls"><label><span>{en?'Rows':'Γραμμές'}</span><select value={pageSize} onChange={event=>onPageSizeChange(Number(event.target.value))}>{PAGE_SIZE_OPTIONS.map(value=><option key={value} value={value}>{value}</option>)}</select></label><button type="button" disabled={page<=1} onClick={()=>onPageChange(page-1)}>‹</button><span>{en?'Page':'Σελίδα'} {page} / {totalPages}</span><button type="button" disabled={page>=totalPages} onClick={()=>onPageChange(page+1)}>›</button></div></div>}
