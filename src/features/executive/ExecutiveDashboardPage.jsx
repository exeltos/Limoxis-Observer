import { useEffect,useMemo,useRef,useState } from 'react'
import { flushSync } from 'react-dom'
import { useLocation,useNavigate } from 'react-router-dom'
import { Activity,AlertOctagon,AlertTriangle,ArrowRight,BookOpen,BriefcaseMedical,ChefHat,ChevronDown,ChevronUp,ClipboardCheck,FlaskConical,GraduationCap,ShieldCheck,TriangleAlert } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Card,CardHeader } from '../../design-system/Card'
import { ExportMenu } from '../../design-system/ExportMenu'
import { KpiCard,KpiStrip } from '../../design-system/KpiCard'
import { ManualDateField } from '../../design-system/ManualDateField'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { printElement } from '../../design-system/printElement'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES,ROLES,can } from '../../core/permissions/roles'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import { exportElementAsPdf } from '../../core/export/pdfReportExport'
import { AnalysisSelect } from '../analysis/AnalysisPanels'
import { BarList,DonutChart,TrendChart } from '../analysis/AnalysisCharts'
import { INDICATOR_MORE_TABS,INDICATOR_TABS,TAB_MODULES,continuousMonths,fmtDate,indicatorTabOf } from '../analysis/analysisPageModel'
import { collectAnalysisDemoSnapshot } from '../analysis/analysisDemoSnapshot'
import { collectDemoDomainMetrics } from '../analysis/analysisDomains'
import { AnalysisPage } from '../analysis/AnalysisPage'
import { periodTag,readSharedPeriod,writeSharedPeriod } from '../analysis/sharedPeriod'
import { loadCommittees } from '../committees/committeeData'
import { signalDemoScenario } from '../demo/demoScenarioSignals'
import { controlRanking,executiveKpis,filtersToQuery,monthlyRate,parseFilters,pct,periodRange,previousRange,redFlags,visibleFor,withDeltas } from './executiveModel'
import { loadExecutiveParts,loadGovernanceStatus } from './executiveService'
import './executive.css'

const PART_KEYS=['domains','people','qualityFood','microbiology','clusters','governance']
const SEVERITY_LABELS={critical:['Κρίσιμη','Critical'],high:['Υψηλή','High'],medium:['Μέτρια','Medium'],low:['Χαμηλή','Low']}
// Detail screen of each Analysis tab for a viewer who has it; otherwise the Analysis tab itself.
const MODULE_SCREENS={surveillance:['/surveillance',CAPABILITIES.VIEW_SURVEILLANCE],laboratory:['/laboratory',CAPABILITIES.VIEW_LAB],prevention:['/prevention',CAPABILITIES.VIEW_PREVENTION],controls:['/controls',CAPABILITIES.VIEW_CONTROLS],quality:['/quality',CAPABILITIES.VIEW_QUALITY],qualityfood:['/quality',CAPABILITIES.VIEW_QUALITY],training:['/training',CAPABILITIES.VIEW_TRAINING],governance:['/meetings',CAPABILITIES.VIEW_COMMITTEES]}

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

function Skeleton({lines=3}){return <div className="exec-skeleton" aria-hidden="true">{Array.from({length:lines},(_,i)=><i key={i}/>)}</div>}
const formatValue=(value,unit,en)=>value==null?'—':`${new Intl.NumberFormat(en?'en-GB':'el-GR',{maximumFractionDigits:1}).format(value)}${unit||''}`

// The change against the previous period, for the KpiCard: rates in percentage points, counts by their relative change (or the difference, from zero).
function deltaOf(item,tx,en,against){
 const d=item.delta
 if(!d)return null
 const sign=d.diff>0?'+':''
 const amount=item.unit==='%'?`${sign}${formatValue(d.diff,'',en)} ${tx('μον.','pts')}`:d.change!=null?`${sign}${formatValue(d.change,'%',en)}`:`${sign}${formatValue(d.diff,'',en)}`
 return {text:`${amount} ${d.good==null?tx('σταθερό','unchanged'):d.good?tx('βελτίωση','better'):tx('επιδείνωση','worse')}`,trend:d.trend,good:d.good,title:against||tx('Μεταβολή έναντι της προηγούμενης περιόδου','Change against the previous period')}
}
function Figures({rows}){return <dl className="exec-figures">{rows.filter(Boolean).map(([label,value,tone])=><div key={label} className={tone?`exec-figure-${tone}`:''}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
// The key figures always show; the charts and lists open on demand (and all of them for print / PDF).
function SectionCard({id,icon,title,subtitle,loading,error,onOpen,tx,figures,children,open,onToggle}){
 return <Card className={`exec-card${open?'':' exec-card-folded'}`} id={`exec-${id}`}>
  <CardHeader icon={icon} title={title} subtitle={subtitle} actions={<span className="exec-card-actions" data-pdf-ignore="">{children&&<button type="button" className="text-button exec-open" aria-expanded={open} onClick={onToggle}>{open?tx('Λιγότερα','Less'):tx('Γραφήματα','Charts')}{open?<ChevronUp size={14} aria-hidden="true"/>:<ChevronDown size={14} aria-hidden="true"/>}</button>}{onOpen&&<button type="button" className="text-button exec-open" onClick={onOpen}>{tx('Αναλυτικά','Details')}<ArrowRight size={14} aria-hidden="true"/></button>}</span>}/>
  {loading?<Skeleton lines={open?5:2}/>:error?<div className="inline-empty">{tx('Δεν ήταν δυνατή η φόρτωση αυτής της ενότητας.','This section could not be loaded.')}</div>:<>{figures}{open&&children}</>}
 </Card>
}
const FLAGS_FOLDED=5
function RankList({title,rows,tx,en}){return <div className="exec-rank"><strong>{title}</strong>{rows.length?<ol>{rows.map(row=><li key={row.name}><span>{row.name}</span><b>{formatValue(row.rate,'%',en)}</b><small>{tx(`${row.findings}/${row.executions} με εύρημα`,`${row.findings}/${row.executions} with finding`)}</small></li>)}</ol>:<p className="inline-empty">{tx('Δεν υπάρχουν αρκετές εκτελέσεις.','Not enough executions.')}</p>}</div>}

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
 const askedTab=query.get('tab')||''
 const pageTab=[...INDICATOR_TABS,...INDICATOR_MORE_TABS].some(([id])=>id===askedTab)?askedTab:query.get('view')==='analysis'?indicatorTabOf(askedTab||'surveillance'):'summary'
 // Σύγκριση: none, the previous period, or the chosen department against the whole hospital (?vs=departments).
 const compareMode=!filters.compare?'none':query.get('vs')==='departments'&&filters.department?'departments':'previous'
 const searchOf=(next,nextTab,nextMode=compareMode)=>{const params=new URLSearchParams(filtersToQuery({...next,compare:nextMode!=='none'}).replace(/^\?/,''));if(nextMode==='departments')params.set('vs','departments');if(nextTab&&nextTab!=='summary')params.set('tab',nextTab);const out=params.toString();return out?`?${out}`:''}
 const setFilters=(patch,nextMode=compareMode)=>{const next={...filters,...patch};writeSharedPeriod(next);navigate({pathname:location.pathname,search:searchOf(next,pageTab,next.department?nextMode:nextMode==='departments'?'previous':nextMode)},{replace:true})}
 const setPageTab=nextTab=>navigate({pathname:location.pathname,search:searchOf(filters,nextTab)},{replace:true})
 const [openCards,setOpenCards]=useState(()=>new Set())
 const [allFlags,setAllFlags]=useState(false)
 const toggleCard=id=>setOpenCards(prev=>{const next=new Set(prev);if(next.has(id))next.delete(id);else next.add(id);return next})
 const cardProps=id=>({open:openCards.has(id),onToggle:()=>toggleCard(id)})
 const range=useMemo(()=>periodRange(filters),[filters])
 const previous=useMemo(()=>compareMode==='previous'?previousRange(range,filters.period):compareMode==='departments'?range:null,[compareMode,filters.period,range])
 const organizationId=tenant?.id||''
 const department=isDemo?'':filters.department
 // The reference the summary and every tab compare with: the previous period, or the whole hospital.
 const previousDepartment=compareMode==='departments'?'':department
 const userCan=capability=>can(role,capability,membership?.capabilities??[],membership?.customCapabilities??[])
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
 const snapshot=useMemo(()=>snapshotOf(current),[current])
 const governance=ready(current.governance)?current.governance.data:null
 const kpis=useMemo(()=>{
  const now=executiveKpis(snapshot,governance)
  const allPrevious=previous&&['domains','people','qualityFood','microbiology'].every(key=>ready(before[key]))
  return visibleFor(withDeltas(now,allPrevious?executiveKpis(snapshotOf(before),governance):null),moduleEnabled)
 },[snapshot,governance,previous,before,moduleEnabled])
 const flags=useMemo(()=>redFlags(kpis,snapshot,moduleEnabled),[kpis,snapshot,moduleEnabled])
 const loadingAny=PART_KEYS.some(key=>current[key]?.status==='loading')
 // A part that failed was never evaluated: «all on target» needs every part read.
 const failedAny=PART_KEYS.some(key=>current[key]?.status==='error')
 const partState=keys=>({loading:keys.some(key=>!current[key]||current[key].status==='loading'),error:keys.every(key=>current[key]?.status==='error')})
 const departments=useMemo(()=>(ready(current.microbiology)?current.microbiology.data?.departments||[]:[]).filter(item=>!item.organizationId||item.organizationId===organizationId),[current.microbiology,organizationId])
 const departmentName=department?(departments.find(item=>item.id===department)?.name||tx('Ένα τμήμα','One department')):tx('Όλα τα τμήματα','All departments')
 // «Αναλυτικά» opens the tab of this page that shows that Analysis section, with the same filters.
 const openAnalysis=tab=>userCan(CAPABILITIES.VIEW_ANALYSIS)?()=>{window.scrollTo?.(0,0);navigate({pathname:location.pathname,search:searchOf(filters,indicatorTabOf(tab))})}:undefined
 const openFlag=tab=>{const [path,capability]=MODULE_SCREENS[tab]||[];if(path&&userCan(capability))return()=>navigate(path);return openAnalysis(tab)}
 const on=(...modules)=>modules.some(module=>moduleEnabled(module))
 const d=snapshot.domains,s=d.surveillance||{},hh=d.handHygiene||{},b=d.bundles||{},c=d.controls||{},q=d.quality||{},t=d.training||{},w=d.workforce||{},g=d.governance||{},f=d.qualityFood||{},micro=snapshot.microbiology||{}
 const ranking=useMemo(()=>controlRanking(c.byDepartment),[c.byDepartment])
 const periodLabel=`${fmtDate(range.from)} – ${fmtDate(range.to)}`
 const previousLabel=compareMode==='departments'?tx('όλου του νοσοκομείου','the whole hospital'):previous?`${fmtDate(previous.from)} – ${fmtDate(previous.to)}`:''
 const presetLabels={month:tx('Τρέχων μήνας','This month'),'3m':tx('Τελευταίοι 3 μήνες','Last 3 months'),'6m':tx('Τελευταίοι 6 μήνες','Last 6 months'),'12m':tx('Τελευταίοι 12 μήνες','Last 12 months'),year:tx('Τρέχον έτος','This year'),custom:tx('Άλλο διάστημα','Custom range')}
 const hospital=tenant?.name||tx('Νοσοκομείο','Hospital')
 const generated=new Date().toLocaleString(en?'en-GB':'el-GR',{dateStyle:'short',timeStyle:'short', hourCycle: 'h23'})
 const reportLines=[hospital,`${tx('Περίοδος','Period')}: ${periodLabel} (${presetLabels[filters.period]})`,`${tx('Τμήμα','Department')}: ${departmentName}${previous?` · ${tx('σύγκριση με','compared with')} ${previousLabel}`:''}`,`${tx('Δημιουργήθηκε','Generated')}: ${generated}`]
 const title=tx('Δείκτες','Indicators')
 // A report holds every chart and the whole attention list.
 const unfoldAll=()=>flushSync(()=>{setOpenCards(new Set(['infections','prevention','controls','quality','people','food','governance']));setAllFlags(true)})
 function print(){signalDemoScenario('analysis_export');unfoldAll();if(!printElement(reportRef.current,{title:`${title} · ${hospital}`}))notifyError(new Error('POPUP_BLOCKED'),'export',{operation:'executive_print'})}
 function exportPdf(){
  signalDemoScenario('analysis_export')
  unfoldAll()
  setExportingPdf(true)
  exportElementAsPdf({element:reportRef.current,filename:`${title}_${hospital}_${range.from}_${range.to}`})
   .catch(error=>notifyError(error,'export',{operation:'executive_pdf_export'}))
   .finally(()=>setExportingPdf(false))
 }
 const handTrend=continuousMonths(monthlyRate(hh.monthly))
 const cultureTrend=continuousMonths(micro.monthly||[])
 const severityRows=(q.bySeverity||[]).map(([key,n])=>[SEVERITY_LABELS[key]?tx(...SEVERITY_LABELS[key]):key,n])
 const trainingByDepartment=(t.byDepartment||[]).filter(([,total])=>Number(total)>0).map(([name,total,done])=>[name,pct(done,total)]).sort((x,y)=>x[1]-y[1]).slice(0,6)
 const kpiParts=item=>item.parts.map(key=>current[key])
 const kpiPeriod=periodTag(range,en,filters.period)
 const canAnalysis=userCan(CAPABILITIES.VIEW_ANALYSIS)
 const shownFlags=allFlags?flags:flags.slice(0,FLAGS_FOLDED)
 // The Analysis sections this viewer may see (modules of the operating profile; the Director reads aggregates only, no reporting lists).
 const sectionVisible=id=>(!TAB_MODULES[id]||TAB_MODULES[id].some(module=>moduleEnabled(module)))&&!(id==='reporting'&&role===ROLES.HOSPITAL_DIRECTOR)
 const tabVisible=([id,,,,sections])=>id==='summary'||(canAnalysis&&sections.some(sectionVisible))
 const mainTabs=INDICATOR_TABS.filter(tabVisible),moreTabs=INDICATOR_MORE_TABS.filter(tabVisible)
 const activeTab=[...mainTabs,...moreTabs].find(([id])=>id===pageTab)||mainTabs[0]
 const activeSections=activeTab[4].filter(sectionVisible)
 const tabTitle=en?activeTab[2]:activeTab[1]
 const compareOf={previous:{title:tx('Σύγκριση με την προηγούμενη περίοδο','Compared with the previous period'),subtitle:tx('Ίδιο εύρος, η ίσης διάρκειας περίοδος πριν.','Same scope, the period of equal length before.'),currentLabel:periodLabel,compareLabel:previousLabel},departments:{title:tx('Τμήμα έναντι νοσοκομείου','Department against the hospital'),subtitle:tx('Ίδια περίοδος· το τμήμα και όλο το νοσοκομείο.','Same period; the department and the whole hospital.'),currentLabel:departmentName,compareLabel:tx('Όλο το νοσοκομείο','Whole hospital')}}
 const analysisCompare=previous&&compareOf[compareMode]?{range:previous,departmentId:previousDepartment,...compareOf[compareMode]}:null
 const against=compareMode==='departments'?tx('Διαφορά έναντι όλου του νοσοκομείου','Difference against the whole hospital'):''
 return <Page className="exec-page" title={title} subtitle={hospital}>
  {mainTabs.length+moreTabs.length>1&&<CanonicalTabs className="exec-view-tabs" value={activeTab[0]} onChange={setPageTab} ariaLabel={tx('Ενότητες δεικτών','Indicator sections')} items={mainTabs.map(([id,elLabel,enLabel,icon])=>({value:id,label:en?enLabel:elLabel,icon}))} moreItems={moreTabs.map(([id,elLabel,enLabel,icon])=>({value:id,label:en?enLabel:elLabel,icon}))}/>}
  <div className="exec-filters" role="group" aria-label={tx('Φίλτρα','Filters')}>
   <AnalysisSelect label={tx('Περίοδος','Period')} value={filters.period} onChange={event=>setFilters({period:event.target.value,...(event.target.value==='custom'?{from:range.from,to:range.to}:{})})}>{Object.entries(presetLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</AnalysisSelect>
   {filters.period==='custom'&&<><ManualDateField label={tx('Από','From')} value={range.from} onChange={value=>value&&setFilters({from:value,to:range.to})}/><ManualDateField label={tx('Έως','To')} value={range.to} onChange={value=>value&&setFilters({from:range.from,to:value})}/></>}
   {!isDemo&&<AnalysisSelect label={tx('Τμήμα','Department')} value={department} onChange={event=>setFilters({department:event.target.value})}><option value="">{tx('Όλα τα τμήματα','All departments')}</option>{departments.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</AnalysisSelect>}
   <AnalysisSelect label={tx('Σύγκριση','Comparison')} value={compareMode} onChange={event=>setFilters({compare:event.target.value!=='none'},event.target.value)}><option value="none">{tx('Χωρίς σύγκριση','No comparison')}</option><option value="previous">{tx('Προηγούμενη περίοδος','Previous period')}</option>{!isDemo&&<option value="departments" disabled={!department}>{tx('Τμήμα έναντι νοσοκομείου','Department vs hospital')}</option>}</AnalysisSelect>
   <p className="exec-period"><b>{kpiPeriod}</b>{periodLabel}{previous&&<span>{tx('έναντι','vs')} {previousLabel}</span>}</p>
   <ExportMenu disabled={activeTab[0]==='summary'&&loadingAny} pdfBusy={exportingPdf} onPrint={print} onPdf={exportPdf}/>
  </div>
  {activeTab[0]!=='summary'?<section ref={reportRef} className="exec-analysis-report" aria-label={tabTitle}>{activeSections.map(id=><AnalysisPage key={`${id}:${compareMode}`} embedded externalRange={range} periodLabel={kpiPeriod} initialTab={id} department={department} externalCompare={analysisCompare}/>)}</section>:<section ref={reportRef} className="exec-report">
   <header className="exec-report-head"><div><strong>{reportLines[0]}</strong><span>{reportLines.slice(1).join(' · ')}</span></div>{isDemo&&<span className="status-badge temporary">{tx('ΔΕΔΟΜΕΝΑ DEMO','DEMO DATA')}</span>}</header>
   <KpiStrip className="exec-kpis" label={tx('Βασικοί δείκτες','Key measures')}>{kpis.map(item=>{const parts=kpiParts(item);return <KpiCard key={item.id} label={tx(...item.label)} period={kpiPeriod} value={item.value==null?null:formatValue(item.value,'',en)} unit={item.unit} status={item.value==null?null:item.tone} hint={tx(...item.hint)} delta={deltaOf(item,tx,en,against)} loading={parts.some(part=>!part||part.status==='loading')} error={parts.some(part=>part?.status==='error')} onOpen={openAnalysis(item.tab)}/>})}</KpiStrip>
   <Card className="exec-card exec-attention">
    <CardHeader icon={TriangleAlert} title={tx('Τι χρειάζεται προσοχή','What needs attention')} subtitle={tx('Δείκτες εκτός στόχου και εκκρεμότητες, οι σοβαρότεροι πρώτοι.','Measures off target and open items, the most serious first.')}/>
    {loadingAny&&!flags.length?<Skeleton lines={3}/>:flags.length?<><ul className="exec-flags">{shownFlags.map(flag=>{const open=openFlag(flag.tab);const Icon=flag.severity==='danger'?AlertOctagon:AlertTriangle;const content=<><Icon size={16} aria-hidden="true"/><span><strong>{tx(...flag.text)}</strong>{flag.detail&&<small>{tx(...flag.detail)}</small>}</span><em>{flag.severity==='danger'?tx('Άμεσα','Urgent'):tx('Παρακολούθηση','Monitor')}</em>{open&&<ArrowRight size={15} aria-hidden="true"/>}</>;return <li key={flag.id} className={`exec-flag-${flag.severity}`}>{open?<button type="button" onClick={open}>{content}</button>:<div>{content}</div>}</li>})}</ul>{flags.length>FLAGS_FOLDED&&<button type="button" className="text-button exec-flags-more" data-pdf-ignore="" aria-expanded={allFlags} onClick={()=>setAllFlags(v=>!v)}>{allFlags?tx('Λιγότερα','Show fewer'):tx(`Όλα (${flags.length})`,`All (${flags.length})`)}{allFlags?<ChevronUp size={14} aria-hidden="true"/>:<ChevronDown size={14} aria-hidden="true"/>}</button>}</>:failedAny?<div className="inline-empty">{tx('Κάποιες ενότητες δεν φορτώθηκαν· η εικόνα είναι ελλιπής.','Some sections did not load; the picture is incomplete.')}</div>:<div className="inline-empty">{tx('Όλοι οι δείκτες είναι εντός στόχου για την περίοδο.','Every measure is on target for the period.')}</div>}
   </Card>
   <div className="exec-grid">
    {on('surveillance','laboratory')&&<SectionCard id="infections" icon={FlaskConical} title={tx('Λοιμώξεις & Μικροβιολογία','Infections & microbiology')} subtitle={tx('Θετικές καλλιέργειες ανά μήνα.','Positive cultures by month.')} {...partState(['domains','microbiology'])} onOpen={openAnalysis(on('surveillance')?'surveillance':'laboratory')} tx={tx} {...cardProps('infections')} figures={<Figures rows={[[tx('Επεισόδια επιτήρησης','Surveillance episodes'),formatValue(s.total,'',en)],[tx('Επιβεβαιωμένες ΛΣΦΥ','Confirmed HAI'),formatValue(s.haiConfirmed,'',en),s.haiConfirmed?'warning':''],[tx('Θετικές καλλιέργειες','Positive cultures'),formatValue(micro.totalPositive,'',en)],[tx('Κρίσιμα αποτελέσματα','Critical results'),formatValue(micro.totalCritical,'',en),micro.totalCritical?'warning':''],[tx('Ενεργές συρροές','Active clusters'),formatValue(snapshot.clusters.length,'',en),snapshot.clusters.length?'danger':'']]}/>}>
     <TrendChart points={cultureTrend} en={en} label={tx('Θετικές καλλιέργειες ανά μήνα','Positive cultures by month')}/>
     <h3 className="exec-subtitle">{tx('Συχνότεροι μικροοργανισμοί','Most frequent organisms')}</h3>
     <BarList rows={micro.microorganisms} en={en} max={5}/>
    </SectionCard>}
    {on('prevention')&&<SectionCard id="prevention" icon={ShieldCheck} title={tx('Πρόληψη','Prevention')} subtitle={tx('Υγιεινή χεριών ανά μήνα (%) και δέσμες μέτρων.','Hand hygiene by month (%) and care bundles.')} {...partState(['domains'])} onOpen={openAnalysis('prevention')} tx={tx} {...cardProps('prevention')} figures={<Figures rows={[[tx('Υγιεινή χεριών','Hand hygiene'),formatValue(pct(hh.compliant,hh.observations),'%',en)],[tx('Ευκαιρίες','Opportunities'),formatValue(hh.observations,'',en)],[tx('Δέσμες μέτρων','Bundles'),formatValue(b.averageScore,'%',en)],[tx('Αξιολογήσεις','Assessments'),formatValue(b.assessments,'',en)]]}/>}>
     <TrendChart points={handTrend} en={en} label={tx('Υγιεινή χεριών ανά μήνα (%)','Hand hygiene by month (%)')}/>
     <h3 className="exec-subtitle">{tx('Συμμόρφωση ανά δέσμη','Compliance by bundle')}</h3>
     <BarList rows={(b.byBundle||[]).filter(([,,score])=>score!=null).map(([key,,score])=>[key,score])} en={en} max={5} scale={100} suffix="%"/>
    </SectionCard>}
    {on('controls')&&<SectionCard id="controls" icon={ClipboardCheck} title={tx('Έλεγχοι','Controls')} subtitle={tx('Κατάταξη τμημάτων με βάση το ποσοστό ευρημάτων.','Departments ranked by finding rate.')} {...partState(['domains'])} onOpen={openAnalysis('controls')} tx={tx} {...cardProps('controls')} figures={<Figures rows={[[tx('Εκτελέσεις','Executions'),formatValue(c.executions,'',en)],[tx('Ολοκληρωμένες','Completed'),formatValue(pct(c.completed,c.executions),'%',en)],[tx('Με εύρημα','With finding'),formatValue(c.withFinding,'',en),c.withFinding?'warning':''],[tx('Εκπρόθεσμοι','Overdue'),formatValue(c.overdueAssignments,'',en),c.overdueAssignments?'danger':'']]}/>}>
     <div className="exec-ranks"><RankList title={tx('Λιγότερα ευρήματα','Fewest findings')} rows={ranking.best} tx={tx} en={en}/><RankList title={tx('Περισσότερα ευρήματα','Most findings')} rows={ranking.worst} tx={tx} en={en}/></div>
    </SectionCard>}
    {on('quality')&&<SectionCard id="quality" icon={BriefcaseMedical} title={tx('Ποιότητα','Quality')} subtitle={tx('Συμβάντα ανά σοβαρότητα και διορθωτικές ενέργειες.','Incidents by severity and corrective actions.')} {...partState(['domains'])} onOpen={openAnalysis('quality')} tx={tx} {...cardProps('quality')} figures={<Figures rows={[[tx('Συμβάντα περιόδου','Incidents in period'),formatValue(q.incidents,'',en)],[tx('Ανοιχτά','Open'),formatValue(q.openIncidents,'',en),q.openIncidents?'warning':''],[tx('Με βλάβη','With harm'),formatValue(q.harm,'',en),q.harm?'danger':''],[tx('Ανοιχτές διορθωτικές','Open CAPA'),formatValue(q.capaOpen,'',en)],[tx('Εκπρόθεσμες διορθωτικές','Overdue CAPA'),formatValue(q.capaOverdue,'',en),q.capaOverdue?'danger':'']]}/>}>
     <DonutChart rows={severityRows} en={en} centerLabel={tx('συμβάντα','incidents')}/>
    </SectionCard>}
    <SectionCard id="people" icon={GraduationCap} title={tx('Ανθρώπινο δυναμικό & εκπαίδευση','Workforce & training')} subtitle={tx('Τμήματα με τη χαμηλότερη ολοκλήρωση εκπαίδευσης (%).','Departments with the lowest training completion (%).')} {...partState(['people'])} onOpen={on('training')?openAnalysis('training'):undefined} tx={tx} {...cardProps('people')} figures={<Figures rows={[[tx('Ενεργοί εργαζόμενοι','Active employees'),formatValue(w.activeEmployees,'',en)],on('training')&&[tx('Αναθέσεις εκπαίδευσης','Training assignments'),formatValue(t.assignments,'',en)],on('training')&&[tx('Ολοκλήρωση','Completion'),formatValue(pct(t.completed,t.assignments),'%',en)],on('training')&&[tx('Εκπρόθεσμες','Overdue'),formatValue(t.overdue,'',en),t.overdue?'warning':'']]}/>}>
     {on('training')&&<BarList rows={trainingByDepartment} en={en} max={6} scale={100} suffix="%"/>}
    </SectionCard>
    {on('kitchen','suppliers')&&<SectionCard id="food" icon={ChefHat} title={tx('Ασφάλεια τροφίμων','Food safety')} subtitle={tx('Κουζίνα (HACCP) και πιστοποιητικά προμηθευτών.','Kitchen (HACCP) and supplier certificates.')} {...partState(['qualityFood'])} onOpen={on('quality')?openAnalysis('qualityfood'):undefined} tx={tx} {...cardProps('food')} figures={<Figures rows={[on('suppliers')&&[tx('Ληγμένα πιστοποιητικά','Expired certificates'),formatValue(f.certificatesExpired,'',en),f.certificatesExpired?'danger':''],on('suppliers')&&[tx('Λήγουν σε 30 ημέρες','Expire within 30 days'),formatValue(f.certificatesExpiring,'',en),f.certificatesExpiring?'warning':''],on('suppliers')&&[tx('Ενεργοί προμηθευτές','Active suppliers'),formatValue(f.suppliersActive,'',en)],on('kitchen')&&[tx('Θερμικές μετρήσεις εκτός ορίων','Thermal checks out of limits'),`${formatValue(f.thermalOut,'',en)} / ${formatValue(f.thermalMeasured,'',en)}`,f.thermalOut?'warning':''],on('kitchen')&&[tx('Παραλαβές εκτός ορίων','Receipts out of limits'),`${formatValue(f.receiptsOut,'',en)} / ${formatValue(f.receipts,'',en)}`,f.receiptsOut?'warning':''],on('kitchen')&&[tx('Ημέρες παραγωγής επαληθευμένες','Production days verified'),formatValue(pct(f.productionDaysVerified,f.productionDays),'%',en)]]}/>}>
    </SectionCard>}
    {on('governance')&&<SectionCard id="governance" icon={BookOpen} title={tx('Διακυβέρνηση','Governance')} subtitle={tx('Επιτροπές, αποφάσεις και ελεγχόμενα έγγραφα.','Committees, decisions and controlled documents.')} {...partState(['people','governance'])} onOpen={openAnalysis('governance')} tx={tx} {...cardProps('governance')} figures={<Figures rows={[[tx('Ενεργές επιτροπές','Active committees'),formatValue(g.committees,'',en)],[tx('Συνεδριάσεις περιόδου','Meetings in period'),formatValue(g.meetings,'',en)],[tx('Πρακτικά σε εκκρεμότητα','Minutes pending'),formatValue(g.minutesPending,'',en),g.minutesPending?'warning':''],[tx('Ανοιχτές αποφάσεις','Open decisions'),formatValue(governance?.openDecisions,'',en)],[tx('Εκπρόθεσμες αποφάσεις','Overdue decisions'),formatValue(governance?.overdueDecisions,'',en),governance?.overdueDecisions?'danger':''],[tx('Έγγραφα σε ισχύ','Documents in force'),formatValue(g.published,'',en)],[tx('Εκπρόθεσμη αναθεώρηση εγγράφων','Documents past review'),formatValue(g.reviewOverdue,'',en),g.reviewOverdue?'warning':'']]}/>}>
    </SectionCard>}
   </div>
   <p className="exec-footnote"><Activity size={13} aria-hidden="true"/>{isDemo?tx('Συνθετικά δεδομένα αποκλειστικά για το Demo περιβάλλον.','Synthetic data for the Demo environment only.'):tx('Πραγματικά δεδομένα του νοσοκομείου· οι εκκρεμότητες (εκπρόθεσμα, ληγμένα, ανοιχτές αποφάσεις) αφορούν τη σημερινή κατάσταση.','Live hospital data; open items (overdue, expired, open decisions) reflect the state today.')}</p>
  </section>}
 </Page>
}
