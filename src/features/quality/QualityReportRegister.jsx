import { useEffect,useMemo,useState } from 'react'
import { KpiFigures } from '../../design-system/KpiCard'
import { AlertOctagon,AlertTriangle,CalendarClock,Clock3,SearchCheck,FileWarning,Plus,MessageSquareWarning,Lightbulb,Stethoscope,Wrench,GraduationCap,ClipboardCheck,ShieldCheck } from 'lucide-react'
import { ActionButton } from '../../design-system/ActionButton'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { useSortedPaging,withSort } from './useSortedPaging'
import { StatusBadge } from '../../design-system/StatusBadge'
import { formatDay } from '../../core/i18n/formatDay'
import { useTenant } from '../../core/tenant/TenantContext'
import { loadControlProgramme } from '../controls/controlCloudService'
import { loadBundleAssessments } from '../prevention/bundleCloudService'
import { loadTrainingProgramsAsync } from '../training/trainingService'
import { loadQualityRecords } from './qualityService'
import { capaPrefill,deviationQueue } from './qualityDeviations'
import { REGISTER_SOURCES,filterRegister,registerCounts,registerRows } from './qualityRegister'
import { INCIDENT_STAGES } from './qualityRecordRules'
import { daysUntil } from './QualityGlance'
import { FINDING_SOURCES,REPORT_KINDS,incidentCategoryLabel,vocabularyLabel } from './qualityVocabulary'
import { roleTitleText } from '../../core/i18n/roleTitles'

// The Quality Center separates three concepts:
// - Reports: neutral staff submissions waiting for Quality to classify.
// - Incidents: reports already classified as clinical/non-clinical, complaint
//   or improvement suggestion and followed through the incident workflow.
// - Deviations: the governed quality_findings register, plus a small queue of
//   automatic signals from controls/bundles/training waiting for review.

const PERIODS=[30,90,365]
const KIND_ICON={report:FileWarning,clinical:Stethoscope,nonClinical:Wrench,complaint:MessageSquareWarning,suggestion:Lightbulb}
const SOURCE_ICON={manual:FileWarning,audit:ClipboardCheck,incident:AlertOctagon,control:ClipboardCheck,bundle:ShieldCheck,training:GraduationCap,other:FileWarning}
const DEVIATION_SOURCES=[...FINDING_SOURCES,...REGISTER_SOURCES.filter(item=>['bundle','training'].includes(item.value))]

export const STAGE_LABELS={
 toAssess:['Προς αξιολόγηση','To assess'],
 investigating:['Σε διερεύνηση','Investigating'],
 action:['Ενέργεια σε εξέλιξη','Action in progress'],
 effectiveness:['Έλεγχος αποτελεσματικότητας','Effectiveness check'],
 toClose:['Προς κλείσιμο','Ready to close'],
 closed:['Κλειστή','Closed'],
 voided:['Ακυρωμένη','Voided'],
}
export const stageLabel=(stage,language)=>STAGE_LABELS[stage]?.[language==='en'?1:0]||stage
const STAGE_TONE={toAssess:'warning',investigating:'info',action:'info',effectiveness:'info',toClose:'success',closed:'neutral',voided:'neutral'}

export function StageTrack({stage,language}){
 const reached=stage==='closed'?5:INCIDENT_STAGES.indexOf(stage)+1
 return <span className="quality-stage">
  {stage!=='closed'&&stage!=='voided'&&<span className="quality-stage-track" aria-hidden="true">{[1,2,3,4,5].map(step=><i key={step} className={step<reached?'is-done':step===reached?'is-current':''}/>)}</span>}
  <StatusBadge tone={STAGE_TONE[stage]||'neutral'}>{stageLabel(stage,language)}</StatusBadge>
 </span>
}

// Automatic signals that may need a deviation/CAPA. They are not themselves
// the deviation register and therefore no longer define the tab count.
export function useDeviationQueue(organizationId,enabled=true){
 const [sources,setSources]=useState({controls:[],bundles:[],trainings:[],capas:[]})
 const [loading,setLoading]=useState(enabled)
 useEffect(()=>{
  if(!enabled){setLoading(false);return}
  let active=true
  setLoading(true)
  const safe=promise=>promise.catch(()=>[])
  Promise.all([safe(loadControlProgramme(organizationId,{summary:false,findingsSince:Date.now()-365*24*60*60*1000})),safe(loadBundleAssessments(organizationId)),safe(loadTrainingProgramsAsync(organizationId)),safe(loadQualityRecords('capas',organizationId))])
   .then(([controls,bundles,trainings,capas])=>{if(active)setSources({controls,bundles,trainings,capas})})
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[organizationId,enabled])
 return {sources,loading}
}

const REPORT_DEFAULTS={query:'',kind:'all',stage:'all',department:'all',category:'all',quick:null,period:'all',origin:'all'}
const DEVIATION_DEFAULTS={query:'',scope:'registry',source:'all',department:'all',priority:'all',status:'all',quick:null}
const departmentsOf=(rows,language)=>[...new Set(rows.map(row=>language==='en'?row.departmentEn:row.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el'))

function useClassifiedRegister(incidents,capas,language,mode){
 const [filters,setFilters]=useState(REPORT_DEFAULTS)
 const set=(key,value)=>setFilters(current=>({...current,[key]:value}))
 const rows=useMemo(()=>registerRows(incidents,[],capas).filter(row=>mode==='reports'?row.kind==='report':row.kind!=='report'),[incidents,capas,mode])
 const filtered=useMemo(()=>filterRegister(rows,{...filters,language}),[rows,filters,language])
 const counts=useMemo(()=>registerCounts(rows),[rows])
 const departments=useMemo(()=>departmentsOf(rows,language),[rows,language])
 const categories=useMemo(()=>[...new Set(rows.map(row=>row.category).filter(Boolean))],[rows])
 return {rows,filtered,counts,filters,set,clear:()=>setFilters(REPORT_DEFAULTS),departments,categories}
}

// Inbox: only neutral submissions that Quality has not classified yet.
export function useReportRegister(incidents,capas,language){
 return useClassifiedRegister(incidents,capas,language,'reports')
}

// Classified quality incidents/complaints/suggestions live here after assessment.
export function useIncidentRegister(incidents,capas,language){
 return useClassifiedRegister(incidents,capas,language,'incidents')
}

function findingRows(findings,capas){
 const handled=new Set((capas||[]).filter(item=>item.sourceId).map(item=>item.sourceId))
 return (findings||[]).map(record=>({
  key:`finding:${record.id}`,
  type:'finding',
  source:record.source||'manual',
  id:record.id,
  code:record.displayId||record.id,
  title:record.title,
  titleEn:record.titleEn||record.title,
  department:record.department||'',
  departmentEn:record.departmentEn||record.department||'',
  date:record.date||'',
  owner:(record.owners?.length?record.owners:[record.owner].filter(Boolean)).join(', '),
  status:record.status||'open',
  severity:record.severity||'medium',
  hasCapa:handled.has(record.id),
  item:record,
 }))
}

// Real findings are the register. Automatic deviations are an additional
// review queue, visible via the scope filter but not counted as existing
// findings until Quality turns them into a governed record.
export function useDeviations(sources,language){
 const {tenant}=useTenant()
 const [days,setDays]=useState(90)
 const [filters,setFilters]=useState(DEVIATION_DEFAULTS)
 const [findings,setFindings]=useState([])
 const [loading,setLoading]=useState(true)
 const set=(key,value)=>setFilters(current=>({...current,[key]:value}))
 useEffect(()=>{
  let active=true
  if(!tenant?.id){setFindings([]);setLoading(false);return()=>{active=false}}
  setLoading(true)
  loadQualityRecords('findings',tenant.id).then(rows=>{if(active)setFindings(rows)}).catch(()=>{if(active)setFindings([])}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[tenant?.id])
 const registry=useMemo(()=>findingRows(findings,sources?.capas||[]),[findings,sources?.capas])
 const pending=useMemo(()=>registerRows([],deviationQueue({...sources,days})),[sources,days])
 const rows=useMemo(()=>[...registry,...pending].sort((a,b)=>String(b.date).localeCompare(String(a.date))),[registry,pending])
 const filtered=useMemo(()=>{
  const text=filters.query.trim().toLowerCase()
  return rows
   .filter(row=>filters.scope==='all'||(filters.scope==='registry'?row.type==='finding':row.type==='deviation'))
   .filter(row=>!text||`${row.code} ${row.title} ${row.titleEn} ${row.owner||''} ${row.department||''}`.toLowerCase().includes(text))
   .filter(row=>filters.source==='all'||row.source===filters.source)
   .filter(row=>filters.status==='all'||(row.type==='finding'&&row.status===filters.status))
   .filter(row=>filters.priority==='all'||row.severity===filters.priority)
   .filter(row=>filters.department==='all'||(language==='en'?row.departmentEn:row.department)===filters.department)
   .filter(row=>!filters.quick||(filters.quick==='withoutCapa'?row.type==='finding'&&row.status!=='closed'&&!row.hasCapa:true))
 },[rows,filters,language])
 const counts=useMemo(()=>({
  total:registry.length,
  pending:pending.length,
  open:registry.filter(row=>row.status==='open').length,
  inProgress:registry.filter(row=>row.status==='inProgress').length,
  closed:registry.filter(row=>row.status==='closed').length,
  withoutCapa:registry.filter(row=>row.status!=='closed'&&!row.hasCapa).length,
  high:registry.filter(row=>row.severity==='high'||row.severity==='critical').length,
  ...Object.fromEntries(['control','bundle','training'].map(source=>[source,pending.filter(row=>row.source===source).length])),
 }),[registry,pending])
 const departments=useMemo(()=>departmentsOf(rows,language),[rows,language])
 return {rows,registry,pending,filtered,counts,filters,set,clear:()=>{setFilters(DEVIATION_DEFAULTS);setDays(90)},days,setDays,departments,loading}
}

const kindText=(kind,language)=>vocabularyLabel(REPORT_KINDS,kind,language)
const findingSourceText=(source,language)=>vocabularyLabel(DEVIATION_SOURCES,source,language)||source

export function reportRegisterExport(rows,{language,t,categories}){
 const en=language==='en'
 return {
  name:en?'reports':'anafores',
  headers:en?['Code','Date','Classification','Category','Title','Department','Responsible','Stage','Status','Sentinel']:['Κωδικός','Ημερομηνία','Ταξινόμηση','Κατηγορία','Τίτλος','Τμήμα','Υπεύθυνος','Στάδιο','Κατάσταση','Sentinel'],
  rows:rows.map(row=>[row.code,row.date,kindText(row.kind,language),incidentCategoryLabel(row.category,categories,language),en?row.titleEn:row.title,en?row.departmentEn:row.department,row.owner,stageLabel(row.stage,language),t(row.status),row.sentinel?(en?'Yes':'Ναι'):'']),
 }
}

export function deviationsExport(rows,{language,t}){
 const en=language==='en'
 return {
  name:en?'deviations':'apokliseis',
  headers:en?['Code','Date','Source','Title','Department','Status','Priority','Responsible']:['Κωδικός','Ημερομηνία','Πηγή','Τίτλος','Τμήμα','Κατάσταση','Προτεραιότητα','Υπεύθυνος'],
  rows:rows.map(row=>[row.code,row.date,findingSourceText(row.source,language),en?row.titleEn:row.title,en?row.departmentEn:row.department,row.type==='finding'?t(row.status):(en?'To assess':'Προς αξιολόγηση'),t(row.severity),row.owner||'']),
 }
}


function ageText(row,language){
 const days=-daysUntil(row.date)
 if(row.stage==='closed'||!Number.isFinite(days)||days<0)return ''
 return language==='en'?`${days} ${days===1?'day':'days'} open`:`${days} ${days===1?'ημέρα':'ημέρες'} ανοιχτή`
}

const WAITING_DAYS=7
const waitingDays=row=>{const days=-daysUntil(row.date);return row.stage==='closed'||row.stage==='voided'||!Number.isFinite(days)?null:Math.max(0,days)}
const PERIOD_DAYS={today:0,'7d':7,'30d':30}
const SEVERITY_RANK={critical:4,high:3,medium:2,low:1}
// Open records first (sentinel events, then the more severe, then the newest), closed ones after.
const openFirst=(a,b)=>{
 const closed=row=>row.stage==='closed'||row.stage==='voided'?1:0
 return closed(a)-closed(b)||(b.sentinel?1:0)-(a.sentinel?1:0)||(SEVERITY_RANK[b.severity]||0)-(SEVERITY_RANK[a.severity]||0)||String(b.date).localeCompare(String(a.date))
}

// The line above a register, outside its card (as in Controls): what waits, in figures that filter the list.
export function ReportSummary({view,loading,language,inbox=false}){
 const en=language==='en'
 const {filters,set}=view
 const quick=filters.quick
 const stageCount=view.counts.stages
 const waits=inbox?view.rows.map(waitingDays).filter(days=>days!=null):[]
 const longWaiting=waits.filter(days=>days>=WAITING_DAYS).length,oldest=waits.length?Math.max(...waits):0
 const dayWord=count=>en?(count===1?'day':'days'):(count===1?'ημέρα':'ημέρες')
 const toggle=key=>()=>set('quick',quick===key?null:key)
 if(inbox)return <KpiFigures className="quality-kpis" label={en?'Reports':'Αναφορές'} loading={loading} figures={[
  {key:'toAssess',icon:Clock3,value:waits.length,label:en?'To assess':'Προς αξιολόγηση',tone:'warning',active:!quick,go:()=>view.clear()},
  {key:'waiting',icon:AlertTriangle,value:longWaiting,label:en?`Waiting over ${WAITING_DAYS} days`:`Αναμένουν πάνω από ${WAITING_DAYS} ημέρες`,status:longWaiting?'danger':'good',target:en?'target: 0':'στόχος: 0',active:quick==='waiting',go:toggle('waiting')},
  {key:'oldest',icon:CalendarClock,value:waits.length?oldest:null,unit:dayWord(oldest),label:en?'Oldest waiting':'Παλαιότερη αναμονή',status:waits.length?(oldest>WAITING_DAYS?'danger':'good'):null,target:en?`target ≤ ${WAITING_DAYS} days`:`στόχος ≤ ${WAITING_DAYS} ημέρες`},
 ]}/>
 // The open stages (closed ones are a filter), then the sentinel events.
 const stageIcons={toAssess:Clock3,investigating:SearchCheck,action:Wrench,effectiveness:ShieldCheck,toClose:ClipboardCheck}
 const open=INCIDENT_STAGES.filter(stage=>stage!=='closed'&&stageCount?.[stage])
 return <KpiFigures className="quality-kpis" label={en?'Incidents':'Συμβάντα'} loading={loading} figures={[
  ...open.slice(0,3).map(stage=>({key:stage,icon:stageIcons[stage],value:stageCount[stage],label:stageLabel(stage,language),active:quick===stage,go:toggle(stage)})),
  {key:'sentinel',icon:AlertOctagon,value:view.counts.sentinel,label:en?'Sentinel events':'Συμβάντα-φρουροί',status:view.counts.sentinel?'danger':'good',target:en?'target: 0':'στόχος: 0',active:quick==='sentinel',go:toggle('sentinel')},
 ]}/>
}

// The inbox (`inbox`): staff reports Quality has not classified yet, as one
// summary line and the usual filter popover instead of boxes and extra columns.
export function ReportRegister({view,loading,language,t,categories,registry,onOpenReport,inbox=false,compact=false}){
 const en=language==='en'
 const {filters,set}=view
 const quick=inbox?filters.quick:null
 const items=useMemo(()=>inbox?view.filtered.filter(row=>{
  const age=-daysUntil(row.date),days=waitingDays(row)
  return (!quick||(days!=null&&(quick==='waiting'?days>=WAITING_DAYS:quick==='new'?days<WAITING_DAYS:true)))
   &&(filters.period==='all'||(Number.isFinite(age)&&age<=PERIOD_DAYS[filters.period]))
   &&(filters.origin==='all'||(filters.origin==='anonymous')===Boolean(row.anonymous))
 }):compact?[...view.filtered].sort(openFirst):view.filtered,[view.filtered,inbox,compact,quick,filters.period,filters.origin])
 const sortBy={code:row=>row.code,title:row=>(en?row.titleEn:row.title),kind:row=>row.kind,department:row=>(en?row.departmentEn:row.department),date:row=>row.date,stage:row=>row.stage,owner:row=>row.owner,reporter:row=>(row.anonymous?'':row.reporter)}
 const paging=useSortedPaging(items,JSON.stringify(filters),sortBy)
 const inboxFilters=(quick==='waiting'||quick==='new'?1:0)+(filters.period!=='all')+(filters.origin!=='all')+(filters.department!=='all')
 const advanced=inbox?inboxFilters:['kind','stage','department','category'].filter(key=>filters[key]!=='all').length
 const columns=inbox
  ?[{key:'code',label:t('code')},{key:'title',label:t('title')},{key:'department',label:t('department')},{key:'date',label:t('date')},{key:'stage',label:en?'Status':'Κατάσταση'},{key:'reporter',label:en?'Reported by':'Αναφέρων'}]
  :compact
   ?[{key:'code',label:t('code')},{key:'title',label:t('title')},{key:'kind',label:en?'Kind':'Είδος'},{key:'department',label:t('department')},{key:'date',label:t('date')},{key:'stage',label:en?'Status':'Κατάσταση'},{key:'owner',label:t('owner')}]
   :null
 const inboxSelects=<>
   <FilterSelect label={en?'Period':'Περίοδος'} value={filters.period} onChange={value=>set('period',value)}><option value="all">{en?'All':'Όλες'}</option><option value="today">{en?'Today':'Σήμερα'}</option><option value="7d">{en?'Last 7 days':'Τελευταίες 7 ημέρες'}</option><option value="30d">{en?'Last 30 days':'Τελευταίες 30 ημέρες'}</option></FilterSelect>
   <FilterSelect label={en?'Wait':'Αναμονή'} value={quick==='waiting'||quick==='new'?quick:'all'} onChange={value=>set('quick',value==='all'?null:value)}><option value="all">{en?'All':'Όλες'}</option><option value="waiting">{en?`Over ${WAITING_DAYS} days`:`Πάνω από ${WAITING_DAYS} ημέρες`}</option><option value="new">{en?'New':'Νέες'}</option></FilterSelect>
   <FilterSelect label={en?'Reported by':'Αναφέρων'} value={filters.origin} onChange={value=>set('origin',value)}><option value="all">{en?'All':'Όλοι'}</option><option value="named">{en?'Named':'Ονομαστικές'}</option><option value="anonymous">{en?'Anonymous':'Ανώνυμες'}</option></FilterSelect>
   <FilterSelect label={t('department')} value={filters.department} onChange={value=>set('department',value)}><option value="all">{t('allDepartments')}</option>{view.departments.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>
  </>
 const popover=inbox?inboxSelects:<>
   <FilterSelect label={en?'Classification':'Ταξινόμηση'} value={filters.kind} onChange={value=>set('kind',value)}><option value="all">{en?'All':'Όλες'}</option>{REPORT_KINDS.map(item=><option key={item.value} value={item.value}>{item.label[en?1:0]}</option>)}</FilterSelect>
   <FilterSelect label={en?'Stage':'Στάδιο'} value={filters.stage} onChange={value=>set('stage',value)}><option value="all">{en?'All':'Όλα'}</option>{INCIDENT_STAGES.map(id=><option key={id} value={id}>{stageLabel(id,language)}</option>)}</FilterSelect>
   <FilterSelect label={en?'Category':'Κατηγορία'} value={filters.category} onChange={value=>set('category',value)}><option value="all">{en?'All':'Όλες'}</option>{view.categories.map(value=><option key={value} value={value}>{incidentCategoryLabel(value,categories,language)}</option>)}</FilterSelect>
   <FilterSelect label={t('department')} value={filters.department} onChange={value=>set('department',value)}><option value="all">{t('allDepartments')}</option>{view.departments.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>
  </>
 return <>
  <FilterBar query={filters.query} onQueryChange={value=>set('query',value)} placeholder={inbox?(en?'Search code, title, department, reporter…':'Αναζήτηση σε κωδικό, τίτλο, τμήμα, αναφέροντα…'):(en?'Search…':'Αναζήτηση…')} activeAdvancedCount={advanced} onClear={view.clear}>
   {popover}
  </FilterBar>
  <div className="scroll-table" ref={registry?.scrollRef}>
   <RegistryTable sort={paging.sort} onSort={paging.onSort} bare className="quality-table quality-register-table" rows={paging.rows} rowKey={row=>row.key} empty={!loading&&!items.length} emptyFiltered={view.rows.length>0} onClearFilters={view.clear}
    columns={withSort(columns||[{key:'code',label:t('code')},{key:'title',label:t('title')},{key:'kind',label:en?'Classification':'Ταξινόμηση'},{key:'department',label:t('department')},{key:'date',label:t('date')},{key:'stage',label:en?'Stage':'Στάδιο'},{key:'owner',label:t('owner')}],sortBy)}
    emptyTitle={en?'No records':'Δεν υπάρχουν εγγραφές'} emptyText={en?'Reports appear in the inbox first; after Quality classifies them they move to the incident register.':'Οι νέες αναφορές εμφανίζονται πρώτα στο inbox· μετά την ταξινόμηση από την Ποιότητα μεταφέρονται στο μητρώο Συμβάντων.'}
    rowProps={row=>({...(registry?.rowProps(row.id)||{}),className:`${registry?.rowProps(row.id)?.className||''}${row.sentinel&&row.stage!=='closed'?' quality-row-sentinel':''}`.trim(),onClick:()=>onOpenReport(row,paging.sorted)})}
    renderRow={row=>{const Icon=KIND_ICON[row.kind]||FileWarning;return <>
     <td><strong>{row.code}</strong>{row.sentinel?<StatusBadge tone="danger" icon={AlertOctagon}>Sentinel</StatusBadge>:row.severity&&<small>{t(row.severity)}</small>}</td>
     <td>{en?row.titleEn:row.title}{row.category&&row.kind!=='report'&&<small>{incidentCategoryLabel(row.category,categories,language)}</small>}</td>
     {!inbox&&<td><span className="quality-register-kind"><Icon size={14} aria-hidden="true"/>{kindText(row.kind,language)}</span></td>}
     <td>{(en?row.departmentEn:row.department)||'—'}</td>
     <td className="nowrap-cell">{formatDay(row.date,language)||'—'}{ageText(row,language)&&<small>{ageText(row,language)}</small>}</td>
     <td>{inbox?<StatusBadge tone={STAGE_TONE[row.stage]||'neutral'}>{stageLabel(row.stage,language)}</StatusBadge>:<StageTrack stage={row.stage} language={language}/>}</td>
     <td>{inbox?(row.anonymous?(en?'Anonymous':'Ανώνυμη'):row.reporter||'—'):roleTitleText(row.owner,language)||'—'}</td>
    </>}}/>
  </div>
  {items.length>0&&<RegistryPagination language={language} {...paging.props}/>}
 </>
}

export function DeviationSummary({view,language}){
 const en=language==='en'
 const {filters,set}=view
 const counts=view.counts
 const pendingView=filters.scope==='pending'
 const showRegistry=extra=>{set('scope','registry');set('quick',null);set('status','all');Object.entries(extra).forEach(([key,value])=>set(key,value))}
 return <KpiFigures className="quality-kpis" label={en?'Deviations':'Αποκλίσεις'} loading={view.loading} figures={[
  {key:'all',icon:FileWarning,value:counts.total,label:en?'Deviations':'Αποκλίσεις',hint:en?`${counts.closed} closed`:`${counts.closed} κλειστές`,active:!pendingView&&filters.status==='all'&&!filters.quick,go:()=>showRegistry({})},
  {key:'progress',icon:Wrench,value:counts.inProgress,label:en?'In progress':'Σε εξέλιξη',active:!pendingView&&filters.status==='inProgress',go:()=>showRegistry({status:filters.status==='inProgress'?'all':'inProgress'})},
  {key:'withoutCapa',icon:AlertOctagon,value:counts.withoutCapa,label:en?'Without corrective action':'Χωρίς διορθωτική ενέργεια',status:counts.withoutCapa?'danger':'good',target:en?'target: 0':'στόχος: 0',active:!pendingView&&filters.quick==='withoutCapa',go:()=>showRegistry({quick:filters.quick==='withoutCapa'?null:'withoutCapa'})},
  {key:'pending',icon:MessageSquareWarning,value:counts.pending,label:en?'Signals to assess':'Σήματα προς αξιολόγηση',tone:'warning',hint:en?'from other modules, e.g. out of limits':'από άλλες ενότητες, π.χ. εκτός ορίων',active:pendingView,go:()=>{set('quick',null);set('status','all');set('scope',pendingView?'registry':'pending')}},
 ]}/>
}

export function DeviationQueue({view,loading,language,t,registry,onOpenRow,onCreateCapa,onCreateFindingCapa}){
 const en=language==='en'
 const {filters,set}=view
 const items=view.filtered
 const severityRank={critical:4,high:3,medium:2,low:1}
 const sortBy={code:row=>row.code,title:row=>(en?row.titleEn:row.title),source:row=>row.source,department:row=>(en?row.departmentEn:row.department),date:row=>row.date,status:row=>row.status,priority:row=>severityRank[row.severity]||0}
 const paging=useSortedPaging(items,`${JSON.stringify(filters)}:${view.days}`,sortBy)
 const advanced=['source','department','priority','status'].filter(key=>filters[key]!=='all').length+(view.days!==90?1:0)
 const statusTone=status=>status==='closed'?'success':status==='inProgress'?'info':'warning'
 const pendingView=filters.scope==='pending'
 const needsAction=row=>row.type==='finding'&&!row.hasCapa&&row.status!=='closed'
 const showActions=pendingView||items.some(needsAction)
 return <>
  <FilterBar query={filters.query} onQueryChange={value=>set('query',value)} placeholder={en?'Search deviations…':'Αναζήτηση αποκλίσεων…'} activeAdvancedCount={advanced} onClear={view.clear}>
   <FilterSelect label={en?'Source':'Πηγή'} value={filters.source} onChange={value=>set('source',value)}><option value="all">{en?'All':'Όλες'}</option>{DEVIATION_SOURCES.map(item=><option key={item.value} value={item.value}>{item.label[en?1:0]}</option>)}</FilterSelect>
   <FilterSelect label={en?'Status':'Κατάσταση'} value={filters.status} onChange={value=>set('status',value)}><option value="all">{en?'All':'Όλες'}</option><option value="open">{en?'Open':'Ανοιχτή'}</option><option value="inProgress">{en?'In progress':'Σε εξέλιξη'}</option><option value="closed">{en?'Closed':'Κλειστή'}</option></FilterSelect>
   <FilterSelect label={t('priority')} value={filters.priority} onChange={value=>set('priority',value)}><option value="all">{t('all')}</option>{['critical','high','medium','low'].map(value=><option key={value} value={value}>{t(value)}</option>)}</FilterSelect>
   <FilterSelect label={t('department')} value={filters.department} onChange={value=>set('department',value)}><option value="all">{t('allDepartments')}</option>{view.departments.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>
   {pendingView&&<FilterSelect label={en?'Pending period':'Περίοδος νέων'} value={String(view.days)} onChange={value=>view.setDays(Number(value))}>{PERIODS.map(value=><option key={value} value={value}>{en?`Last ${value} days`:`Τελευταίες ${value} ημέρες`}</option>)}</FilterSelect>}
  </FilterBar>
  <div className="scroll-table" ref={registry?.scrollRef}>
   <RegistryTable sort={paging.sort} onSort={paging.onSort} bare className="quality-table quality-register-table quality-deviation-table" rows={paging.rows} rowKey={row=>row.key} empty={!(loading||view.loading)&&!items.length} emptyFiltered={view.rows.length>0} onClearFilters={view.clear}
    columns={withSort([{key:'code',label:t('code')},{key:'title',label:t('title')},{key:'source',label:en?'Source':'Πηγή'},{key:'department',label:t('department')},{key:'date',label:t('date')},{key:'status',label:t('status')},{key:'priority',label:t('priority')},...(showActions?[{key:'actions',label:''}]:[])],sortBy)}
    emptyTitle={en?'No deviations':'Δεν υπάρχουν αποκλίσεις'} emptyText={en?'The register contains governed findings/deviations. Automatic signals stay in “Signals from other modules” until Quality reviews them.':'Το μητρώο περιέχει τις επίσημες αποκλίσεις/ευρήματα. Οι αυτόματες ενδείξεις παραμένουν στα «Σήματα από άλλες ενότητες» μέχρι να τις εξετάσει η Ποιότητα.'}
    rowProps={row=>({...(registry?.rowProps(row.type==='finding'?row.id:row.key)||{}),onClick:()=>onOpenRow(row,paging.sorted)})}
    renderRow={row=>{const Icon=SOURCE_ICON[row.source]||FileWarning;return <>
     <td><strong>{row.code}</strong></td>
     <td>{en?row.titleEn:row.title}{row.type==='finding'&&!row.hasCapa&&row.status!=='closed'&&<small>{en?'No corrective action linked':'Χωρίς συνδεδεμένη διορθωτική ενέργεια'}</small>}{row.type==='deviation'&&row.item.notes&&<small>{row.item.notes}</small>}</td>
     <td><span className="quality-register-kind"><Icon size={14} aria-hidden="true"/>{findingSourceText(row.source,language)}</span></td>
     <td>{(en?row.departmentEn:row.department)||'—'}</td>
     <td className="nowrap-cell">{formatDay(row.date,language)||'—'}</td>
     <td>{row.type==='finding'?<StatusBadge tone={statusTone(row.status)}>{t(row.status)}</StatusBadge>:<StatusBadge tone="warning">{en?'To assess':'Προς αξιολόγηση'}</StatusBadge>}</td>
     <td><StatusBadge tone={row.severity==='critical'?'danger':row.severity==='high'?'warning':'neutral'}>{t(row.severity)}</StatusBadge></td>
     {showActions&&<td><div className="row-actions quality-register-actions" onClick={event=>event.stopPropagation()}>
      {row.type==='deviation'&&<ActionButton tone="neutral" label={en?'Create corrective action':'Δημιουργία διορθωτικής ενέργειας'} onClick={()=>onCreateCapa(capaPrefill(row.item,language))}><Plus size={15}/><span>{en?'Action':'Ενέργεια'}</span></ActionButton>}
      {needsAction(row)&&<ActionButton tone="neutral" label={en?'Create corrective action':'Δημιουργία διορθωτικής ενέργειας'} onClick={()=>onCreateFindingCapa(row.item)}><Plus size={15}/><span>{en?'Action':'Ενέργεια'}</span></ActionButton>}
     </div></td>}
    </>}}/>
  </div>
  {items.length>0&&<RegistryPagination language={language} {...paging.props}/>}
 </>
}
