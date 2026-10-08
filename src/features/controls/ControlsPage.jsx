import { useCallback,useEffect,useMemo,useState } from 'react'
import { AlertTriangle,CheckCircle2,ClipboardCheck,Clock3,Gauge,ListChecks,PlayCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { IconButton } from '../../design-system/IconButton'
import { useTenant } from '../../core/tenant/TenantContext'
import { useAuth } from '../../core/auth/AuthContext'
import { CAPABILITIES,ROLES,can } from '../../core/permissions/roles'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { ControlEditor } from './ControlEditor'
import { controlActorFromAuth } from './controlActor'
import { MetricCard } from '../../design-system/MetricCard'
import { ModuleTabs } from '../../design-system/ModuleTabs'
import { ControlAdherencePanel,useControlAdherenceReport } from './ControlAdherencePanel'
import { periodRange,programmeAdherence } from './controlAdherence'
import { assignmentStatus,frequencyLabel,getAssignment,isControlDue } from './controlScheduling'
import { loadControlProgramme,saveControlDefinition } from './controlCloudService'
import { compareControlPriority,controlCriticality,criticalityLabel } from './controlCriticality'
import './controlEvidence.css'
import { DownloadMenu } from '../../design-system/DownloadMenu'
import { controlsExport,exportRegistry } from '../../core/export/registryExports'

const controlsText={
 el:{adherence:'Τήρηση προγράμματος',adherenceTab:'Τήρηση',programmeTab:'Πρόγραμμα',period:'Περίοδος',p30d:'Τελευταίες 30 ημέρες',p90d:'Τελευταίες 90 ημέρες',p12m:'Τελευταίοι 12 μήνες',pyear:'Από την αρχή του έτους',expected:'Έπρεπε',performed:'Έγιναν',onTime:'Στην ώρα τους',missed:'Χάθηκαν',adherenceRate:'Τήρηση',adherenceNote:'«Έπρεπε»: πόσες φορές ζητούσε η συχνότητα του ελέγχου μέσα στην περίοδο. «Στην ώρα τους»: όσες έγιναν έως την προθεσμία (ανοχή 2 ώρες για καθημερινούς, 1 ημέρα για τους υπόλοιπους).',noAdherence:'Δεν υπάρχουν προγραμματισμένες εκτελέσεις στην περίοδο.',total:'Σύνολο',created:'Ο έλεγχος δημιουργήθηκε.',centralSubtitle:'Κεντρικός προγραμματισμός και παρακολούθηση ελέγχων ανά τμήμα.',departmentSubtitle:'Οι προγραμματισμένοι έλεγχοι που αφορούν το τμήμα σας.',active:'Ενεργοί έλεγχοι',dueSoon:'Πλησιάζουν',overdue:'Εκπρόθεσμοι',today:'Καταχωρήσεις σήμερα',search:'Αναζήτηση ελέγχων',department:'Τμήμα',departments:'Τμήματα',allDepartments:'Όλα τα τμήματα',status:'Κατάσταση',all:'Όλες',temporary:'Προσωρινή',scheduled:'Εντός προγράμματος',frequency:'Συχνότητα',daily:'Ημερήσια',weekly:'Εβδομαδιαία',monthly:'Μηνιαία / ανά μήνες',yearly:'Ετήσια',control:'Έλεγχος',executions:'Εκτελέσεις',next:'Επόμενος',within:'Εντός',execute:'Καταχώρηση ελέγχου',emptyTitle:'Δεν υπάρχουν έλεγχοι',emptyText:'Δεν υπάρχουν έλεγχοι που να αντιστοιχούν στα επιλεγμένα φίλτρα.'},
 en:{adherence:'Programme adherence',adherenceTab:'Adherence',programmeTab:'Programme',period:'Period',p30d:'Last 30 days',p90d:'Last 90 days',p12m:'Last 12 months',pyear:'Year to date',expected:'Due',performed:'Done',onTime:'On time',missed:'Missed',adherenceRate:'Adherence',adherenceNote:'“Due”: how many times the control’s frequency called for it in the period. “On time”: done by the due time (2-hour tolerance for daily controls, 1 day for the rest).',noAdherence:'No scheduled executions in this period.',total:'Total',created:'Control created.',centralSubtitle:'Central scheduling and monitoring of controls by department.',departmentSubtitle:'Scheduled controls assigned to your department.',active:'Active controls',dueSoon:'Due soon',overdue:'Overdue',today:'Entries today',search:'Search controls',department:'Department',departments:'Departments',allDepartments:'All departments',status:'Status',all:'All',temporary:'Draft',scheduled:'On schedule',frequency:'Frequency',daily:'Daily',weekly:'Weekly',monthly:'Monthly / every N months',yearly:'Yearly',control:'Control',executions:'Executions',next:'Next',within:'On schedule',execute:'Record control',emptyTitle:'No controls',emptyText:'No controls match the selected filters.'}
}

function controlState(item,departments){
 const states=departments.map(dep=>assignmentStatus(item,dep))
 if(states.includes('overdue'))return 'overdue'
 if(states.includes('dueSoon'))return 'dueSoon'
 return 'scheduled'
}
function earliestNext(item,departments){
 return departments.map(dep=>getAssignment(item,dep)?.nextDueAt).filter(Boolean).sort((a,b)=>new Date(a)-new Date(b))[0]||null
}
function executionCount(item,departments){
 return departments.reduce((n,dep)=>n+(getAssignment(item,dep)?.history?.length||0),0)
}
function hasDraft(item,departments){
 return departments.some(dep=>Boolean(getAssignment(item,dep)?.hasDraft))
}
function quickDepartment(item,departments){
 const ordered=[...departments].sort((a,b)=>{
  const aa=getAssignment(item,a),bb=getAssignment(item,b)
  if(Boolean(aa?.hasDraft)!==Boolean(bb?.hasDraft))return aa?.hasDraft?-1:1
  const sa=assignmentStatus(item,a),sb=assignmentStatus(item,b)
  const rank={overdue:0,dueSoon:1,scheduled:2}
  if(rank[sa]!==rank[sb])return rank[sa]-rank[sb]
  return new Date(aa?.nextDueAt||8640000000000000)-new Date(bb?.nextDueAt||8640000000000000)
 })
 return ordered[0]||''
}

export function ControlsPage(){
 const {role,membership,tenant,canAccessRecord}=useTenant()
 const {profile,user}=useAuth()
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const {t,language,locale}=useLanguage();const tx=controlsText[language==='en'?'en':'el']
 const {confirm,notify,notifyError}=useFeedback()
 const navigate=useNavigate(),registry=useRegistryMemory('controls')
 const savedView=registry.loadViewState({query:'',department:'all',status:'all',frequency:'all',view:'programme'})
 const [query,setQuery]=useState(savedView.query),[department,setDepartment]=useState(savedView.department),[status,setStatus]=useState(savedView.status),[frequency,setFrequency]=useState(savedView.frequency)
 const [editorOpen,setEditorOpen]=useState(false)
 const [programme,setProgramme]=useState([]),[loading,setLoading]=useState(true)
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(15)
 const [view,setView]=useState(savedView.view||'programme')
 const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[]
 const canManage=can(role,CAPABILITIES.MANAGE_CONTROLS,addOns,custom)
 const canExecute=can(role,CAPABILITIES.EXECUTE_CONTROL,addOns,custom)
 const ownDepartment=membership?.previewDepartment||membership?.departmentName||membership?.department||''
 const isDepartmentManager=role===ROLES.DEPARTMENT_MANAGER
 const canCreate=canManage||(isDepartmentManager&&Boolean(ownDepartment))

 const reload=useCallback(async()=>{
  if(!tenant?.id){setProgramme([]);setLoading(false);return}
  setLoading(true)
  try{setProgramme(await loadControlProgramme(tenant.id))}
  catch(error){setProgramme([]);notifyError(error,'load',{operation:'controls_programme_load'})}
  finally{setLoading(false)}
 },[tenant?.id,notifyError])
 useEffect(()=>{void reload()},[reload])

 const scopedControls=useMemo(()=>programme.map(item=>({item,departments:item.departments.filter(dep=>canAccessRecord({department:dep}))})).filter(row=>row.departments.length>0),[programme,canAccessRecord])
 const departments=[...new Set(scopedControls.flatMap(x=>x.departments))]
 const rows=useMemo(()=>scopedControls.filter(({item})=>`${item.id} ${item.title} ${item.category} ${item.owner}`.toLowerCase().includes(query.toLowerCase())).filter(row=>department==='all'||row.departments.includes(department)).filter(({item,departments:deps})=>status==='all'||(status==='temporary'?hasDraft(item,deps):deps.some(dep=>assignmentStatus(item,dep)===status))).filter(({item})=>frequency==='all'||item.frequency.kind===frequency).map(row=>({...row,state:controlState(row.item,row.departments)})).sort(compareControlPriority),[scopedControls,query,department,status,frequency])
 useEffect(()=>{setPage(1)},[query,department,status,frequency,pageSize])
 const totalPages=Math.max(1,Math.ceil(rows.length/pageSize));const safePage=Math.min(page,totalPages);const pagedRows=rows.slice((safePage-1)*pageSize,safePage*pageSize)
 const fmt=v=>v?new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short',hour12:false}).format(new Date(v)):'—'
 const overdue=scopedControls.filter(({item,departments:deps})=>controlState(item,deps)==='overdue').length
 const dueSoon=scopedControls.filter(({item,departments:deps})=>controlState(item,deps)==='dueSoon').length
 const todayKey=new Date().toISOString().slice(0,10)
 const today=scopedControls.reduce((total,{item,departments:deps})=>total+deps.reduce((n,dep)=>n+(getAssignment(item,dep)?.history||[]).filter(h=>h.at?.slice(0,10)===todayKey).length,0),0)
 const adherenceReport=useControlAdherenceReport(rows,tx,language)
 const monthAdherence=useMemo(()=>programmeAdherence(scopedControls,periodRange('30d')).totals,[scopedControls])
 const createdByScope=isDepartmentManager?'department':role===ROLES.PLATFORM_OWNER?'platform':role===ROLES.HOSPITAL_ADMIN?'hospital_admin':role===ROLES.QUALITY_MANAGER?'quality':'infection_control'

 async function saveNew(draft){
  try{
   const scopedDraft=isDepartmentManager?{...draft,departments:[ownDepartment],createdByScope:'department',createdForDepartment:ownDepartment}:{...draft,createdByScope}
   const saved=await saveControlDefinition(tenant.id,scopedDraft,{actorName:actor.name,createdByScope:scopedDraft.createdByScope,createdForDepartment:scopedDraft.createdForDepartment})
   setEditorOpen(false);notify(tx.created,'success');await reload()
   registry.openRecord(navigate,`/controls/${saved.id}`,saved.id)
  }catch(error){notifyError(error,'save',{operation:'control_definition_create'})}
 }
 async function quickExecute(item,deps,e){
  e?.stopPropagation()
  const dep=quickDepartment(item,deps)
  const assignment=getAssignment(item,dep)
  const allowed=Boolean(dep&&assignment)&&(Boolean(assignment?.hasDraft)||canManage||(canExecute&&isControlDue(item,dep)))
  if(!allowed)return
  const ok=await confirm({title:tx.execute,message:language==='en'?`Open a new entry for “${item.titleEn||item.title}” in ${dep}? The recorder details will be filled automatically.`:`Να ανοίξει νέα καταχώρηση για «${item.title}» στο ${dep}; Τα στοιχεία του ελεγκτή θα συμπληρωθούν αυτόματα.`,confirmLabel:tx.execute})
  if(!ok)return
  registry.saveViewState({query,department,status,frequency,view})
  navigate(`/controls/${item.id}?department=${encodeURIComponent(dep)}&execute=1`)
 }
 function exportProgramme(){
  const stateText=assignment=>{if(assignment?.status==='paused')return language==='en'?'Paused':'Σε παύση';const due=assignment?.nextDueAt?new Date(assignment.nextDueAt)-Date.now():null;return due==null?'—':due<=0?tx.overdue:due<=24*60*60*1000?tx.dueSoon:tx.within}
  exportRegistry(controlsExport(rows,{en:language==='en',frequencyLabel:f=>frequencyLabel(f,language),stateLabel:stateText,criticality:controlCriticality,criticalityLabel:level=>criticalityLabel(level,language)}))
 }
 function pageAction(action){if(action===UI_ACTIONS.CREATE&&canCreate)setEditorOpen(true)}
 function openControl(item){registry.saveViewState({query,department,status,frequency,view});registry.openRecord(navigate,`/controls/${item.id}`,item.id,rows.map(x=>x.item.id))}

 if(editorOpen)return <ControlEditor departmentOnly={isDepartmentManager} fixedDepartment={isDepartmentManager?ownDepartment:''} onCancel={()=>setEditorOpen(false)} onSave={saveNew}/>

 return <Page fill className="registry-fill-page controls-registry-page" title={t('controls')} subtitle={canManage&&!isDepartmentManager?tx.centralSubtitle:tx.departmentSubtitle} actions={<div className="row-actions">{view==='adherence'?<DownloadMenu onExcel={adherenceReport.exportCsv} onPdf={adherenceReport.exportPdf} disabled={!adherenceReport.lines.length} pdfBusy={adherenceReport.exporting}/>:<DownloadMenu disabled={!rows.length} onExcel={exportProgramme}/>}{canCreate&&<RecordActions actions={[UI_ACTIONS.CREATE]} onAction={pageAction}/>}</div>}>
  <div className="workspace-summary"><div className="module-summary-strip"><Kpi icon={ClipboardCheck} label={tx.active} value={scopedControls.length}/><Kpi icon={Clock3} label={tx.dueSoon} value={dueSoon} onClick={()=>setStatus(status==='dueSoon'?'all':'dueSoon')} active={status==='dueSoon'}/><Kpi icon={AlertTriangle} label={tx.overdue} value={overdue} onClick={()=>setStatus(status==='overdue'?'all':'overdue')} active={status==='overdue'}/><Kpi icon={CheckCircle2} label={tx.today} value={today}/><Kpi icon={Gauge} label={`${tx.adherence} · 30 ${language==='en'?'days':'ημ.'}`} value={monthAdherence.rate==null?'—':`${monthAdherence.rate}%`} onClick={()=>setView(view==='adherence'?'programme':'adherence')} active={view==='adherence'}/></div></div>
  <section className="surface registry-workspace workspace-column workspace-fill controls-registry-workspace">
   <ModuleTabs activeId={view} onChange={setView} ariaLabel={t('controls')} tabs={[{id:'programme',label:tx.programmeTab,icon:ListChecks},{id:'adherence',label:tx.adherenceTab,icon:Gauge}]}/>
   <FilterBar query={query} onQueryChange={setQuery} placeholder={tx.search} activeAdvancedCount={(department!=='all')+(status!=='all')+(frequency!=='all')} onClear={()=>{setQuery('');setDepartment('all');setStatus('all');setFrequency('all')}}>
    <FilterSelect label={tx.department} value={department} onChange={setDepartment}><option value="all">{tx.allDepartments}</option>{departments.map(x=><option key={x}>{x}</option>)}</FilterSelect>
    <FilterSelect label={tx.status} value={status} onChange={setStatus}><option value="all">{tx.all}</option><option value="temporary">{tx.temporary}</option><option value="scheduled">{tx.scheduled}</option><option value="dueSoon">{tx.dueSoon}</option><option value="overdue">{tx.overdue}</option></FilterSelect>
    <FilterSelect label={tx.frequency} value={frequency} onChange={setFrequency}><option value="all">{tx.all}</option><option value="daily">{tx.daily}</option><option value="weekly">{tx.weekly}</option><option value="monthly">{tx.monthly}</option><option value="yearly">{tx.yearly}</option></FilterSelect>
   </FilterBar>
   {view==='adherence'?<ControlAdherencePanel report={adherenceReport} tx={tx} language={language}/>:<>
   <div className="scroll-table" ref={registry.scrollRef}>
    <table className="data-table sticky-table controls-table">
     <thead><tr><th>{tx.control}</th><th>{tx.departments}</th><th>{tx.frequency}</th><th>{tx.executions}</th><th>{tx.next}</th><th>{tx.status}</th><th className="control-action-col"></th></tr></thead>
     <tbody>{pagedRows.map(({item,departments:deps})=>{const state=controlState(item,deps),draft=hasDraft(item,deps),depPreview=deps.slice(0,3).join(' · '),more=deps.length>3?' …':'',dep=quickDepartment(item,deps),assignment=getAssignment(item,dep),allowed=Boolean(dep&&assignment)&&(Boolean(assignment?.hasDraft)||canManage||(canExecute&&isControlDue(item,dep)));return <tr key={item.id} {...registry.rowProps(item.id)} onClick={()=>openControl(item)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openControl(item)}}}><td><strong>{language==='el'?item.title:item.titleEn}</strong><small>{item.category}{controlCriticality(item)==='high'&&<span className="control-criticality-badge high">{criticalityLabel('high',language)} {language==='en'?'criticality':'κρισιμότητα'}</span>}</small></td><td>{deps.length===1?deps[0]:<><strong>{deps.length} {language==='en'?'departments':'τμήματα'}</strong><small>{depPreview}{more}</small></>}</td><td>{frequencyLabel(item.frequency,language)}</td><td>{executionCount(item,deps)}</td><td>{fmt(earliestNext(item,deps))}</td><td><div className="control-status-stack">{draft&&<span className="status-badge temporary">{tx.temporary}</span>}<span className={`status-badge ${state==='overdue'?'danger':state==='dueSoon'?'warning':'active'}`}>{state==='overdue'?tx.overdue:state==='dueSoon'?tx.dueSoon:tx.within}</span></div></td><td className="control-action-col"><IconButton size="sm" tone={allowed?'primary':'neutral'} disabled={!allowed} label={tx.execute} onClick={e=>quickExecute(item,deps,e)}><PlayCircle size={16}/></IconButton></td></tr>})}</tbody>
    </table>
    {loading&&<div className="registry-empty-state"><strong>{language==='en'?'Loading controls…':'Φόρτωση ελέγχων…'}</strong></div>}
    {!loading&&!rows.length&&<div className="registry-empty-state"><strong>{tx.emptyTitle}</strong><span>{tx.emptyText}</span></div>}
   </div>
   <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1)}}/>
   </>}
  </section>
 </Page>
}
function Kpi({icon:Icon,label,value,onClick,active}){return <MetricCard icon={Icon} value={value} label={label} onClick={onClick} active={active}/>}
