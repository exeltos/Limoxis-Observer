import { useEffect,useMemo,useState } from 'react'
import { AlertOctagon,FileWarning,Plus,MessageSquareWarning,Lightbulb,Stethoscope,Wrench,GraduationCap,ClipboardCheck,ShieldCheck } from 'lucide-react'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { FilterBar,FilterDate,FilterSelect } from '../../design-system/FilterBar'
import { RegistryTotals } from '../../design-system/RegistryTotals'
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
import { CAUSE_CATEGORIES,DEVIATION_KINDS,FINDING_SOURCES,REPORT_KINDS,causeCategoriesText,incidentCategoryLabel,vocabularyLabel } from './qualityVocabulary'
import { roleTitleText } from '../../core/i18n/roleTitles'
import type { RefObject } from 'react'
import type { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import type { CategoryItem, DeviationFilters, DeviationSources, QualityRecord, RegisterRow, ReportFilters, ReportRow } from './qualityTypes'
import type { IconType } from '../../design-system/types'

// The Quality Center separates three concepts:
// - Reports: neutral staff submissions waiting for Quality to classify.
// - Incidents: reports already classified as clinical/non-clinical, complaint
//   or improvement suggestion and followed through the incident workflow.
// - Deviations: the governed quality_findings register, plus a small queue of
//   automatic signals from controls/bundles/training waiting for review.

const PERIODS=[30,90,365]
const KIND_ICON: Record<string, IconType>={report:FileWarning,clinical:Stethoscope,nonClinical:Wrench,complaint:MessageSquareWarning,suggestion:Lightbulb}
const SOURCE_ICON: Record<string, IconType>={manual:FileWarning,audit:ClipboardCheck,incident:AlertOctagon,control:ClipboardCheck,bundle:ShieldCheck,training:GraduationCap,other:FileWarning}
const DEVIATION_SOURCES=[...FINDING_SOURCES,...REGISTER_SOURCES.filter(item=>['bundle','training'].includes(item.value))]

export const STAGE_LABELS: Record<string, string[]>={
 toAssess:['Προς αξιολόγηση','To assess'],
 investigating:['Σε διερεύνηση','Investigating'],
 action:['Ενέργεια σε εξέλιξη','Action in progress'],
 effectiveness:['Έλεγχος αποτελεσματικότητας','Effectiveness check'],
 toClose:['Προς κλείσιμο','Ready to close'],
 closed:['Κλειστή','Closed'],
 voided:['Ακυρωμένη','Voided'],
}
export const stageLabel=(stage: string | undefined,language: string)=>STAGE_LABELS[stage as string]?.[language==='en'?1:0]||stage
const STAGE_TONE: Record<string, string>={toAssess:'warning',investigating:'info',action:'info',effectiveness:'info',toClose:'success',closed:'neutral',voided:'neutral'}

export function StageTrack({stage,language}: { stage: string, language: string }){
 const reached=stage==='closed'?5:INCIDENT_STAGES.indexOf(stage)+1
 return <span className="quality-stage">
  {stage!=='closed'&&stage!=='voided'&&<span className="quality-stage-track" aria-hidden="true">{[1,2,3,4,5].map(step=><i key={step} className={step<reached?'is-done':step===reached?'is-current':''}/>)}</span>}
  <StatusBadge tone={STAGE_TONE[stage]||'neutral'}>{stageLabel(stage,language)}</StatusBadge>
 </span>
}

// Automatic signals that may need a deviation/CAPA. They are not themselves
// the deviation register and therefore no longer define the tab count.
export function useDeviationQueue(organizationId: string | null | undefined,enabled=true){
 const [sources,setSources]=useState<DeviationSources>({controls:[],bundles:[],trainings:[],capas:[]})
 const [loading,setLoading]=useState(enabled)
 useEffect(()=>{
  if(!enabled){setLoading(false);return}
  let active=true
  setLoading(true)
  const safe=(promise: Promise<unknown[]>)=>promise.catch(()=>[])
  Promise.all([safe(loadControlProgramme(organizationId,{summary:false,findingsSince:Date.now()-365*24*60*60*1000})),safe(loadBundleAssessments(organizationId)),safe(loadTrainingProgramsAsync(organizationId as string)),safe(loadQualityRecords('capas',organizationId))])
   .then(([controls,bundles,trainings,capas])=>{if(active)setSources({controls,bundles,trainings,capas} as DeviationSources)})
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[organizationId,enabled])
 return {sources,loading}
}

const REPORT_DEFAULTS={query:'',kind:'all',stage:'all',department:'all',category:'all',quick:null,period:'all',origin:'all',dateFrom:'',dateTo:''}
const DEVIATION_DEFAULTS={query:'',scope:'registry',source:'all',department:'all',priority:'all',status:'all',deviationKind:'all',cause:'all',recurring:'all',dateFrom:'',dateTo:'',quick:null}
const departmentsOf=(rows: RegisterRow[],language: string)=>[...new Set(rows.map((row: RegisterRow)=>language==='en'?row.departmentEn:row.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el'))

function useClassifiedRegister(incidents: QualityRecord[],capas: QualityRecord[],language: string,mode: string){
 const [filters,setFilters]=useState<ReportFilters>(REPORT_DEFAULTS)
 const set=(key: string,value: string | null)=>setFilters((current: ReportFilters)=>({...current,[key]:value}))
 const rows=useMemo(()=>registerRows(incidents,[],capas).filter((row): row is ReportRow=>mode==='reports'?row.kind==='report':row.kind!=='report'),[incidents,capas,mode])
 // «Από / Έως» on the incident date; `base` is the list without the quick figure, for the totals beside the search.
 const inRange=(row: RegisterRow)=>{const day=String(row.date||'').slice(0,10);return (!filters.dateFrom||day>=filters.dateFrom)&&(!filters.dateTo||day<=filters.dateTo)}
 const base=useMemo(()=>filterRegister(rows,{...filters,quick:null,language}).filter(inRange),[rows,filters,language]) // eslint-disable-line react-hooks/exhaustive-deps
 const filtered=useMemo(()=>filterRegister(rows,{...filters,language}).filter(inRange),[rows,filters,language]) // eslint-disable-line react-hooks/exhaustive-deps
 const counts=useMemo(()=>registerCounts(rows),[rows])
 const departments=useMemo(()=>departmentsOf(rows,language),[rows,language])
 const categories=useMemo(()=>[...new Set(rows.map(row=>row.category).filter(Boolean))] as string[],[rows])
 return {rows,base,filtered,counts,filters,set,clear:()=>setFilters(REPORT_DEFAULTS),departments,categories}
}

// Inbox: only neutral submissions that Quality has not classified yet.
export function useReportRegister(incidents: QualityRecord[],capas: QualityRecord[],language: string){
 return useClassifiedRegister(incidents,capas,language,'reports')
}

// Classified quality incidents/complaints/suggestions live here after assessment.
export function useIncidentRegister(incidents: QualityRecord[],capas: QualityRecord[],language: string){
 return useClassifiedRegister(incidents,capas,language,'incidents')
}

function findingRows(findings: QualityRecord[],capas: QualityRecord[]){
 const handled=new Set((capas||[]).filter((item: QualityRecord)=>item.sourceId).map((item: QualityRecord)=>item.sourceId))
 return (findings||[]).map((record: QualityRecord): RegisterRow=>({
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
  hasCapa:handled.has(record.id)||record.correctiveActionNeeded===false,
  noActionNeeded:record.correctiveActionNeeded===false,
  deviationKind:record.deviationKind||'',
  causeCategories:record.causeCategories||[],
  recurring:record.recurring??null,
  item:record,
 }))
}

// The search and the filters of the deviations list (the automatic signals have no kind, causes or recurrence).
export function filterDeviations(rows: RegisterRow[],filters: DeviationFilters,language='el'){
 const text=String(filters.query||'').trim().toLowerCase()
 const day=(row: RegisterRow)=>String(row.date||'').slice(0,10)
 return rows
  .filter((row: RegisterRow)=>filters.scope==='all'||(filters.scope==='registry'?row.type==='finding':row.type==='deviation'))
  .filter((row: RegisterRow)=>!text||`${row.code} ${row.title} ${row.titleEn} ${row.owner||''} ${row.department||''} ${row.item?.reportedBy||''}`.toLowerCase().includes(text))
  .filter((row: RegisterRow)=>filters.source==='all'||row.source===filters.source)
  .filter((row: RegisterRow)=>filters.status==='all'||(row.type==='finding'&&row.status===filters.status))
  .filter((row: RegisterRow)=>filters.priority==='all'||row.severity===filters.priority)
  .filter((row: RegisterRow)=>filters.department==='all'||(language==='en'?row.departmentEn:row.department)===filters.department)
  .filter((row: RegisterRow)=>!filters.deviationKind||filters.deviationKind==='all'||row.deviationKind===filters.deviationKind)
  .filter((row: RegisterRow)=>!filters.cause||filters.cause==='all'||(row.causeCategories||[]).includes(filters.cause))
  .filter((row: RegisterRow)=>!filters.recurring||filters.recurring==='all'||(filters.recurring==='yes'?row.recurring===true:row.recurring===false))
  .filter((row: RegisterRow)=>(!filters.dateFrom||day(row)>=filters.dateFrom)&&(!filters.dateTo||day(row)<=filters.dateTo))
  .filter((row: RegisterRow)=>!filters.quick||(filters.quick==='withoutCapa'?row.type==='finding'&&row.status!=='closed'&&!row.hasCapa:true))
}

// Real findings are the register. Automatic deviations are an additional
// review queue, visible via the scope filter but not counted as existing
// findings until Quality turns them into a governed record.
export function useDeviations(sources: DeviationSources,language: string){
 const {tenant}=useTenant()
 const [days,setDays]=useState(90)
 const [filters,setFilters]=useState<DeviationFilters>(DEVIATION_DEFAULTS)
 const [findings,setFindings]=useState<QualityRecord[]>([])
 const [loading,setLoading]=useState(true)
 const set=(key: string,value: string | null)=>setFilters((current: DeviationFilters)=>({...current,[key]:value}))
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
 // `base` is the list without the status and the quick figure, for the totals beside the search (each one filters).
 const base=useMemo(()=>filterDeviations(rows,{...filters,status:'all',quick:null},language),[rows,filters,language])
 const filtered=useMemo(()=>filterDeviations(rows,filters,language),[rows,filters,language])
 const counts=useMemo(()=>({
  total:registry.length,
  pending:pending.length,
  open:registry.filter((row: RegisterRow)=>row.status==='open').length,
  inProgress:registry.filter((row: RegisterRow)=>row.status==='inProgress').length,
  closed:registry.filter((row: RegisterRow)=>row.status==='closed').length,
  withoutCapa:registry.filter((row: RegisterRow)=>row.status!=='closed'&&!row.hasCapa).length,
  high:registry.filter((row: RegisterRow)=>row.severity==='high'||row.severity==='critical').length,
  ...Object.fromEntries(['control','bundle','training'].map(source=>[source,pending.filter(row=>row.source===source).length])),
 }),[registry,pending])
 const departments=useMemo(()=>departmentsOf(rows,language),[rows,language])
 return {rows,registry,pending,base,filtered,counts,filters,set,clear:()=>{setFilters(DEVIATION_DEFAULTS);setDays(90)},days,setDays,departments,loading}
}

const kindText=(kind: string | undefined,language: string)=>vocabularyLabel(REPORT_KINDS,kind,language)
const findingSourceText=(source: string,language: string)=>vocabularyLabel(DEVIATION_SOURCES,source,language)||source

export function reportRegisterExport(rows: RegisterRow[],{language,t,categories}: {language: string, t: (key: string) => string, categories: CategoryItem[]}){
 const en=language==='en'
 return {
  name:en?'reports':'anafores',
  headers:en?['Code','Date','Classification','Category','Title','Department','Responsible','Stage','Status','Sentinel','Description','People involved','Patient record no.','Room','Causes','Notes']:['Κωδικός','Ημερομηνία','Ταξινόμηση','Κατηγορία','Τίτλος','Τμήμα','Υπεύθυνος','Στάδιο','Κατάσταση','Sentinel','Περιγραφή','Εμπλεκόμενοι','Κωδικός ασθενή','Θάλαμος','Αίτια','Σημειώσεις'],
  rows:rows.map((row: RegisterRow)=>{const r: Partial<QualityRecord>=row.record||{};return [row.code,row.date,kindText(row.kind,language),incidentCategoryLabel(row.category,categories,language),en?row.titleEn:row.title,en?row.departmentEn:row.department,row.owner,stageLabel(row.stage,language),t(row.status),row.sentinel?(en?'Yes':'Ναι'):'',(en?r.descriptionEn:r.description)||'',r.involvedPeople||'',r.patientReference||'',r.room||'',r.rootCause||'',r.notes||'']}),
 }
}

export function deviationsExport(rows: RegisterRow[],{language,t}: {language: string, t: (key: string) => string}){
 const en=language==='en'
 return {
  name:en?'deviations':'apokliseis',
  headers:en?['Code','Date','Kind','Source','Title','Department','Status','Priority','Responsible','Reported by','Recurring','Cause categories','Analysis of the causes','Description']:['Κωδικός','Ημερομηνία','Είδος','Πηγή','Τίτλος','Τμήμα','Κατάσταση','Προτεραιότητα','Υπεύθυνος','Αναφέρθηκε από','Επαναλαμβανόμενη','Κατηγορίες αιτιών','Ανάλυση αιτιών','Περιγραφή'],
  rows:rows.map((row: RegisterRow)=>{const r: Partial<QualityRecord>=row.item||{};return [row.code,row.date,row.deviationKind?vocabularyLabel(DEVIATION_KINDS,row.deviationKind,language):'',findingSourceText(row.source,language),en?row.titleEn:row.title,en?row.departmentEn:row.department,row.type==='finding'?t(row.status):(en?'To assess':'Προς αξιολόγηση'),t(row.severity as string),row.owner||'',r.reportedBy||'',row.recurring==null?'':row.recurring?(en?'Yes':'Ναι'):(en?'No':'Όχι'),causeCategoriesText(row.causeCategories||[],language),r.rootCause||'',(en?r.descriptionEn:r.description)||r.description||'']}),
 }
}


function ageText(row: RegisterRow,language: string){
 const days=-Number(daysUntil(row.date))
 if(row.stage==='closed'||!Number.isFinite(days)||days<0)return ''
 return language==='en'?`${days} ${days===1?'day':'days'} open`:`${days} ${days===1?'ημέρα':'ημέρες'} ανοιχτή`
}

const WAITING_DAYS=7
const waitingDays=(row: RegisterRow)=>{const days=-Number(daysUntil(row.date));return row.stage==='closed'||row.stage==='voided'||!Number.isFinite(days)?null:Math.max(0,days)}
const PERIOD_DAYS: Record<string, number>={today:0,'7d':7,'30d':30}
const SEVERITY_RANK: Record<string, number>={critical:4,high:3,medium:2,low:1}
// Open records first (sentinel events, then the more severe, then the newest), closed ones after.
// Deviations: those still without a corrective action first, then the open ones by priority, closed ones last.
const deviationOrder=(a: RegisterRow,b: RegisterRow)=>{
 const rank=(row: RegisterRow)=>row.type==='finding'&&row.status==='closed'?2:row.type==='finding'&&!row.hasCapa?0:1
 return rank(a)-rank(b)||(SEVERITY_RANK[b.severity as string]||0)-(SEVERITY_RANK[a.severity as string]||0)||String(b.date).localeCompare(String(a.date))
}
const openFirst=(a: RegisterRow,b: RegisterRow)=>{
 const closed=(row: RegisterRow)=>row.stage==='closed'||row.stage==='voided'?1:0
 return closed(a)-closed(b)||(b.sentinel?1:0)-(a.sentinel?1:0)||(SEVERITY_RANK[b.severity as string]||0)-(SEVERITY_RANK[a.severity as string]||0)||String(b.date).localeCompare(String(a.date))
}

// The inbox (`inbox`): staff reports Quality has not classified yet, as one
// summary line and the usual filter popover instead of boxes and extra columns.
export function ReportRegister({view,loading,language,t,categories,registry,onOpenReport,inbox=false,compact=false,totals=false}: { view: ReturnType<typeof useClassifiedRegister>, loading: boolean, language: string, t: (key: string) => string, categories: CategoryItem[], registry: ReturnType<typeof useRegistryMemory>, onOpenReport: (row: RegisterRow, items: RegisterRow[]) => void, inbox?: boolean, compact?: boolean, totals?: boolean }){
 const en=language==='en'
 const {filters,set}=view
 const quick=inbox?filters.quick:null
 const items=useMemo(()=>inbox?view.filtered.filter((row: RegisterRow)=>{
  const age=-Number(daysUntil(row.date)),days=waitingDays(row)
  return (!quick||(days!=null&&(quick==='waiting'?days>=WAITING_DAYS:quick==='new'?days<WAITING_DAYS:true)))
   &&(filters.period==='all'||(Number.isFinite(age)&&age<=PERIOD_DAYS[filters.period]))
   &&(filters.origin==='all'||(filters.origin==='anonymous')===Boolean(row.anonymous))
 }):compact?[...view.filtered].sort(openFirst):view.filtered,[view.filtered,inbox,compact,quick,filters.period,filters.origin])
 const sortBy={code:(row: RegisterRow)=>row.code,title:(row: RegisterRow)=>(en?row.titleEn:row.title),kind:(row: RegisterRow)=>row.kind,department:(row: RegisterRow)=>(en?row.departmentEn:row.department),date:(row: RegisterRow)=>row.date,stage:(row: RegisterRow)=>row.stage,owner:(row: RegisterRow)=>row.owner,reporter:(row: RegisterRow)=>(row.anonymous?'':row.reporter)}
 const paging=useSortedPaging(items,JSON.stringify(filters),sortBy)
 const inboxFilters=(quick==='waiting'||quick==='new'?1:0)+Number(filters.period!=='all')+Number(filters.origin!=='all')+Number(filters.department!=='all')
 const advanced=inbox?inboxFilters:['kind','stage','department','category'].filter(key=>filters[key]!=='all').length+(filters.dateFrom?1:0)+(filters.dateTo?1:0)
 const columns=inbox
  ?[{key:'code',label:t('code')},{key:'title',label:t('title')},{key:'department',label:t('department')},{key:'date',label:t('date')},{key:'stage',label:en?'Status':'Κατάσταση'},{key:'reporter',label:en?'Reported by':'Αναφέρων'}]
  :compact
   ?[{key:'code',label:t('code')},{key:'title',label:t('title')},{key:'kind',label:en?'Kind':'Είδος'},{key:'department',label:t('department')},{key:'date',label:t('date')},{key:'stage',label:en?'Status':'Κατάσταση'},{key:'owner',label:t('owner')}]
   :null
 const inboxSelects=<>
   <FilterSelect label={en?'Period':'Περίοδος'} value={filters.period} onChange={(value: string)=>set('period',value)}><option value="all">{en?'All':'Όλες'}</option><option value="today">{en?'Today':'Σήμερα'}</option><option value="7d">{en?'Last 7 days':'Τελευταίες 7 ημέρες'}</option><option value="30d">{en?'Last 30 days':'Τελευταίες 30 ημέρες'}</option></FilterSelect>
   <FilterSelect label={en?'Wait':'Αναμονή'} value={quick==='waiting'||quick==='new'?quick:'all'} onChange={(value: string)=>set('quick',value==='all'?null:value)}><option value="all">{en?'All':'Όλες'}</option><option value="waiting">{en?`Over ${WAITING_DAYS} days`:`Πάνω από ${WAITING_DAYS} ημέρες`}</option><option value="new">{en?'New':'Νέες'}</option></FilterSelect>
   <FilterSelect label={en?'Reported by':'Αναφέρων'} value={filters.origin} onChange={(value: string)=>set('origin',value)}><option value="all">{en?'All':'Όλοι'}</option><option value="named">{en?'Named':'Ονομαστικές'}</option><option value="anonymous">{en?'Anonymous':'Ανώνυμες'}</option></FilterSelect>
   <FilterSelect label={t('department')} value={filters.department} onChange={(value: string)=>set('department',value)}><option value="all">{t('allDepartments')}</option>{view.departments.map((value: string)=><option key={value} value={value}>{value}</option>)}</FilterSelect>
  </>
 const popover=inbox?inboxSelects:<>
   <FilterSelect label={en?'Classification':'Ταξινόμηση'} value={filters.kind} onChange={(value: string)=>set('kind',value)}><option value="all">{en?'All':'Όλες'}</option>{REPORT_KINDS.map(item=><option key={item.value} value={item.value}>{item.label[en?1:0]}</option>)}</FilterSelect>
   <FilterSelect label={en?'Stage':'Στάδιο'} value={filters.stage} onChange={(value: string)=>set('stage',value)}><option value="all">{en?'All':'Όλα'}</option>{INCIDENT_STAGES.map(id=><option key={id} value={id}>{stageLabel(id,language)}</option>)}</FilterSelect>
   <FilterSelect label={en?'Category':'Κατηγορία'} value={filters.category} onChange={(value: string)=>set('category',value)}><option value="all">{en?'All':'Όλες'}</option>{view.categories.map((value: string)=><option key={value} value={value}>{incidentCategoryLabel(value,categories,language)}</option>)}</FilterSelect>
   <FilterSelect label={t('department')} value={filters.department} onChange={(value: string)=>set('department',value)}><option value="all">{t('allDepartments')}</option>{view.departments.map((value: string)=><option key={value} value={value}>{value}</option>)}</FilterSelect>
   <FilterDate label={en?'From':'Από'} value={filters.dateFrom} onChange={(value: string)=>set('dateFrom',value)}/>
   <FilterDate label={en?'To':'Έως'} value={filters.dateTo} onChange={(value: string)=>set('dateTo',value)}/>
  </>
 // The incident register's totals beside the search: all it shows, the open and the closed ones, the sentinel events.
 const base=view.base||view.filtered
 const toggle=(key: string)=>()=>set('quick',filters.quick===key?null:key)
 const isOpen=(row: RegisterRow)=>!['closed','voided'].includes(row.stage as string)
 // The inbox's totals beside the search (instead of cards above it): what waits, how long the oldest has waited.
 const waits=inbox?view.rows.map(waitingDays).filter((days: number | null)=>days!=null):[]
 const oldest=waits.length?Math.max(...waits):0
 const inboxTotals=inbox&&totals?<RegistryTotals label={en?'Totals':'Σύνολα'} items={[
  {key:'toAssess',always:true,value:waits.length,label:en?'to assess':'προς αξιολόγηση',active:!filters.quick,onClick:()=>view.clear()},
  {key:'waiting',value:waits.filter((days: number)=>days>=WAITING_DAYS).length,label:en?`over ${WAITING_DAYS} days`:`πάνω από ${WAITING_DAYS} ημέρες`,active:filters.quick==='waiting',onClick:toggle('waiting')},
  {key:'oldest',value:oldest,label:en?(oldest===1?'day the oldest':'days the oldest'):(oldest===1?'ημέρα η παλαιότερη':'ημέρες η παλαιότερη')},
 ]}/>:null
 const end=inbox?inboxTotals:totals?<RegistryTotals label={en?'Totals':'Σύνολα'} items={[
  {key:'all',always:true,value:base.length,label:en?'incidents':'συμβάντα',active:!filters.quick,onClick:()=>set('quick',null)},
  {key:'open',value:base.filter(isOpen).length,label:en?'open':'ανοιχτά',active:filters.quick==='open',onClick:toggle('open')},
  {key:'closed',value:base.filter((row: RegisterRow)=>row.stage==='closed').length,label:en?'closed':'κλειστά',active:filters.quick==='closed',onClick:toggle('closed')},
  {key:'sentinel',value:base.filter((row: RegisterRow)=>row.sentinel&&isOpen(row)).length,label:'sentinel',active:filters.quick==='sentinel',onClick:toggle('sentinel')},
 ]}/>:null
 return <>
  <FilterBar query={filters.query} onQueryChange={value=>set('query',value)} placeholder={inbox?(en?'Search code, title, department, reporter…':'Αναζήτηση σε κωδικό, τίτλο, τμήμα, αναφέροντα…'):(en?'Search…':'Αναζήτηση…')} activeAdvancedCount={advanced} onClear={view.clear} end={end}>
   {popover}
  </FilterBar>
  <div className="scroll-table" ref={registry?.scrollRef as RefObject<HTMLDivElement>}>
   <RegistryTable sort={paging.sort} onSort={paging.onSort} bare className="quality-table quality-register-table" rows={paging.rows} rowKey={row=>row.key} empty={!loading&&!items.length} emptyFiltered={view.rows.length>0} onClearFilters={view.clear}
    columns={withSort(columns||[{key:'code',label:t('code')},{key:'title',label:t('title')},{key:'kind',label:en?'Classification':'Ταξινόμηση'},{key:'department',label:t('department')},{key:'date',label:t('date')},{key:'stage',label:en?'Stage':'Στάδιο'},{key:'owner',label:t('owner')}],sortBy)}
    emptyTitle={en?'No records':'Δεν υπάρχουν εγγραφές'} emptyText={en?'Reports appear in the inbox first; after Quality classifies them they move to the incident register.':'Οι νέες αναφορές εμφανίζονται πρώτα στο inbox· μετά την ταξινόμηση από την Ποιότητα μεταφέρονται στο μητρώο Συμβάντων.'}
    rowProps={row=>({...(registry?.rowProps(row.id)||{}),className:`${registry?.rowProps(row.id)?.className||''}${row.sentinel&&row.stage!=='closed'?' quality-row-sentinel':''}`.trim(),onClick:()=>onOpenReport(row,paging.sorted)})}
    renderRow={row=>{const Icon=KIND_ICON[row.kind as string]||FileWarning;return <>
     <td><strong>{row.code}</strong>{row.sentinel?<StatusBadge tone="danger" icon={AlertOctagon}>Sentinel</StatusBadge>:row.severity&&<small>{t(row.severity)}</small>}</td>
     <td>{en?row.titleEn:row.title}{row.category&&row.kind!=='report'&&<small>{incidentCategoryLabel(row.category,categories,language)}</small>}</td>
     {!inbox&&<td><span className="quality-register-kind"><Icon size={14} aria-hidden="true"/>{kindText(row.kind,language)}</span></td>}
     <td>{(en?row.departmentEn:row.department)||'—'}</td>
     <td className="nowrap-cell">{formatDay(row.date,language)||'—'}{ageText(row,language)&&<small>{ageText(row,language)}</small>}</td>
     <td>{inbox?<StatusBadge tone={STAGE_TONE[row.stage as string]||'neutral'}>{stageLabel(row.stage,language)}</StatusBadge>:<StageTrack stage={row.stage as string} language={language}/>}</td>
     <td>{inbox?(row.anonymous?(en?'Anonymous':'Ανώνυμη'):row.reporter||'—'):(roleTitleText(row.owner,language) as string)||'—'}</td>
    </>}}/>
  </div>
  {items.length>0&&<RegistryPagination language={language} {...paging.props}/>}
 </>
}

export function DeviationQueue({view,loading,language,t,registry,onOpenRow,onCreateCapa,onCreateFindingCapa}: { view: ReturnType<typeof useDeviations>, loading: boolean, language: string, t: (key: string) => string, registry: ReturnType<typeof useRegistryMemory>, onOpenRow: (row: RegisterRow, rows: RegisterRow[]) => void, onCreateCapa: (prefill: ReturnType<typeof capaPrefill>) => void, onCreateFindingCapa: (finding: QualityRecord) => void }){
 const en=language==='en'
 const {filters,set}=view
 const items=useMemo(()=>[...view.filtered].sort(deviationOrder),[view.filtered])
 const severityRank: Record<string, number>={critical:4,high:3,medium:2,low:1}
 const sortBy={code:(row: RegisterRow)=>row.code,title:(row: RegisterRow)=>(en?row.titleEn:row.title),source:(row: RegisterRow)=>row.deviationKind?vocabularyLabel(DEVIATION_KINDS,row.deviationKind,language):findingSourceText(row.source,language),department:(row: RegisterRow)=>(en?row.departmentEn:row.department),date:(row: RegisterRow)=>row.date,status:(row: RegisterRow)=>row.status,priority:(row: RegisterRow)=>severityRank[row.severity as string]||0}
 const paging=useSortedPaging(items,`${JSON.stringify(filters)}:${view.days}`,sortBy)
 const pendingView=filters.scope==='pending'
 const advanced=['source','department','priority','status','deviationKind','cause','recurring'].filter(key=>filters[key]&&filters[key]!=='all').length+(filters.dateFrom?1:0)+(filters.dateTo?1:0)+(view.days!==90?1:0)
 // Totals beside the search, counted on the list as filtered (without the status and quick figure); each one filters it.
 const base=view.base.filter((row: RegisterRow)=>row.type==='finding')
 const showRegistry=(extra: Record<string, string | null>)=>{set('scope','registry');set('quick',null);set('status','all');Object.entries(extra).forEach(([key,value])=>set(key,value))}
 const plain=!pendingView&&filters.status==='all'&&!filters.quick
 const totals=<RegistryTotals label={en?'Totals':'Σύνολα'} items={[
  {key:'all',always:true,value:base.length,label:en?'deviations':'αποκλίσεις',active:plain,onClick:()=>showRegistry({})},
  {key:'open',value:base.filter((row: RegisterRow)=>row.status==='open').length,label:en?'open':'ανοιχτές',active:!pendingView&&filters.status==='open',onClick:()=>showRegistry({status:filters.status==='open'?'all':'open'})},
  {key:'progress',value:base.filter((row: RegisterRow)=>row.status==='inProgress').length,label:en?'in progress':'σε εξέλιξη',active:!pendingView&&filters.status==='inProgress',onClick:()=>showRegistry({status:filters.status==='inProgress'?'all':'inProgress'})},
  {key:'withoutCapa',value:base.filter((row: RegisterRow)=>row.status!=='closed'&&!row.hasCapa).length,label:en?'without action':'χωρίς ενέργεια',active:!pendingView&&filters.quick==='withoutCapa',onClick:()=>showRegistry({quick:filters.quick==='withoutCapa'?null:'withoutCapa'})},
  {key:'pending',value:view.counts.pending,label:en?'automatic signals':'αυτόματα σήματα',active:pendingView,onClick:()=>{set('quick',null);set('status','all');set('scope',pendingView?'registry':'pending')}},
 ]}/>
 const statusTone=(status: string)=>status==='closed'?'success':status==='inProgress'?'info':'warning'
 const needsAction=(row: RegisterRow)=>row.type==='finding'&&!row.hasCapa&&row.status!=='closed'
 const showActions=pendingView||items.some(needsAction)
 return <>
  <FilterBar query={filters.query} onQueryChange={value=>set('query',value)} placeholder={en?'Search deviations…':'Αναζήτηση αποκλίσεων…'} activeAdvancedCount={advanced} onClear={view.clear} end={totals}>
   <FilterSelect label={en?'Kind of deviation':'Είδος απόκλισης'} value={filters.deviationKind} onChange={(value: string)=>set('deviationKind',value)}><option value="all">{en?'All':'Όλα'}</option>{DEVIATION_KINDS.filter(item=>view.rows.some((row: RegisterRow)=>row.deviationKind===item.value)).map(item=><option key={item.value} value={item.value}>{item.label[en?1:0]}</option>)}</FilterSelect>
   <FilterSelect label={en?'Cause':'Αιτία'} value={filters.cause} onChange={(value: string)=>set('cause',value)}><option value="all">{en?'All':'Όλες'}</option>{CAUSE_CATEGORIES.filter(item=>view.rows.some((row: RegisterRow)=>(row.causeCategories||[]).includes(item.value))).map(item=><option key={item.value} value={item.value}>{item.label[en?1:0]}</option>)}</FilterSelect>
   <FilterSelect label={en?'Recurring':'Επαναλαμβανόμενη'} value={filters.recurring} onChange={(value: string)=>set('recurring',value)}><option value="all">{en?'All':'Όλες'}</option><option value="yes">{en?'Yes':'Ναι'}</option><option value="no">{en?'No':'Όχι'}</option></FilterSelect>
   <FilterSelect label={en?'Source':'Πηγή'} value={filters.source} onChange={(value: string)=>set('source',value)}><option value="all">{en?'All':'Όλες'}</option>{DEVIATION_SOURCES.map(item=><option key={item.value} value={item.value}>{item.label[en?1:0]}</option>)}</FilterSelect>
   <FilterSelect label={en?'Status':'Κατάσταση'} value={filters.status} onChange={(value: string)=>set('status',value)}><option value="all">{en?'All':'Όλες'}</option><option value="open">{en?'Open':'Ανοιχτή'}</option><option value="inProgress">{en?'In progress':'Σε εξέλιξη'}</option><option value="closed">{en?'Closed':'Κλειστή'}</option></FilterSelect>
   <FilterSelect label={t('priority')} value={filters.priority} onChange={(value: string)=>set('priority',value)}><option value="all">{t('all')}</option>{['critical','high','medium','low'].map((value: string)=><option key={value} value={value}>{t(value)}</option>)}</FilterSelect>
   <FilterSelect label={t('department')} value={filters.department} onChange={(value: string)=>set('department',value)}><option value="all">{t('allDepartments')}</option>{view.departments.map((value: string)=><option key={value} value={value}>{value}</option>)}</FilterSelect>
   <FilterDate label={en?'From':'Από'} value={filters.dateFrom||''} onChange={(value: string)=>set('dateFrom',value)}/>
   <FilterDate label={en?'To':'Έως'} value={filters.dateTo||''} onChange={(value: string)=>set('dateTo',value)}/>
   {pendingView&&<FilterSelect label={en?'Pending period':'Περίοδος νέων'} value={String(view.days)} onChange={value=>view.setDays(Number(value))}>{PERIODS.map((value: number)=><option key={value} value={value}>{en?`Last ${value} days`:`Τελευταίες ${value} ημέρες`}</option>)}</FilterSelect>}
  </FilterBar>
  <div className="scroll-table" ref={registry?.scrollRef as RefObject<HTMLDivElement>}>
   <RegistryTable sort={paging.sort} onSort={paging.onSort} bare className="quality-table quality-register-table quality-deviation-table" rows={paging.rows} rowKey={row=>row.key} empty={!(loading||view.loading)&&!items.length} emptyFiltered={view.rows.length>0} onClearFilters={view.clear}
    columns={withSort([{key:'code',label:t('code')},{key:'title',label:t('title')},{key:'source',label:en?'Kind / source':'Είδος / πηγή'},{key:'department',label:t('department')},{key:'date',label:t('date')},{key:'status',label:t('status')},{key:'priority',label:t('priority')},...(showActions?[{key:'actions',label:''}]:[])],sortBy)}
    emptyTitle={en?'No deviations':'Δεν υπάρχουν αποκλίσεις'} emptyText={en?'The register contains governed findings/deviations. Automatic signals stay in “Signals from other modules” until Quality reviews them.':'Το μητρώο περιέχει τις επίσημες αποκλίσεις/ευρήματα. Οι αυτόματες ενδείξεις παραμένουν στα «Σήματα από άλλες ενότητες» μέχρι να τις εξετάσει η Ποιότητα.'}
    rowProps={row=>({...(registry?.rowProps(row.type==='finding'?row.id:row.key)||{}),onClick:()=>onOpenRow(row,paging.sorted)})}
    renderRow={row=>{const Icon=SOURCE_ICON[row.source]||FileWarning;return <>
     <td><strong>{row.code}</strong></td>
     <td>{en?row.titleEn:row.title}{row.type==='finding'&&!row.hasCapa&&row.status!=='closed'&&<small>{en?'No corrective action linked':'Χωρίς συνδεδεμένη διορθωτική ενέργεια'}</small>}{row.type==='deviation'&&row.item.notes&&<small>{row.item.notes}</small>}</td>
     <td><span className="quality-register-kind"><Icon size={14} aria-hidden="true"/>{row.deviationKind?vocabularyLabel(DEVIATION_KINDS,row.deviationKind,language):findingSourceText(row.source,language)}</span>{row.recurring&&<small>{en?'Recurring':'Επαναλαμβανόμενη'}</small>}</td>
     <td>{(en?row.departmentEn:row.department)||'—'}</td>
     <td className="nowrap-cell">{formatDay(row.date,language)||'—'}</td>
     <td>{row.type==='finding'?<StatusBadge tone={statusTone(row.status)}>{t(row.status)}</StatusBadge>:<StatusBadge tone="warning">{en?'To assess':'Προς αξιολόγηση'}</StatusBadge>}</td>
     <td><StatusBadge tone={row.severity==='critical'?'danger':row.severity==='high'?'warning':'neutral'}>{t(row.severity as string)}</StatusBadge></td>
     {showActions&&<td className="quality-register-actions" onClick={event=>event.stopPropagation()}>
      <OverflowMenu label={en?'Actions':'Ενέργειες'} items={[
       row.type==='deviation'?{label:en?'Create corrective action':'Δημιουργία διορθωτικής ενέργειας',icon:Plus,onClick:()=>onCreateCapa(capaPrefill(row.item,language))}:null,
       needsAction(row)?{label:en?'Create corrective action':'Δημιουργία διορθωτικής ενέργειας',icon:Plus,onClick:()=>onCreateFindingCapa(row.item as QualityRecord)}:null,
      ]}/>
     </td>}
    </>}}/>
  </div>
  {items.length>0&&<RegistryPagination language={language} {...paging.props}/>}
 </>
}
