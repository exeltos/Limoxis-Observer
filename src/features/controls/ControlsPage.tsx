import { useCallback,useEffect,useMemo,useState } from 'react'
import { CalendarX2,ClipboardCheck,Clock,Gauge,LayoutGrid,ListChecks,PlayCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { useTenant } from '../../core/tenant/TenantContext'
import { useAuth } from '../../core/auth/AuthContext'
import { CAPABILITIES,ROLES,can } from '../../core/permissions/roles'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { ControlEditor } from './ControlEditor'
import { SignalBadge,StatusBadge } from '../../design-system/StatusBadge'
import { formatDateTime } from '../../core/i18n/formatDay'
import { controlActorFromAuth } from './controlActor'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { RegistryTable } from '../../design-system/RegistryTable'
import { controlTypeCode } from './controlVocabulary'
import { useTableSort } from '../../design-system/useTableSort'
import { ControlAdherencePanel,RateMeter,useAdherenceCounts,useControlAdherenceReport } from './ControlAdherencePanel'
import { ControlsKpis,timeFitSummary } from './ControlsKpis'
import { ControlDepartmentCards } from './ControlDepartmentCards'
import { ControlMissedDialog } from './ControlMissedDialog'
import { controlRates,departmentCards,weekendClosedDepartments } from './controlDepartmentCards'
import { DEFAULT_PERIOD,isToday,normalizePeriod,periodAdherence,periodShort,reportEnd } from './controlAdherence'
import { ControlPeriodPicker } from './ControlPeriodPicker'
import { assignmentProgress,assignmentStatus,controlFrequencyLabel,frequencyLabel,getAssignment,canRecordAnytime,isControlDue,recordWindow } from './controlScheduling'
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
import { ExportMenu, type ExportItem } from '../../design-system/ExportMenu'
import { printReport, type ReportFact } from '../../core/export/reportDocument'
import { controlsExport,exportRegistry } from '../../core/export/registryExports'
import { controlsText } from './controlsText'
import { useViewPreference } from '../../core/preferences/viewPreferences'
import { Eye } from 'lucide-react'
import type { RefObject } from 'react'
import type { ControlAssignment, ControlDraft, ControlFrequency, ControlRecord, ControlRow } from './controlTypes'
import type { AdherenceLine } from './controlAdherence'

// The department a membership names in older records.
type MembershipDepartment = { department?: string } | null

// The list's scroll box is a div (RegistryTable's wrapperRef); the shared hook keeps it as any element.
type ControlsRegistry = Omit<ReturnType<typeof useRegistryMemory>,'scrollRef'> & { scrollRef: RefObject<HTMLDivElement> }

const NO_HIDDEN: string[]=[]


function controlState(item:ControlRecord,departments:string[],now=new Date()){
 const states=departments.map(dep=>assignmentStatus(item,dep,now))
 if(states.includes('overdue'))return 'overdue'
 if(states.includes('dueSoon'))return 'dueSoon'
 return 'scheduled'
}
function earliestNext(item:ControlRecord,departments:string[]){
 return departments.map(dep=>getAssignment(item,dep)?.nextDueAt).filter(Boolean).sort((a,b)=>new Date(a).getTime()-new Date(b).getTime())[0]||null
}
function hasDraft(item:ControlRecord,departments:string[]){
 return departments.some(dep=>Boolean(getAssignment(item,dep)?.hasDraft))
}
export function ControlsPage(){
 const {role,membership,tenant,canAccessRecord}=useTenant()
 const {profile,user}=useAuth()
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const {t,language}=useLanguage();const tx=controlsText[language==='en'?'en':'el']
 const {confirm,notify,notifyError}=useFeedback()
 const navigate=useNavigate(),registry=useRegistryMemory('controls') as ControlsRegistry
 const savedView=registry.loadViewState({query:'',department:'all',status:'all',view:'departments',period:DEFAULT_PERIOD})
 const [query,setQuery]=useState(savedView.query),[department,setDepartment]=useState(savedView.department),[status,setStatus]=useState(savedView.status)
 const [programme,setProgramme]=useState<ControlRecord[]>([]),[loading,setLoading]=useState(true)
 // One period for the whole page: the cards, the summary, the list's column and the «Adherence» tab.
 const [period,setPeriod]=useState(normalizePeriod(savedView.period))
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(15)
 // The planned and done executions are in the main calendar (filter «Controls»); an old calendar view or ?tab=calendar link opens it there.
 const calendarRequested=savedView.view==='calendar'||(typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('tab')==='calendar')
 const [expiryExport,setExpiryExport]=useState<ExportItem[]|null>(null)
 // The missed executions of a control (its departments in the list), from its adherence.
 const [missedOf,setMissedOf]=useState<{lines:AdherenceLine[],title:string}|null>(null)
 const [view,setView]=useState(savedView.view&&savedView.view!=='calendar'?savedView.view:'departments')
 useEffect(()=>{if(calendarRequested)navigate('/calendar?filter=controls',{replace:true})},[calendarRequested,navigate])
 // «Controls due today» on the home page opens the list of what is due today.
 useEffect(()=>{if(typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('due')==='today'){setStatus('today');setView('programme')}},[])
 const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[]
 const canManage=can(role,CAPABILITIES.MANAGE_CONTROLS,addOns,custom)
 const canExecute=can(role,CAPABILITIES.EXECUTE_CONTROL,addOns,custom)
 const ownDepartment=membership?.previewDepartment||membership?.departmentName||(membership as MembershipDepartment)?.department||''
 const isDepartmentManager=role===ROLES.DEPARTMENT_MANAGER
 const canCreate=canManage||(isDepartmentManager&&Boolean(ownDepartment))

 const [loadError,setLoadError]=useState(false)
 const reload=useCallback(async()=>{
  if(!tenant?.id){setProgramme([]);setLoading(false);return}
  setLoading(true)
  try{setProgramme(await loadControlProgramme(tenant.id));setLoadError(false)}
  catch(error){setProgramme([]);setLoadError(true);notifyError(error,'load',{operation:'controls_programme_load'})}
  finally{setLoading(false)}
 },[tenant?.id,notifyError])
 useEffect(()=>{void reload()},[reload])
 // Placeholders, not 0, until the programme's first read ends.
 const firstLoad=loading&&!programme.length

 // The culture sampling programme (one control per department sampled) is not part of the Controls: its annual plan lives in the environmental surveillance.
 const accessibleControls=useMemo(()=>programme.filter(item=>controlTypeCode(item.category)!=='CTRL-ENV').map(item=>({item,departments:item.departments.filter(dep=>canAccessRecord({department:dep,departmentId:item.departmentIdByName?.[dep]||null}))})).filter(row=>row.departments.length>0),[programme,canAccessRecord])
 // «Departments I see» (owner, 7/11/2026): the departments a user hides leave every tab, the totals and the exports; the
 // choice is the user's own, on their account.
 const [hiddenList,setHiddenList]=useViewPreference(tenant?.id,user?.id,'controls.hiddenDepartments',NO_HIDDEN)
 const hidden=useMemo(()=>new Set(Array.isArray(hiddenList)?hiddenList:[]),[hiddenList])
 const [picking,setPicking]=useState(false)
 // «Expiry»: «N expired» / «N expiring» in the totals narrow the list to them (a second click shows all again).
 const [expiryState,setExpiryState]=useState<string|null>(null)
 // «Today» on a weekend: the departments that only work Monday–Friday leave every tab too.
 const closedToday=useMemo(()=>(isToday(period)?weekendClosedDepartments(accessibleControls,new Date()):new Set<string>()),[period,accessibleControls])
 const scopedControls=useMemo(()=>hidden.size||closedToday.size?accessibleControls.map(row=>({...row,departments:row.departments.filter(dep=>!hidden.has(dep)&&!closedToday.has(dep))})).filter(row=>row.departments.length>0):accessibleControls,[accessibleControls,hidden,closedToday])
 const hiddenCount=useMemo(()=>new Set(accessibleControls.flatMap(row=>row.departments).filter(dep=>hidden.has(dep))).size,[accessibleControls,hidden])
 const toggleHidden=(dep:string)=>{const next=new Set(hidden);if(next.has(dep))next.delete(dep);else next.add(dep);setHiddenList([...next].sort())}
 const departments=[...new Set(scopedControls.flatMap(x=>x.departments))]
  const expirySources=useMemo(()=>scopedControls.filter(({item})=>isExpiryControl(item)).filter(row=>department==='all'||row.departments.includes(department)).map(({item,departments:deps})=>({record:item,departments:department==='all'?deps:deps.filter(dep=>dep===department)})),[scopedControls,department])
 // «Expiry»: what has expired or expires soon, and the departments with something expired.
 const expirySummary=useMemo(()=>{const items=expirySources.flatMap(({record,departments:deps})=>expiryItems(record,deps)),deps=[...new Set(items.map(item=>item.department))];return {...expiryCounts(items),departments:deps.length,withExpired:deps.filter(dep=>items.some(item=>item.department===dep&&item.state==='expired')).length}},[expirySources])
 // Every tab (list, KPIs, adherence, calendar, exports) counts only the
 // departments the filters keep (controlFilters).
 const kpiRows=useMemo(()=>scopeControlRows(scopedControls,{department}),[scopedControls,department])
 // While the entries are still kept elsewhere, every rate ends on the last day with entries.
 const [lastEntryAt,setLastEntryAt]=useState<string|null>(null)
 useEffect(()=>{if(!tenant?.id)return undefined;let active=true;loadControlLastEntryAt(tenant.id).then(at=>{if(active)setLastEntryAt(at)}).catch(()=>{});return()=>{active=false}},[tenant?.id,programme])
 const until=useMemo(()=>{if(!lastEntryAt)return null;const end=reportEnd(lastEntryAt);return Date.now()-end.getTime()>60000?end:null},[lastEntryAt])
 // The state of the controls (overdue, due soon, due today) is read at the same moment: the last day with entries while those are kept elsewhere, else now.
 const asOf=useCallback(()=>until||new Date(),[until])
 const rows=useMemo(()=>filterControlRows(scopedControls,{query,department,status,now:asOf()}).map(row=>({...row,state:controlState(row.item,row.departments,asOf()),due:row.departments.some(dep=>isControlDue(row.item,dep,asOf()))})).sort((a,b)=>(Number(b.due)-Number(a.due))||compareControlPriority(a,b)),[scopedControls,query,department,status,asOf])
 useEffect(()=>{setPage(1)},[query,department,status,pageSize])
 // «Today» is always today; the other periods end where the entries end.
 const periodEnd=isToday(period)?null:until
 const {counts:periodCounts,failed:periodCountsFailed}=useAdherenceCounts(tenant?.id,period,programme,periodEnd)
 const adherenceOf=useCallback((list:ControlRow[])=>periodCountsFailed?periodAdherence([],period,new Map(),periodEnd||new Date()):periodAdherence(list,period,periodCounts,periodEnd||new Date()),[period,periodCounts,periodCountsFailed,periodEnd])
 const fmt=(v:string|null|undefined)=>formatDateTime(v,language)
 // A department with one department sees its list straight away: no cards to choose from.
 const showCards=new Set(accessibleControls.flatMap(x=>x.departments)).size>1
 // «Times»: the set times of the daily controls against when they are really done (central roles).
 const showTimes=canManage&&!isDepartmentManager
 const activeView=(view==='departments'&&!showCards)||(view==='times'&&!showTimes)?'programme':view
 const scopedAdherence=useMemo(()=>adherenceOf(scopedControls),[adherenceOf,scopedControls])
 const pickAdherence=useMemo(()=>(picking?adherenceOf(accessibleControls):null),[picking,adherenceOf,accessibleControls])
 const cards=useMemo(()=>picking?departmentCards(accessibleControls,pickAdherence!.lines,asOf(),language):departmentCards(scopedControls,scopedAdherence.lines,asOf(),language),[picking,accessibleControls,pickAdherence,scopedControls,scopedAdherence,language,asOf])
 const rates=useMemo(()=>controlRates(adherenceOf(rows).lines),[rows,adherenceOf])
 // The arrows in the headers sort the whole list (the default order stays: due first, then by criticality); then the page is cut.
 const stateRank:Record<string,number>={overdue:0,dueSoon:1}
 const {sorted:sortedRows,sort,onSort}=useTableSort(rows,{
  control:row=>language==='el'?row.item.title:row.item.titleEn||row.item.title,
  departments:row=>row.departments.length===1?row.departments[0]:row.departments.length,
  frequency:row=>controlFrequencyLabel(row.item,row.departments,language),
  rate:row=>rates.get(row.item.id)??null,
  next:row=>{const at=earliestNext(row.item,row.departments);return at?new Date(at).toISOString():null},
  status:row=>stateRank[row.state]??2,
 })
 useEffect(()=>{setPage(1)},[sort])
 const totalPages=Math.max(1,Math.ceil(rows.length/pageSize));const safePage=Math.min(page,totalPages);const pagedRows=sortedRows.slice((safePage-1)*pageSize,safePage*pageSize)
 // A column for «Record» when a department can record from the list (its own controls).
 const recordColumn=canExecute&&rows.some(({item,departments:deps})=>deps.length===1&&isControlDue(item,deps[0]))
 function openDepartment(dep:string|null){setDepartment(dep);setStatus('all');setView('programme')}
 const overdue=kpiRows.filter(({item,departments:deps})=>controlState(item,deps,asOf())==='overdue').length
 const dueSoon=kpiRows.filter(({item,departments:deps})=>controlState(item,deps,asOf())==='dueSoon').length
  const adherenceReport=useControlAdherenceReport(rows,tx,language,tenant?.id,programme,periodEnd,period)
 const timeFitReport=useControlTimeFitReport(showTimes&&view==='times'?rows:[],showTimes&&view==='times'?tenant?.id:null,language,programme,until)
 // A failed count shows no rate rather than a false 0%.
 const periodTotals=useMemo(()=>adherenceOf(kpiRows).totals,[kpiRows,adherenceOf])

 // One period for the cards, the list's column and «Adherence»: beside the search.
 const periodSelect=<ControlPeriodPicker value={period} onChange={setPeriod} language={language} label={tx.period}/>
 function programmeExport(){
  const stateText=(assignment:Pick<ControlAssignment,'status'|'nextDueAt'>|null|undefined)=>{if(assignment?.status==='paused')return language==='en'?'Paused':'Σε παύση';if(!assignment?.nextDueAt)return '—';const state=dueState(assignment.nextDueAt);return state==='overdue'?tx.overdue:state==='dueSoon'?tx.dueSoon:tx.within}
  return controlsExport(rows,{en:language==='en',frequencyLabel:f=>frequencyLabel(f as unknown as ControlFrequency,language),stateLabel:stateText,criticality:controlCriticality,criticalityLabel:level=>criticalityLabel(level,language)})
 }
 function exportProgramme(){exportRegistry(programmeExport())}
 // The same list on the shared document layout (landscape), to print or keep as PDF.
 function printProgramme(pdf=false){
  const data=programmeExport(),en=language==='en'
  const ok=printReport({language,orientation:'landscape',kind:t('controls'),title:en?'Control programme':'Πρόγραμμα ελέγχων',meta:[[tx.department,department==='all'?tx.allDepartments:department],...(status!=='all'?[[tx.status,({today:en?'Due today':'Για σήμερα',overdue:tx.overdue,dueSoon:tx.dueSoon} as Record<string,string>)[status]||status]]:[]),...(query.trim()?[[en?'Search':'Αναζήτηση',query.trim()]]:[]),[en?'Controls':'Έλεγχοι',String(rows.length)]] as ReportFact[],sections:[{title:en?'Controls per department':'Έλεγχοι ανά τμήμα',table:{columns:data.headers.slice(1),rows:data.rows.map(row=>row.slice(1).map(cell=>cell==null?'':String(cell))),empty:tx.emptyText}}],filename:data.name},{pdf:pdf===true})
  if(!ok)notify(en?'Allow pop-ups to print.':'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','error')
 }
 function clearFilters(){setQuery('');setDepartment('all');setStatus('all');setPeriod(DEFAULT_PERIOD)}
 function pageAction(action:string){if(action===UI_ACTIONS.CREATE&&canCreate){registry.saveViewState({query,department,status,view,period});navigate('/controls/new')}}
 function openControl(item:Pick<ControlRecord,'id'>,tab=''){registry.saveViewState({query,department,status,view,period});registry.openRecord(navigate,`/controls/${item.id}${tab?`?tab=${tab}`:''}`,item.id,rows.map(x=>x.item.id))}

 return <Page fill className="registry-fill-page controls-registry-page" title={t('controls')} subtitle={canManage&&!isDepartmentManager?tx.centralSubtitle:tx.departmentSubtitle} actions={<div className="row-actions">{activeView==='times'?<ExportMenu onPrint={()=>timeFitReport.exportPrint(false)} onPdf={()=>timeFitReport.exportPrint(true)} onExcel={timeFitReport.exportCsv} disabled={!timeFitReport.lines.length}/>:activeView==='adherence'?<ExportMenu onPrint={()=>adherenceReport.exportPdf(false)} onPdf={()=>adherenceReport.exportPdf(true)} onExcel={adherenceReport.exportCsv} disabled={!adherenceReport.lines.length} pdfBusy={adherenceReport.exporting}/>:<ExportMenu menuWidth={activeView==='expiry'?440:220} disabled={activeView==='expiry'?!expiryExport:!rows.length} onPrint={activeView==='expiry'?undefined:()=>printProgramme(false)} onPdf={activeView==='expiry'?undefined:()=>printProgramme(true)} onExcel={activeView==='expiry'?undefined:exportProgramme} items={activeView==='expiry'&&expiryExport?expiryExport:[]}/>}{canCreate&&<RecordActions actions={[UI_ACTIONS.CREATE]} onAction={pageAction}/>}</div>}>
  <CanonicalTabs items={[...(showCards?[{value:'departments',label:tx.departments,icon:LayoutGrid}]:[]),{value:'programme',label:tx.programmeTab,icon:ListChecks},{value:'adherence',label:tx.adherenceTab,icon:Gauge},{value:'expiry',label:language==='en'?'Expiry':'Λήξεις',icon:CalendarX2},...(showTimes?[{value:'times',label:language==='en'?'Execution times':'Ώρες εκτέλεσης',icon:Clock}]:[])]} value={activeView} onChange={setView} ariaLabel={t('controls')}/>
  {activeView==='programme'&&!showCards&&!firstLoad&&<ControlDepartmentCards single cards={cards} period={period} language={language}/>}
  <section className="surface registry-workspace workspace-column workspace-fill controls-registry-workspace">
   <FilterBar query={query} onQueryChange={activeView==='departments'?undefined:setQuery} placeholder={activeView==='expiry'?tx.searchExpiry:tx.search} activeAdvancedCount={Number(department!=='all')+Number(status!=='all')} onClear={clearFilters} end={<>{activeView==='departments'&&!firstLoad&&<button type="button" className={`filter-trigger controls-pick-departments${picking||hiddenCount?' active':''}`} aria-pressed={picking} onClick={()=>setPicking(!picking)}><Eye size={16} aria-hidden="true"/><span>{picking?(language==='en'?'Done':'Τέλος'):(language==='en'?'Show / hide':'Εμφάνιση / απόκρυψη')}</span>{!picking&&hiddenCount>0&&<b>{hiddenCount}</b>}</button>}<ControlsKpis view={activeView} language={language} loading={firstLoad} overdue={overdue} dueSoon={dueSoon} adherence={activeView==='adherence'?adherenceReport.totals:periodTotals} expiry={expirySummary} timeFit={{...timeFitSummary(timeFitReport.lines),loading:timeFitReport.loading}} status={status} onStatus={value=>{setStatus(status===value?'all':value);setView('programme')}} expiryState={expiryState} onExpiryState={value=>setExpiryState(expiryState===value?null:value)}/>{activeView==='expiry'?null:periodSelect}</>} activeFilters={department!=='all'&&showCards?[{key:'department',label:`${tx.department}: ${department}`,onRemove:()=>setDepartment('all')}]:[]}><>{showCards&&<FilterSelect label={tx.department} value={department} onChange={setDepartment}><option value="all">{language==='en'?'All departments':'Όλα τα τμήματα'}</option>{departments.map(dep=><option key={dep} value={dep}>{dep}</option>)}</FilterSelect>}{activeView==='programme'&&<FilterSelect label={tx.status} value={status} onChange={setStatus}><option value="all">{language==='en'?'All':'Όλες'}</option><option value="today">{language==='en'?'Due today':'Για σήμερα'}</option><option value="overdue">{tx.overdue}</option><option value="dueSoon">{tx.dueSoon}</option></FilterSelect>}</></FilterBar>
   {activeView==='departments'?<ControlDepartmentCards cards={cards} total={scopedControls.length} overdue={scopedControls.filter(({item,departments:deps})=>controlState(item,deps,asOf())==='overdue').length} totals={scopedAdherence.totals} period={period} loading={firstLoad} language={language} onOpen={openDepartment} picking={picking} hidden={hidden} onToggle={toggleHidden} hiddenCount={hiddenCount} onShowAll={()=>setHiddenList([])} closedCount={picking?0:[...closedToday].filter(dep=>!hidden.has(dep)).length}/>:<>
   {activeView==='times'?<ControlTimeFitPanel report={timeFitReport} organizationId={tenant?.id} language={language} canChange={canManage} onChanged={reload} onOpen={openControl}/>:activeView==='expiry'?<ControlExpiryPanel actorName={actor.name} onExportChange={setExpiryExport} query={query} stateFilter={expiryState} sources={expirySources} canRemove={()=>canExecute} onRemove={item=>removeExpiryItem({item,organizationId:tenant!.id,actor,language,confirm,notify,notifyError,reload})} language={language} locale={language==='en'?'en-GB':'el-GR'}/>:activeView==='adherence'?<ControlAdherencePanel report={adherenceReport} tx={tx} language={language} onOpen={openControl}/>:<>
   <RegistryTable sort={sort} onSort={onSort} wrapperRef={registry.scrollRef} error={loadError} onRetry={reload} className="controls-table" columns={[{key:'control',label:tx.control,sortable:true},{key:'departments',label:tx.departments,sortable:true},{key:'frequency',label:tx.frequency,sortable:true},{key:'rate',label:`${tx.adherenceRate} · ${periodShort(period,language).toLowerCase()}`,sortable:true},{key:'next',label:tx.next,sortable:true},{key:'status',label:tx.status,sortable:true},...(recordColumn?[{key:'record',label:'',ariaLabel:language==='en'?'Record':'Καταχώρηση',className:'controls-record-cell'}]:[])]} rows={firstLoad?[]:pagedRows} loading={firstLoad} rowKey={row=>row.item.id} emptyTitle={loading?(language==='en'?'Loading controls…':'Φόρτωση ελέγχων…'):scopedControls.length?undefined:tx.emptyTitle} emptyText={loading?undefined:scopedControls.length?undefined:(language==='en'?`A control defines what is checked, where and how often; its executions build the adherence report.${canCreate?' Use «Create» at the top right to add the first one.':''}`:`Ένας έλεγχος ορίζει τι ελέγχεται, πού και πόσο συχνά· οι εκτελέσεις του δίνουν την τήρηση του προγράμματος.${canCreate?' Για να προσθέσετε τον πρώτο, πατήστε «Δημιουργία» πάνω δεξιά.':''}`)} emptyFiltered={!loading&&!loadError&&scopedControls.length>0} onClearFilters={clearFilters} emptyIcon={loading?undefined:ClipboardCheck} renderRow={({item,departments:deps})=>{const state=controlState(item,deps,asOf()),draft=hasDraft(item,deps),depPreview=deps.slice(0,3).join(' · '),more=deps.length>3?' …':'',progress=deps.length===1?progressText(assignmentProgress(item,deps[0]),language):'',expiry=isExpiryControl(item)?expiryCounts(expiryItems(item,deps)):null;return <tr key={item.id} {...registry.rowProps(item.id)} onClick={()=>openControl(item)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openControl(item)}}}><td><strong>{language==='el'?item.title:item.titleEn}</strong><small>{[item.category,item.equipment||item.location].filter(Boolean).join(' · ')}{controlCriticality(item)==='high'&&<span className="control-criticality-badge">{criticalityLabel('high',language)} {language==='en'?'criticality':'κρισιμότητα'}</span>}{(expiry?.expired??0)>0&&<span className="control-criticality-badge signal">{expiry!.expired} {language==='en'?'expired':(expiry!.expired===1?'ληγμένο':'ληγμένα')}</span>}{(expiry?.expiring??0)>0&&<span className="control-criticality-badge is-strong">{expiry!.expiring} {language==='en'?'expiring':(expiry!.expiring===1?'λήγει':'λήγουν')}</span>}</small></td><td>{deps.length===1?deps[0]:<><strong>{deps.length} {language==='en'?'departments':'τμήματα'}</strong><small>{depPreview}{more}</small></>}</td><td>{controlFrequencyLabel(item,deps,language)}</td><td>{(()=>{const lines=adherenceReport.lines.filter(line=>line.item.id===item.id),n=lines.reduce((sum,line)=>sum+line.missed,0);const rate=rates.get(item.id)??null;return <><RateMeter rate={n>0&&rate===100?99:rate}/>{n>0&&<button type="button" className="control-missed-link" onClick={e=>{e.stopPropagation();setMissedOf({lines,title:language==='el'?item.title:item.titleEn||item.title})}}>{language==='en'?`${n} missed`:`${n} ${n===1?'χαμένος':'χαμένοι'}`}</button>}</>})()}</td><td>{fmt(earliestNext(item,deps))}</td><td><div className="control-status-stack">{draft&&<SignalBadge tone="info">{tx.temporary}</SignalBadge>}<StatusBadge className="control-state-badge" tone={state==='overdue'?'danger':state==='dueSoon'?'warning':'success'}>{state==='overdue'?tx.overdue:state==='dueSoon'?tx.dueSoon:tx.within}</StatusBadge>{progress&&<small className="control-progress-text">{progress}</small>}</div></td>{recordColumn&&<td className="controls-record-cell">{canExecute&&deps.length===1&&isControlDue(item,deps[0])&&(()=>{const win=canRecordAnytime(role)?{gated:false}:recordWindow(item,deps[0]);const clock=(d:Date|null|undefined)=>d?`${String(zonedParts(d).hour).padStart(2,'0')}:${String(zonedParts(d).minute).padStart(2,'0')}`:'';if(win.gated&&win.state!=='open')return <button type="button" className="controls-record-now is-waiting" disabled title={win.state==='before'?(language==='en'?`The entry opens at ${clock(win.opens)} (1 hour before its time). For anything else, contact the hospital administrator.`:`Η καταχώρηση ανοίγει στις ${clock(win.opens)} (1 ώρα πριν την ώρα του ελέγχου). Για οτιδήποτε άλλο, επικοινωνήστε με τον Διαχειριστή.`):(language==='en'?'The time of this control has passed. Contact the hospital administrator.':'Η ώρα του ελέγχου πέρασε. Επικοινωνήστε με τον Διαχειριστή.')} onClick={e=>e.stopPropagation()}><PlayCircle size={14} aria-hidden="true"/>{win.state==='before'?(language==='en'?`From ${clock(win.opens)}`:`Από ${clock(win.opens)}`):(language==='en'?'Closed':'Έκλεισε')}</button>;return <button type="button" className="controls-record-now" onClick={e=>{e.stopPropagation();registry.saveViewState({query,department,status,view,period});navigate(`/controls/${item.id}?department=${encodeURIComponent(deps[0])}&execute=1`,{state:{returnTo:'/controls'}})}}><PlayCircle size={14} aria-hidden="true"/>{language==='en'?'Record':'Καταχώρηση'}</button>})()}</td>}</tr>}}/>
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
 const [categories,setCategories]=useState<string[]>([])
 const [existingControls,setExistingControls]=useState<Pick<ControlRecord,'id'|'title'|'status'>[]>([])
 const ownDepartment=membership?.previewDepartment||membership?.departmentName||(membership as MembershipDepartment)?.department||''
 const isDepartmentManager=role===ROLES.DEPARTMENT_MANAGER
 const createdByScope=isDepartmentManager?'department':role===ROLES.PLATFORM_OWNER?'platform':role===ROLES.HOSPITAL_ADMIN?'hospital_admin':role===ROLES.QUALITY_MANAGER?'quality':'infection_control'
 useEffect(()=>{if(!tenant?.id)return;let active=true;loadControlCategories(tenant.id).then(rows=>{if(active)setCategories(rows)}).catch(()=>{});loadControlNames(tenant.id).then(rows=>{if(active)setExistingControls(rows)}).catch(()=>{});return()=>{active=false}},[tenant?.id])
 async function saveNew(draft:ControlDraft){
  try{
   const scopedDraft:ControlDraft=isDepartmentManager?{...draft,departments:[ownDepartment],createdByScope:'department',createdForDepartment:ownDepartment}:{...draft,createdByScope}
   const saved=await saveControlDefinition(tenant!.id,scopedDraft,{actorName:actor.name,createdByScope:scopedDraft.createdByScope,createdForDepartment:scopedDraft.createdForDepartment})
   notify(tx.created,'success')
   navigate(`/controls/${saved!.id}`,{replace:true})
  }catch(error){notifyError(error,'save',{operation:'control_definition_create'})}
 }
 const canCreate=can(role,CAPABILITIES.MANAGE_CONTROLS,membership?.capabilities??[],membership?.customCapabilities??[])||(isDepartmentManager&&Boolean(ownDepartment))
 if(!canCreate)return <Page title={language==='en'?'Controls':'Έλεγχοι'}><div className="inline-empty">{language==='en'?'You cannot create controls.':'Δεν έχετε δικαίωμα δημιουργίας ελέγχων.'}</div></Page>
 return <ControlEditor departmentOnly={isDepartmentManager} fixedDepartment={isDepartmentManager?ownDepartment:''} usedCategories={categories} existingControls={existingControls} onCancel={()=>navigate('/controls')} onSave={saveNew}/>
}
