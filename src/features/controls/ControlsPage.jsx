import { useCallback,useEffect,useMemo,useState } from 'react'
import { CalendarX2,ClipboardCheck,Clock,Gauge,LayoutGrid,ListChecks,PlayCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar } from '../../design-system/FilterBar'
import { ChoiceChips } from '../../design-system/ChoiceChips'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { useTenant } from '../../core/tenant/TenantContext'
import { useAuth } from '../../core/auth/AuthContext'
import { CAPABILITIES,ROLES,can } from '../../core/permissions/roles'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { ControlEditor } from './ControlEditor'
import { SignalBadge } from '../../design-system/StatusBadge'
import { formatDateTime } from '../../core/i18n/formatDay'
import { controlActorFromAuth } from './controlActor'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { RegistryTable } from '../../design-system/RegistryTable'
import { ControlAdherencePanel,RateMeter,UntilNote,useAdherenceCounts,useControlAdherenceReport } from './ControlAdherencePanel'
import { ControlDepartmentCards } from './ControlDepartmentCards'
import { ControlMissedDialog } from './ControlMissedDialog'
import { controlRates,departmentCards } from './controlDepartmentCards'
import { ADHERENCE_PERIODS,periodAdherence,periodShort,reportEnd } from './controlAdherence'
import { assignmentProgress,assignmentStatus,controlFrequencyLabel,frequencyLabel,getAssignment,isControlDue,recordOpensAt } from './controlScheduling'
import { dueState,zonedParts } from './controlDueRules'
import { filterControlRows,scopeControlRows } from './controlFilters'
import { progressText } from './controlProgress'
import { expiryCounts,expiryItems,isExpiryControl } from './controlExpiry'
import { ControlExpiryPanel } from './ControlExpiryPanel'
import { ControlTimeFitPanel,useControlTimeFitReport } from './ControlTimeFitPanel'
import { removeExpiryItem } from './controlExpiryRemoval'
import { loadControlCategories,loadControlLastEntryAt,loadControlNames,loadControlProgramme,saveControlDefinition } from './controlCloudService'
import { compareControlPriority,controlCriticality,criticalityLabel } from './controlCriticality'
import './controlEvidence.css'
import { ExportMenu } from '../../design-system/ExportMenu'
import { controlsExport,exportRegistry } from '../../core/export/registryExports'

const controlsText={
 el:{calendarTab:'Ημερολόγιο',calendarYear:'Έτος',previousYear:'Προηγούμενο έτος',nextYear:'Επόμενο έτος',legendDone:'Έγινε (ημέρα)',legendLate:'Έγινε με καθυστέρηση',legendMissed:'Χάθηκε',legendPlanned:'Προγραμματισμένος',legendCount:'Έγιναν / έπρεπε',noCalendar:'Δεν υπάρχουν έλεγχοι για το ημερολόγιο.',calendarNote:'Οι συχνοί έλεγχοι (καθημερινοί, εβδομαδιαίοι) εμφανίζονται ως «έγιναν / έπρεπε» για κάθε μήνα και, για τους επόμενους μήνες, με τον αριθμό των προγραμματισμένων. Οι μηνιαίοι και ετήσιοι εμφανίζονται με την ημέρα του μήνα. Οι μελλοντικές ημερομηνίες υπολογίζονται από την επόμενη προθεσμία και μετακινούνται όταν ένας έλεγχος γίνει νωρίτερα ή αργότερα.',adherence:'Τήρηση προγράμματος',adherenceTab:'Τήρηση',programmeTab:'Πρόγραμμα',period:'Περίοδος',ptoday:'Σήμερα',p30d:'Τελευταίες 30 ημέρες',p60d:'Τελευταίες 60 ημέρες',p6m:'Τελευταίοι 6 μήνες',p90d:'Τελευταίες 90 ημέρες',p12m:'Τελευταίοι 12 μήνες',pyear:'Από την αρχή του έτους',expected:'Έπρεπε',performed:'Έγιναν',onTime:'Στην ώρα τους',missed:'Χάθηκαν',adherenceRate:'Τήρηση',adherenceNote:'«Έπρεπε»: πόσες φορές ζητούσε η συχνότητα του ελέγχου μέσα στην περίοδο. «Στην ώρα τους»: όσες έγιναν έως την προθεσμία: κάθε ώρα εκτέλεσης από 1 ώρα πριν έως 2 ώρες μετά όταν γίνεται μία φορά την ημέρα, ±1 ώρα όταν γίνεται συχνότερα (ή με το περιθώριο του ελέγχου), οι εβδομαδιαίοι έως την Κυριακή, οι μηνιαίοι έως το τέλος του μήνα. Οι έκτακτες καταχωρήσεις δεν μετρούν.',noAdherence:'Δεν υπάρχουν προγραμματισμένες εκτελέσεις στην περίοδο.',total:'Σύνολο',created:'Ο έλεγχος δημιουργήθηκε.',centralSubtitle:'Κεντρικός προγραμματισμός και παρακολούθηση ελέγχων ανά τμήμα.',departmentSubtitle:'Οι προγραμματισμένοι έλεγχοι που αφορούν το τμήμα σας.',dueSoon:'Πλησιάζουν',overdue:'Εκπρόθεσμοι',search:'Αναζήτηση: όνομα, είδος, συχνότητα, κρισιμότητα',searchExpiry:'Αναζήτηση: υλικό, παρτίδα, τμήμα, έλεγχος',department:'Τμήμα',departments:'Τμήματα',allDepartments:'Όλα τα τμήματα',status:'Κατάσταση',all:'Όλες',temporary:'Προσωρινή',scheduled:'Εντός προγράμματος',frequency:'Συχνότητα',control:'Έλεγχος',executions:'Εκτελέσεις',next:'Επόμενος',within:'Εντός προγράμματος',execute:'Καταχώρηση ελέγχου',emptyTitle:'Δεν υπάρχουν έλεγχοι',emptyText:'Δεν υπάρχουν έλεγχοι που να αντιστοιχούν στα επιλεγμένα φίλτρα.'},
 en:{calendarTab:'Calendar',calendarYear:'Year',previousYear:'Previous year',nextYear:'Next year',legendDone:'Done (day)',legendLate:'Done late',legendMissed:'Missed',legendPlanned:'Planned',legendCount:'Done / due',noCalendar:'No controls for the calendar.',calendarNote:'Frequent controls (daily, weekly) show “done / due” for each month and, for the months ahead, the number planned. Monthly and yearly controls show the day of the month. Future dates are worked out from the next due date and move when a control is done earlier or later.',adherence:'Programme adherence',adherenceTab:'Adherence',programmeTab:'Programme',period:'Period',ptoday:'Today',p30d:'Last 30 days',p60d:'Last 60 days',p6m:'Last 6 months',p90d:'Last 90 days',p12m:'Last 12 months',pyear:'Year to date',expected:'Due',performed:'Done',onTime:'On time',missed:'Missed',adherenceRate:'Adherence',adherenceNote:'“Due”: how many times the control’s frequency called for it in the period. “On time”: done by the deadline: each execution time from 1 hour before to 2 hours after when once a day, ±1 hour when more often (or the control’s own margin), weekly controls by Sunday, monthly ones by the end of the month. Extra entries do not count.',noAdherence:'No scheduled executions in this period.',total:'Total',created:'Control created.',centralSubtitle:'Central scheduling and monitoring of controls by department.',departmentSubtitle:'Scheduled controls assigned to your department.',dueSoon:'Due soon',overdue:'Overdue',search:'Search: name, type, frequency, criticality',searchExpiry:'Search: item, lot, department, control',department:'Department',departments:'Departments',allDepartments:'All departments',status:'Status',all:'All',temporary:'Draft',scheduled:'On schedule',frequency:'Frequency',control:'Control',executions:'Executions',next:'Next',within:'On schedule',execute:'Record control',emptyTitle:'No controls',emptyText:'No controls match the selected filters.'}
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
function hasDraft(item,departments){
 return departments.some(dep=>Boolean(getAssignment(item,dep)?.hasDraft))
}
export function ControlsPage(){
 const {role,membership,tenant,canAccessRecord}=useTenant()
 const {profile,user}=useAuth()
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const {t,language}=useLanguage();const tx=controlsText[language==='en'?'en':'el']
 const {confirm,notify,notifyError}=useFeedback()
 const navigate=useNavigate(),registry=useRegistryMemory('controls')
 const savedView=registry.loadViewState({query:'',department:'all',status:'all',view:'departments',period:'30d'})
 const [query,setQuery]=useState(savedView.query),[department,setDepartment]=useState(savedView.department),[status,setStatus]=useState(savedView.status)
 const [programme,setProgramme]=useState([]),[loading,setLoading]=useState(true)
 // One period for the whole page: the cards, the summary, the list's column and the «Adherence» tab.
 const [period,setPeriod]=useState(ADHERENCE_PERIODS.includes(savedView.period)?savedView.period:'30d')
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(15)
 // The planned and done executions are in the main calendar (filter «Controls»); an old calendar view or ?tab=calendar link opens it there.
 const calendarRequested=savedView.view==='calendar'||(typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('tab')==='calendar')
 const [expiryExport,setExpiryExport]=useState(null)
 // The missed executions of a control (its departments in the list), from its adherence.
 const [missedOf,setMissedOf]=useState(null)
 const [view,setView]=useState(savedView.view&&savedView.view!=='calendar'?savedView.view:'departments')
 useEffect(()=>{if(calendarRequested)navigate('/calendar?filter=controls',{replace:true})},[calendarRequested,navigate])
 // «Controls due today» on the home page opens the list of what is due today.
 useEffect(()=>{if(typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('due')==='today'){setStatus('today');setView('programme')}},[])
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
 // Placeholders, not 0, until the programme's first read ends.
 const firstLoad=loading&&!programme.length

 const scopedControls=useMemo(()=>programme.map(item=>({item,departments:item.departments.filter(dep=>canAccessRecord({department:dep,departmentId:item.departmentIdByName?.[dep]||null}))})).filter(row=>row.departments.length>0),[programme,canAccessRecord])
 const departments=[...new Set(scopedControls.flatMap(x=>x.departments))]
  const expirySources=useMemo(()=>scopedControls.filter(({item})=>isExpiryControl(item)).filter(row=>department==='all'||row.departments.includes(department)).map(({item,departments:deps})=>({record:item,departments:department==='all'?deps:deps.filter(dep=>dep===department)})),[scopedControls,department])
 // Every tab (list, KPIs, adherence, calendar, exports) counts only the
 // departments the filters keep (controlFilters).
 const kpiRows=useMemo(()=>scopeControlRows(scopedControls,{department}),[scopedControls,department])
 const rows=useMemo(()=>filterControlRows(scopedControls,{query,department,status}).map(row=>({...row,state:controlState(row.item,row.departments),due:row.departments.some(dep=>isControlDue(row.item,dep))})).sort((a,b)=>(b.due-a.due)||compareControlPriority(a,b)),[scopedControls,query,department,status])
 useEffect(()=>{setPage(1)},[query,department,status,pageSize])
 // While the entries are still kept elsewhere, every rate ends on the last day with entries.
 const [lastEntryAt,setLastEntryAt]=useState(null)
 useEffect(()=>{if(!tenant?.id)return undefined;let active=true;loadControlLastEntryAt(tenant.id).then(at=>{if(active)setLastEntryAt(at)}).catch(()=>{});return()=>{active=false}},[tenant?.id,programme])
 const until=useMemo(()=>{if(!lastEntryAt)return null;const end=reportEnd(lastEntryAt);return Date.now()-end>86400000?end:null},[lastEntryAt])
 // «Today» is always today; the other periods end where the entries end.
 const periodEnd=period==='today'?null:until
 const {counts:periodCounts,failed:periodCountsFailed}=useAdherenceCounts(tenant?.id,period,programme,periodEnd)
 const adherenceOf=useCallback(list=>periodCountsFailed?periodAdherence([],period,new Map(),periodEnd||new Date()):periodAdherence(list,period,periodCounts,periodEnd||new Date()),[period,periodCounts,periodCountsFailed,periodEnd])
 const totalPages=Math.max(1,Math.ceil(rows.length/pageSize));const safePage=Math.min(page,totalPages);const pagedRows=rows.slice((safePage-1)*pageSize,safePage*pageSize)
 const fmt=v=>formatDateTime(v,language)
 // A department with one department sees its list straight away: no cards to choose from.
 const showCards=departments.length>1
 // «Times»: the set times of the daily controls against when they are really done (central roles).
 const showTimes=canManage&&!isDepartmentManager
 const activeView=(view==='departments'&&!showCards)||(view==='times'&&!showTimes)?'programme':view
 const scopedAdherence=useMemo(()=>adherenceOf(scopedControls),[adherenceOf,scopedControls])
 const cards=useMemo(()=>departmentCards(scopedControls,scopedAdherence.lines,new Date(),language),[scopedControls,scopedAdherence,language])
 const rates=useMemo(()=>controlRates(adherenceOf(rows).lines),[rows,adherenceOf])
 // A column for «Record» when a department can record from the list (its own controls).
 const recordColumn=canExecute&&rows.some(({item,departments:deps})=>deps.length===1&&isControlDue(item,deps[0]))
 function openDepartment(dep){setDepartment(dep);setStatus('all');setView('programme')}
 const overdue=kpiRows.filter(({item,departments:deps})=>controlState(item,deps)==='overdue').length
 const dueSoon=kpiRows.filter(({item,departments:deps})=>controlState(item,deps)==='dueSoon').length
  const adherenceReport=useControlAdherenceReport(rows,tx,language,tenant?.id,programme,periodEnd,period)
 const timeFitReport=useControlTimeFitReport(showTimes&&view==='times'?rows:[],showTimes&&view==='times'?tenant?.id:null,language,programme,until)
 // A failed count shows no rate rather than a false 0%.
 const periodTotals=useMemo(()=>adherenceOf(kpiRows).totals,[kpiRows,adherenceOf])

 function exportProgramme(){
  const stateText=assignment=>{if(assignment?.status==='paused')return language==='en'?'Paused':'Σε παύση';if(!assignment?.nextDueAt)return '—';const state=dueState(assignment.nextDueAt);return state==='overdue'?tx.overdue:state==='dueSoon'?tx.dueSoon:tx.within}
  exportRegistry(controlsExport(rows,{en:language==='en',frequencyLabel:f=>frequencyLabel(f,language),stateLabel:stateText,criticality:controlCriticality,criticalityLabel:level=>criticalityLabel(level,language)}))
 }
 function clearFilters(){setQuery('');setDepartment('all');setStatus('all')}
 function pageAction(action){if(action===UI_ACTIONS.CREATE&&canCreate){registry.saveViewState({query,department,status,view,period});navigate('/controls/new')}}
 function openControl(item){registry.saveViewState({query,department,status,view,period});registry.openRecord(navigate,`/controls/${item.id}`,item.id,rows.map(x=>x.item.id))}

 return <Page fill className="registry-fill-page controls-registry-page" title={t('controls')} subtitle={canManage&&!isDepartmentManager?tx.centralSubtitle:tx.departmentSubtitle} actions={<div className="row-actions">{activeView==='times'?<ExportMenu onPrint={timeFitReport.exportPrint} onExcel={timeFitReport.exportCsv} disabled={!timeFitReport.lines.length}/>:activeView==='adherence'?<ExportMenu onPrint={()=>adherenceReport.exportPdf(false)} onPdf={()=>adherenceReport.exportPdf(true)} onExcel={adherenceReport.exportCsv} disabled={!adherenceReport.lines.length} pdfBusy={adherenceReport.exporting}/>:<ExportMenu disabled={!rows.length} onExcel={exportProgramme} items={activeView==='expiry'&&expiryExport?expiryExport:[]}/>}{canCreate&&<RecordActions actions={[UI_ACTIONS.CREATE]} onAction={pageAction}/>}</div>}>
  <CanonicalTabs items={[...(showCards?[{value:'departments',label:tx.departments,icon:LayoutGrid}]:[]),{value:'programme',label:tx.programmeTab,icon:ListChecks},{value:'adherence',label:tx.adherenceTab,icon:Gauge},{value:'expiry',label:language==='en'?'Expiry':'Λήξεις',icon:CalendarX2},...(showTimes?[{value:'times',label:language==='en'?'Times':'Ώρες',icon:Clock}]:[])]} value={activeView} onChange={setView} ariaLabel={t('controls')}/>
  <p className="controls-summary-line" aria-live="polite">{firstLoad?<span>{language==='en'?'Loading…':'Φόρτωση…'}</span>:<>
   <button type="button" className={overdue?'is-late':''} onClick={()=>{setStatus('overdue');setView('programme')}}><b>{overdue}</b> {tx.overdue.toLowerCase()}</button>
   <button type="button" onClick={()=>{setStatus('dueSoon');setView('programme')}}><b>{dueSoon}</b> {tx.dueSoon.toLowerCase()}</button>
   <span>{tx.adherence} · {periodShort(period,language).toLowerCase()}: <b>{periodTotals.rate==null?'—':`${periodTotals.rate}%`}</b></span>
   {periodEnd&&<UntilNote until={periodEnd} language={language}/>}
   {['departments','programme','adherence'].includes(activeView)&&<ChoiceChips className="controls-period-switch" label="" options={ADHERENCE_PERIODS.map(key=>({value:key,label:periodShort(key,language)}))} selected={[period]} onToggle={setPeriod}/>}
  </>}</p>
  {activeView==='programme'&&!showCards&&!firstLoad&&<ControlDepartmentCards single cards={cards} period={period} language={language}/>}
  <section className="surface registry-workspace workspace-column workspace-fill controls-registry-workspace">
   {activeView==='departments'?<ControlDepartmentCards cards={cards} total={scopedControls.length} overdue={scopedControls.filter(({item,departments:deps})=>controlState(item,deps)==='overdue').length} totals={scopedAdherence.totals} period={period} loading={firstLoad} language={language} onOpen={openDepartment}/>:<>
   <FilterBar query={query} onQueryChange={setQuery} placeholder={activeView==='expiry'?tx.searchExpiry:tx.search} activeAdvancedCount={(department!=='all')+(status!=='all')} onClear={clearFilters} activeFilters={department!=='all'&&showCards?[{key:'department',label:`${tx.department}: ${department}`,onRemove:()=>setDepartment('all')}]:[]} end={activeView==='programme'&&<ChoiceChips className="controls-status-switch" label="" options={[{value:'today',label:language==='en'?'Due today':'Για σήμερα'},{value:'overdue',label:tx.overdue},{value:'dueSoon',label:tx.dueSoon}]} selected={[status]} onToggle={value=>setStatus(status===value?'all':value)}/>}>
   </FilterBar>
   {activeView==='times'?<ControlTimeFitPanel report={timeFitReport} organizationId={tenant?.id} language={language} canChange={canManage} onChanged={reload} onOpen={openControl}/>:activeView==='expiry'?<ControlExpiryPanel actorName={actor.name} showControl onExportChange={setExpiryExport} query={query} sources={expirySources} canRemove={()=>canExecute} onRemove={item=>removeExpiryItem({item,organizationId:tenant.id,actor,language,confirm,notify,notifyError,reload})} onOpenControl={openControl} language={language} locale={language==='en'?'en-GB':'el-GR'}/>:activeView==='adherence'?<ControlAdherencePanel report={adherenceReport} tx={tx} language={language} onOpen={openControl}/>:<>
   <RegistryTable wrapperRef={registry.scrollRef} className="controls-table" columns={[{key:'control',label:tx.control},{key:'departments',label:tx.departments},{key:'frequency',label:tx.frequency},{key:'rate',label:`${tx.adherenceRate} · ${periodShort(period,language).toLowerCase()}`},{key:'next',label:tx.next},{key:'status',label:tx.status},...(recordColumn?[{key:'record',label:'',ariaLabel:language==='en'?'Record':'Καταχώρηση',className:'controls-record-cell'}]:[])]} rows={firstLoad?[]:pagedRows} loading={firstLoad} rowKey={row=>row.item.id} emptyTitle={loading?(language==='en'?'Loading controls…':'Φόρτωση ελέγχων…'):scopedControls.length?undefined:tx.emptyTitle} emptyText={loading?undefined:scopedControls.length?undefined:(language==='en'?`A control defines what is checked, where and how often; its executions build the adherence report.${canCreate?' Use «Create» at the top right to add the first one.':''}`:`Ένας έλεγχος ορίζει τι ελέγχεται, πού και πόσο συχνά· οι εκτελέσεις του δίνουν την τήρηση του προγράμματος.${canCreate?' Για να προσθέσετε τον πρώτο, πατήστε «Δημιουργία» πάνω δεξιά.':''}`)} emptyFiltered={!loading&&scopedControls.length>0} onClearFilters={clearFilters} emptyIcon={loading?undefined:ClipboardCheck} renderRow={({item,departments:deps})=>{const state=controlState(item,deps),draft=hasDraft(item,deps),depPreview=deps.slice(0,3).join(' · '),more=deps.length>3?' …':'',progress=deps.length===1?progressText(assignmentProgress(item,deps[0]),language):'',expiry=isExpiryControl(item)?expiryCounts(expiryItems(item,deps)):null;return <tr key={item.id} {...registry.rowProps(item.id)} onClick={()=>openControl(item)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openControl(item)}}}><td><strong>{language==='el'?item.title:item.titleEn}</strong><small>{[item.category,item.equipment||item.location].filter(Boolean).join(' · ')}{controlCriticality(item)==='high'&&<span className="control-criticality-badge">{criticalityLabel('high',language)} {language==='en'?'criticality':'κρισιμότητα'}</span>}{expiry?.expired>0&&<span className="control-criticality-badge signal">{expiry.expired} {language==='en'?'expired':(expiry.expired===1?'ληγμένο':'ληγμένα')}</span>}{expiry?.expiring>0&&<span className="control-criticality-badge is-strong">{expiry.expiring} {language==='en'?'expiring':(expiry.expiring===1?'λήγει':'λήγουν')}</span>}</small></td><td>{deps.length===1?deps[0]:<><strong>{deps.length} {language==='en'?'departments':'τμήματα'}</strong><small>{depPreview}{more}</small></>}</td><td>{controlFrequencyLabel(item,deps,language)}</td><td>{(()=>{const lines=adherenceReport.lines.filter(line=>line.item.id===item.id),n=lines.reduce((sum,line)=>sum+line.missed,0);const rate=rates.get(item.id)??null;return <><RateMeter rate={n>0&&rate===100?99:rate}/>{n>0&&<button type="button" className="control-missed-link" onClick={e=>{e.stopPropagation();setMissedOf({lines,title:language==='el'?item.title:item.titleEn||item.title})}}>{language==='en'?`${n} missed`:`${n} ${n===1?'χαμένος':'χαμένοι'}`}</button>}</>})()}</td><td>{fmt(earliestNext(item,deps))}</td><td><div className="control-status-stack">{draft&&<SignalBadge tone="info">{tx.temporary}</SignalBadge>}<SignalBadge tone={state==='overdue'?'danger':state==='dueSoon'?'warning':'success'}>{state==='overdue'?tx.overdue:state==='dueSoon'?tx.dueSoon:tx.within}</SignalBadge>{progress&&<small className="control-progress-text">{progress}</small>}</div></td>{recordColumn&&<td className="controls-record-cell">{canExecute&&deps.length===1&&isControlDue(item,deps[0])&&(()=>{const opens=recordOpensAt(item,deps[0]);const at=opens?`${String(zonedParts(opens).hour).padStart(2,'0')}:${String(zonedParts(opens).minute).padStart(2,'0')}`:'';return opens?<button type="button" className="controls-record-now is-waiting" disabled title={language==='en'?`The entry opens at ${at}, 1 hour before its time.`:`Η καταχώρηση ανοίγει στις ${at}, 1 ώρα πριν την ώρα του ελέγχου.`} onClick={e=>e.stopPropagation()}><PlayCircle size={14} aria-hidden="true"/>{language==='en'?`From ${at}`:`Από ${at}`}</button>:null})()}{canExecute&&deps.length===1&&isControlDue(item,deps[0])&&!recordOpensAt(item,deps[0])&&<button type="button" className="controls-record-now" onClick={e=>{e.stopPropagation();registry.saveViewState({query,department,status,view,period});navigate(`/controls/${item.id}?department=${encodeURIComponent(deps[0])}&execute=1`,{state:{returnTo:'/controls'}})}}><PlayCircle size={14} aria-hidden="true"/>{language==='en'?'Record':'Καταχώρηση'}</button>}</td>}</tr>}}/>
   {rows.length>0&&<RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1)}}/>}
   </>}
   </>}
  </section>
  {missedOf&&<ControlMissedDialog lines={missedOf.lines} title={missedOf.title} language={language} onClose={()=>setMissedOf(null)}/>}
 </Page>
}

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
 const [existingControls,setExistingControls]=useState([])
 const ownDepartment=membership?.previewDepartment||membership?.departmentName||membership?.department||''
 const isDepartmentManager=role===ROLES.DEPARTMENT_MANAGER
 const createdByScope=isDepartmentManager?'department':role===ROLES.PLATFORM_OWNER?'platform':role===ROLES.HOSPITAL_ADMIN?'hospital_admin':role===ROLES.QUALITY_MANAGER?'quality':'infection_control'
 useEffect(()=>{if(!tenant?.id)return;let active=true;loadControlCategories(tenant.id).then(rows=>{if(active)setCategories(rows)}).catch(()=>{});loadControlNames(tenant.id).then(rows=>{if(active)setExistingControls(rows)}).catch(()=>{});return()=>{active=false}},[tenant?.id])
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
 return <ControlEditor departmentOnly={isDepartmentManager} fixedDepartment={isDepartmentManager?ownDepartment:''} usedCategories={categories} existingControls={existingControls} onCancel={()=>navigate('/controls')} onSave={saveNew}/>
}
