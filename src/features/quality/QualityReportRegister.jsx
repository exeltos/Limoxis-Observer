import { useEffect,useMemo,useState } from 'react'
import { AlertOctagon,ExternalLink,FileWarning,Plus,MessageSquareWarning,Lightbulb,Stethoscope,Wrench } from 'lucide-react'
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
import { loadTrainingStateAsync } from '../training/trainingService'
import { loadQualityRecords } from './qualityService'
import { capaPrefill,deviationQueue } from './qualityDeviations'
import { REGISTER_SOURCES,filterRegister,registerCounts,registerRows } from './qualityRegister'
import { REPORT_KINDS,incidentCategoryLabel,qualityStatusTone,vocabularyLabel } from './qualityVocabulary'

// Reports and deviations, one register (Quality > Reports & deviations).

const PERIODS=[30,90,365]
const KIND_ICON={training:FileWarning,clinical:Stethoscope,nonClinical:Wrench,complaint:MessageSquareWarning,suggestion:Lightbulb,deviation:FileWarning}

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
  Promise.all([safe(loadControlProgramme(organizationId)),safe(loadBundleAssessments(organizationId)),safe(loadTrainingStateAsync(organizationId).then(state=>state?.programs||[])),safe(loadQualityRecords('capas',organizationId))])
   .then(([controls,bundles,trainings,capas])=>{if(active)setSources({controls,bundles,trainings,capas})})
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[organizationId,enabled])
 return {sources,loading}
}

// The register's rows, filters and counts. The page holds them so the figures
// above the tabs and the table stay in step.
export function useReportRegister(incidents,sources,language){
 const [days,setDays]=useState(90)
 const [filters,setFilters]=useState({query:'',kind:'all',source:'all',status:'all',department:'all',category:'all',quick:null})
 const set=(key,value)=>setFilters(current=>({...current,[key]:value}))
 const deviations=useMemo(()=>deviationQueue({...sources,days}),[sources,days])
 const rows=useMemo(()=>registerRows(incidents,deviations),[incidents,deviations])
 const filtered=useMemo(()=>filterRegister(rows,{...filters,language}),[rows,filters,language])
 const counts=useMemo(()=>registerCounts(rows),[rows])
 const departments=useMemo(()=>[...new Set(rows.map(row=>language==='en'?row.departmentEn:row.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el')),[rows,language])
 const categories=useMemo(()=>[...new Set(rows.map(row=>row.category).filter(Boolean))],[rows])
 const clear=()=>setFilters({query:'',kind:'all',source:'all',status:'all',department:'all',category:'all',quick:null})
 return {rows,filtered,counts,filters,set,clear,days,setDays,departments,categories}
}

const kindText=(kind,language)=>kind==='deviation'?(language==='en'?'Deviation':'Απόκλιση'):vocabularyLabel(REPORT_KINDS,kind,language)
const sourceText=(source,language)=>vocabularyLabel(REGISTER_SOURCES,source,language)

export function reportRegisterExport(rows,{language,t,categories}){
 const en=language==='en'
 return {
  name:en?'reports-and-deviations':'anafores-kai-apokliseis',
  headers:en?['Code','Date','Kind','Category','Title','Department','Responsible','Source','Status','Sentinel']:['Κωδικός','Ημερομηνία','Είδος','Κατηγορία','Τίτλος','Τμήμα','Υπεύθυνος','Πηγή','Κατάσταση','Sentinel'],
  rows:rows.map(row=>[row.code,row.date,kindText(row.kind,language),incidentCategoryLabel(row.category,categories,language),en?row.titleEn:row.title,en?row.departmentEn:row.department,row.owner,sourceText(row.source,language),row.type==='deviation'?(en?'Without CAPA':'Χωρίς ενέργεια'):t(row.status),row.sentinel?(en?'Yes':'Ναι'):'']),
 }
}

export function ReportRegister({view,loading,language,t,categories,registry,onOpenReport,onCreateCapa}){
 const en=language==='en'
 const {goTo}=useContextualNavigation('/quality')
 const [page,setPage]=useState(1)
 const [pageSize,setPageSize]=useState(15)
 const {filters,set}=view
 const items=view.filtered
 useEffect(()=>setPage(1),[filters,view.days,pageSize])
 const totalPages=Math.max(1,Math.ceil(items.length/pageSize)),safePage=Math.min(page,totalPages),pagedItems=items.slice((safePage-1)*pageSize,safePage*pageSize)
 const advanced=['kind','source','status','department','category'].filter(key=>filters[key]!=='all').length+(view.days!==90?1:0)
 const statuses=[...new Set(view.rows.filter(row=>row.type==='report').map(row=>row.status))]
 return <>
  <FilterBar query={filters.query} onQueryChange={value=>set('query',value)} placeholder={en?'Search reports and deviations…':'Αναζήτηση αναφορών και αποκλίσεων…'} activeAdvancedCount={advanced} onClear={()=>{view.clear();view.setDays(90)}}>
   <FilterSelect label={en?'Kind':'Είδος'} value={filters.kind} onChange={value=>set('kind',value)}><option value="all">{en?'All':'Όλα'}</option>{REPORT_KINDS.map(item=><option key={item.value} value={item.value}>{item.label[en?1:0]}</option>)}<option value="deviation">{en?'Deviation':'Απόκλιση'}</option></FilterSelect>
   <FilterSelect label={en?'Category':'Κατηγορία'} value={filters.category} onChange={value=>set('category',value)}><option value="all">{en?'All':'Όλες'}</option>{view.categories.map(value=><option key={value} value={value}>{incidentCategoryLabel(value,categories,language)}</option>)}</FilterSelect>
   <FilterSelect label={en?'Source':'Πηγή'} value={filters.source} onChange={value=>set('source',value)}><option value="all">{en?'All':'Όλες'}</option>{REGISTER_SOURCES.map(item=><option key={item.value} value={item.value}>{item.label[en?1:0]}</option>)}</FilterSelect>
   <FilterSelect label={t('status')} value={filters.status} onChange={value=>set('status',value)}><option value="all">{t('all')}</option>{statuses.map(value=><option key={value} value={value}>{t(value)}</option>)}<option value="withoutCapa">{en?'Without CAPA':'Χωρίς ενέργεια'}</option></FilterSelect>
   <FilterSelect label={t('department')} value={filters.department} onChange={value=>set('department',value)}><option value="all">{t('allDepartments')}</option>{view.departments.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>
   <FilterSelect label={en?'Deviations from':'Αποκλίσεις από'} value={String(view.days)} onChange={value=>view.setDays(Number(value))}>{PERIODS.map(value=><option key={value} value={value}>{en?`Last ${value} days`:`Τελευταίες ${value} ημέρες`}</option>)}</FilterSelect>
  </FilterBar>
  <div className="scroll-table" ref={registry?.scrollRef}>
   <RegistryTable bare className="quality-table quality-register-table" rows={pagedItems} rowKey={row=>row.key} empty={!loading&&!items.length}
    columns={[{key:'code',label:t('code')},{key:'title',label:t('title')},{key:'kind',label:en?'Kind · source':'Είδος · πηγή'},{key:'department',label:t('department')},{key:'date',label:t('date')},{key:'owner',label:t('owner')},{key:'status',label:t('status')}]}
    emptyTitle={en?'Nothing to show':'Δεν υπάρχει κάτι να εμφανιστεί'} emptyText={en?'Reports and deviations without a CAPA appear here.':'Εδώ εμφανίζονται οι αναφορές και οι αποκλίσεις χωρίς διορθωτική ενέργεια.'}
    rowProps={row=>row.type==='report'?{...(registry?.rowProps(row.id)||{}),onClick:()=>onOpenReport(row,items)}:{className:'quality-register-deviation'}}
    renderRow={row=>{const Icon=KIND_ICON[row.kind]||FileWarning;return <>
     <td><strong>{row.code}</strong>{row.sentinel&&<StatusBadge tone="danger" icon={AlertOctagon}>Sentinel</StatusBadge>}{row.type==='report'&&!row.sentinel&&row.severity&&<small>{t(row.severity)}</small>}</td>
     <td>{en?row.titleEn:row.title}{row.category&&<small>{incidentCategoryLabel(row.category,categories,language)}</small>}{row.type==='deviation'&&row.item.notes&&<small>{row.item.notes}</small>}</td>
     <td><span className="quality-register-kind"><Icon size={14} aria-hidden="true"/>{kindText(row.kind,language)}</span><small>{sourceText(row.source,language)}</small></td>
     <td>{(en?row.departmentEn:row.department)||'—'}{row.source==='training'&&row.item.detail&&<small>{row.item.detail==='partial'?(en?'Partly effective':'Μερικώς αποτελεσματική'):(en?'Not effective':'Μη αποτελεσματική')}</small>}</td>
     <td className="nowrap-cell">{formatDay(row.date,language)||'—'}</td>
     <td>{row.owner||'—'}</td>
     <td>{row.type==='deviation'?<div className="row-actions quality-register-actions">
      <StatusBadge tone="warning">{en?'Without CAPA':'Χωρίς ενέργεια'}</StatusBadge>
      <IconButton size="sm" label={en?'Open source record':'Άνοιγμα εγγραφής προέλευσης'} onClick={()=>goTo(row.item.path,{returnTo:'/quality'})}><ExternalLink size={15}/></IconButton>
      <ActionButton tone="primary" label={en?'Create CAPA':'Δημιουργία διορθωτικής ενέργειας'} onClick={()=>onCreateCapa(capaPrefill(row.item,language))}><Plus size={15}/><span>{en?'CAPA':'Ενέργεια'}</span></ActionButton>
     </div>:<StatusBadge tone={qualityStatusTone(row.status)}>{t(row.status)}</StatusBadge>}</td>
    </>}}/>
  </div>
  <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={items.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
 </>
}
