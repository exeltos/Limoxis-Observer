import { useCallback,useEffect,useMemo,useState } from 'react'
import { CalendarX2,ClipboardCheck,Gauge,LayoutGrid,ListChecks,PlayCircle } from 'lucide-react'
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
import { ControlAdherencePanel,RateMeter,useAdherenceCounts,useControlAdherenceReport } from './ControlAdherencePanel'
import { ControlDepartmentCards } from './ControlDepartmentCards'
import { controlRates,departmentCards } from './controlDepartmentCards'
import { periodRange,programmeAdherence } from './controlAdherence'
import { assignmentProgress,assignmentStatus,controlFrequencyLabel,frequencyLabel,getAssignment,isControlDue } from './controlScheduling'
import { dueState } from './controlDueRules'
import { filterControlRows,scopeControlRows } from './controlFilters'
import { progressText } from './controlProgress'
import { expiryCounts,expiryItems,isExpiryControl } from './controlExpiry'
import { ControlExpiryPanel } from './ControlExpiryPanel'
import { removeExpiryItem } from './controlExpiryRemoval'
import { loadControlCategories,loadControlNames,loadControlProgramme,saveControlDefinition } from './controlCloudService'
import { compareControlPriority,controlCriticality,criticalityLabel } from './controlCriticality'
import './controlEvidence.css'
import { ExportMenu } from '../../design-system/ExportMenu'
import { controlsExport,exportRegistry } from '../../core/export/registryExports'

const controlsText={
 el:{calendarTab:'Ημερολόγιο',calendarYear:'Έτος',previousYear:'Προηγούμενο έτος',nextYear:'Επόμενο έτος',legendDone:'Έγινε (ημέρα)',legendLate:'Έγινε με καθυστέρηση',legendMissed:'Χάθηκε',legendPlanned:'Προγραμματισμένος',legendCount:'Έγιναν / έπρεπε',noCalendar:'Δεν υπάρχουν έλεγχοι για το ημερολόγιο.',calendarNote:'Οι συχνοί έλεγχοι (καθημερινοί, εβδομαδιαίοι) εμφανίζονται ως «έγιναν / έπρεπε» για κάθε μήνα και, για τους επόμενους μήνες, με τον αριθμό των προγραμματισμένων. Οι μηνιαίοι και ετήσιοι εμφανίζονται με την ημέρα του μήνα. Οι μελλοντικές ημερομηνίες υπολογίζονται από την επόμενη προθεσμία και μετακινούνται όταν ένας έλεγχος γίνει νωρίτερα ή αργότερα.',adherence:'Τήρηση προγράμματος',adherenceTab:'Τήρηση',programmeTab:'Πρόγραμμα',period:'Περίοδος',p30d:'Τελευταίες 30 ημέρες',p90d:'Τελευταίες 90 ημέρες',p12m:'Τελευταίοι 12 μήνες',pyear:'Από την αρχή του έτους',expected:'Έπρεπε',performed:'Έγιναν',onTime:'Στην ώρα τους',missed:'Χάθηκαν',adherenceRate:'Τήρηση',adherenceNote:'«Έπρεπε»: πόσες φορές ζητούσε η συχνότητα του ελέγχου μέσα στην περίοδο. «Στην ώρα τους»: όσες έγιναν έως την προθεσμία: κάθε ώρα εκτέλεσης έως την επόμενη (η τελευταία έως τις 23:59, ή έως την ώρα + ανοχή), οι εβδομαδιαίοι έως την Κυριακή, οι μηνιαίοι έως το τέλος του μήνα. Οι έκτακτες καταχωρήσεις δεν μετρούν.',noAdherence:'Δεν υπάρχουν προγραμματισμένες εκτελέσεις στην περίοδο.',total:'Σύνολο',created:'Ο έλεγχος δημιουργήθηκε.',centralSubtitle:'Κεντρικός προγραμματισμός και παρακολούθηση ελέγχων ανά τμήμα.',departmentSubtitle:'Οι προγραμματισμένοι έλεγχοι που αφορούν το τμήμα σας.',dueSoon:'Πλησιάζουν',overdue:'Εκπρόθεσμοι',search:'Αναζήτηση: όνομα, είδος, συχνότητα, κρισιμότητα',searchExpiry:'Αναζήτηση: υλικό, παρτίδα, τμήμα, έλεγχος',department:'Τμήμα',departments:'Τμήματα',allDepartments:'Όλα τα τμήματα',status:'Κατάσταση',all:'Όλες',temporary:'Προσωρινή',scheduled:'Εντός προγράμματος',frequency:'Συχνότητα',control:'Έλεγχος',executions:'Εκτελέσεις',next:'Επόμενος',within:'Εντός προγράμματος',execute:'Καταχώρηση ελέγχου',emptyTitle:'Δεν υπάρχουν έλεγχοι',emptyText:'Δεν υπάρχουν έλεγχοι που να αντιστοιχούν στα επιλεγμένα φίλτρα.'},
 en:{calendarTab:'Calendar',calendarYear:'Year',previousYear:'Previous year',nextYear:'Next year',legendDone:'Done (day)',legendLate:'Done late',legendMissed:'Missed',legendPlanned:'Planned',legendCount:'Done / due',noCalendar:'No controls for the calendar.',calendarNote:'Frequent controls (daily, weekly) show “done / due” for each month and, for the months ahead, the number planned. Monthly and yearly controls show the day of the month. Future dates are worked out from the next due date and move when a control is done earlier or later.',adherence:'Programme adherence',adherenceTab:'Adherence',programmeTab:'Programme',period:'Period',p30d:'Last 30 days',p90d:'Last 90 days',p12m:'Last 12 months',pyear:'Year to date',expected:'Due',performed:'Done',onTime:'On time',missed:'Missed',adherenceRate:'Adherence',adherenceNote:'“Due”: how many times the control’s frequency called for it in the period. “On time”: done by the deadline: each execution time by the next one (the last by 23:59, or by the time + tolerance), weekly controls by Sunday, monthly ones by the end of the month. Extra entries do not count.',noAdherence:'No scheduled executions in this period.',total:'Total',created:'Control created.',centralSubtitle:'Central scheduling and monitoring of controls by department.',departmentSubtitle:'Scheduled controls assigned to your department.',dueSoon:'Due soon',overdue:'Overdue',search:'Search: name, type, frequency, criticality',searchExpiry:'Search: item, lot, department, control',department:'Department',departments:'Departments',allDepartments:'All departments',status:'Status',all:'All',temporary:'Draft',scheduled:'On schedule',frequency:'Frequency',control:'Control',executions:'Executions',next:'Next',within:'On schedule',execute:'Record control',emptyTitle:'No controls',emptyText:'No controls match the selected filters.'}
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
 const savedView=registry.loadViewState({query:'',department:'all',status:'all',view:'departments'})
 const [query,setQuery]=useState(savedView.query),[department,setDepartment]=useState(savedView.department),[status,setStatus]=useState(savedView.status)
 const [programme,setProgramme]=useState([]),[loading,setLoading]=useState(true)
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(15)
 // The planned and done executions are in the main calendar (filter «Controls»); an old calendar view or ?tab=calendar link opens it there.
 const calendarRequested=savedView.view==='calendar'||(typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('tab')==='calendar')
 const [expiryExport,setExpiryExport]=useState(null)
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
 const {counts:monthCounts,failed:monthCountsFailed}=useAdherenceCounts(tenant?.id,'30d',programme)
 const totalPages=Math.max(1,Math.ceil(rows.length/pageSize));const safePage=Math.min(page,totalPages);const pagedRows=rows.slice((safePage-1)*pageSize,safePage*pageSize)
 const fmt=v=>formatDateTime(v,language)
 // A department with one department sees its list straight away: no cards to choose from.
 const showCards=departments.length>1
 const activeView=view==='departments'&&!showCards?'programme':view
 const cards=useMemo(()=>departmentCards(scopedControls,monthCountsFailed?[]:programmeAdherence(scopedControls,periodRange('30d'),monthCounts).lines,new Date(),language),[scopedControls,monthCounts,monthCountsFailed,language])
 const rates=useMemo(()=>controlRates(monthCountsFailed?[]:programmeAdherence(rows,periodRange('30d'),monthCounts).lines),[rows,monthCounts,monthCountsFailed])
 function openDepartment(dep){setDepartment(dep);setStatus('all');setView('programme')}
 const overdue=kpiRows.filter(({item,departments:deps})=>controlState(item,deps)==='overdue').length
 const dueSoon=kpiRows.filter(({item,departments:deps})=>controlState(item,deps)==='dueSoon').length
  const adherenceReport=useControlAdherenceReport(rows,tx,language,tenant?.id,programme)
 // A failed count shows no rate rather than a false 0%.
 const monthAdherence=useMemo(()=>monthCountsFailed?programmeAdherence([],periodRange('30d'),new Map()).totals:programmeAdherence(kpiRows,periodRange('30d'),monthCounts).totals,[kpiRows,monthCounts,monthCountsFailed])

 function exportProgramme(){
  const stateText=assignment=>{if(assignment?.status==='paused')return language==='en'?'Paused':'Σε παύση';if(!assignment?.nextDueAt)return '—';const state=dueState(assignment.nextDueAt);return state==='overdue'?tx.overdue:state==='dueSoon'?tx.dueSoon:tx.within}
  exportRegistry(controlsExport(rows,{en:language==='en',frequencyLabel:f=>frequencyLabel(f,language),stateLabel:stateText,criticality:controlCriticality,criticalityLabel:level=>criticalityLabel(level,language)}))
 }
 function clearFilters(){setQuery('');setDepartment('all');setStatus('all')}
 function pageAction(action){if(action===UI_ACTIONS.CREATE&&canCreate){registry.saveViewState({query,department,status,view});navigate('/controls/new')}}
 function openControl(item){registry.saveViewState({query,department,status,view});registry.openRecord(navigate,`/controls/${item.id}`,item.id,rows.map(x=>x.item.id))}

 return <Page fill className="registry-fill-page controls-registry-page" title={t('controls')} subtitle={canManage&&!isDepartmentManager?tx.centralSubtitle:tx.departmentSubtitle} actions={<div className="row-actions">{activeView==='adherence'?<ExportMenu onPrint={()=>adherenceReport.exportPdf(false)} onPdf={()=>adherenceReport.exportPdf(true)} onExcel={adherenceReport.exportCsv} disabled={!adherenceReport.lines.length} pdfBusy={adherenceReport.exporting}/>:<ExportMenu disabled={!rows.length} onExcel={exportProgramme} items={activeView==='expiry'&&expiryExport?[expiryExport]:[]}/>}{canCreate&&<RecordActions actions={[UI_ACTIONS.CREATE]} onAction={pageAction}/>}</div>}>
  <CanonicalTabs items={[...(showCards?[{value:'departments',label:tx.departments,icon:LayoutGrid}]:[]),{value:'programme',label:tx.programmeTab,icon:ListChecks},{value:'adherence',label:tx.adherenceTab,icon:Gauge},{value:'expiry',label:language==='en'?'Expiry':'Λήξεις',icon:CalendarX2}]} value={activeView} onChange={setView} ariaLabel={t('controls')}/>
  <p className="controls-summary-line" aria-live="polite">{firstLoad?<span>{language==='en'?'Loading…':'Φόρτωση…'}</span>:<>
   <button type="button" className={overdue?'is-late':''} onClick={()=>{setStatus('overdue');setView('programme')}}><b>{overdue}</b> {tx.overdue.toLowerCase()}</button>
   <button type="button" onClick={()=>{setStatus('dueSoon');setView('programme')}}><b>{dueSoon}</b> {tx.dueSoon.toLowerCase()}</button>
   <span>{tx.adherence} · 30 {language==='en'?'days':'ημ.'}: <b>{monthAdherence.rate==null?'—':`${monthAdherence.rate}%`}</b></span>
  </>}</p>
  <section className="surface registry-workspace workspace-column workspace-fill controls-registry-workspace">
   {activeView==='departments'?<ControlDepartmentCards cards={cards} total={scopedControls.length} overdue={scopedControls.filter(({item,departments:deps})=>controlState(item,deps)==='overdue').length} loading={firstLoad} language={language} onOpen={openDepartment}/>:<>
   <FilterBar query={query} onQueryChange={setQuery} placeholder={activeView==='expiry'?tx.searchExpiry:tx.search} activeAdvancedCount={(department!=='all')+(status!=='all')} onClear={clearFilters} activeFilters={department!=='all'&&showCards?[{key:'department',label:`${tx.department}: ${department}`,onRemove:()=>setDepartment('all')}]:[]} end={activeView==='programme'&&<ChoiceChips className="controls-status-switch" label="" options={[{value:'today',label:language==='en'?'Due today':'Για σήμερα'},{value:'overdue',label:tx.overdue},{value:'dueSoon',label:tx.dueSoon}]} selected={[status]} onToggle={value=>setStatus(status===value?'all':value)}/>}>
   </FilterBar>
   {activeView==='expiry'?<ControlExpiryPanel actorName={actor.name} showControl onExportChange={setExpiryExport} query={query} sources={expirySources} canRemove={()=>canExecute} onRemove={item=>removeExpiryItem({item,organizationId:tenant.id,actor,language,confirm,notify,notifyError,reload})} onOpenControl={openControl} language={language} locale={language==='en'?'en-GB':'el-GR'}/>:activeView==='adherence'?<ControlAdherencePanel report={adherenceReport} tx={tx} language={language} onOpen={openControl}/>:<>
   <RegistryTable wrapperRef={registry.scrollRef} className="controls-table" columns={[{key:'control',label:tx.control},{key:'departments',label:tx.departments},{key:'frequency',label:tx.frequency},{key:'rate',label:`${tx.adherenceRate} · 30 ${language==='en'?'days':'ημ.'}`},{key:'next',label:tx.next},{key:'status',label:tx.status}]} rows={firstLoad?[]:pagedRows} loading={firstLoad} rowKey={row=>row.item.id} emptyTitle={loading?(language==='en'?'Loading controls…':'Φόρτωση ελέγχων…'):scopedControls.length?undefined:tx.emptyTitle} emptyText={loading?undefined:scopedControls.length?undefined:(language==='en'?`A control defines what is checked, where and how often; its executions build the adherence report.${canCreate?' Use «Create» at the top right to add the first one.':''}`:`Ένας έλεγχος ορίζει τι ελέγχεται, πού και πόσο συχνά· οι εκτελέσεις του δίνουν την τήρηση του προγράμματος.${canCreate?' Για να προσθέσετε τον πρώτο, πατήστε «Δημιουργία» πάνω δεξιά.':''}`)} emptyFiltered={!loading&&scopedControls.length>0} onClearFilters={clearFilters} emptyIcon={loading?undefined:ClipboardCheck} renderRow={({item,departments:deps})=>{const state=controlState(item,deps),draft=hasDraft(item,deps),depPreview=deps.slice(0,3).join(' · '),more=deps.length>3?' …':'',progress=deps.length===1?progressText(assignmentProgress(item,deps[0]),language):'',expiry=isExpiryControl(item)?expiryCounts(expiryItems(item,deps)):null;return <tr key={item.id} {...registry.rowProps(item.id)} onClick={()=>openControl(item)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openControl(item)}}}><td><strong>{language==='el'?item.title:item.titleEn}</strong><small>{[item.category,item.equipment||item.location].filter(Boolean).join(' · ')}{controlCriticality(item)==='high'&&<span className="control-criticality-badge">{criticalityLabel('high',language)} {language==='en'?'criticality':'κρισιμότητα'}</span>}{expiry?.expired>0&&<span className="control-criticality-badge signal">{expiry.expired} {language==='en'?'expired':(expiry.expired===1?'ληγμένο':'ληγμένα')}</span>}{expiry?.expiring>0&&<span className="control-criticality-badge is-strong">{expiry.expiring} {language==='en'?'expiring':(expiry.expiring===1?'λήγει':'λήγουν')}</span>}</small></td><td>{deps.length===1?deps[0]:<><strong>{deps.length} {language==='en'?'departments':'τμήματα'}</strong><small>{depPreview}{more}</small></>}</td><td>{controlFrequencyLabel(item,deps,language)}</td><td><RateMeter rate={rates.get(item.id)??null}/></td><td>{fmt(earliestNext(item,deps))}</td><td><div className="control-status-stack">{draft&&<SignalBadge tone="info">{tx.temporary}</SignalBadge>}<SignalBadge tone={state==='overdue'?'danger':state==='dueSoon'?'warning':'success'}>{state==='overdue'?tx.overdue:state==='dueSoon'?tx.dueSoon:tx.within}</SignalBadge>{progress&&<small className="control-progress-text">{progress}</small>}{canExecute&&deps.length===1&&isControlDue(item,deps[0])&&<button type="button" className="controls-record-now" onClick={e=>{e.stopPropagation();registry.saveViewState({query,department,status,view});navigate(`/controls/${item.id}?department=${encodeURIComponent(deps[0])}&execute=1`,{state:{returnTo:'/controls'}})}}><PlayCircle size={14} aria-hidden="true"/>{language==='en'?'Record':'Καταχώρηση'}</button>}</div></td></tr>}}/>
   {rows.length>0&&<RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1)}}/>}
   </>}
   </>}
  </section>
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
