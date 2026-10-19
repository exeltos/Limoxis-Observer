import { useCallback,useEffect,useMemo,useState } from 'react'
import { AlertTriangle,CalendarDays,CalendarX2,CheckCircle2,ClipboardCheck,Clock3,Gauge,ListChecks,PlayCircle,Plus } from 'lucide-react'
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
import { StatusBadge } from '../../design-system/StatusBadge'
import { formatDateTime } from '../../core/i18n/formatDay'
import { controlActorFromAuth } from './controlActor'
import { MetricCard } from '../../design-system/MetricCard'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { RegistryTable } from '../../design-system/RegistryTable'
import { ControlAdherencePanel,useAdherenceCounts,useControlAdherenceReport } from './ControlAdherencePanel'
import { periodRange,programmeAdherence } from './controlAdherence'
import { ControlCalendarPanel,useControlCalendarReport } from './ControlCalendarPanel'
import { assignmentProgress,assignmentStatus,frequencyLabel,getAssignment,isControlDue } from './controlScheduling'
import { dueState } from './controlDueRules'
import { filterControlRows,scopeControlRows } from './controlFilters'
import { progressText } from './controlProgress'
import { expiryCounts,expiryItems,isExpiryControl } from './controlExpiry'
import { ControlExpiryPanel } from './ControlExpiryPanel'
import { removeExpiryItem } from './controlExpiryRemoval'
import { loadControlCategories,loadControlProgramme,saveControlDefinition } from './controlCloudService'
import { CRITICALITY_LEVELS,compareControlPriority,controlCriticality,criticalityLabel } from './controlCriticality'
import './controlEvidence.css'
import { ExportMenu } from '../../design-system/ExportMenu'
import { controlsExport,exportRegistry } from '../../core/export/registryExports'

const controlsText={
 el:{calendarTab:'Ημερολόγιο',calendarYear:'Έτος',previousYear:'Προηγούμενο έτος',nextYear:'Επόμενο έτος',legendDone:'Έγινε (ημέρα)',legendLate:'Έγινε με καθυστέρηση',legendMissed:'Χάθηκε',legendPlanned:'Προγραμματισμένος',legendCount:'Έγιναν / έπρεπε',noCalendar:'Δεν υπάρχουν έλεγχοι για το ημερολόγιο.',calendarNote:'Οι συχνοί έλεγχοι (καθημερινοί, εβδομαδιαίοι) εμφανίζονται ως «έγιναν / έπρεπε» για κάθε μήνα και, για τους επόμενους μήνες, με τον αριθμό των προγραμματισμένων. Οι μηνιαίοι και ετήσιοι εμφανίζονται με την ημέρα του μήνα. Οι μελλοντικές ημερομηνίες υπολογίζονται από την επόμενη προθεσμία και μετακινούνται όταν ένας έλεγχος γίνει νωρίτερα ή αργότερα.',adherence:'Τήρηση προγράμματος',adherenceTab:'Τήρηση',programmeTab:'Πρόγραμμα',period:'Περίοδος',p30d:'Τελευταίες 30 ημέρες',p90d:'Τελευταίες 90 ημέρες',p12m:'Τελευταίοι 12 μήνες',pyear:'Από την αρχή του έτους',expected:'Έπρεπε',performed:'Έγιναν',onTime:'Στην ώρα τους',missed:'Χάθηκαν',adherenceRate:'Τήρηση',adherenceNote:'«Έπρεπε»: πόσες φορές ζητούσε η συχνότητα του ελέγχου μέσα στην περίοδο. «Στην ώρα τους»: όσες έγιναν έως την προθεσμία: κάθε ώρα εκτέλεσης έως την επόμενη (η τελευταία έως τις 23:59, ή έως την ώρα + ανοχή), οι εβδομαδιαίοι έως την Κυριακή, οι μηνιαίοι έως το τέλος του μήνα. Οι έκτακτες καταχωρήσεις δεν μετρούν.',noAdherence:'Δεν υπάρχουν προγραμματισμένες εκτελέσεις στην περίοδο.',total:'Σύνολο',created:'Ο έλεγχος δημιουργήθηκε.',centralSubtitle:'Κεντρικός προγραμματισμός και παρακολούθηση ελέγχων ανά τμήμα.',departmentSubtitle:'Οι προγραμματισμένοι έλεγχοι που αφορούν το τμήμα σας.',active:'Ενεργοί έλεγχοι',dueSoon:'Πλησιάζουν',overdue:'Εκπρόθεσμοι',today:'Καταχωρήσεις σήμερα',search:'Αναζήτηση ελέγχων',department:'Τμήμα',departments:'Τμήματα',allDepartments:'Όλα τα τμήματα',status:'Κατάσταση',all:'Όλες',temporary:'Προσωρινή',scheduled:'Εντός προγράμματος',frequency:'Συχνότητα',daily:'Ημερήσια',weekly:'Εβδομαδιαία',monthly:'Μηνιαία / ανά μήνες',yearly:'Ετήσια',custom:'Κάθε Χ ημέρες',control:'Έλεγχος',executions:'Εκτελέσεις',next:'Επόμενος',within:'Εντός',execute:'Καταχώρηση ελέγχου',emptyTitle:'Δεν υπάρχουν έλεγχοι',emptyText:'Δεν υπάρχουν έλεγχοι που να αντιστοιχούν στα επιλεγμένα φίλτρα.'},
 en:{calendarTab:'Calendar',calendarYear:'Year',previousYear:'Previous year',nextYear:'Next year',legendDone:'Done (day)',legendLate:'Done late',legendMissed:'Missed',legendPlanned:'Planned',legendCount:'Done / due',noCalendar:'No controls for the calendar.',calendarNote:'Frequent controls (daily, weekly) show “done / due” for each month and, for the months ahead, the number planned. Monthly and yearly controls show the day of the month. Future dates are worked out from the next due date and move when a control is done earlier or later.',adherence:'Programme adherence',adherenceTab:'Adherence',programmeTab:'Programme',period:'Period',p30d:'Last 30 days',p90d:'Last 90 days',p12m:'Last 12 months',pyear:'Year to date',expected:'Due',performed:'Done',onTime:'On time',missed:'Missed',adherenceRate:'Adherence',adherenceNote:'“Due”: how many times the control’s frequency called for it in the period. “On time”: done by the deadline: each execution time by the next one (the last by 23:59, or by the time + tolerance), weekly controls by Sunday, monthly ones by the end of the month. Extra entries do not count.',noAdherence:'No scheduled executions in this period.',total:'Total',created:'Control created.',centralSubtitle:'Central scheduling and monitoring of controls by department.',departmentSubtitle:'Scheduled controls assigned to your department.',active:'Active controls',dueSoon:'Due soon',overdue:'Overdue',today:'Entries today',search:'Search controls',department:'Department',departments:'Departments',allDepartments:'All departments',status:'Status',all:'All',temporary:'Draft',scheduled:'On schedule',frequency:'Frequency',daily:'Daily',weekly:'Weekly',monthly:'Monthly / every N months',yearly:'Yearly',custom:'Every N days',control:'Control',executions:'Executions',next:'Next',within:'On schedule',execute:'Record control',emptyTitle:'No controls',emptyText:'No controls match the selected filters.'}
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
// Counted in the database (control_assignment_summary): the list never reads the executions.
function executionCount(item,departments){
 return departments.reduce((n,dep)=>n+(getAssignment(item,dep)?.summary?.executions||0),0)
}
function hasDraft(item,departments){
 return departments.some(dep=>Boolean(getAssignment(item,dep)?.hasDraft))
}
function quickDepartment(item,departments){
 const ordered=[...departments].sort((a,b)=>{
  const aa=getAssignment(item,a),bb=getAssignment(item,b)
  if(Boolean(aa?.hasDraft)!==Boolean(bb?.hasDraft))return aa?.hasDraft?-1:1
  const sa=assignmentStatus(item,a),sb=assignmentStatus(item,b)
  const rank={overdue:0,dueSoon:1,scheduled:2,paused:3}
  if(rank[sa]!==rank[sb])return rank[sa]-rank[sb]
  return new Date(aa?.nextDueAt||8640000000000000)-new Date(bb?.nextDueAt||8640000000000000)
 })
 return ordered[0]||''
}

export function ControlsPage(){
 const {role,membership,tenant,canAccessRecord}=useTenant()
 const {profile,user}=useAuth()
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const {t,language}=useLanguage();const tx=controlsText[language==='en'?'en':'el']
 const {confirm,notify,notifyError}=useFeedback()
 const navigate=useNavigate(),registry=useRegistryMemory('controls')
 const savedView=registry.loadViewState({query:'',department:'all',status:'all',frequency:'all',category:'all',criticality:'all',view:'programme'})
 const [query,setQuery]=useState(savedView.query),[department,setDepartment]=useState(savedView.department),[status,setStatus]=useState(savedView.status),[frequency,setFrequency]=useState(savedView.frequency),[category,setCategory]=useState(savedView.category||'all'),[criticality,setCriticality]=useState(savedView.criticality||'all')
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

 const scopedControls=useMemo(()=>programme.map(item=>({item,departments:item.departments.filter(dep=>canAccessRecord({department:dep,departmentId:item.departmentIdByName?.[dep]||null}))})).filter(row=>row.departments.length>0),[programme,canAccessRecord])
 const departments=[...new Set(scopedControls.flatMap(x=>x.departments))]
 const categories=[...new Set(scopedControls.map(({item})=>item.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el'))
 const expirySources=useMemo(()=>scopedControls.filter(({item})=>isExpiryControl(item)&&(category==='all'||item.category===category)).filter(row=>department==='all'||row.departments.includes(department)).map(({item,departments:deps})=>({record:item,departments:department==='all'?deps:deps.filter(dep=>dep===department)})),[scopedControls,department,category])
 // Every tab (list, KPIs, adherence, calendar, exports) counts only the
 // departments the filters keep (controlFilters).
 const kpiRows=useMemo(()=>scopeControlRows(scopedControls,{department,frequency,category,criticality}),[scopedControls,department,frequency,category,criticality])
 const rows=useMemo(()=>filterControlRows(scopedControls,{query,department,status,frequency,category,criticality}).map(row=>({...row,state:controlState(row.item,row.departments)})).sort(compareControlPriority),[scopedControls,query,department,status,frequency,category,criticality])
 useEffect(()=>{setPage(1)},[query,department,status,frequency,category,criticality,pageSize])
 const totalPages=Math.max(1,Math.ceil(rows.length/pageSize));const safePage=Math.min(page,totalPages);const pagedRows=rows.slice((safePage-1)*pageSize,safePage*pageSize)
 const fmt=v=>formatDateTime(v,language)
 const overdue=kpiRows.filter(({item,departments:deps})=>controlState(item,deps)==='overdue').length
 const dueSoon=kpiRows.filter(({item,departments:deps})=>controlState(item,deps)==='dueSoon').length
 const today=kpiRows.reduce((total,{item,departments:deps})=>total+deps.reduce((n,dep)=>n+(getAssignment(item,dep)?.summary?.today||0),0),0)
 const adherenceReport=useControlAdherenceReport(rows,tx,language,tenant?.id,programme)
 const calendarReport=useControlCalendarReport(rows,tx,language,tenant?.id,programme)
 const {counts:monthCounts,failed:monthCountsFailed}=useAdherenceCounts(tenant?.id,'30d',programme)
 // A failed count shows no rate rather than a false 0%.
 const monthAdherence=useMemo(()=>monthCountsFailed?programmeAdherence([],periodRange('30d'),new Map()).totals:programmeAdherence(kpiRows,periodRange('30d'),monthCounts).totals,[kpiRows,monthCounts,monthCountsFailed])

 function quickExecute(item,deps,e){
  e?.stopPropagation()
  const dep=quickDepartment(item,deps)
  const assignment=getAssignment(item,dep)
  const allowed=Boolean(dep&&assignment)&&(Boolean(assignment?.hasDraft)||canManage||(canExecute&&(isControlDue(item,dep)||assignmentProgress(item,dep)?.complete)))
  if(!allowed)return
  // ▶ opens the entry form straight away (its ← returns here): no extra confirm step.
  registry.saveViewState({query,department,status,frequency,category,criticality,view})
  navigate(`/controls/${item.id}?department=${encodeURIComponent(dep)}&execute=1`)
 }
 function exportProgramme(){
  const stateText=assignment=>{if(assignment?.status==='paused')return language==='en'?'Paused':'Σε παύση';if(!assignment?.nextDueAt)return '—';const state=dueState(assignment.nextDueAt);return state==='overdue'?tx.overdue:state==='dueSoon'?tx.dueSoon:tx.within}
  exportRegistry(controlsExport(rows,{en:language==='en',frequencyLabel:f=>frequencyLabel(f,language),stateLabel:stateText,criticality:controlCriticality,criticalityLabel:level=>criticalityLabel(level,language)}))
 }
 function clearFilters(){setQuery('');setDepartment('all');setStatus('all');setFrequency('all');setCategory('all');setCriticality('all');calendarReport.setYear(new Date().getFullYear())}
 function pageAction(action){if(action===UI_ACTIONS.CREATE&&canCreate){registry.saveViewState({query,department,status,frequency,category,criticality,view});navigate('/controls/new')}}
 function openControl(item){registry.saveViewState({query,department,status,frequency,category,criticality,view});registry.openRecord(navigate,`/controls/${item.id}`,item.id,rows.map(x=>x.item.id))}

 return <Page fill className="registry-fill-page controls-registry-page" title={t('controls')} subtitle={canManage&&!isDepartmentManager?tx.centralSubtitle:tx.departmentSubtitle} actions={<div className="row-actions">{view==='adherence'?<ExportMenu onPrint={()=>adherenceReport.exportPdf(false)} onPdf={()=>adherenceReport.exportPdf(true)} onExcel={adherenceReport.exportCsv} disabled={!adherenceReport.lines.length} pdfBusy={adherenceReport.exporting}/>:view==='calendar'?<ExportMenu onPrint={()=>calendarReport.exportPdf(false)} onPdf={()=>calendarReport.exportPdf(true)} onExcel={calendarReport.exportCsv} disabled={!calendarReport.lines.length} pdfBusy={calendarReport.exporting}/>:<ExportMenu disabled={!rows.length} onExcel={exportProgramme}/>}{canCreate&&<RecordActions actions={[UI_ACTIONS.CREATE]} onAction={pageAction}/>}</div>}>
  <div className="workspace-summary"><div className="module-summary-strip"><Kpi icon={ClipboardCheck} label={tx.active} value={kpiRows.length}/><Kpi icon={Clock3} label={tx.dueSoon} value={dueSoon} onClick={()=>setStatus(status==='dueSoon'?'all':'dueSoon')} active={status==='dueSoon'}/><Kpi icon={AlertTriangle} label={tx.overdue} value={overdue} onClick={()=>setStatus(status==='overdue'?'all':'overdue')} active={status==='overdue'}/><Kpi icon={CheckCircle2} label={tx.today} value={today}/><Kpi icon={Gauge} label={`${tx.adherence} · 30 ${language==='en'?'days':'ημ.'}`} value={monthAdherence.rate==null?'—':`${monthAdherence.rate}%`} onClick={()=>setView(view==='adherence'?'programme':'adherence')} active={view==='adherence'}/></div></div>
  <CanonicalTabs items={[{value:'programme',label:tx.programmeTab,icon:ListChecks},{value:'calendar',label:tx.calendarTab,icon:CalendarDays},{value:'adherence',label:tx.adherenceTab,icon:Gauge},{value:'expiry',label:language==='en'?'Expiry':'Λήξεις',icon:CalendarX2}]} value={view} onChange={setView} ariaLabel={t('controls')}/>
  <section className="surface registry-workspace workspace-column workspace-fill controls-registry-workspace">
   <FilterBar query={query} onQueryChange={setQuery} placeholder={tx.search} activeAdvancedCount={(department!=='all')+(status!=='all')+(frequency!=='all')+(category!=='all')+(criticality!=='all')+(view==='calendar'&&calendarReport.year!==new Date().getFullYear())} onClear={clearFilters}>
    <FilterSelect label={tx.department} value={department} onChange={setDepartment}><option value="all">{tx.allDepartments}</option>{departments.map(x=><option key={x}>{x}</option>)}</FilterSelect>
    <FilterSelect label={tx.status} value={status} onChange={setStatus}><option value="all">{tx.all}</option><option value="temporary">{tx.temporary}</option><option value="scheduled">{tx.scheduled}</option><option value="dueSoon">{tx.dueSoon}</option><option value="overdue">{tx.overdue}</option></FilterSelect>
    <FilterSelect label={tx.frequency} value={frequency} onChange={setFrequency}><option value="all">{tx.all}</option><option value="daily">{tx.daily}</option><option value="weekly">{tx.weekly}</option><option value="monthly">{tx.monthly}</option><option value="yearly">{tx.yearly}</option><option value="custom">{tx.custom}</option></FilterSelect>
    <FilterSelect label={language==='en'?'Control type':'Είδος ελέγχου'} value={category} onChange={setCategory}><option value="all">{tx.all}</option>{categories.map(x=><option key={x} value={x}>{x}</option>)}</FilterSelect>
    <FilterSelect label={language==='en'?'Criticality':'Κρισιμότητα'} value={criticality} onChange={setCriticality}><option value="all">{tx.all}</option>{CRITICALITY_LEVELS.map(level=><option key={level} value={level}>{criticalityLabel(level,language)}</option>)}</FilterSelect>
    {view==='calendar'&&<FilterSelect label={language==='en'?'Year':'Έτος'} value={String(calendarReport.year)} onChange={value=>calendarReport.setYear(Number(value))}>{Array.from({length:6},(_,i)=>new Date().getFullYear()+1-i).map(y=><option key={y} value={y}>{y}</option>)}</FilterSelect>}
   </FilterBar>
   {view==='expiry'?<ControlExpiryPanel actorName={actor.name} showControl query={query} sources={expirySources} canRemove={()=>canExecute} onRemove={item=>removeExpiryItem({item,organizationId:tenant.id,actor,language,confirm,notify,notifyError,reload})} onOpenControl={openControl} language={language} locale={language==='en'?'en-GB':'el-GR'}/>:view==='adherence'?<ControlAdherencePanel report={adherenceReport} tx={tx} language={language} onOpen={openControl}/>:view==='calendar'?<ControlCalendarPanel report={calendarReport} language={language} onOpen={openControl}/>:<>
   <RegistryTable wrapperRef={registry.scrollRef} className="controls-table" columns={[{key:'control',label:tx.control},{key:'departments',label:tx.departments},{key:'frequency',label:tx.frequency},{key:'executions',label:tx.executions},{key:'next',label:tx.next},{key:'status',label:tx.status},{key:'action',label:'',ariaLabel:tx.execute,className:'control-action-col'}]} rows={loading?[]:pagedRows} rowKey={row=>row.item.id} emptyTitle={loading?(language==='en'?'Loading controls…':'Φόρτωση ελέγχων…'):scopedControls.length?undefined:tx.emptyTitle} emptyText={loading?undefined:scopedControls.length?undefined:(language==='en'?'A control defines what is checked, where and how often; its executions build the adherence report.':'Ένας έλεγχος ορίζει τι ελέγχεται, πού και πόσο συχνά· οι εκτελέσεις του δίνουν την τήρηση του προγράμματος.')} emptyFiltered={!loading&&scopedControls.length>0} onClearFilters={clearFilters} emptyIcon={loading?undefined:ClipboardCheck} emptyAction={!loading&&!scopedControls.length&&canCreate?{label:language==='en'?'New control':'Νέος έλεγχος',icon:Plus,onClick:()=>pageAction(UI_ACTIONS.CREATE)}:undefined} renderRow={({item,departments:deps})=>{const state=controlState(item,deps),draft=hasDraft(item,deps),depPreview=deps.slice(0,3).join(' · '),more=deps.length>3?' …':'',dep=quickDepartment(item,deps),assignment=getAssignment(item,dep),due=isControlDue(item,dep),allowed=Boolean(dep&&assignment)&&(Boolean(assignment?.hasDraft)||canManage||(canExecute&&(due||assignmentProgress(item,dep)?.complete))),progress=deps.length===1?progressText(assignmentProgress(item,deps[0]),language):'',expiry=isExpiryControl(item)?expiryCounts(expiryItems(item,deps)):null;return <tr key={item.id} {...registry.rowProps(item.id)} onClick={()=>openControl(item)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openControl(item)}}}><td><strong>{language==='el'?item.title:item.titleEn}</strong><small>{[item.category,item.equipment||item.location].filter(Boolean).join(' · ')}{controlCriticality(item)==='high'&&<span className="control-criticality-badge high">{criticalityLabel('high',language)} {language==='en'?'criticality':'κρισιμότητα'}</span>}{expiry?.expired>0&&<span className="control-criticality-badge high">{expiry.expired} {language==='en'?'expired':(expiry.expired===1?'ληγμένο':'ληγμένα')}</span>}{expiry?.expiring>0&&<span className="control-criticality-badge medium">{expiry.expiring} {language==='en'?'expiring':(expiry.expiring===1?'λήγει':'λήγουν')}</span>}</small></td><td>{deps.length===1?deps[0]:<><strong>{deps.length} {language==='en'?'departments':'τμήματα'}</strong><small>{depPreview}{more}</small></>}</td><td>{frequencyLabel(item.frequency,language)}</td><td>{executionCount(item,deps).toLocaleString(language==='en'?'en-GB':'el-GR')}</td><td>{fmt(earliestNext(item,deps))}</td><td><div className="control-status-stack">{draft&&<StatusBadge tone="info">{tx.temporary}</StatusBadge>}<StatusBadge tone={state==='overdue'?'danger':state==='dueSoon'?'warning':'success'}>{state==='overdue'?tx.overdue:state==='dueSoon'?tx.dueSoon:tx.within}</StatusBadge>{progress&&<small className="control-progress-text">{progress}</small>}</div></td><td className="control-action-col"><IconButton size="sm" tone={allowed&&(due||canManage||assignment?.hasDraft)?'primary':'neutral'} disabled={!allowed} label={tx.execute} onClick={e=>quickExecute(item,deps,e)}><PlayCircle size={16}/></IconButton></td></tr>}}/>
   {rows.length>0&&<RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1)}}/>}
   </>}
  </section>
 </Page>
}
function Kpi({icon:Icon,label,value,onClick,active}){return <MetricCard icon={Icon} value={value} label={label} onClick={onClick} active={active}/>}

// New control (/controls/new): the editor on its own route, so ← and the
// browser's back return to the registry where it was left.
export function ControlCreatePage(){
 const {role,membership,tenant}=useTenant()
 const {profile,user}=useAuth()
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const {language}=useLanguage();const tx=controlsText[language==='en'?'en':'el']
 const {notify,notifyError}=useFeedback()
 const navigate=useNavigate()
 const [categories,setCategories]=useState([])
 const ownDepartment=membership?.previewDepartment||membership?.departmentName||membership?.department||''
 const isDepartmentManager=role===ROLES.DEPARTMENT_MANAGER
 const createdByScope=isDepartmentManager?'department':role===ROLES.PLATFORM_OWNER?'platform':role===ROLES.HOSPITAL_ADMIN?'hospital_admin':role===ROLES.QUALITY_MANAGER?'quality':'infection_control'
 useEffect(()=>{if(!tenant?.id)return;let active=true;loadControlCategories(tenant.id).then(rows=>{if(active)setCategories(rows)}).catch(()=>{});return()=>{active=false}},[tenant?.id])
 async function saveNew(draft){
  try{
   const scopedDraft=isDepartmentManager?{...draft,departments:[ownDepartment],createdByScope:'department',createdForDepartment:ownDepartment}:{...draft,createdByScope}
   const saved=await saveControlDefinition(tenant.id,scopedDraft,{actorName:actor.name,createdByScope:scopedDraft.createdByScope,createdForDepartment:scopedDraft.createdForDepartment})
   notify(tx.created,'success')
   navigate(`/controls/${saved.id}`,{replace:true})
  }catch(error){notifyError(error,'save',{operation:'control_definition_create'})}
 }
 const canCreate=can(role,CAPABILITIES.MANAGE_CONTROLS,membership?.capabilities??[],membership?.customCapabilities??[])||(isDepartmentManager&&Boolean(ownDepartment))
 if(!canCreate)return <Page title={language==='en'?'Controls':'Έλεγχοι'}><div className="inline-empty">{language==='en'?'You cannot create controls.':'Δεν έχετε δικαίωμα δημιουργίας ελέγχων.'}</div></Page>
 return <ControlEditor departmentOnly={isDepartmentManager} fixedDepartment={isDepartmentManager?ownDepartment:''} usedCategories={categories} onCancel={()=>navigate('/controls')} onSave={saveNew}/>
}
