import { useEffect,useMemo,useRef,useState } from 'react'
import { flushSync } from 'react-dom'
import { useLocation,useNavigate } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { ExportMenu } from '../../design-system/ExportMenu'
import { FilterBar,FilterDate,FilterSelect } from '../../design-system/FilterBar'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { printElement } from '../../design-system/printElement'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES,ROLES,can } from '../../core/permissions/roles'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import { exportElementAsPdf } from '../../core/export/pdfReportExport'
import { INDICATOR_MORE_TABS,INDICATOR_TABS,TABS,TAB_MODULES,fmtDate,indicatorTabOf } from '../analysis/analysisPageModel'
import { collectAnalysisDemoSnapshot } from '../analysis/analysisDemoSnapshot'
import { collectDemoDomainMetrics } from '../analysis/analysisDomains'
import { AnalysisPage } from '../analysis/AnalysisPage'
import { infectionReportDocument,loadInfectionReportRows } from '../analysis/infectionReport'
import { printReportLater } from '../../core/export/reportDocument'
import { periodTag,readSharedPeriod,writeSharedPeriod } from '../analysis/sharedPeriod'
import { loadCommittees } from '../committees/committeeData'
import { signalDemoScenario } from '../demo/demoScenarioSignals'
import { TARGETS,executiveKpis,judgedByTarget,filtersToQuery,parseFilters,periodRange,previousRange,indicatorRates,targetsFromObjectives,visibleFor,withDeltas } from './executiveModel'
import { calculateCloudDefinition,collectCloudIndicatorMetrics,loadOperationalIndicatorDefinitions } from '../indicators/indicatorCloudService'
import { loadObjectives } from '../quality/review/reviewService'
import { loadExecutiveParts,loadGovernanceStatus } from './executiveService'
import { changeSentences,departmentGrid,departmentProfile,patientDaysIn,rateMeasures,yearAgoRange } from './executiveInsights'
import { loadPatientDayPeriods } from '../management/patientDayPeriodsCloudService'
import { ExecutiveDepartments } from './ExecutiveDepartments'
import { boardReportDocument,departmentReportDocument } from './executiveReports'
import { printReport } from '../../core/export/reportDocument'
import { ExecutiveSummary } from './ExecutiveSummary'
import './executive.css'
import { Building2,Database } from 'lucide-react'
import { IndicatorDataPanel, useIndicatorDataItems } from '../indicators/IndicatorDataPanel'

const DATA_TAB=['data','Δεδομένα','Data',Database,[]]
// «Τμήματα» (owner, 7/11/2026): one department against the departments' average and the comparison.
const DEPARTMENTS_TAB=['departments','Τμήματα','Departments',Building2,[]]

const PART_KEYS=['domains','people','qualityFood','microbiology','clusters','governance']

const ready=part=>part?.status==='ready'
// Settles each part on its own, so a card shows as soon as its data is in.
function useParts(parts){
 const [state,setState]=useState({})
 useEffect(()=>{
  if(!parts){setState({});return undefined}
  let active=true
  setState(Object.fromEntries(Object.keys(parts).map(key=>[key,{status:'loading'}])))
  for(const [key,promise] of Object.entries(parts))Promise.resolve(promise).then(data=>{if(active)setState(prev=>({...prev,[key]:{status:'ready',data}}))},error=>{if(active)setState(prev=>({...prev,[key]:{status:'error',error:error?.message||'LOAD_FAILED'}}))})
  return()=>{active=false}
 },[parts])
 return state
}
// Parts → the Analysis snapshot shape the model reads.
function snapshotOf(state){
 const data=key=>(ready(state[key])?state[key].data:null)||{}
 return {domains:{...data('domains'),...data('people'),...data('qualityFood')},microbiology:ready(state.microbiology)?state.microbiology.data:{},clusters:ready(state.clusters)?state.clusters.data||[]:[]}
}
function demoParts(range,en){
 const base=collectAnalysisDemoSnapshot({range}),domains=collectDemoDomainMetrics(range,en,base.clusters?.length||0)
 const today=new Date().toISOString().slice(0,10),decisions=loadCommittees().flatMap(item=>item.decisions||[]).filter(item=>!['completed','closed','cancelled'].includes(item.status))
 const {training,workforce,governance,qualityFood,...rest}=domains
 return {domains:rest,people:{training,workforce,governance},qualityFood:{qualityFood},microbiology:base.microbiology,clusters:base.clusters||[],governance:{openDecisions:decisions.length,overdueDecisions:decisions.filter(item=>item.dueDate&&item.dueDate<today).length}}
}


export function ExecutiveDashboardPage(){
 const {tenant,role,membership,isDemo:contextIsDemo,moduleEnabled}=useTenant()
 const isDemo=contextIsDemo||isOwnerPreview()
 const {language}=useLanguage();const en=language==='en';const tx=(elText,enText)=>en?enText:elText
 const {notifyError}=useFeedback()
 const location=useLocation();const navigate=useNavigate()
 const reportRef=useRef(null);const [exportingPdf,setExportingPdf]=useState(false)
 const query=useMemo(()=>new URLSearchParams(location.search),[location.search])
 // The period is shared with Analysis (sharedPeriod.js): a URL without one opens on the last one picked.
 const filters=useMemo(()=>parseFilters(location.search,readSharedPeriod()),[location.search])
 // One row of tabs (?tab=); an old ?view=analysis&tab=<analysis tab> opens the tab that shows it.
 // The former «Μικροβιολογία & AMR» tab is part of «Λοιμώξεις & μικροβιολογία».
 const askedTab=query.get('tab')==='laboratory'?'infections':query.get('tab')||''
 const pageTab=[...INDICATOR_TABS,...INDICATOR_MORE_TABS,DATA_TAB,DEPARTMENTS_TAB].some(([id])=>id===askedTab)?askedTab:query.get('view')==='analysis'?indicatorTabOf(askedTab||'surveillance'):'summary'
 // Σύγκριση: none, the previous period, or the chosen department against the whole hospital (?vs=departments).
 // The default is the same period a year before («πέρσι», owner 7/11/2026); ?vs=previous the period just before.
 const compareMode=!filters.compare?'none':query.get('vs')==='departments'&&filters.department?'departments':query.get('vs')==='previous'?'previous':'lastYear'
 const searchOf=(next,nextTab,nextMode=compareMode)=>{const params=new URLSearchParams(filtersToQuery({...next,compare:nextMode!=='none'}).replace(/^\?/,''));if(nextMode==='departments'||nextMode==='previous')params.set('vs',nextMode);if(nextTab&&nextTab!=='summary')params.set('tab',nextTab);const out=params.toString();return out?`?${out}`:''}
 const setFilters=(patch,nextMode=compareMode)=>{const next={...filters,...patch};writeSharedPeriod(next);navigate({pathname:location.pathname,search:searchOf(next,pageTab,next.department?nextMode:nextMode==='departments'?'lastYear':nextMode)},{replace:true})}
 const setPageTab=nextTab=>navigate({pathname:location.pathname,search:searchOf(filters,nextTab)},{replace:true})
 const range=useMemo(()=>periodRange(filters),[filters])
 const previous=useMemo(()=>compareMode==='lastYear'?yearAgoRange(range):compareMode==='previous'?previousRange(range,filters.period):compareMode==='departments'?range:null,[compareMode,filters.period,range])
 const organizationId=tenant?.id||''
 const department=isDemo?'':filters.department
 // The reference the summary and every tab compare with: the previous period, or the whole hospital.
 const previousDepartment=compareMode==='departments'?'':department
 const userCan=capability=>can(role,capability,membership?.capabilities??[],membership?.customCapabilities??[])
 // «Δεδομένα»: bed days, structural indicators and PPS, entered by hand (moved here from the Management Center).
 const dataItems=useIndicatorDataItems()
 const currentParts=useMemo(()=>{
  if(isDemo)return demoParts(range,en)
  if(!organizationId)return null
  return {...loadExecutiveParts({organizationId,...range,departmentId:department}),governance:loadGovernanceStatus(organizationId)}
 },[isDemo,organizationId,range,department,en])
 const previousParts=useMemo(()=>{
  if(!previous)return null
  if(isDemo)return demoParts(previous,en)
  if(!organizationId)return null
  const parts=loadExecutiveParts({organizationId,...previous,departmentId:previousDepartment})
  return {domains:parts.domains,people:parts.people,qualityFood:parts.qualityFood,microbiology:parts.microbiology}
},[isDemo,organizationId,previous,previousDepartment,en])
 const current=useParts(currentParts),before=useParts(previousParts)
 // The targets of the measures, from the hospital's objectives on the platform's indicators.
 const [targets,setTargets]=useState(TARGETS)
 useEffect(()=>{if(!isDemo&&!organizationId)return undefined;let live=true;loadObjectives(organizationId).then(rows=>{if(live)setTargets(targetsFromObjectives(rows))}).catch(()=>{});return()=>{live=false}},[isDemo,organizationId])
 // Hand hygiene, bundles and training: the value of the platform's indicators for the period (the same as in «Δείκτες & Στόχοι»).
 const [rates,setRates]=useState({now:{},before:{}})
 useEffect(()=>{if(!isDemo&&!organizationId)return undefined;let live=true;(async()=>{const definitions=await loadOperationalIndicatorDefinitions(organizationId).catch(()=>[]);const at=async(period,departmentId)=>{if(!period)return {};const metrics=await collectCloudIndicatorMetrics(organizationId,{from:period.from,to:period.to,departmentId:departmentId||null}).catch(()=>null);return metrics?indicatorRates(definitions,def=>calculateCloudDefinition(def,metrics).value):{}};const [now,before]=await Promise.all([at(range,department),at(previous,previousDepartment)]);if(live)setRates({now,before})})();return()=>{live=false}},[isDemo,organizationId,range,previous,department,previousDepartment])
 const snapshot=useMemo(()=>snapshotOf(current),[current])
 const governance=ready(current.governance)?current.governance.data:null
 const previousSnapshot=useMemo(()=>(previous&&['domains','people','qualityFood','microbiology'].every(key=>ready(before[key]))?snapshotOf(before):null),[previous,before])
 // The hospital's patient days (Δεδομένα), for the rates per 1,000 patient days.
 const [dayPeriods,setDayPeriods]=useState([])
 useEffect(()=>{if(isDemo||!organizationId)return undefined;let live=true;loadPatientDayPeriods(organizationId).then(rows=>{if(live)setDayPeriods(rows)}).catch(()=>{});return()=>{live=false}},[isDemo,organizationId])
 const kpis=useMemo(()=>{
  const withRates=(items,period)=>[...items,...judgedByTarget(rateMeasures(items,patientDaysIn(dayPeriods,period)))]
  const now=withRates(executiveKpis(snapshot,governance,targets,rates.now),range)
  return visibleFor(withDeltas(now,previousSnapshot?withRates(executiveKpis(previousSnapshot,governance,targets,rates.before),previous):null),moduleEnabled)
 },[snapshot,governance,previousSnapshot,moduleEnabled,targets,rates,dayPeriods,range,previous])
 const loadingAny=PART_KEYS.some(key=>current[key]?.status==='loading')
 const departments=useMemo(()=>(ready(current.microbiology)?current.microbiology.data?.departments||[]:[]).filter(item=>!item.organizationId||item.organizationId===organizationId),[current.microbiology,organizationId])
 const departmentName=department?(departments.find(item=>item.id===department)?.name||tx('Ένα τμήμα','One department')):tx('Όλα τα τμήματα','All departments')
 // «Αναλυτικά» opens the tab of this page that shows that Analysis section, with the same filters.
 const openAnalysis=tab=>userCan(CAPABILITIES.VIEW_ANALYSIS)?()=>{window.scrollTo?.(0,0);navigate({pathname:location.pathname,search:searchOf(filters,indicatorTabOf(tab))})}:undefined
 const periodLabel=`${fmtDate(range.from)} – ${fmtDate(range.to)}`
 const previousLabel=compareMode==='departments'?tx('όλου του νοσοκομείου','the whole hospital'):previous?`${fmtDate(previous.from)} – ${fmtDate(previous.to)}`:''
 const presetLabels={month:tx('Τρέχων μήνας','This month'),'3m':tx('Τελευταίοι 3 μήνες','Last 3 months'),'6m':tx('Τελευταίοι 6 μήνες','Last 6 months'),'12m':tx('Τελευταίοι 12 μήνες','Last 12 months'),year:tx('Τρέχον έτος','This year'),custom:tx('Άλλο διάστημα','Custom range')}
 const hospital=tenant?.name||tx('Νοσοκομείο','Hospital')
 const generated=new Date().toLocaleString(en?'en-GB':'el-GR',{dateStyle:'short',timeStyle:'short', hourCycle: 'h23'})
 const reportLines=[hospital,`${tx('Περίοδος','Period')}: ${periodLabel} (${presetLabels[filters.period]})`,`${tx('Τμήμα','Department')}: ${departmentName}${previous?` · ${tx('σύγκριση με','compared with')} ${previousLabel}`:''}`,`${tx('Δημιουργήθηκε','Generated')}: ${generated}`]
 // «Εικόνα νοσοκομείου»: the picture for the administration (the indicators and objectives are in «Δείκτες & Στόχοι»).
 const title=tx('Εικόνα νοσοκομείου','Hospital overview')
 // The printed report carries the hospital, the period and when it was made.
 const [printing,setPrinting]=useState(false)
 const unfoldAll=()=>flushSync(()=>{setPrinting(true)})
 // «Infections» also has its annual report, a document of its own (the window opens in the click, the data is read after).
 function printInfectionReport(pdf){const year=Number(String(range.to||range.from).slice(0,4))||new Date().getFullYear();if(!printReportLater(async()=>infectionReportDocument({...await loadInfectionReportRows(organizationId,year),year,language}),{language,pdf:pdf===true}))notifyError(new Error(en?'Allow pop-ups to print.':'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.'),'export')}
 // «Αναφορά Δ.Σ.» and «Αναφορά τμήματος» (owner, 7/11/2026): short documents of their own, not the screen.
 function printDocument(doc,pdf){if(!printReport(doc,{pdf:pdf===true}))notifyError(new Error('POPUP_BLOCKED'),'export',{operation:'executive_print'})}
 function boardReport(pdf){printDocument(boardReportDocument({kpis,sentences:previousSnapshot?changeSentences(kpis,snapshot,{en}):[],grid,hospital,periodLine,compareLabel:compareLabelText,language}),pdf)}
 function departmentReport(pdf){const name=grid.rows.some(row=>row.name===chosenDepartment)?chosenDepartment:grid.rows[0]?.name;if(!name)return;printDocument(departmentReportDocument({department:name,profile:departmentProfile(grid,name),hospital,periodLine,compareLabel:compareLabelText,language}),pdf)}
 function print(){signalDemoScenario('analysis_export');unfoldAll();if(!printElement(reportRef.current,{title:`${title} · ${hospital}`,heading:[`${title} · ${tabTitle}`,periodLine]}))notifyError(new Error('POPUP_BLOCKED'),'export',{operation:'executive_print'});setPrinting(false)}
 function exportPdf(){
  signalDemoScenario('analysis_export')
  unfoldAll()
  setExportingPdf(true)
  exportElementAsPdf({element:reportRef.current,filename:`${title}_${hospital}_${range.from}_${range.to}`})
   .catch(error=>notifyError(error,'export',{operation:'executive_pdf_export'}))
   .finally(()=>{setExportingPdf(false);setPrinting(false)})
 }
 const kpiParts=item=>item.parts.map(key=>current[key])
 const kpiPeriod=periodTag(range,en,filters.period)
 const canAnalysis=userCan(CAPABILITIES.VIEW_ANALYSIS)
 // The Analysis sections this viewer may see (modules of the operating profile; the Director reads aggregates only, no reporting lists).
 const sectionVisible=id=>(!TAB_MODULES[id]||TAB_MODULES[id].some(module=>moduleEnabled(module)))&&!(id==='reporting'&&role===ROLES.HOSPITAL_DIRECTOR)
 const tabVisible=([id,,,,sections])=>id==='summary'||(canAnalysis&&sections.some(sectionVisible))
 const grid=useMemo(()=>departmentGrid(snapshot,previousSnapshot,targets),[snapshot,previousSnapshot,targets])
 const [chosenDepartment,setChosenDepartment]=useState('')
 const compareLabelText=compareMode==='lastYear'?tx('Πέρσι','Last year'):compareMode==='departments'?tx('Νοσοκομείο','Hospital'):compareMode==='previous'?tx('Προηγ. περίοδος','Previous period'):tx('Σύγκριση','Comparison')
 const shownTabs=INDICATOR_TABS.filter(tabVisible)
 const mainTabs=[shownTabs[0],...(grid.rows.length>1?[DEPARTMENTS_TAB]:[]),...shownTabs.slice(1),...(dataItems.length?[DATA_TAB]:[])],moreTabs=INDICATOR_MORE_TABS.filter(tabVisible)
 const activeTab=[...mainTabs,...moreTabs].find(([id])=>id===pageTab)||mainTabs[0]
 const activeSections=activeTab[4].filter(sectionVisible)
 // A tab of three or more sections («Organisation») shows one at a time, under its own small tabs, so it never runs long; all
 // stay loaded (hidden), and printing or the PDF unfold them all.
 const [subSection,setSubSection]=useState('')
 const subTabs=activeSections.length>2?activeSections.map(id=>{const row=TABS.find(([key])=>key===id);return {value:id,label:row?(en?row[2]:row[1]):id,icon:row?.[3]}}):[]
 const shownSection=subTabs.some(item=>item.value===subSection)?subSection:subTabs[0]?.value||''
 const tabTitle=en?activeTab[2]:activeTab[1]
 const compareOf={lastYear:{shortLabel:tx('Πέρσι','Last year'),title:tx('Σύγκριση με πέρσι','Compared with last year'),subtitle:tx('Ίδιο εύρος, η ίδια περίοδος του προηγούμενου έτους.','Same scope, the same period a year before.'),currentLabel:periodLabel,compareLabel:previousLabel},previous:{shortLabel:tx('Προηγ. περίοδος','Previous period'),title:tx('Σύγκριση με την προηγούμενη περίοδο','Compared with the previous period'),subtitle:tx('Ίδιο εύρος, η ίσης διάρκειας περίοδος πριν.','Same scope, the period of equal length before.'),currentLabel:periodLabel,compareLabel:previousLabel},departments:{shortLabel:tx('Νοσοκομείο','Hospital'),title:tx('Τμήμα έναντι νοσοκομείου','Department against the hospital'),subtitle:tx('Ίδια περίοδος· το τμήμα και όλο το νοσοκομείο.','Same period; the department and the whole hospital.'),currentLabel:departmentName,compareLabel:tx('Όλο το νοσοκομείο','Whole hospital')}}
 const analysisCompare=previous&&compareOf[compareMode]?{range:previous,departmentId:previousDepartment,...compareOf[compareMode]}:null
 // Period, department and comparison in «Φίλτρα» next to the export; the period reads under the title.
 const filterCount=(filters.period!=='year'?1:0)+(department?1:0)+(compareMode!=='lastYear'?1:0)
 const pageActions=activeTab[0]==='data'?null:<div className="row-actions exec-actions">
  <FilterBar activeAdvancedCount={filterCount} onClear={()=>setFilters({period:'year',department:'',compare:true},'lastYear')}>
   <FilterSelect label={tx('Περίοδος','Period')} value={filters.period} onChange={value=>setFilters({period:value,...(value==='custom'?{from:range.from,to:range.to}:{})})}>{Object.entries(presetLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</FilterSelect>
   {filters.period==='custom'&&<><FilterDate label={tx('Από','From')} value={range.from} onChange={value=>value&&setFilters({from:value,to:range.to})}/><FilterDate label={tx('Έως','To')} value={range.to} onChange={value=>value&&setFilters({from:range.from,to:value})}/></>}
   {!isDemo&&<FilterSelect label={tx('Τμήμα','Department')} value={department} onChange={value=>setFilters({department:value})}><option value="">{tx('Όλα τα τμήματα','All departments')}</option>{departments.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</FilterSelect>}
   <FilterSelect label={tx('Σύγκριση','Comparison')} value={compareMode} onChange={value=>setFilters({compare:value!=='none'},value)}><option value="none">{tx('Χωρίς σύγκριση','No comparison')}</option><option value="lastYear">{tx('Ίδια περίοδος πέρσι','Same period last year')}</option><option value="previous">{tx('Προηγούμενη περίοδος','Previous period')}</option>{!isDemo&&<option value="departments" disabled={!department}>{tx('Τμήμα έναντι νοσοκομείου','Department vs hospital')}</option>}</FilterSelect>
  </FilterBar>
  <ExportMenu disabled={activeTab[0]==='summary'&&loadingAny} pdfBusy={exportingPdf} onPrint={print} onPdf={exportPdf} items={activeTab[0]==='summary'?[{id:'board-print',kind:'print',label:en?'Print: report to the Board':'Εκτύπωση: αναφορά Δ.Σ.',onClick:()=>boardReport(false)},{id:'board-pdf',kind:'pdf',label:en?'PDF: report to the Board':'PDF: αναφορά Δ.Σ.',onClick:()=>boardReport(true)}]:activeTab[0]==='departments'?[{id:'department-print',kind:'print',label:en?'Print: department report':'Εκτύπωση: αναφορά τμήματος',onClick:()=>departmentReport(false)},{id:'department-pdf',kind:'pdf',label:en?'PDF: department report':'PDF: αναφορά τμήματος',onClick:()=>departmentReport(true)}]:activeTab[0]==='infections'?[{id:'infections-report-print',kind:'print',label:en?'Print: annual infections report':'Εκτύπωση: ετήσια αναφορά λοιμώξεων',onClick:()=>printInfectionReport(false)},{id:'infections-report-pdf',kind:'pdf',label:en?'PDF: annual infections report':'PDF: ετήσια αναφορά λοιμώξεων',onClick:()=>printInfectionReport(true)}]:[]}/>
 </div>
 const periodLine=`${presetLabels[filters.period]} · ${periodLabel}${department?` · ${departmentName}`:''}${previous?` · ${tx('έναντι','vs')} ${previousLabel}`:''}`
 return <Page className="exec-page" title={title} subtitle={activeTab[0]==='data'?hospital:periodLine} actions={pageActions}>
  {mainTabs.length+moreTabs.length>1&&<CanonicalTabs className="exec-view-tabs" value={activeTab[0]} onChange={setPageTab} ariaLabel={tx('Ενότητες δεικτών','Indicator sections')} items={mainTabs.map(([id,elLabel,enLabel,icon])=>({value:id,label:en?enLabel:elLabel,icon}))} moreItems={moreTabs.map(([id,elLabel,enLabel,icon])=>({value:id,label:en?enLabel:elLabel,icon}))}/>}
  {activeTab[0]==='data'?<IndicatorDataPanel initial={query.get('item')}/>:<>
  {activeTab[0]==='departments'?<section ref={reportRef} className="exec-report"><ExecutiveDepartments grid={grid} department={chosenDepartment} onDepartment={setChosenDepartment} compareLabel={compareLabelText} language={language}/></section>:activeTab[0]!=='summary'?<section ref={reportRef} className="exec-analysis-report" aria-label={tabTitle}>{subTabs.length>0&&!printing&&<CanonicalTabs className="exec-sub-tabs" value={shownSection} onChange={setSubSection} ariaLabel={tabTitle} items={subTabs}/>}{activeSections.map(id=><div key={`${id}:${compareMode}`} hidden={Boolean(shownSection)&&id!==shownSection&&!printing}><AnalysisPage embedded externalRange={range} periodLabel={kpiPeriod} initialTab={id} department={department} externalCompare={analysisCompare}/></div>)}</section>:<section ref={reportRef} className="exec-report">
   {printing&&<header className="exec-report-head"><div><strong>{reportLines[0]}</strong><span>{reportLines.slice(1).join(' · ')}</span></div>{isDemo&&<span className="status-badge temporary">{tx('ΔΕΔΟΜΕΝΑ DEMO','DEMO DATA')}</span>}</header>}
   <ExecutiveSummary kpis={kpis} snapshot={snapshot} previousSnapshot={previousSnapshot} range={range} targets={targets} compareLabel={compareLabelText} partsOf={kpiParts} onOpen={item=>openAnalysis(item.tab)} language={language}/>
   <p className="exec-footnote"><Activity size={13} aria-hidden="true"/>{isDemo?tx('Συνθετικά δεδομένα αποκλειστικά για το Demo περιβάλλον.','Synthetic data for the Demo environment only.'):tx('Πραγματικά δεδομένα του νοσοκομείου· οι εκκρεμότητες (εκπρόθεσμα, ληγμένα, ανοιχτές αποφάσεις) αφορούν τη σημερινή κατάσταση.','Live hospital data; open items (overdue, expired, open decisions) reflect the state today.')}</p>
  </section>}
  </>}
 </Page>
}
