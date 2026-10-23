import { useEffect,useMemo,useState } from 'react'
import { AlertOctagon,ExternalLink,FileWarning,Plus,MessageSquareWarning,Lightbulb,Stethoscope,Wrench,GraduationCap,ClipboardCheck,ShieldCheck } from 'lucide-react'
import { ActionButton } from '../../design-system/ActionButton'
import { IconButton } from '../../design-system/IconButton'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { StatusBadge } from '../../design-system/StatusBadge'
import { formatDay } from '../../core/i18n/formatDay'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
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

// The Quality Center has two different concepts here:
// 1. reports submitted by staff, which Quality assesses and classifies;
// 2. the actual deviation/finding register (quality_findings), plus a small
//    queue of automatic signals from controls/bundles/training not yet turned
//    into a governed quality record.

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
  <span className="quality-stage-track" aria-hidden="true">{[1,2,3,4,5].map(step=><i key={step} className={step<reached?'is-done':step===reached?'is-current':''}/>)}</span>
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

const REPORT_DEFAULTS={query:'',kind:'all',stage:'all',department:'all',category:'all',quick:null}
const DEVIATION_DEFAULTS={query:'',scope:'registry',source:'all',department:'all',priority:'all',status:'all'}
const departmentsOf=(rows,language)=>[...new Set(rows.map(row=>language==='en'?row.departmentEn:row.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el'))

export function useReportRegister(incidents,capas,language){
 const [filters,setFilters]=useState(REPORT_DEFAULTS)
 const set=(key,value)=>setFilters(current=>({...current,[key]:value}))
 const rows=useMemo(()=>registerRows(incidents,[],capas),[incidents,capas])
 const filtered=useMemo(()=>filterRegister(rows,{...filters,language}),[rows,filters,language])
 const counts=useMemo(()=>registerCounts(rows),[rows])
 const departments=useMemo(()=>departmentsOf(rows,language),[rows,language])
 const categories=useMemo(()=>[...new Set(rows.map(row=>row.category).filter(Boolean))],[rows])
 return {rows,filtered,counts,filters,set,clear:()=>setFilters(REPORT_DEFAULTS),departments,categories}
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

function usePage(items,resetKey){
 const [page,setPage]=useState(1)
 const [pageSize,setPageSize]=useState(15)
 useEffect(()=>setPage(1),[resetKey,pageSize])
 const totalPages=Math.max(1,Math.ceil(items.length/pageSize)),safePage=Math.min(page,totalPages)
 return {rows:items.slice((safePage-1)*pageSize,safePage*pageSize),props:{page:safePage,totalPages,totalItems:items.length,pageSize,onPageChange:setPage,onPageSizeChange:setPageSize}}
}

function ageText(row,language){
 const days=-daysUntil(row.date)
 if(row.stage==='closed'||!Number.isFinite(days)||days<0)return ''
 return language==='en'?`${days} ${days===1?'day':'days'} open`:`${days} ${days===1?'ημέρα':'ημέρες'} ανοιχτή`
}

export function ReportRegister({view,loading,language,t,categories,registry,onOpenReport}){
 const en=language==='en'
 const {filters,set}=view
 const items=view.filtered
 const paging=usePage(items,JSON.stringify(filters))
 const advanced=['kind','stage','department','category'].filter(key=>filters[key]!=='all').length
 return <>
  <FilterBar query={filters.query} onQueryChange={value=>set('query',value)} placeholder={en?'Search reports…':'Αναζήτηση αναφορών…'} activeAdvancedCount={advanced} onClear={view.clear}>
   <FilterSelect label={en?'Classification':'Ταξινόμηση'} value={filters.kind} onChange={value=>set('kind',value)}><option value="all">{en?'All':'Όλες'}</option>{REPORT_KINDS.map(item=><option key={item.value} value={item.value}>{item.label[en?1:0]}</option>)}</FilterSelect>
   <FilterSelect label={en?'Stage':'Στάδιο'} value={filters.stage} onChange={value=>set('stage',value)}><option value="all">{en?'All':'Όλα'}</option>{INCIDENT_STAGES.map(id=><option key={id} value={id}>{stageLabel(id,language)}</option>)}</FilterSelect>
   <FilterSelect label={en?'Category':'Κατηγορία'} value={filters.category} onChange={value=>set('category',value)}><option value="all">{en?'All':'Όλες'}</option>{view.categories.map(value=><option key={value} value={value}>{incidentCategoryLabel(value,categories,language)}</option>)}</FilterSelect>
   <FilterSelect label={t('department')} value={filters.department} onChange={value=>set('department',value)}><option value="all">{t('allDepartments')}</option>{view.departments.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>
  </FilterBar>
  <div className="scroll-table" ref={registry?.scrollRef}>
   <RegistryTable bare className="quality-table quality-register-table" rows={paging.rows} rowKey={row=>row.key} empty={!loading&&!items.length} emptyFiltered={view.rows.length>0} onClearFilters={view.clear}
    columns={[{key:'code',label:t('code')},{key:'title',label:t('title')},{key:'kind',label:en?'Classification':'Ταξινόμηση'},{key:'department',label:t('department')},{key:'date',label:t('date')},{key:'stage',label:en?'Stage':'Στάδιο'},{key:'owner',label:t('owner')}]}
    emptyTitle={en?'No reports':'Δεν υπάρχουν αναφορές'} emptyText={en?'Staff reports appear here first; Quality assesses and classifies them before the follow-up workflow continues.':'Οι αναφορές του προσωπικού εμφανίζονται πρώτα εδώ· η Ποιότητα τις αξιολογεί και τις ταξινομεί πριν συνεχιστεί η ροή διαχείρισης.'}
    rowProps={row=>({...(registry?.rowProps(row.id)||{}),className:`${registry?.rowProps(row.id)?.className||''}${row.sentinel&&row.stage!=='closed'?' quality-row-sentinel':''}`.trim(),onClick:()=>onOpenReport(row,items)})}
    renderRow={row=>{const Icon=KIND_ICON[row.kind]||FileWarning;return <>
     <td><strong>{row.code}</strong>{row.sentinel?<StatusBadge tone="danger" icon={AlertOctagon}>Sentinel</StatusBadge>:row.severity&&<small>{t(row.severity)}</small>}</td>
     <td>{en?row.titleEn:row.title}{row.category&&row.kind!=='report'&&<small>{incidentCategoryLabel(row.category,categories,language)}</small>}</td>
     <td><span className="quality-register-kind"><Icon size={14} aria-hidden="true"/>{kindText(row.kind,language)}</span></td>
     <td>{(en?row.departmentEn:row.department)||'—'}</td>
     <td className="nowrap-cell">{formatDay(row.date,language)||'—'}{ageText(row,language)&&<small>{ageText(row,language)}</small>}</td>
     <td><StageTrack stage={row.stage} language={language}/></td>
     <td>{roleTitleText(row.owner,language)||'—'}</td>
    </>}}/>
  </div>
  {items.length>0&&<RegistryPagination language={language} {...paging.props}/>}
 </>
}

export function DeviationQueue({view,loading,language,t,onCreateCapa}){
 const en=language==='en'
 const {goTo}=useContextualNavigation('/quality')
 const {filters,set}=view
 const items=view.filtered
 const paging=usePage(items,`${JSON.stringify(filters)}:${view.days}`)
 const advanced=['scope','source','department','priority','status'].filter(key=>filters[key]!=='all'&&!(key==='scope'&&filters.scope==='registry')).length+(view.days!==90?1:0)
 const statusTone=status=>status==='closed'?'success':status==='inProgress'?'info':'warning'
 const openRow=row=>row.type==='finding'?goTo(`/quality/findings/${row.id}`,{returnTo:'/quality',returnTab:'deviations'}):goTo(row.item.path,{returnTo:'/quality',returnTab:'deviations'})
 return <>
  <FilterBar query={filters.query} onQueryChange={value=>set('query',value)} placeholder={en?'Search deviations…':'Αναζήτηση αποκλίσεων…'} activeAdvancedCount={advanced} onClear={view.clear}>
   <FilterSelect label={en?'View':'Προβολή'} value={filters.scope} onChange={value=>set('scope',value)}>
    <option value="registry">{en?'Deviation register':'Μητρώο αποκλίσεων'}</option>
    <option value="pending">{en?`New to assess (${view.counts.pending})`:`Νέες προς αξιολόγηση (${view.counts.pending})`}</option>
    <option value="all">{en?'All':'Όλα'}</option>
   </FilterSelect>
   <FilterSelect label={en?'Source':'Πηγή'} value={filters.source} onChange={value=>set('source',value)}><option value="all">{en?'All':'Όλες'}</option>{DEVIATION_SOURCES.map(item=><option key={item.value} value={item.value}>{item.label[en?1:0]}</option>)}</FilterSelect>
   <FilterSelect label={en?'Status':'Κατάσταση'} value={filters.status} onChange={value=>set('status',value)}><option value="all">{en?'All':'Όλες'}</option><option value="open">{en?'Open':'Ανοιχτή'}</option><option value="inProgress">{en?'In progress':'Σε εξέλιξη'}</option><option value="closed">{en?'Closed':'Κλειστή'}</option></FilterSelect>
   <FilterSelect label={t('priority')} value={filters.priority} onChange={value=>set('priority',value)}><option value="all">{t('all')}</option>{['critical','high','medium','low'].map(value=><option key={value} value={value}>{t(value)}</option>)}</FilterSelect>
   <FilterSelect label={t('department')} value={filters.department} onChange={value=>set('department',value)}><option value="all">{t('allDepartments')}</option>{view.departments.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>
   {(filters.scope==='pending'||filters.scope==='all')&&<FilterSelect label={en?'Pending period':'Περίοδος νέων'} value={String(view.days)} onChange={value=>view.setDays(Number(value))}>{PERIODS.map(value=><option key={value} value={value}>{en?`Last ${value} days`:`Τελευταίες ${value} ημέρες`}</option>)}</FilterSelect>}
  </FilterBar>
  <div className="scroll-table">
   <RegistryTable bare className="quality-table quality-register-table quality-deviation-table" rows={paging.rows} rowKey={row=>row.key} empty={!(loading||view.loading)&&!items.length} emptyFiltered={view.rows.length>0} onClearFilters={view.clear}
    columns={[{key:'code',label:t('code')},{key:'title',label:t('title')},{key:'source',label:en?'Source':'Πηγή'},{key:'department',label:t('department')},{key:'date',label:t('date')},{key:'status',label:t('status')},{key:'priority',label:t('priority')},{key:'actions',label:''}]}
    emptyTitle={en?'No deviations':'Δεν υπάρχουν αποκλίσεις'} emptyText={en?'The register contains governed findings/deviations. Automatic signals stay in “New to assess” until Quality reviews them.':'Το μητρώο περιέχει τις επίσημες αποκλίσεις/ευρήματα. Οι αυτόματες ενδείξεις παραμένουν στις «Νέες προς αξιολόγηση» μέχρι να τις εξετάσει η Ποιότητα.'}
    rowProps={row=>({className:'quality-register-deviation',onClick:()=>openRow(row)})}
    renderRow={row=>{const Icon=SOURCE_ICON[row.source]||FileWarning;return <>
     <td><strong>{row.code}</strong></td>
     <td>{en?row.titleEn:row.title}{row.type==='finding'&&!row.hasCapa&&row.status!=='closed'&&<small>{en?'No corrective action linked':'Χωρίς συνδεδεμένη διορθωτική ενέργεια'}</small>}{row.type==='deviation'&&row.item.notes&&<small>{row.item.notes}</small>}</td>
     <td><span className="quality-register-kind"><Icon size={14} aria-hidden="true"/>{findingSourceText(row.source,language)}</span></td>
     <td>{(en?row.departmentEn:row.department)||'—'}</td>
     <td className="nowrap-cell">{formatDay(row.date,language)||'—'}</td>
     <td>{row.type==='finding'?<StatusBadge tone={statusTone(row.status)}>{t(row.status)}</StatusBadge>:<StatusBadge tone="warning">{en?'To assess':'Προς αξιολόγηση'}</StatusBadge>}</td>
     <td><StatusBadge tone={row.severity==='critical'?'danger':row.severity==='high'?'warning':'neutral'}>{t(row.severity)}</StatusBadge></td>
     <td><div className="row-actions quality-register-actions" onClick={event=>event.stopPropagation()}>
      <IconButton size="sm" label={row.type==='finding'?(en?'Open deviation':'Άνοιγμα απόκλισης'):(en?'Open source record':'Άνοιγμα εγγραφής προέλευσης')} onClick={()=>openRow(row)}><ExternalLink size={15}/></IconButton>
      {row.type==='deviation'&&<ActionButton tone="primary" label={en?'Create corrective action':'Δημιουργία διορθωτικής ενέργειας'} onClick={()=>onCreateCapa(capaPrefill(row.item,language))}><Plus size={15}/><span>{en?'Action':'Ενέργεια'}</span></ActionButton>}
     </div></td>
    </>}}/>
  </div>
  {items.length>0&&<RegistryPagination language={language} {...paging.props}/>}
 </>
}
