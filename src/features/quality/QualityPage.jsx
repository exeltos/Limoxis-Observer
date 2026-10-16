import { useEffect,useMemo,useRef,useState } from 'react'
import { AlertTriangle,CheckSquare2,ClipboardCheck,ClipboardList,ClipboardSignature,Clock3,FileSpreadsheet,FileWarning,Plus,SearchCheck,ShieldAlert,Target,TrendingDown,UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { ActionButton } from '../../design-system/ActionButton'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { DownloadMenu } from '../../design-system/DownloadMenu'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { MetricCard } from '../../design-system/MetricCard'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can,CAPABILITIES,ROLES } from '../../core/permissions/roles'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { readSessionValue,writeSessionValue } from '../../core/storage/browserStorage'
import { formatDay } from '../../core/i18n/formatDay'
import { exportRegistry,qualityExport } from '../../core/export/registryExports'
import { QUALITY_RETURN_KEY as RETURN_KEY,qualityTabOf } from './qualityReturnSection'
import { loadQualityRecords } from './qualityService'
import { ReportRegister,reportRegisterExport,useDeviationQueue,useReportRegister } from './QualityReportRegister'
import { ActionsList,AuditsList,actionRows,filterActions,filterAudits,isOverdueAction,useListFilters } from './QualityLists'
import { useLibraries } from '../management/useLibraries'
import { RiskAssessmentsPanel } from './risk/RiskAssessmentsPanel'
import { useRiskAssessmentList } from './risk/useRiskAssessmentList'
import { summarizeRisks } from './risk/riskModel'
import { RegistersPanel,useRegisterList } from '../registers/RegistersPanel'
import { registerKindLabel,registerStatusLabel } from '../registers/registerText'
import { ObjectiveDialog,ObjectivesTable,ReviewsTable,newObjective,objectivesExport,reviewsExport,useObjectives,useReviews } from './review/QualityObjectives'
import './quality.css'

// The Quality Center follows the same frame as the other modules: one row of
// figures that need attention (the same on every tab), the tabs, then one card
// with the filter row, the list and the pager. «Create» is always top right.
const TABS=[
 {value:'reports',icon:AlertTriangle,label:['Αναφορές','Reports']},
 {value:'actions',icon:CheckSquare2,label:['Ευρήματα & ενέργειες','Findings & actions']},
 {value:'audits',icon:ClipboardCheck,label:['Επιθεωρήσεις','Audits']},
 {value:'risks',icon:ShieldAlert,label:['Κίνδυνοι','Risks']},
 {value:'measure',icon:Target,label:['Μέτρηση & Ανασκόπηση','Measurement & review']},
]
const MEASURE_OPTIONS=[
 {value:'registers',icon:ClipboardList,label:['Μητρώα','Registers']},
 {value:'objectives',icon:Target,label:['Στόχοι','Objectives']},
 {value:'reviews',icon:ClipboardSignature,label:['Ανασκοπήσεις','Reviews']},
]
const ACTION_DEFAULTS={query:'',kind:'all',status:'all',department:'all',quick:null}
const AUDIT_DEFAULTS={query:'',status:'all',type:'all',department:'all',mode:'list'}

// The incidents, findings, corrective actions and audits, loaded once: the
// figures above the tabs read all of them.
function useQualityRecords(organizationId){
 const [data,setData]=useState({incidents:[],findings:[],capas:[],audits:[]})
 const [loading,setLoading]=useState(true)
 useEffect(()=>{
  let active=true
  setLoading(true)
  const sections=['incidents','findings','capas','audits']
  Promise.all(sections.map(section=>loadQualityRecords(section,organizationId).catch(()=>[])))
   .then(lists=>{if(active)setData(Object.fromEntries(sections.map((section,index)=>[section,lists[index]])))})
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[organizationId])
 return {data,loading}
}

export function QualityPage(){
 const {t,language,locale}=useLanguage()
 const en=language==='en'
 const L=(el,enText)=>en?enText:el
 const {role,membership,tenant,actualRole,isRolePreview}=useTenant()
 const navigate=useNavigate()
 const {goTo}=useContextualNavigation('/quality')
 // Entering Quality always starts on Reports; the last tab is restored only
 // when coming back from a record opened here (the flag is consumed once).
 const [initial]=useState(()=>qualityTabOf(readSessionValue(RETURN_KEY,''))||{tab:'reports',view:null})
 useEffect(()=>{writeSessionValue(RETURN_KEY,'')},[])
 const [tab,setTab]=useState(initial.tab)
 const [measureView,setMeasureView]=useState(initial.view||'registers')
 const registry=useRegistryMemory(`quality.${tab}`)

 const addOns=membership?.capabilities??[];const custom=membership?.customCapabilities??[]
 const ownerFullAccess=!isRolePreview&&actualRole===ROLES.PLATFORM_OWNER
 const canManage=ownerFullAccess||can(role,CAPABILITIES.MANAGE_QUALITY,addOns,custom)
 const canReportIncident=ownerFullAccess||can(role,CAPABILITIES.REPORT_INCIDENT,addOns,custom)

 const records=useQualityRecords(tenant?.id)
 const queue=useDeviationQueue(tenant?.id,canManage)
 const {libraries}=useLibraries()
 const categories=libraries.incidentCategories||[]
 const register=useReportRegister(records.data.incidents,queue.sources,language)
 const actions=useMemo(()=>actionRows(records.data.findings,records.data.capas),[records.data.findings,records.data.capas])
 const actionView=useListFilters('quality.actions',ACTION_DEFAULTS)
 const auditView=useListFilters('quality.audits',AUDIT_DEFAULTS)
 const riskList=useRiskAssessmentList(tenant?.id,tab==='risks')
 const [riskCreating,setRiskCreating]=useState(false)
 const riskFile=useRef(null)
 const registerList=useRegisterList()
 const objectives=useObjectives(tenant?.id)
 const reviews=useReviews(tenant?.id)
 const [objectiveFilters,setObjectiveFilters]=useState({query:'',state:'all'})
 const [reviewQuery,setReviewQuery]=useState('')
 const [editingObjective,setEditingObjective]=useState(null)

 const visibleObjectives=useMemo(()=>{const q=objectiveFilters.query.trim().toLowerCase();return objectives.objectives.filter(item=>!q||`${item.code} ${item.title} ${item.ownerLabel||''}`.toLowerCase().includes(q)).filter(item=>objectiveFilters.state==='all'||item.current.status===objectiveFilters.state)},[objectives.objectives,objectiveFilters])
 const visibleReviews=useMemo(()=>{const q=reviewQuery.trim().toLowerCase();return reviews.reviews.filter(item=>!q||`${item.code} ${item.reviewDate||''}`.toLowerCase().includes(q))},[reviews.reviews,reviewQuery])

 // What needs attention now, across the whole Center. Each figure opens its list, filtered.
 const overdueActions=actions.filter(isOverdueAction).length
 const missedObjectives=objectives.objectives.filter(item=>item.current.status==='missed').length
 const figures=[
  {key:'open',icon:Clock3,value:register.counts.open,label:L('Ανοιχτές αναφορές','Open reports'),active:tab==='reports'&&register.filters.quick==='open',go:()=>{setTab('reports');register.set('quick',register.filters.quick==='open'&&tab==='reports'?null:'open')}},
  {key:'deviations',icon:FileWarning,value:register.counts.deviations,label:L('Αποκλίσεις χωρίς ενέργεια','Deviations without action'),active:tab==='reports'&&register.filters.quick==='deviations',go:()=>{setTab('reports');register.set('quick',register.filters.quick==='deviations'&&tab==='reports'?null:'deviations')}},
  {key:'overdue',icon:AlertTriangle,value:overdueActions,label:L('Εκπρόθεσμες ενέργειες','Overdue actions'),active:tab==='actions'&&actionView.filters.quick==='overdue',go:()=>{setTab('actions');actionView.set('quick',actionView.filters.quick==='overdue'&&tab==='actions'?null:'overdue')}},
  {key:'objectives',icon:TrendingDown,value:objectives.loading?'—':missedObjectives,label:L('Στόχοι που δεν επιτυγχάνονται','Objectives not met'),active:tab==='measure'&&measureView==='objectives'&&objectiveFilters.state==='missed',go:()=>{const on=tab==='measure'&&measureView==='objectives'&&objectiveFilters.state==='missed';setTab('measure');setMeasureView('objectives');setObjectiveFilters(current=>({...current,state:on?'all':'missed'}))}},
 ]

 // Where «Back» from a record or a new record returns.
 const returnValue=tab==='measure'?`measure:${measureView}`:tab
 const remember=()=>writeSessionValue(RETURN_KEY,returnValue)
 const create=path=>()=>{remember();goTo(path,{registry:`quality.${tab}`})}
 const openRecord=(path,id,ids)=>{remember();registry.openRecord(navigate,path,id,ids)}

 const createOptions=({
  reports:canManage||canReportIncident?[{id:'report',label:L('Αναφορά συμβάντος','Incident report'),icon:AlertTriangle,onClick:create('/quality/incidents/new')}]:[],
  actions:canManage?[{id:'capa',label:L('Διορθωτική ενέργεια','Corrective action'),icon:CheckSquare2,onClick:create('/quality/capas/new')},{id:'finding',label:L('Εύρημα','Finding'),icon:SearchCheck,onClick:create('/quality/findings/new')}]:[],
  audits:canManage?[{id:'audit',label:L('Επιθεώρηση','Audit'),icon:ClipboardCheck,onClick:create('/quality/audits/new')}]:[],
  risks:canManage?[{id:'assessment',label:L('Εκτίμηση κινδύνου','Risk assessment'),icon:ShieldAlert,onClick:()=>setRiskCreating(true)},{id:'import',label:L('Εισαγωγή από Excel','Import from Excel'),icon:FileSpreadsheet,onClick:()=>riskFile.current?.click()}]:[],
  measure:canManage?[{id:'register',label:L('Μητρώο τμήματος','Department register'),icon:ClipboardList,onClick:()=>{remember();goTo('/registers/new')}},{id:'objective',label:L('Στόχος ποιότητας','Quality objective'),icon:Target,onClick:()=>{setMeasureView('objectives');setEditingObjective(newObjective())}},{id:'review',label:L('Ανασκόπηση Διοίκησης','Management review'),icon:ClipboardSignature,onClick:()=>{setMeasureView('reviews');writeSessionValue(RETURN_KEY,'measure:reviews');navigate('/quality/reviews/new')}}]:[],
 })[tab]

 const download=({
  reports:<DownloadMenu disabled={!register.filtered.length} onExcel={()=>exportRegistry(reportRegisterExport(register.filtered,{language,t,categories}))}/>,
  actions:(()=>{const rows=filterActions(actions,actionView.filters,en);const findings=rows.filter(row=>row.kind==='finding'),capas=rows.filter(row=>row.kind==='capa');return <DownloadMenu items={[{id:'findings',label:L('Ευρήματα (.csv)','Findings (.csv)'),disabled:!findings.length,onClick:()=>exportRegistry(qualityExport('findings',findings,{en,t}))},{id:'capas',label:L('Διορθωτικές ενέργειες (.csv)','Corrective actions (.csv)'),disabled:!capas.length,onClick:()=>exportRegistry(qualityExport('capas',capas,{en,t}))}]}/>})(),
  audits:(()=>{const rows=filterAudits(records.data.audits,auditView.filters,en);return <DownloadMenu disabled={!rows.length} onExcel={()=>exportRegistry(qualityExport('audits',rows,{en,t}))}/>})(),
  risks:<DownloadMenu disabled={!riskList.items.length} onExcel={()=>exportRegistry(riskAssessmentsExport(riskList.items,language))}/>,
  measure:measureView==='registers'?<DownloadMenu disabled={!registerList.registers.length} onExcel={()=>exportRegistry(registersExport(registerList.registers,language))}/>:measureView==='objectives'?<DownloadMenu disabled={!visibleObjectives.length} onExcel={()=>exportRegistry(objectivesExport(visibleObjectives,language))}/>:<DownloadMenu disabled={!visibleReviews.length} onExcel={()=>exportRegistry(reviewsExport(visibleReviews,language))}/>,
 })[tab]

 const measureSwitch=<ModeSwitch ariaLabel={L('Προβολή','View')} value={measureView} onChange={setMeasureView} options={MEASURE_OPTIONS.map(option=>({value:option.value,icon:option.icon,label:option.label[en?1:0]}))}/>

 return <Page fill className="registry-fill-page" title={t('quality')} subtitle={L('Από την αναφορά και το εύρημα ως τη διορθωτική ενέργεια, τους στόχους και την Ανασκόπηση Διοίκησης.','From the report and the finding to the corrective action, the objectives and the management review.')}
  actions={<div className="row-actions">
   {download}
   {tab==='reports'&&canReportIncident&&<ActionButton label={L('Οι αναφορές συμβάντων μου','My incident reports')} tone="neutral" onClick={()=>goTo('/quality/my-reports')}><UserRound size={17}/><span>{L('Οι αναφορές μου','My reports')}</span></ActionButton>}
   <CreateAction options={createOptions} label={L('Δημιουργία','Create')}/>
  </div>}>
  <div className="workspace-summary"><div className="module-summary-strip">
   {figures.map(figure=><MetricCard key={figure.key} icon={figure.icon} value={figure.value} label={figure.label} onClick={figure.go} active={figure.active}/>)}
  </div></div>
  <CanonicalTabs items={TABS.map(item=>({value:item.value,icon:item.icon,label:item.value==='reports'&&canManage?L('Αναφορές & αποκλίσεις','Reports & deviations'):item.label[en?1:0],count:item.value==='reports'?register.counts.deviations:item.value==='actions'?overdueActions:0}))} value={tab} onChange={setTab} ariaLabel={t('quality')}/>
  <section className="surface registry-workspace workspace-column workspace-fill">
   {tab==='reports'&&<ReportRegister view={register} loading={records.loading||queue.loading} language={language} t={t} categories={categories} registry={registry}
    onCreateCapa={prefill=>{writeSessionValue(RETURN_KEY,'reports');goTo('/quality/capas/new',{registry:'quality.actions',state:{qualitySource:prefill}})}}
    onOpenReport={(row,items)=>openRecord(`/quality/incidents/${row.id}`,row.id,items.filter(item=>item.type==='report').map(item=>item.id))}/>}
   {tab==='actions'&&<ActionsList rows={actions} view={actionView} loading={records.loading} language={language} t={t} registry={registry}
    onOpen={(row,same)=>openRecord(`/quality/${row.kind==='capa'?'capas':'findings'}/${row.id}`,row.id,same.map(item=>item.id))}/>}
   {tab==='audits'&&<AuditsList rows={records.data.audits} view={auditView} loading={records.loading} language={language} t={t} registry={registry}
    onOpen={(row,same)=>openRecord(`/quality/audits/${row.id}`,row.id,same.map(item=>item.id))}/>}
   {tab==='risks'&&<RiskAssessmentsPanel list={riskList} organizationId={tenant?.id} en={en} locale={locale} creating={riskCreating} onCreatingChange={setRiskCreating} fileRef={riskFile}/>}
   {tab==='measure'&&measureView==='registers'&&<RegistersPanel list={registerList} onBeforeOpen={remember} filterEnd={measureSwitch}/>}
   {tab==='measure'&&measureView==='objectives'&&<>
    <FilterBar query={objectiveFilters.query} onQueryChange={query=>setObjectiveFilters(current=>({...current,query}))} placeholder={L('Αναζήτηση στόχου ή υπευθύνου','Search objective or owner')} activeAdvancedCount={objectiveFilters.state!=='all'?1:0} onClear={()=>setObjectiveFilters({query:'',state:'all'})} end={measureSwitch}>
     <FilterSelect label={t('status')} value={objectiveFilters.state} onChange={state=>setObjectiveFilters(current=>({...current,state}))}><option value="all">{t('all')}</option><option value="missed">{L('Δεν επιτυγχάνεται','Not met')}</option><option value="met">{L('Επιτυγχάνεται','Met')}</option><option value="pending">{L('Σε εξέλιξη','In progress')}</option></FilterSelect>
    </FilterBar>
    <ObjectivesTable rows={visibleObjectives} loading={objectives.loading} onOpen={objective=>canManage&&setEditingObjective(objective)}/>
   </>}
   {tab==='measure'&&measureView==='reviews'&&<>
    <FilterBar query={reviewQuery} onQueryChange={setReviewQuery} placeholder={L('Αναζήτηση ανασκόπησης','Search review')} onClear={()=>setReviewQuery('')} end={measureSwitch}/>
    <ReviewsTable rows={visibleReviews} loading={reviews.loading} onOpen={review=>{writeSessionValue(RETURN_KEY,'measure:reviews');navigate(`/quality/reviews/${review.id}`)}}/>
   </>}
  </section>
  {editingObjective&&<ObjectiveDialog objective={editingObjective} registers={objectives.registers} onClose={()=>setEditingObjective(null)} onSaved={()=>{setEditingObjective(null);void objectives.reload()}}/>}
 </Page>
}

// The page's main action: one button, or a menu when the tab can create more than one thing.
function CreateAction({options,label}){
 if(!options.length)return null
 if(options.length===1){const [only]=options;return <ActionButton label={only.label} tone="primary" onClick={only.onClick}><Plus size={18}/><span>{label}</span></ActionButton>}
 return <OverflowMenu label={label} triggerTone="primary" width={240} trigger={<><Plus size={18} aria-hidden="true"/>{label}</>} items={options}/>
}

function riskAssessmentsExport(items,language){
 const en=language==='en'
 return {
  name:en?'risk-assessments':'ektimiseis-kindynou',
  headers:en?['Code','Period','Assessment','Date','Next assessment','Risks','Very high (residual)','High (residual)','Status']:['Κωδικός','Περίοδος','Εκτίμηση','Ημερομηνία','Επόμενη αξιολόγηση','Κίνδυνοι','Πολύ υψηλοί (υπολειπόμενοι)','Υψηλοί (υπολειπόμενοι)','Κατάσταση'],
  rows:items.map(item=>{const summary=summarizeRisks(item.risks||[]);return [item.code,item.periodLabel,(en?item.titleEn:item.title)||item.title,formatDay(item.assessedOn,language),formatDay(item.nextReviewOn,language),summary.total,summary.levels.residual.very_high,summary.levels.residual.high,item.status]}),
 }
}

function registersExport(registers,language){
 const en=language==='en'
 return {
  name:en?'department-registers':'mitroa-tmimaton',
  headers:en?['Code','Register','Department','Kind','Entries','Last entry','Indicators','Status']:['Κωδικός','Μητρώο','Τμήμα','Είδος','Καταχωρίσεις','Τελευταία καταχώριση','Δείκτες','Κατάσταση'],
  rows:registers.map(item=>[item.code,en?item.nameEn:item.name,en?item.departmentEn:item.department,registerKindLabel(item.kind,language),item.entryCount??0,formatDay(item.lastEntry,language),item.indicators?.length||0,registerStatusLabel(item.status,language)]),
 }
}
