import { useEffect,useMemo,useRef,useState } from 'react'
import { useLocation,useNavigate } from 'react-router-dom'
import { Activity,AlertOctagon,AlertTriangle,ArrowDownRight,ArrowRight,ArrowUpRight,BookOpen,BriefcaseMedical,ChefHat,CheckCircle2,ClipboardCheck,FlaskConical,GraduationCap,Minus,ShieldCheck,TriangleAlert } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Card,CardHeader } from '../../design-system/Card'
import { ExportMenu } from '../../design-system/ExportMenu'
import { ManualDateField } from '../../design-system/ManualDateField'
import { CheckboxField } from '../../design-system/CheckboxField'
import { printElement } from '../../design-system/printElement'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES,can } from '../../core/permissions/roles'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import { exportElementAsPdf } from '../../core/export/pdfReportExport'
import { AnalysisSelect } from '../analysis/AnalysisPanels'
import { BarList,DonutChart,TrendChart } from '../analysis/AnalysisCharts'
import { continuousMonths,fmtDate } from '../analysis/analysisPageModel'
import { collectAnalysisDemoSnapshot } from '../analysis/analysisDemoSnapshot'
import { collectDemoDomainMetrics } from '../analysis/analysisDomains'
import { loadCommittees } from '../committees/committeeData'
import { controlRanking,executiveKpis,filtersToQuery,monthlyRate,parseFilters,pct,periodRange,previousRange,redFlags,visibleFor,withDeltas } from './executiveModel'
import { loadExecutiveParts,loadGovernanceStatus } from './executiveService'
import './executive.css'

const PART_KEYS=['domains','people','qualityFood','microbiology','clusters','governance']
const SEVERITY_LABELS={critical:['Κρίσιμη','Critical'],high:['Υψηλή','High'],medium:['Μέτρια','Medium'],low:['Χαμηλή','Low']}
const TONES={good:[CheckCircle2,'Εντός στόχου','On target'],warning:[AlertTriangle,'Προσοχή','Watch'],danger:[AlertOctagon,'Εκτός στόχου','Off target']}
// Detail screen of each Analysis tab for a viewer who has it; otherwise the Analysis tab itself.
const MODULE_SCREENS={surveillance:['/surveillance',CAPABILITIES.VIEW_SURVEILLANCE],laboratory:['/laboratory',CAPABILITIES.VIEW_LAB],prevention:['/prevention',CAPABILITIES.VIEW_PREVENTION],controls:['/controls',CAPABILITIES.VIEW_CONTROLS],quality:['/quality',CAPABILITIES.VIEW_QUALITY],qualityfood:['/quality',CAPABILITIES.VIEW_QUALITY],training:['/training',CAPABILITIES.VIEW_TRAINING],governance:['/committees',CAPABILITIES.VIEW_COMMITTEES]}

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

function DeltaBadge({item,tx,en}){
 const d=item.delta
 if(!d)return null
 const Icon=d.trend==='up'?ArrowUpRight:d.trend==='down'?ArrowDownRight:Minus
 const sign=d.diff>0?'+':''
 // Rates change in percentage points; counts by their relative change (or the difference, from zero).
 const amount=item.unit==='%'?`${sign}${formatValue(d.diff,'',en)} ${tx('μον.','pts')}`:d.change!=null?`${sign}${formatValue(d.change,'%',en)}`:`${sign}${formatValue(d.diff,'',en)}`
 return <span className={`exec-delta ${d.good==null?'flat':d.good?'better':'worse'}`} title={tx('Μεταβολή έναντι της προηγούμενης περιόδου','Change against the previous period')}><Icon size={13} aria-hidden="true"/>{amount}<em>{d.good==null?tx('σταθερό','unchanged'):d.good?tx('βελτίωση','better'):tx('επιδείνωση','worse')}</em></span>
}
function KpiTile({item,loading,error,tx,en,onOpen}){
 const [Icon,el,enLabel]=TONES[item.tone]||[]
 const body=<><span className="exec-kpi-label">{tx(...item.label)}</span>{loading?<Skeleton lines={2}/>:error?<small className="exec-kpi-error">{tx('Δεν φορτώθηκε','Not loaded')}</small>:<><strong>{formatValue(item.value,item.unit,en)}</strong>{Icon&&item.value!=null&&<span className={`exec-status exec-status-${item.tone}`}><Icon size={13} aria-hidden="true"/>{en?enLabel:el}</span>}<small>{tx(...item.hint)}</small><DeltaBadge item={item} tx={tx} en={en}/></>}</>
 return onOpen?<button type="button" className={`exec-kpi exec-tone-${loading||error?'neutral':item.tone}`} onClick={onOpen}>{body}</button>:<article className={`exec-kpi exec-tone-${loading||error?'neutral':item.tone}`}>{body}</article>
}
function Figures({rows}){return <dl className="exec-figures">{rows.filter(Boolean).map(([label,value,tone])=><div key={label} className={tone?`exec-figure-${tone}`:''}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
function SectionCard({id,icon,title,subtitle,loading,error,onOpen,tx,children}){
 return <Card className="exec-card" id={`exec-${id}`}>
  <CardHeader icon={icon} title={title} subtitle={subtitle} actions={onOpen&&<button type="button" className="text-button exec-open" data-pdf-ignore="" onClick={onOpen}>{tx('Αναλυτικά','Details')}<ArrowRight size={14} aria-hidden="true"/></button>}/>
  {loading?<Skeleton lines={5}/>:error?<div className="inline-empty">{tx('Δεν ήταν δυνατή η φόρτωση αυτής της ενότητας.','This section could not be loaded.')}</div>:children}
 </Card>
}
function RankList({title,rows,tx,en}){return <div className="exec-rank"><strong>{title}</strong>{rows.length?<ol>{rows.map(row=><li key={row.name}><span>{row.name}</span><b>{formatValue(row.rate,'%',en)}</b><small>{tx(`${row.findings}/${row.executions} με εύρημα`,`${row.findings}/${row.executions} with finding`)}</small></li>)}</ol>:<p className="inline-empty">{tx('Δεν υπάρχουν αρκετές εκτελέσεις.','Not enough executions.')}</p>}</div>}

export function ExecutiveDashboardPage(){
 const {tenant,role,membership,isDemo:contextIsDemo,moduleEnabled}=useTenant()
 const isDemo=contextIsDemo||isOwnerPreview()
 const {language}=useLanguage();const en=language==='en';const tx=(elText,enText)=>en?enText:elText
 const {notifyError}=useFeedback()
 const location=useLocation();const navigate=useNavigate()
 const reportRef=useRef(null);const [exportingPdf,setExportingPdf]=useState(false)
 const filters=useMemo(()=>parseFilters(location.search),[location.search])
 const setFilters=patch=>navigate({pathname:location.pathname,search:filtersToQuery({...filters,...patch})},{replace:true})
 const range=useMemo(()=>periodRange(filters),[filters])
 const previous=useMemo(()=>filters.compare?previousRange(range,filters.period):null,[filters.compare,filters.period,range])
 const organizationId=tenant?.id||''
 const department=isDemo?'':filters.department
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
  const parts=loadExecutiveParts({organizationId,...previous,departmentId:department})
  return {domains:parts.domains,people:parts.people,qualityFood:parts.qualityFood,microbiology:parts.microbiology}
 },[isDemo,organizationId,previous,department,en])
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
 const returnTo=`${location.pathname}${location.search}`
 const openAnalysis=tab=>userCan(CAPABILITIES.VIEW_ANALYSIS)?()=>navigate(`/analysis?tab=${tab}`,{state:{returnTo}}):undefined
 const openFlag=tab=>{const [path,capability]=MODULE_SCREENS[tab]||[];if(path&&userCan(capability))return()=>navigate(path);return openAnalysis(tab)}
 const on=(...modules)=>modules.some(module=>moduleEnabled(module))
 const d=snapshot.domains,s=d.surveillance||{},hh=d.handHygiene||{},b=d.bundles||{},c=d.controls||{},q=d.quality||{},t=d.training||{},w=d.workforce||{},g=d.governance||{},f=d.qualityFood||{},micro=snapshot.microbiology||{}
 const ranking=useMemo(()=>controlRanking(c.byDepartment),[c.byDepartment])
 const periodLabel=`${fmtDate(range.from)} – ${fmtDate(range.to)}`
 const previousLabel=previous?`${fmtDate(previous.from)} – ${fmtDate(previous.to)}`:''
 const presetLabels={month:tx('Τρέχων μήνας','This month'),'3m':tx('Τελευταίοι 3 μήνες','Last 3 months'),'6m':tx('Τελευταίοι 6 μήνες','Last 6 months'),'12m':tx('Τελευταίοι 12 μήνες','Last 12 months'),year:tx('Τρέχον έτος','This year'),custom:tx('Άλλο διάστημα','Custom range')}
 const hospital=tenant?.name||tx('Νοσοκομείο','Hospital')
 const generated=new Date().toLocaleString(en?'en-GB':'el-GR',{dateStyle:'short',timeStyle:'short'})
 const reportLines=[hospital,`${tx('Περίοδος','Period')}: ${periodLabel} (${presetLabels[filters.period]})`,`${tx('Τμήμα','Department')}: ${departmentName}${previous?` · ${tx('σύγκριση με','compared with')} ${previousLabel}`:''}`,`${tx('Δημιουργήθηκε','Generated')}: ${generated}`]
 const title=tx('Πίνακας Διοίκησης','Executive dashboard')
 function print(){if(!printElement(reportRef.current,{title:`${title} · ${hospital}`}))notifyError(new Error('POPUP_BLOCKED'),'export',{operation:'executive_print'})}
 function exportPdf(){
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
 return <Page className="exec-page" title={title} subtitle={hospital} actions={<ExportMenu disabled={loadingAny} pdfBusy={exportingPdf} onPrint={print} onPdf={exportPdf}/>}>
  <div className="exec-filters surface" role="group" aria-label={tx('Φίλτρα','Filters')}>
   <AnalysisSelect label={tx('Περίοδος','Period')} value={filters.period} onChange={event=>setFilters({period:event.target.value,...(event.target.value==='custom'?{from:range.from,to:range.to}:{})})}>{Object.entries(presetLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</AnalysisSelect>
   {filters.period==='custom'&&<><ManualDateField label={tx('Από','From')} value={range.from} onChange={value=>value&&setFilters({from:value,to:range.to})}/><ManualDateField label={tx('Έως','To')} value={range.to} onChange={value=>value&&setFilters({from:range.from,to:value})}/></>}
   {!isDemo&&<AnalysisSelect label={tx('Τμήμα','Department')} value={department} onChange={event=>setFilters({department:event.target.value})}><option value="">{tx('Όλα τα τμήματα','All departments')}</option>{departments.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</AnalysisSelect>}
   <CheckboxField label={tx('Σύγκριση με την προηγούμενη περίοδο','Compare with the previous period')} checked={filters.compare} onChange={value=>setFilters({compare:value})}/>
   <p className="exec-period">{periodLabel}{previous&&<span>{tx('έναντι','vs')} {previousLabel}</span>}</p>
  </div>
  <section ref={reportRef} className="exec-report">
   <header className="exec-report-head"><div><strong>{reportLines[0]}</strong><span>{reportLines.slice(1).join(' · ')}</span></div>{isDemo&&<span className="status-badge temporary">{tx('ΔΕΔΟΜΕΝΑ DEMO','DEMO DATA')}</span>}</header>
   <div className="exec-kpis">{kpis.map(item=>{const parts=kpiParts(item);return <KpiTile key={item.id} item={item} loading={parts.some(part=>!part||part.status==='loading')} error={parts.some(part=>part?.status==='error')} tx={tx} en={en} onOpen={openAnalysis(item.tab)}/>})}</div>
   <Card className="exec-card exec-attention">
    <CardHeader icon={TriangleAlert} title={tx('Τι χρειάζεται προσοχή','What needs attention')} subtitle={tx('Δείκτες εκτός στόχου και εκκρεμότητες, οι σοβαρότεροι πρώτοι.','Measures off target and open items, the most serious first.')}/>
    {loadingAny&&!flags.length?<Skeleton lines={3}/>:flags.length?<ul className="exec-flags">{flags.map(flag=>{const open=openFlag(flag.tab);const Icon=flag.severity==='danger'?AlertOctagon:AlertTriangle;const content=<><Icon size={16} aria-hidden="true"/><span><strong>{tx(...flag.text)}</strong>{flag.detail&&<small>{tx(...flag.detail)}</small>}</span><em>{flag.severity==='danger'?tx('Άμεσα','Urgent'):tx('Παρακολούθηση','Monitor')}</em>{open&&<ArrowRight size={15} aria-hidden="true"/>}</>;return <li key={flag.id} className={`exec-flag-${flag.severity}`}>{open?<button type="button" onClick={open}>{content}</button>:<div>{content}</div>}</li>})}</ul>:failedAny?<div className="inline-empty">{tx('Κάποιες ενότητες δεν φορτώθηκαν· η εικόνα είναι ελλιπής.','Some sections did not load; the picture is incomplete.')}</div>:<div className="inline-empty">{tx('Όλοι οι δείκτες είναι εντός στόχου για την περίοδο.','Every measure is on target for the period.')}</div>}
   </Card>
   <div className="exec-grid">
    {on('surveillance','laboratory')&&<SectionCard id="infections" icon={FlaskConical} title={tx('Λοιμώξεις & Μικροβιολογία','Infections & microbiology')} subtitle={tx('Θετικές καλλιέργειες ανά μήνα.','Positive cultures by month.')} {...partState(['domains','microbiology'])} onOpen={openAnalysis(on('surveillance')?'surveillance':'laboratory')} tx={tx}>
     <Figures rows={[[tx('Επεισόδια επιτήρησης','Surveillance episodes'),formatValue(s.total,'',en)],[tx('Επιβεβαιωμένες HAI','Confirmed HAI'),formatValue(s.haiConfirmed,'',en),s.haiConfirmed?'warning':''],[tx('Θετικές καλλιέργειες','Positive cultures'),formatValue(micro.totalPositive,'',en)],[tx('Κρίσιμα αποτελέσματα','Critical results'),formatValue(micro.totalCritical,'',en),micro.totalCritical?'warning':''],[tx('Ενεργές συρροές','Active clusters'),formatValue(snapshot.clusters.length,'',en),snapshot.clusters.length?'danger':'']]}/>
     <TrendChart points={cultureTrend} en={en} label={tx('Θετικές καλλιέργειες ανά μήνα','Positive cultures by month')}/>
     <h3 className="exec-subtitle">{tx('Συχνότεροι μικροοργανισμοί','Most frequent organisms')}</h3>
     <BarList rows={micro.microorganisms} en={en} max={5}/>
    </SectionCard>}
    {on('prevention')&&<SectionCard id="prevention" icon={ShieldCheck} title={tx('Πρόληψη','Prevention')} subtitle={tx('Υγιεινή χεριών ανά μήνα (%) και δέσμες μέτρων.','Hand hygiene by month (%) and care bundles.')} {...partState(['domains'])} onOpen={openAnalysis('prevention')} tx={tx}>
     <Figures rows={[[tx('Υγιεινή χεριών','Hand hygiene'),formatValue(pct(hh.compliant,hh.observations),'%',en)],[tx('Ευκαιρίες','Opportunities'),formatValue(hh.observations,'',en)],[tx('Δέσμες μέτρων','Bundles'),formatValue(b.averageScore,'%',en)],[tx('Αξιολογήσεις','Assessments'),formatValue(b.assessments,'',en)]]}/>
     <TrendChart points={handTrend} en={en} label={tx('Υγιεινή χεριών ανά μήνα (%)','Hand hygiene by month (%)')}/>
     <h3 className="exec-subtitle">{tx('Συμμόρφωση ανά δέσμη','Compliance by bundle')}</h3>
     <BarList rows={(b.byBundle||[]).filter(([,,score])=>score!=null).map(([key,,score])=>[key,score])} en={en} max={5} scale={100} suffix="%"/>
    </SectionCard>}
    {on('controls')&&<SectionCard id="controls" icon={ClipboardCheck} title={tx('Έλεγχοι','Controls')} subtitle={tx('Κατάταξη τμημάτων με βάση το ποσοστό ευρημάτων.','Departments ranked by finding rate.')} {...partState(['domains'])} onOpen={openAnalysis('controls')} tx={tx}>
     <Figures rows={[[tx('Εκτελέσεις','Executions'),formatValue(c.executions,'',en)],[tx('Ολοκληρωμένες','Completed'),formatValue(pct(c.completed,c.executions),'%',en)],[tx('Με εύρημα','With finding'),formatValue(c.withFinding,'',en),c.withFinding?'warning':''],[tx('Εκπρόθεσμοι','Overdue'),formatValue(c.overdueAssignments,'',en),c.overdueAssignments?'danger':'']]}/>
     <div className="exec-ranks"><RankList title={tx('Λιγότερα ευρήματα','Fewest findings')} rows={ranking.best} tx={tx} en={en}/><RankList title={tx('Περισσότερα ευρήματα','Most findings')} rows={ranking.worst} tx={tx} en={en}/></div>
    </SectionCard>}
    {on('quality')&&<SectionCard id="quality" icon={BriefcaseMedical} title={tx('Ποιότητα','Quality')} subtitle={tx('Συμβάντα ανά σοβαρότητα και διορθωτικές ενέργειες.','Incidents by severity and corrective actions.')} {...partState(['domains'])} onOpen={openAnalysis('quality')} tx={tx}>
     <Figures rows={[[tx('Συμβάντα περιόδου','Incidents in period'),formatValue(q.incidents,'',en)],[tx('Ανοιχτά','Open'),formatValue(q.openIncidents,'',en),q.openIncidents?'warning':''],[tx('Με βλάβη','With harm'),formatValue(q.harm,'',en),q.harm?'danger':''],[tx('Ανοιχτές διορθωτικές','Open CAPA'),formatValue(q.capaOpen,'',en)],[tx('Εκπρόθεσμες διορθωτικές','Overdue CAPA'),formatValue(q.capaOverdue,'',en),q.capaOverdue?'danger':'']]}/>
     <DonutChart rows={severityRows} en={en} centerLabel={tx('συμβάντα','incidents')}/>
    </SectionCard>}
    <SectionCard id="people" icon={GraduationCap} title={tx('Ανθρώπινο δυναμικό & εκπαίδευση','Workforce & training')} subtitle={tx('Τμήματα με τη χαμηλότερη ολοκλήρωση εκπαίδευσης (%).','Departments with the lowest training completion (%).')} {...partState(['people'])} onOpen={on('training')?openAnalysis('training'):undefined} tx={tx}>
     <Figures rows={[[tx('Ενεργοί εργαζόμενοι','Active employees'),formatValue(w.activeEmployees,'',en)],on('training')&&[tx('Αναθέσεις εκπαίδευσης','Training assignments'),formatValue(t.assignments,'',en)],on('training')&&[tx('Ολοκλήρωση','Completion'),formatValue(pct(t.completed,t.assignments),'%',en)],on('training')&&[tx('Εκπρόθεσμες','Overdue'),formatValue(t.overdue,'',en),t.overdue?'warning':'']]}/>
     {on('training')&&<BarList rows={trainingByDepartment} en={en} max={6} scale={100} suffix="%"/>}
    </SectionCard>
    {on('kitchen','suppliers')&&<SectionCard id="food" icon={ChefHat} title={tx('Ασφάλεια τροφίμων','Food safety')} subtitle={tx('Κουζίνα (HACCP) και πιστοποιητικά προμηθευτών.','Kitchen (HACCP) and supplier certificates.')} {...partState(['qualityFood'])} onOpen={on('quality')?openAnalysis('qualityfood'):undefined} tx={tx}>
     <Figures rows={[on('suppliers')&&[tx('Ληγμένα πιστοποιητικά','Expired certificates'),formatValue(f.certificatesExpired,'',en),f.certificatesExpired?'danger':''],on('suppliers')&&[tx('Λήγουν σε 30 ημέρες','Expire within 30 days'),formatValue(f.certificatesExpiring,'',en),f.certificatesExpiring?'warning':''],on('suppliers')&&[tx('Ενεργοί προμηθευτές','Active suppliers'),formatValue(f.suppliersActive,'',en)],on('kitchen')&&[tx('Θερμικές μετρήσεις εκτός ορίων','Thermal checks out of limits'),`${formatValue(f.thermalOut,'',en)} / ${formatValue(f.thermalMeasured,'',en)}`,f.thermalOut?'warning':''],on('kitchen')&&[tx('Παραλαβές εκτός ορίων','Receipts out of limits'),`${formatValue(f.receiptsOut,'',en)} / ${formatValue(f.receipts,'',en)}`,f.receiptsOut?'warning':''],on('kitchen')&&[tx('Ημέρες παραγωγής επαληθευμένες','Production days verified'),formatValue(pct(f.productionDaysVerified,f.productionDays),'%',en)]]}/>
    </SectionCard>}
    {on('governance')&&<SectionCard id="governance" icon={BookOpen} title={tx('Διακυβέρνηση','Governance')} subtitle={tx('Επιτροπές, αποφάσεις και ελεγχόμενα έγγραφα.','Committees, decisions and controlled documents.')} {...partState(['people','governance'])} onOpen={openAnalysis('governance')} tx={tx}>
     <Figures rows={[[tx('Ενεργές επιτροπές','Active committees'),formatValue(g.committees,'',en)],[tx('Συνεδριάσεις περιόδου','Meetings in period'),formatValue(g.meetings,'',en)],[tx('Πρακτικά σε εκκρεμότητα','Minutes pending'),formatValue(g.minutesPending,'',en),g.minutesPending?'warning':''],[tx('Ανοιχτές αποφάσεις','Open decisions'),formatValue(governance?.openDecisions,'',en)],[tx('Εκπρόθεσμες αποφάσεις','Overdue decisions'),formatValue(governance?.overdueDecisions,'',en),governance?.overdueDecisions?'danger':''],[tx('Έγγραφα σε ισχύ','Documents in force'),formatValue(g.published,'',en)],[tx('Εκπρόθεσμη αναθεώρηση εγγράφων','Documents past review'),formatValue(g.reviewOverdue,'',en),g.reviewOverdue?'warning':'']]}/>
    </SectionCard>}
   </div>
   <p className="exec-footnote"><Activity size={13} aria-hidden="true"/>{isDemo?tx('Συνθετικά δεδομένα αποκλειστικά για το Demo περιβάλλον.','Synthetic data for the Demo environment only.'):tx('Πραγματικά δεδομένα του νοσοκομείου· οι εκκρεμότητες (εκπρόθεσμα, ληγμένα, ανοιχτές αποφάσεις) αφορούν τη σημερινή κατάσταση.','Live hospital data; open items (overdue, expired, open decisions) reflect the state today.')}</p>
  </section>
 </Page>
}
