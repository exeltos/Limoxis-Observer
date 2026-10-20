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
import { loadControlProgramme } from '../controls/controlCloudService'
import { loadBundleAssessments } from '../prevention/bundleCloudService'
import { loadTrainingProgramsAsync } from '../training/trainingService'
import { loadQualityRecords } from './qualityService'
import { capaPrefill,deviationQueue } from './qualityDeviations'
import { REGISTER_SOURCES,filterRegister,registerCounts,registerRows } from './qualityRegister'
import { INCIDENT_STAGES } from './qualityRecordRules'
import { daysUntil } from './QualityGlance'
import { REPORT_KINDS,incidentCategoryLabel,vocabularyLabel } from './qualityVocabulary'
import { roleTitleText } from '../../core/i18n/roleTitles'

// Two lists of the Quality Center: the reports people send, each at its stage
// of the flow (report → assessment → CAPA → effectiveness → closed), and the
// queue of deviations other modules recorded that no CAPA handles yet.

const PERIODS=[30,90,365]
const KIND_ICON={clinical:Stethoscope,nonClinical:Wrench,complaint:MessageSquareWarning,suggestion:Lightbulb}
const SOURCE_ICON={control:ClipboardCheck,bundle:ShieldCheck,training:GraduationCap}

// The stages of an open report, in the order of the flow.
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

// Five marks, one per step of the flow; the report's stage is the last lit one.
export function StageTrack({stage,language}){
 const reached=stage==='closed'?5:INCIDENT_STAGES.indexOf(stage)+1
 return <span className="quality-stage">
  <span className="quality-stage-track" aria-hidden="true">{[1,2,3,4,5].map(step=><i key={step} className={step<reached?'is-done':step===reached?'is-current':''}/>)}</span>
  <StatusBadge tone={STAGE_TONE[stage]||'neutral'}>{stageLabel(stage,language)}</StatusBadge>
 </span>
}

// What other modules recorded that no CAPA handles yet. Only Quality reads
// them (they are its work queue); recording staff cannot create CAPAs.
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
const DEVIATION_DEFAULTS={query:'',source:'all',department:'all',priority:'all'}
const departmentsOf=(rows,language)=>[...new Set(rows.map(row=>language==='en'?row.departmentEn:row.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el'))

// The reports' rows, filters and counts. The page holds them so the stage
// cards above the list and the table stay in step.
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

// The deviations' queue, over the last 30, 90 or 365 days.
export function useDeviations(sources,language){
 const [days,setDays]=useState(90)
 const [filters,setFilters]=useState(DEVIATION_DEFAULTS)
 const set=(key,value)=>setFilters(current=>({...current,[key]:value}))
 const rows=useMemo(()=>registerRows([],deviationQueue({...sources,days})),[sources,days])
 const filtered=useMemo(()=>filterRegister(rows,{...filters,language}).filter(row=>filters.priority==='all'||row.severity===filters.priority),[rows,filters,language])
 const counts=useMemo(()=>({total:rows.length,...Object.fromEntries(['control','bundle','training'].map(source=>[source,rows.filter(row=>row.source===source).length])),high:rows.filter(row=>row.severity==='high').length}),[rows])
 const departments=useMemo(()=>departmentsOf(rows,language),[rows,language])
 return {rows,filtered,counts,filters,set,clear:()=>{setFilters(DEVIATION_DEFAULTS);setDays(90)},days,setDays,departments}
}

const kindText=(kind,language)=>vocabularyLabel(REPORT_KINDS,kind,language)
const sourceText=(source,language)=>vocabularyLabel(REGISTER_SOURCES,source,language)

export function reportRegisterExport(rows,{language,t,categories}){
 const en=language==='en'
 return {
  name:en?'reports':'anafores',
  headers:en?['Code','Date','Kind','Category','Title','Department','Responsible','Stage','Status','Sentinel']:['Κωδικός','Ημερομηνία','Είδος','Κατηγορία','Τίτλος','Τμήμα','Υπεύθυνος','Στάδιο','Κατάσταση','Sentinel'],
  rows:rows.map(row=>[row.code,row.date,kindText(row.kind,language),incidentCategoryLabel(row.category,categories,language),en?row.titleEn:row.title,en?row.departmentEn:row.department,row.owner,stageLabel(row.stage,language),t(row.status),row.sentinel?(en?'Yes':'Ναι'):'']),
 }
}

export function deviationsExport(rows,{language}){
 const en=language==='en'
 return {
  name:en?'deviations-without-action':'apokliseis-xoris-energeia',
  headers:en?['Code','Date','Source','Title','Department','Detail','Notes','Priority']:['Κωδικός','Ημερομηνία','Πηγή','Τίτλος','Τμήμα','Τιμή / αποτέλεσμα','Σημειώσεις','Προτεραιότητα'],
  rows:rows.map(row=>[row.code,row.date,sourceText(row.source,language),en?row.titleEn:row.title,en?row.departmentEn:row.department,row.item.detail||'',row.item.notes||'',row.severity]),
 }
}

function usePage(items,resetKey){
 const [page,setPage]=useState(1)
 const [pageSize,setPageSize]=useState(15)
 useEffect(()=>setPage(1),[resetKey,pageSize])
 const totalPages=Math.max(1,Math.ceil(items.length/pageSize)),safePage=Math.min(page,totalPages)
 return {rows:items.slice((safePage-1)*pageSize,safePage*pageSize),props:{page:safePage,totalPages,totalItems:items.length,pageSize,onPageChange:setPage,onPageSizeChange:setPageSize}}
}

// How long a report has been open, under its date.
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
   <FilterSelect label={en?'Kind':'Είδος'} value={filters.kind} onChange={value=>set('kind',value)}><option value="all">{en?'All':'Όλα'}</option>{REPORT_KINDS.map(item=><option key={item.value} value={item.value}>{item.label[en?1:0]}</option>)}</FilterSelect>
   <FilterSelect label={en?'Stage':'Στάδιο'} value={filters.stage} onChange={value=>set('stage',value)}><option value="all">{en?'All':'Όλα'}</option>{INCIDENT_STAGES.map(id=><option key={id} value={id}>{stageLabel(id,language)}</option>)}</FilterSelect>
   <FilterSelect label={en?'Category':'Κατηγορία'} value={filters.category} onChange={value=>set('category',value)}><option value="all">{en?'All':'Όλες'}</option>{view.categories.map(value=><option key={value} value={value}>{incidentCategoryLabel(value,categories,language)}</option>)}</FilterSelect>
   <FilterSelect label={t('department')} value={filters.department} onChange={value=>set('department',value)}><option value="all">{t('allDepartments')}</option>{view.departments.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>
  </FilterBar>
  <div className="scroll-table" ref={registry?.scrollRef}>
   <RegistryTable bare className="quality-table quality-register-table" rows={paging.rows} rowKey={row=>row.key} empty={!loading&&!items.length} emptyFiltered={view.rows.length>0} onClearFilters={view.clear}
    columns={[{key:'code',label:t('code')},{key:'title',label:t('title')},{key:'kind',label:en?'Kind':'Είδος'},{key:'department',label:t('department')},{key:'date',label:t('date')},{key:'stage',label:en?'Stage':'Στάδιο'},{key:'owner',label:t('owner')}]}
    emptyTitle={en?'No reports':'Δεν υπάρχουν αναφορές'} emptyText={en?'Incidents, complaints and suggestions that staff report appear here, at their stage of the flow.':'Εδώ εμφανίζονται τα συμβάντα, τα παράπονα και οι προτάσεις που αναφέρει το προσωπικό, στο στάδιο όπου βρίσκονται.'}
    rowProps={row=>({...(registry?.rowProps(row.id)||{}),className:`${registry?.rowProps(row.id)?.className||''}${row.sentinel&&row.stage!=='closed'?' quality-row-sentinel':''}`.trim(),onClick:()=>onOpenReport(row,items)})}
    renderRow={row=>{const Icon=KIND_ICON[row.kind]||FileWarning;return <>
     <td><strong>{row.code}</strong>{row.sentinel?<StatusBadge tone="danger" icon={AlertOctagon}>Sentinel</StatusBadge>:row.severity&&<small>{t(row.severity)}</small>}</td>
     <td>{en?row.titleEn:row.title}{row.category&&<small>{incidentCategoryLabel(row.category,categories,language)}</small>}</td>
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

// The queue: each deviation opens its source record or becomes a CAPA, prefilled.
export function DeviationQueue({view,loading,language,t,onCreateCapa}){
 const en=language==='en'
 const {goTo}=useContextualNavigation('/quality')
 const {filters,set}=view
 const items=view.filtered
 const paging=usePage(items,`${JSON.stringify(filters)}:${view.days}`)
 const advanced=['source','department','priority'].filter(key=>filters[key]!=='all').length+(view.days!==90?1:0)
 return <>
  <FilterBar query={filters.query} onQueryChange={value=>set('query',value)} placeholder={en?'Search deviations…':'Αναζήτηση αποκλίσεων…'} activeAdvancedCount={advanced} onClear={view.clear}>
   <FilterSelect label={en?'Source':'Πηγή'} value={filters.source} onChange={value=>set('source',value)}><option value="all">{en?'All':'Όλες'}</option>{REGISTER_SOURCES.filter(item=>item.value!=='report').map(item=><option key={item.value} value={item.value}>{item.label[en?1:0]}</option>)}</FilterSelect>
   <FilterSelect label={t('priority')} value={filters.priority} onChange={value=>set('priority',value)}><option value="all">{t('all')}</option>{['high','medium','low'].map(value=><option key={value} value={value}>{t(value)}</option>)}</FilterSelect>
   <FilterSelect label={t('department')} value={filters.department} onChange={value=>set('department',value)}><option value="all">{t('allDepartments')}</option>{view.departments.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>
   <FilterSelect label={en?'Period':'Περίοδος'} value={String(view.days)} onChange={value=>view.setDays(Number(value))}>{PERIODS.map(value=><option key={value} value={value}>{en?`Last ${value} days`:`Τελευταίες ${value} ημέρες`}</option>)}</FilterSelect>
  </FilterBar>
  <div className="scroll-table">
   <RegistryTable bare className="quality-table quality-register-table quality-deviation-table" rows={paging.rows} rowKey={row=>row.key} empty={!loading&&!items.length} emptyFiltered={view.rows.length>0} onClearFilters={view.clear}
    columns={[{key:'source',label:en?'Source':'Πηγή'},{key:'title',label:en?'What was recorded':'Τι καταγράφηκε'},{key:'department',label:t('department')},{key:'date',label:t('date')},{key:'priority',label:t('priority')},{key:'actions',label:''}]}
    emptyTitle={en?'No deviations waiting':'Καμία απόκλιση σε αναμονή'} emptyText={en?'Control entries with a finding, failed bundle criteria and trainings that did not change practice appear here until a corrective action handles them.':'Εδώ εμφανίζονται οι καταχωρίσεις ελέγχων με εύρημα, τα κριτήρια bundle που δεν τηρήθηκαν και οι εκπαιδεύσεις που δεν άλλαξαν την πρακτική, μέχρι να τις αναλάβει μια διορθωτική ενέργεια.'}
    rowProps={()=>({className:'quality-register-deviation'})}
    renderRow={row=>{const Icon=SOURCE_ICON[row.source]||FileWarning;return <>
     <td><span className="quality-register-kind"><Icon size={14} aria-hidden="true"/>{sourceText(row.source,language)}</span><small>{row.code}</small></td>
     <td>{en?row.titleEn:row.title}{row.item.detail&&row.source!=='training'&&<small>{row.source==='bundle'?(en?`${row.item.detail} criteria not met`:`${row.item.detail} κριτήρια δεν τηρήθηκαν`):row.item.detail}</small>}{row.source==='training'&&<small>{row.item.detail==='partial'?(en?'Partly effective':'Μερικώς αποτελεσματική'):(en?'Not effective':'Μη αποτελεσματική')}</small>}{row.item.notes&&<small>{row.item.notes}</small>}</td>
     <td>{(en?row.departmentEn:row.department)||'—'}</td>
     <td className="nowrap-cell">{formatDay(row.date,language)||'—'}</td>
     <td><StatusBadge tone={row.severity==='high'?'danger':row.severity==='medium'?'warning':'neutral'}>{t(row.severity)}</StatusBadge></td>
     <td><div className="row-actions quality-register-actions">
      <IconButton size="sm" label={en?'Open source record':'Άνοιγμα εγγραφής προέλευσης'} onClick={()=>goTo(row.item.path,{returnTo:'/quality'})}><ExternalLink size={15}/></IconButton>
      <ActionButton tone="primary" label={en?'Create CAPA':'Δημιουργία διορθωτικής ενέργειας'} onClick={()=>onCreateCapa(capaPrefill(row.item,language))}><Plus size={15}/><span>{en?'CAPA':'Ενέργεια'}</span></ActionButton>
     </div></td>
    </>}}/>
  </div>
  {items.length>0&&<RegistryPagination language={language} {...paging.props}/>}
 </>
}
