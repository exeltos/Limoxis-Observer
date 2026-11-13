import { useCallback,useEffect,useMemo,useRef,useState } from 'react'
import { STALE_DAYS,isStaleRegister as isStale } from '../registers/registerFigures'
import { KpiFigures, type KpiFigure } from '../../design-system/KpiCard'
import { AlertOctagon,AlertTriangle,CalendarClock,CheckSquare2,ClipboardCheck,ClipboardList,Clock3,FileSpreadsheet,FileWarning,Gauge,LayoutDashboard,ListChecks,Plus,ShieldAlert,ShieldCheck,Smile,Star,Stethoscope,Target,TrendingDown,Truck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page,PageEmbedProvider } from '../../design-system/Page'
import { ActionButton } from '../../design-system/ActionButton'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { ExportMenu } from '../../design-system/ExportMenu'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { PageSkeleton } from '../../design-system/LoadingSkeleton'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuth } from '../../core/auth/AuthContext'
import { can,CAPABILITIES,ROLES } from '../../core/permissions/roles'
import { registryStorageKey,useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { readSessionValue,writeSessionJson,writeSessionValue } from '../../core/storage/browserStorage'
import { formatDay } from '../../core/i18n/formatDay'
import { exportRegistry,printRegistry,qualityExport,type RegistryExport } from '../../core/export/registryExports'
import { QUALITY_RETURN_KEY as RETURN_KEY,qualityTabOf } from './qualityReturnSection'
import { fillAuditProgramme,loadQualityRecords } from './qualityService'
import { DeviationQueue,ReportRegister,deviationsExport,reportRegisterExport,useDeviationQueue,useDeviations,useIncidentRegister,useReportRegister } from './QualityReportRegister'
import { printReport, type ReportDoc } from '../../core/export/reportDocument'
import { PrintOptionsDialog } from '../../design-system/PrintOptionsDialog'
import { ExcelFieldsDialog,pickColumns,tableFields } from '../../design-system/ExcelFieldsDialog'
import { incidentRegisterDoc,incidentStatisticsDoc } from './incidentReports'
import { actionsReportDoc } from './actionReports'
import { auditDetailedBatchDocument,auditFindingsExport } from './audits/auditReport'
import { QualityOverview } from './QualityOverview'
import { ActionsList,AUDIT_VIEWS,AuditsList,AuditsSummary,actionCounts,actionRows,auditCounts,auditRows,filterActions,filterAudits,isOverdueAction,useListFilters } from './QualityLists'
import { capaSourceFor } from './qualityDeviations'
import { sourceKindLabel } from './capaSources'
import { useLibraries } from '../management/useLibraries'
import { RiskAssessmentsPanel } from './risk/RiskAssessmentsPanel'
import { useRiskAssessmentList } from './risk/useRiskAssessmentList'
import { summarizeRisks } from './risk/riskModel'
import { IndicatorsPage } from '../indicators/IndicatorsPage'
import { RegistersPanel,useRegisterList } from '../registers/RegistersPanel'
import { registerKindLabel,registerStatusLabel } from '../registers/registerText'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { ObjectivesTable,objectivesExport,useObjectives } from './review/QualityObjectives'
import { loadDossierExtras,loadObjectiveHistories,objectivesDossier,objectivesListDoc } from './review/objectiveDossier'
import { OBJECTIVE_LEVELS,levelLabel } from './review/objectiveSources'
import { loadReviews } from './review/reviewService'
import { SurveysList,filterSurveys,surveysExport,useSurveys } from './surveys/SurveysPanel'
import { isSurveyOpen } from './surveys/surveyModel'
import { EquipmentList,SuppliersList,useResources } from './resources/ResourcesPanel'
import { NO_EQUIPMENT_FILTERS,NO_SUPPLIER_FILTERS,equipmentCounts,equipmentExport,filterEquipment,filterSuppliers,supplierCounts,suppliersExport } from './resources/resourceModel'
import { deviationsReportDoc } from './deviationReports'
import { RegistryTotals } from '../../design-system/RegistryTotals'
import { groupedListDoc } from './listReports'
import { supplierEvaluationsSheet } from './resources/supplierEvaluationReport'
import './quality.css'
import { hospitalToday } from '../../core/dates/hospitalDate'
import type { ObjectiveView, PlanObjective } from './review/reviewTypes'
import type { SurveyFilters } from './surveys/surveyTypes'
import type { RiskAssessment } from './risk/riskTypes'
import type { Register } from '../registers/registerTypes'
import type { ComponentProps } from 'react'
import type { ActionFilters, AuditFilters, CreateOption, DeviationItem, QualityRecord, TabFigure } from './qualityTypes'

// What the objectives' annual dossier is printed from (loaded when the objectives are shown).
type DossierData = { histories: Awaited<ReturnType<typeof loadObjectiveHistories>>, reviews: Awaited<ReturnType<typeof loadReviews>>, extras: Awaited<ReturnType<typeof loadDossierExtras>> | null }

// Intake and governance are deliberately separate:
// Report (staff) → Quality assessment/classification → Incident and/or
// Deviation → corrective action → effectiveness → closure.
const TABS=[
 {value:'overview',icon:LayoutDashboard,label:['Επισκόπηση','Overview']},
 {value:'reports',icon:AlertTriangle,label:['Αναφορές','Reports']},
 {value:'incidents',icon:AlertOctagon,label:['Συμβάντα','Incidents']},
 {value:'deviations',icon:FileWarning,label:['Αποκλίσεις','Deviations'],manage:true},
 {value:'actions',icon:CheckSquare2,label:['Ενέργειες','Actions']},
 {value:'audits',icon:ClipboardCheck,label:['Επιθεωρήσεις','Audits']},
 {value:'risks',icon:ShieldAlert,label:['Κίνδυνοι','Risks']},
 {value:'indicators',icon:Target,label:['Δείκτες & Στόχοι','Indicators & objectives']},
 // Equipment is kept (its pages and data) but not shown here for now: the tab holds the suppliers.
 {value:'resources',icon:Truck,label:['Προμηθευτές','Suppliers']},
]
const INDICATOR_OPTIONS=[
 {value:'indicators',icon:Gauge,label:['Δείκτες','Indicators']},
 {value:'registers',icon:ClipboardList,label:['Μητρώα','Registers']},
 {value:'objectives',icon:Target,label:['Στόχοι','Objectives']},
 {value:'surveys',icon:Smile,label:['Ερωτηματολόγια','Questionnaires']},
]
// «Create» in Indicators & objectives makes what the open tab lists (owner, 6/11/2026).
const MEASURE_CREATE: Record<string, string>={indicators:'indicator',registers:'register',objectives:'objective',surveys:'survey'}
const EQUIPMENT_SHOWN=false
const RESOURCE_OPTIONS=[
 ...(EQUIPMENT_SHOWN?[{value:'equipment',icon:Stethoscope,label:['Εξοπλισμός','Equipment']}]:[]),
 {value:'suppliers',icon:Truck,label:['Προμηθευτές','Suppliers']},
]
const ACTION_DEFAULTS={query:'',kind:'all',status:'all',department:'all',source:'all',quick:null,dueFrom:'',dueTo:''}
const AUDIT_DEFAULTS={query:'',status:'all',type:'all',standard:'all',department:'all',cycle:'all',mode:'programme',quick:null}

function useQualityRecords(organizationId: string | null | undefined){
 const [data,setData]=useState<Record<string, QualityRecord[]>>({incidents:[],findings:[],capas:[],audits:[]})
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState(false)
 const [version,setVersion]=useState(0)
 useEffect(()=>{
  let active=true
  setLoading(true)
  const sections=['incidents','findings','capas','audits']
  let failed=false
  Promise.all(sections.map(section=>loadQualityRecords(section,organizationId).catch(()=>{failed=true;return []})))
   .then(lists=>{if(active){setData(Object.fromEntries(sections.map((section,index)=>[section,lists[index]])));setError(failed)}})
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[organizationId,version])
 return {data,loading,error,reload:()=>setVersion(value=>value+1)}
}

// `section="measures"` (/quality/measures) is «Indicators & objectives» on a page of its own: indicators,
// registers, objectives and surveys; the Quality Center keeps the rest.
export function QualityPage({section=''}: { section?: string }={}){
 const measures=section==='measures'
 const {t,language,locale}=useLanguage()
 const en=language==='en'
 const L=(el: string,enText: string)=>en?enText:el
 const [incidentDialog,setIncidentDialog]=useState<string | null>(null)
 const {role,membership,tenant,actualRole,isRolePreview,moduleEnabled}=useTenant()
 const {notify,confirm}=useFeedback()
 // Where «Indicators» puts its «Export» and «⋯» (the top bar).
 const [indicatorActions,setIndicatorActions]=useState<HTMLDivElement | null>(null)
 const {user}=useAuth()
 const suppliersOn=moduleEnabled('suppliers')
 const navigate=useNavigate()
 const {goTo}=useContextualNavigation('/quality')
 const [initial]=useState(()=>qualityTabOf(new URLSearchParams(window.location.search).get('tab'))||qualityTabOf(readSessionValue(RETURN_KEY,''))||{tab:measures?'indicators':'overview',view:null})
 // A return to «Indicators & objectives» that lands on the Quality Center goes on to its page.
 const toMeasures=!measures&&initial.tab==='indicators'
 useEffect(()=>{if(toMeasures){writeSessionValue(RETURN_KEY,`indicators:${initial.view||'indicators'}`);navigate('/quality/measures',{replace:true})}else writeSessionValue(RETURN_KEY,'')},[]) // eslint-disable-line react-hooks/exhaustive-deps
 const [tabState,setTab]=useState(measures?'indicators':initial.tab)
 // The Quality Center and «Indicators & objectives» are one page: going from the second to the first keeps the page (and
 // its last tab), so the Center never shows the indicators tab (it is not one of its tabs).
 const tab=measures?'indicators':tabState==='indicators'?'overview':tabState
 const [measureView,setMeasureView]=useState(initial.tab==='indicators'&&initial.view||'indicators')
 const [resourceView,setResourceView]=useState(()=>EQUIPMENT_SHOWN?(initial.tab==='resources'&&initial.view||'equipment'):'suppliers')
 useEffect(()=>{if(EQUIPMENT_SHOWN&&!suppliersOn&&resourceView==='suppliers')setResourceView('equipment')},[suppliersOn,resourceView])
 const [equipmentFilters,setEquipmentFilters]=useState(NO_EQUIPMENT_FILTERS)
 const [supplierFilters,setSupplierFilters]=useState(NO_SUPPLIER_FILTERS)
 const [surveyFilters,setSurveyFilters]=useState<SurveyFilters>({query:'',audience:'all',status:'all',quick:null})
 const registry=useRegistryMemory(`quality.${tab}`)

 const addOns=membership?.capabilities??[];const custom=membership?.customCapabilities??[]
 const ownerFullAccess=!isRolePreview&&actualRole===ROLES.PLATFORM_OWNER
 const canManage=ownerFullAccess||can(role,CAPABILITIES.MANAGE_QUALITY,addOns,custom)
 const canManageIndicators=ownerFullAccess||can(role,CAPABILITIES.MANAGE_INDICATORS,addOns,custom)
 const canReportIncident=ownerFullAccess||can(role,CAPABILITIES.REPORT_INCIDENT,addOns,custom)

 const records=useQualityRecords(tenant?.id)
 const [fillingProgramme,setFillingProgramme]=useState(false)
 const fillProgramme=async()=>{
  if(!await confirm({title:L('Προγραμματισμός επιθεωρήσεων','Plan the audits'),message:L('Να προγραμματιστεί η επόμενη επιθεώρηση για κάθε τμήμα που δεν έχει;','Plan the next audit for every department that has none?'),confirmLabel:L('Προγραμματισμός','Plan')}))return
  setFillingProgramme(true)
  try{const count=await fillAuditProgramme(tenant?.id,records.data.audits,user?.id||null);records.reload();notify(count?L(`Προγραμματίστηκαν ${count} επιθεωρήσεις.`,`${count} audits planned.`):L('Όλα τα τμήματα έχουν επόμενη επιθεώρηση.','Every department has a next audit.'),'success')}
  catch{notify(L('Δεν ήταν δυνατός ο προγραμματισμός. Δοκιμάστε ξανά.','The audits could not be planned. Try again.'),'error')}
  finally{setFillingProgramme(false)}
 }
 const queue=useDeviationQueue(tenant?.id,canManage)
 const {libraries}=useLibraries()
 const categories=libraries.incidentCategories||[]
 const register=useReportRegister(records.data.incidents,records.data.capas,language)
 const incidents=useIncidentRegister(records.data.incidents,records.data.capas,language)
 const deviations=useDeviations(queue.sources,language)
 const actions=useMemo(()=>actionRows(records.data.findings,records.data.capas,records.data.incidents),[records.data.findings,records.data.capas,records.data.incidents])
 const audits=useMemo(()=>auditRows(records.data.audits,records.data.findings),[records.data.audits,records.data.findings])
 const actionView=useListFilters<ActionFilters>('quality.actions',ACTION_DEFAULTS)
 const auditView=useListFilters<AuditFilters>('quality.audits',AUDIT_DEFAULTS)
 const riskList=useRiskAssessmentList(tenant?.id,true)
 const [riskCreating,setRiskCreating]=useState(false)
 const riskFile=useRef<HTMLInputElement>(null)
 const [riskRows,setRiskRows]=useState<RiskAssessment[]>([])
 const [registerRows,setRegisterRows]=useState<Register[]>([])
 const [staleOnly,setStaleOnly]=useState(false)
 const registerList=useRegisterList()
 const objectives=useObjectives(tenant?.id)
 // The auditor's file of the year's objectives: the months of each and the last management review, read once the objectives are on screen.
 const [dossierData,setDossierData]=useState<DossierData | null>(null)
 const [objectiveFilters,setObjectiveFilters]=useState({query:'',state:'all',year:'auto',level:'all'})
 const dossierYear=objectiveFilters.year==='auto'||objectiveFilters.year==='all'?new Date().getFullYear():Number(objectiveFilters.year)
 useEffect(()=>{if(tab!=='indicators'||measureView!=='objectives'||objectives.loading||!tenant?.id){return undefined}let live=true;Promise.all([loadObjectiveHistories(tenant.id,objectives.objectives,objectives.definitions),loadReviews(tenant.id).catch(()=>[]),loadDossierExtras(tenant.id,dossierYear).catch(()=>null)]).then(([histories,reviews,extras])=>{if(live)setDossierData({histories,reviews,extras})}).catch(()=>{if(live)setDossierData(null)});return()=>{live=false}},[tab,measureView,objectives.loading,objectives.objectives,objectives.definitions,tenant?.id,dossierYear])
 const surveys=useSurveys()
 const visibleSurveys=useMemo(()=>filterSurveys(surveys.surveys,surveyFilters),[surveys.surveys,surveyFilters])
 const resources=useResources(tab==='resources')
 const visibleEquipment=useMemo(()=>filterEquipment(resources.equipment,equipmentFilters),[resources.equipment,equipmentFilters])
 const visibleSuppliers=useMemo(()=>filterSuppliers(resources.suppliers,supplierFilters),[resources.suppliers,supplierFilters])

 // The year of the objectives shown: this year's when there are any, else all (the older years stay one choice away).
 const objectiveYears=useMemo(()=>[...new Set(objectives.objectives.map(item=>item.year).filter(Boolean))].sort((a,b)=>b-a),[objectives.objectives])
 const objectiveYear=objectiveFilters.year==='auto'?(objectiveYears.includes(new Date().getFullYear())?String(new Date().getFullYear()):'all'):objectiveFilters.year
 const inObjectiveYear=(item: { year?: unknown })=>objectiveYear==='all'||String(item.year)===objectiveYear
 const isMissed=(item: ObjectiveView)=>(item.status||'active')==='active'&&item.current.status==='missed'
 // All the hospital's objectives in one list: its own, the departments' and the committees' (with the committees' annual plans).
 const planRows=useMemo<PlanObjective[]>(()=>objectives.committeeTargets.map(item=>({...item,kind:'plan',level:'committee'})),[objectives.committeeTargets])
 // The objectives' totals count what the year, level and search leave; each one sets the state filter.
 const setObjectiveState=(state: string)=>setObjectiveFilters(current=>({...current,state:current.state===state?'all':state}))
 const objectivesLoaded=!objectives.loading
 const objectiveBase=useMemo(()=>{const q=objectiveFilters.query.trim().toLowerCase();return [...objectives.objectives,...planRows].filter(item=>objectiveYear==='all'||String(item.year)===objectiveYear).filter(item=>objectiveFilters.level==='all'||item.level===objectiveFilters.level).filter(item=>!q||`${item.code||''} ${item.title} ${item.titleEn||''} ${item.ownerLabel||''} ${item.committeeName||''}`.toLowerCase().includes(q))},[objectives.objectives,planRows,objectiveFilters,objectiveYear])
 const visibleObjectives=useMemo(()=>{const q=objectiveFilters.query.trim().toLowerCase();const plans=objectiveFilters.state==='all'?planRows:[];return [...objectives.objectives,...plans].filter(item=>objectiveYear==='all'||String(item.year)===objectiveYear).filter(item=>objectiveFilters.level==='all'||item.level===objectiveFilters.level).filter(item=>!q||`${item.code||''} ${item.title} ${item.titleEn||''} ${item.ownerLabel||''} ${item.committeeName||''}`.toLowerCase().includes(q)).filter(item=>item.kind==='plan'||objectiveFilters.state==='all'||(objectiveFilters.state==='missed'?isMissed(item):item.current.status===objectiveFilters.state))},[objectives.objectives,planRows,objectiveFilters,objectiveYear])
 const todayIso=hospitalToday()

 const overdueActions=actions.filter(isOverdueAction).length
 const missedObjectives=objectives.objectives.filter(isMissed).length
 const goReports=(quick: string)=>{setTab('reports');register.clear();register.set('quick',quick)}
 const goIncidents=(quick: string)=>{setTab('incidents');incidents.clear();if(quick)incidents.set('quick',quick)}
 const goActions=(quick: string)=>{setTab('actions');actionView.set('quick',quick)}
 const goObjectives=()=>{if(!measures){writeSessionValue(RETURN_KEY,'indicators:objectives');navigate('/quality/measures');return}setMeasureView('objectives');setObjectiveFilters(current=>({...current,state:'missed'}))}
 const centerFigures=[
  {key:'open',icon:Clock3,value:register.counts.open,label:L('Αναφορές προς αξιολόγηση','Reports to assess'),tone:'warning',go:()=>goReports('open')},
  {key:'sentinel',icon:AlertOctagon,value:incidents.counts.sentinel,label:L('Ανοιχτά συμβάντα-φρουροί','Open sentinel events'),status:incidents.counts.sentinel?'danger':'good',target:L('στόχος: 0','target: 0'),go:()=>goIncidents('sentinel')},
  {key:'overdue',icon:AlertTriangle,value:overdueActions,label:L('Εκπρόθεσμες ενέργειες','Overdue actions'),status:overdueActions?'danger':'good',target:L('στόχος: 0','target: 0'),go:()=>goActions('overdue')},
  {key:'objectives',icon:TrendingDown,value:missedObjectives,loading:objectives.loading,label:L('Στόχοι που δεν επιτυγχάνονται','Objectives not met'),tone:'danger',go:goObjectives},
  // The deviations without an action are counted on «Actions» and «Deviations».
 ]
 const actionCount=actionCounts(actions)
 const auditCount=auditCounts(audits)
 const activeObjectives=objectives.objectives.filter(inObjectiveYear).filter(item=>(item.status||'active')==='active')
 const isStaleRegister=useCallback((item: Register)=>isStale(item,todayIso),[todayIso])
 const staleRegisters=registerList.registers.filter(isStaleRegister).length
 const latestAssessment=[...riskList.items].sort((a,b)=>String(b.assessedOn||'').localeCompare(String(a.assessedOn||'')))[0]
 const latestRisks=latestAssessment?summarizeRisks(latestAssessment.risks||[]):null
 const tabFigures: Record<string, TabFigure[]>={
  risks:latestRisks?[
   {key:'risks',icon:ClipboardList,value:latestRisks.total,label:L(`Κίνδυνοι · ${latestAssessment.periodLabel}`,`Risks · ${latestAssessment.periodLabel}`)},
   {key:'veryHigh',icon:AlertOctagon,value:latestRisks.levels.residual.very_high,label:L('Πολύ υψηλοί','Very high'),status:latestRisks.levels.residual.very_high?'danger':'good',target:L('στόχος: 0','target: 0')},
   {key:'high',icon:AlertTriangle,value:latestRisks.levels.residual.high,label:L('Υψηλοί','High'),tone:'warning'},
   {key:'next',icon:CalendarClock,value:formatDay(latestAssessment.nextReviewOn,language)||'—',label:L('Επόμενη αξιολόγηση','Next assessment'),hint:L(`${riskList.items.length} εκτιμήσεις`,`${riskList.items.length} assessments`)},
  ]:[],
  registers:[{key:'registers',icon:ClipboardList,value:registerList.loading?'—':registerList.registers.length,label:L('Μητρώα τμημάτων','Department registers'),active:measureView==='registers'&&!staleOnly,go:()=>{setMeasureView('registers');setStaleOnly(false)}},
   {key:'stale',icon:Clock3,value:registerList.loading?'—':staleRegisters,label:L(`Χωρίς καταχώριση ${STALE_DAYS}+ ημέρες`,`No entry for ${STALE_DAYS}+ days`),tone:'warning',active:measureView==='registers'&&staleOnly,go:()=>{setMeasureView('registers');setStaleOnly(value=>measureView!=='registers'||!value)}}],
  // The objectives without figures above them: the list and its filters say it all.
  objectives:[],
  equipment:(()=>{const count=equipmentCounts(resources.equipment);const dash=(value: number)=>resources.loading?'—':value;const quick=(key: string)=>setEquipmentFilters(current=>({...current,quick:current.quick===key?null:key}));return [
   {key:'all',icon:Stethoscope,value:dash(count.total),label:L('Εξοπλισμός σε χρήση','Equipment in use'),hint:resources.loading?null:L(`${count.critical} κρίσιμος`,`${count.critical} critical`),active:!equipmentFilters.quick,go:()=>setEquipmentFilters(current=>({...current,quick:null}))},
   {key:'overdue',icon:AlertTriangle,value:dash(count.overdue),label:L('Εκπρόθεσμοι έλεγχοι','Overdue checks'),status:resources.loading?null:count.overdue?'danger':'good',target:L('στόχος: 0','target: 0'),active:equipmentFilters.quick==='overdue',go:()=>quick('overdue')},
   {key:'dueSoon',icon:CalendarClock,value:dash(count.dueSoon),label:L('Οφείλονται σε 30 ημέρες','Due within 30 days'),tone:'warning',active:equipmentFilters.quick==='dueSoon',go:()=>quick('dueSoon')},
   {key:'down',icon:AlertOctagon,value:dash(count.down),label:L('Εκτός λειτουργίας','Out of service'),tone:'danger',active:equipmentFilters.quick==='down',go:()=>quick('down')},
   ]})(),
  suppliers:(()=>{const count=supplierCounts(resources.suppliers);const dash=(value: number)=>resources.loading?'—':value;const quick=(key: string)=>setSupplierFilters(current=>({...current,quick:current.quick===key?null:key}));return [
   {key:'all',icon:Truck,value:dash(count.total),label:L('Ενεργοί','Active'),hint:resources.loading?null:L(`${count.approved} εγκεκριμένοι`,`${count.approved} approved`),active:!supplierFilters.quick,go:()=>setSupplierFilters(current=>({...current,quick:null}))},
   {key:'evaluationDue',icon:Star,value:dash(count.evaluationDue),label:L('Οφείλεται αξιολόγηση','Evaluation due'),tone:'warning',active:supplierFilters.quick==='evaluationDue',go:()=>quick('evaluationDue')},
   {key:'certificates',icon:ShieldCheck,value:dash(count.certificates),label:L('Λήγουν πιστοποιητικά','Certificates expiring'),tone:'warning',active:supplierFilters.quick==='certificates',go:()=>quick('certificates')},
   {key:'nonconformities',icon:FileWarning,value:dash(count.nonconformities),label:L('Μη συμμορφώσεις','Nonconformities'),status:resources.loading?null:count.nonconformities?'danger':'good',target:L('στόχος: 0','target: 0'),active:supplierFilters.quick==='nonconformities',go:()=>quick('nonconformities')}]})(),
  // The questionnaires list has no cards: its filters are the search and «Φίλτρα».
  surveys:[],
 }
 // A list's figures as the totals beside its search (FilterBar `end`): each one filters the list, as it did as a card.
 const asTotals=(list: TabFigure[]=[],label: string)=>list.length?<RegistryTotals label={label} items={list.map((item,index)=>({key:item.key,always:index===0,value:typeof item.value==='number'?item.value:(item.value&&item.value!=='—'?1:0),display:typeof item.value==='number'?undefined:item.value,label:String(item.label).toLocaleLowerCase(en?'en':'el'),active:item.active,onClick:item.go}))}/>:null
 const figures=(({
  overview:[],
  reports:[],
  incidents:[],
  deviations:[],
  risks:[],
  resources:[],
 }) as Record<string, TabFigure[]>)[tab]||(tab==='indicators'?[]:tab==='resources'?tabFigures[resourceView]:tabFigures[tab])||[]

 // What each tab asks for: reports and incidents still open, deviations, overdue actions and audits, the high residual risks of the latest assessment, objectives not met and registers gone quiet, equipment and suppliers that need attention.
 const resourcesAttention=(()=>{const equipmentNow=equipmentCounts(resources.equipment),suppliersNow=supplierCounts(resources.suppliers);return (EQUIPMENT_SHOWN?equipmentNow.overdue+equipmentNow.down:0)+suppliersNow.attention+suppliersNow.certificates})()
 const tabCounts: Record<string, number | null>={reports:register.counts.open,incidents:incidents.counts.open,deviations:deviations.counts.total-deviations.counts.closed,actions:actionCount.open,audits:auditCount.overdue,risks:latestRisks?(latestRisks.levels.residual.very_high||0)+(latestRisks.levels.residual.high||0):0,indicators:missedObjectives+staleRegisters,resources:resourcesAttention}
 const returnValue=tab==='indicators'?`indicators:${measureView}`:tab==='resources'?`resources:${resourceView}`:tab
 const remember=()=>writeSessionValue(RETURN_KEY,returnValue)
 const create=(path: string)=>()=>{remember();goTo(path,{registry:`quality.${tab}`})}
 const openRecord=(type: string,id: string,ids: string[])=>{remember();writeSessionJson(registryStorageKey(`quality.${type}`,'sequence'),ids);registry.openRecord(navigate,`/quality/${type}/${id}`,id,ids)}

 const reportOption=canManage||canReportIncident?[{id:'report',label:L('Νέα αναφορά','New report'),icon:AlertTriangle,onClick:create('/quality/incidents/new')}]:[]
 const createOptions=(({
  overview:[...reportOption,...(canManage?[{id:'capa',label:L('Διορθωτική ενέργεια','Corrective action'),icon:CheckSquare2,onClick:create('/quality/capas/new')},{id:'audit',label:L('Επιθεώρηση','Audit'),icon:ClipboardCheck,onClick:create('/quality/audits/new')}]:[])],
  reports:reportOption,
  incidents:reportOption,
  deviations:canManage?[{id:'finding',label:L('Απόκλιση','Deviation'),icon:FileWarning,onClick:create('/quality/findings/new')}]:[],
  actions:canManage?[{id:'capa',label:L('Διορθωτική ενέργεια','Corrective action'),icon:CheckSquare2,onClick:create('/quality/capas/new')}]:[],
  audits:[...(canManage?[{id:'audit',label:L('Επιθεώρηση','Audit'),icon:ClipboardCheck,onClick:create('/quality/audits/new')},{id:'round',label:L('Κύκλος επιθεώρησης','Audit round'),icon:ListChecks,onClick:create('/quality/audits/round')}]:[]),{id:'questionnaires',label:L('Ερωτηματολόγια επιθεώρησης','Audit questionnaires'),icon:ListChecks,onClick:()=>{remember();goTo('/quality/audit-questionnaires')}}],
  risks:canManage?[{id:'assessment',label:L('Εκτίμηση κινδύνου','Risk assessment'),icon:ShieldAlert,onClick:()=>setRiskCreating(true)},{id:'import',label:L('Εισαγωγή από Excel','Import from Excel'),icon:FileSpreadsheet,onClick:()=>riskFile.current?.click()}]:[],
  indicators:[...(canManageIndicators?[{id:'indicator',label:L('Δείκτης','Indicator'),icon:Gauge,onClick:()=>{remember();goTo('/indicators/new')}}]:[]),...(canManage?[{id:'register',label:L('Μητρώο τμήματος','Department register'),icon:ClipboardList,onClick:()=>{remember();goTo('/registers/new')}},{id:'objective',label:L('Στόχος ποιότητας','Quality objective'),icon:Target,onClick:()=>{setMeasureView('objectives');writeSessionValue(RETURN_KEY,'indicators:objectives');goTo('/quality/objectives/new')}},{id:'survey',label:L('Ερωτηματολόγιο ικανοποίησης','Satisfaction questionnaire'),icon:Smile,onClick:()=>{setMeasureView('surveys');writeSessionValue(RETURN_KEY,'indicators:surveys');goTo('/quality/surveys/new')}}]:[])].filter(option=>option.id===MEASURE_CREATE[measureView]),
  resources:canManage?[...(EQUIPMENT_SHOWN?[{id:'equipment',label:L('Εξοπλισμός','Equipment'),icon:Stethoscope,onClick:()=>{setResourceView('equipment');writeSessionValue(RETURN_KEY,'resources:equipment');goTo('/quality/equipment/new')}}]:[]),...(suppliersOn?[{id:'supplier',label:L('Προμηθευτής','Supplier'),icon:Truck,onClick:()=>{setResourceView('suppliers');writeSessionValue(RETURN_KEY,'resources:suppliers');goTo('/quality/suppliers/new')}},{id:'templates',label:L('Πρότυπα αξιολόγησης','Evaluation templates'),icon:ListChecks,onClick:()=>{setResourceView('suppliers');writeSessionValue(RETURN_KEY,'resources:suppliers');goTo('/quality/suppliers/templates')}},{id:'renewals',label:L('Πιστοποιητικά προς ανανέωση','Certificates to renew'),icon:ShieldCheck,onClick:()=>{setResourceView('suppliers');writeSessionValue(RETURN_KEY,'resources:suppliers');goTo('/quality/suppliers/renewals')}}]:[])]:[],
 }) as Record<string, CreateOption[]>)[tab]

 // Every list exports the same rows to print and to Excel.
 const incidentPeriod=[incidents.filters.dateFrom,incidents.filters.dateTo].some(Boolean)?`${incidents.filters.dateFrom?formatDay(incidents.filters.dateFrom,language):'…'} – ${incidents.filters.dateTo?formatDay(incidents.filters.dateTo,language):'…'}`:''
 const printIncidents=({groupBy}: Record<string, string>)=>{setIncidentDialog(null);if(!printReport(incidentRegisterDoc({rows:incidents.filtered,groupBy,language,categories,period:incidentPeriod})))notify(L('Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','Allow pop-ups to print.'),'error')}
 const incidentTable=()=>reportRegisterExport(incidents.filtered,{language,t,categories})
 // The actions the list shows (its search and filters), for the print and the Excel.
 const actionCapas=()=>filterActions(actions,actionView.filters,en).filter(row=>row.kind==='capa')
 const actionPeriod=[actionView.filters.dueFrom,actionView.filters.dueTo].some(Boolean)?`${actionView.filters.dueFrom?formatDay(actionView.filters.dueFrom,language):'…'} – ${actionView.filters.dueTo?formatDay(actionView.filters.dueTo,language):'…'}`:''
 const actionSource=(kind: string)=>sourceKindLabel(kind,language)
 const printActions=({groupBy}: Record<string, string>)=>{setIncidentDialog(null);if(!printReport(actionsReportDoc({rows:actionCapas(),groupBy,language,t,sourceLabel:actionSource,period:actionPeriod})))notify(L('Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','Allow pop-ups to print.'),'error')}
 const actionTable=()=>qualityExport('capas',actionCapas(),{en,t})
 // The deviations the list shows (its search and filters; the automatic signals are not printed).
 const deviationRows=()=>deviations.filtered.filter(row=>row.type==='finding')
 const deviationPeriod=[deviations.filters.dateFrom,deviations.filters.dateTo].some(Boolean)?`${deviations.filters.dateFrom?formatDay(deviations.filters.dateFrom,language):'…'} – ${deviations.filters.dateTo?formatDay(deviations.filters.dateTo,language):'…'}`:''
 const printDeviations=({groupBy}: Record<string, string>)=>{setIncidentDialog(null);if(!printReport(deviationsReportDoc({rows:deviationRows(),groupBy,language,t,period:deviationPeriod})))notify(L('Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','Allow pop-ups to print.'),'error')}
 const deviationTable=()=>deviationsExport(deviations.filtered,{language,t})
 // Equipment and suppliers: the print groups by one of its columns (as the Excel table numbers them).
 const resourceTable=(kind: string)=>kind==='equipment'?equipmentExport(visibleEquipment,language):suppliersExport(visibleSuppliers,language)
 const RESOURCE_PRINT: Record<string, { title: string, file: string, columns: number[], groups: [string, number, string][] }>={
  equipment:{title:L('Εξοπλισμός','Equipment'),file:L('eksoplismos','equipment'),columns:[0,1,3,4,10,11,12,13,14],groups:[['department',3,L('Ανά τμήμα','By department')],['criticality',10,L('Ανά κρισιμότητα','By criticality')],['status',11,L('Ανά κατάσταση','By status')]]},
  suppliers:{title:L('Προμηθευτές','Suppliers'),file:L('promitheftes','suppliers'),columns:[0,1,2,5,6,7,8,9,11],groups:[['category',2,L('Ανά κατηγορία','By category')],['criticality',5,L('Ανά κρισιμότητα','By criticality')],['approval',8,L('Ανά έγκριση','By approval')]]},
 }
 const printResources=(kind: string,{groupBy}: Record<string, string>)=>{setIncidentDialog(null);const spec=RESOURCE_PRINT[kind];const column=spec.groups.find(([key])=>key===groupBy)?.[1]??null;if(!printReport(groupedListDoc({title:spec.title,filename:spec.file,table:resourceTable(kind),columns:spec.columns,groupBy:column,language})))notify(L('Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','Allow pop-ups to print.'),'error')}
 const printAuditSummary=(list: Parameters<typeof auditDetailedBatchDocument>[0])=>{if(!printReport(auditDetailedBatchDocument(list,records.data.findings,{language}),{pdf:false}))notify(L('Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','Allow pop-ups to print.'),'error')}
 const printList=(data: () => RegistryExport,title: string,pdf: boolean)=>{if(!printRegistry(data(),{language,kind:t('quality'),title,pdf}))notify(L('Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','Allow pop-ups to print.'),'error')}
 // `doc`: a list with its own printed layout (the objectives, grouped by place); Excel stays the full table.
 const printDoc=(doc: () => ReportDoc,pdf: boolean)=>{if(!printReport(doc(),{pdf}))notify(L('Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','Allow pop-ups to print.'),'error')}
 const listExport=(rows: unknown[],data: () => RegistryExport,title: string,items: NonNullable<ComponentProps<typeof ExportMenu>['items']>=[],doc: (() => ReportDoc) | null=null)=><ExportMenu disabled={!rows.length} items={items} menuWidth={items.length?260:220} onPrint={()=>doc?printDoc(doc,false):printList(data,title,false)} onPdf={()=>doc?printDoc(doc,true):printList(data,title,true)} onExcel={()=>exportRegistry(data())}/>
 const download=({
  overview:null,
  deviations:<ExportMenu items={[
   {id:'deviations-print',kind:'print',label:L('Εκτύπωση: αποκλίσεις','Print: deviations'),disabled:!deviationRows().length,onClick:()=>setIncidentDialog('deviations-print')},
   {id:'deviations-excel',kind:'excel',label:t('exportFields.menuLabel'),disabled:!deviations.filtered.length,onClick:()=>setIncidentDialog('deviations-excel')},
  ]}/>,
  reports:listExport(register.filtered,()=>reportRegisterExport(register.filtered,{language,t,categories}),L('Αναφορές προς αξιολόγηση','Reports to assess')),
  incidents:<ExportMenu items={[
   {id:'incidents-print',kind:'print',label:L('Εκτύπωση: μητρώο συμβάντων','Print: incident register'),disabled:!incidents.filtered.length,onClick:()=>setIncidentDialog('print')},
   {id:'incidents-stats',kind:'print',label:L('Εκτύπωση: στατιστικά συμβάντων','Print: incident statistics'),disabled:!incidents.filtered.length,onClick:()=>{if(!printReport(incidentStatisticsDoc({rows:incidents.filtered,language,categories,period:incidentPeriod})))notify(L('Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','Allow pop-ups to print.'),'error')}},
   {id:'incidents-excel',kind:'excel',label:t('exportFields.menuLabel'),disabled:!incidents.filtered.length,onClick:()=>setIncidentDialog('excel')},
  ]}/>,
  actions:<ExportMenu items={[
   {id:'actions-print',kind:'print',label:L('Εκτύπωση: διορθωτικές ενέργειες','Print: corrective actions'),disabled:!actionCapas().length,onClick:()=>setIncidentDialog('actions-print')},
   {id:'actions-excel',kind:'excel',label:t('exportFields.menuLabel'),disabled:!actionCapas().length,onClick:()=>setIncidentDialog('actions-excel')},
  ]}/>,
  audits:(()=>{const rows=filterAudits(audits,auditView.filters,en);return <ExportMenu disabled={!rows.length} items={[
   {id:'summary-print',kind:'print',label:L('Συγκεντρωτική έκθεση','Summary report'),onClick:()=>printAuditSummary(rows)},
   {id:'findings-excel',kind:'excel',label:L('Ευρήματα (Excel)','Findings (Excel)'),onClick:()=>exportRegistry(auditFindingsExport(rows,records.data.findings,language))},
   {id:'list-excel',kind:'excel',label:L('Λίστα επιθεωρήσεων (Excel)','Audit list (Excel)'),onClick:()=>exportRegistry(qualityExport('audits',rows,{en,t}))},
  ]}/>})(),
  risks:listExport(riskRows,()=>riskAssessmentsExport(riskRows,language),L('Εκτιμήσεις κινδύνου','Risk assessments')),
  // «Indicators» puts its own «Export» here (actionsSlot).
  indicators:measureView==='indicators'?<div ref={setIndicatorActions} className="row-actions"/>:measureView==='surveys'?listExport(visibleSurveys,()=>surveysExport(visibleSurveys,language),L('Ερωτηματολόγια ικανοποίησης','Satisfaction questionnaires')):measureView==='registers'?listExport(registerRows,()=>registersExport(registerRows,language),L('Μητρώα τμημάτων','Department registers')):listExport(visibleObjectives,()=>objectivesExport(visibleObjectives,language),L('Στόχοι ποιότητας','Quality objectives'),[{id:'dossier',kind:'pdf',label:L('Ετήσιος φάκελος στόχων','Annual objectives file'),disabled:!dossierData||(!activeObjectives.length&&!objectives.committeeTargets.length),onClick:()=>{const year=objectiveYear==='all'?new Date().getFullYear():Number(objectiveYear);if(!printReport(objectivesDossier({objectives:objectives.objectives,committeeTargets:objectives.committeeTargets,histories:dossierData?.histories,reviews:dossierData?.reviews,extras:dossierData?.extras,year,language}),{pdf:true}))notify(L('Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','Allow pop-ups to print.'),'error')}}],()=>objectivesListDoc({rows:visibleObjectives,year:objectiveYear==='all'?null:objectiveYear,language})),
  resources:(()=>{const kind=resourceView==='equipment'?'equipment':'suppliers';const rows=kind==='equipment'?visibleEquipment:visibleSuppliers;return <ExportMenu items={[
   {id:`${kind}-print`,kind:'print',label:kind==='equipment'?L('Εκτύπωση: εξοπλισμός','Print: equipment'):L('Εκτύπωση: προμηθευτές','Print: suppliers'),disabled:!rows.length,onClick:()=>setIncidentDialog(`${kind}-print`)},
   // The suppliers' evaluations on one sheet (the form «Αξιολόγηση εξωτερικών παρόχων»), the questions once per template.
   ...(kind==='suppliers'?[{id:'suppliers-evaluations',kind:'print',label:L('Εκτύπωση: φύλλο αξιολόγησης προμηθευτών','Print: supplier evaluation sheet'),disabled:!rows.length,onClick:()=>{if(!printReport(supplierEvaluationsSheet(visibleSuppliers,resources.templates||[],{language}) as ReportDoc))notify(L('Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','Allow pop-ups to print.'),'error')}}]:[]),
   {id:`${kind}-excel`,kind:'excel',label:t('exportFields.menuLabel'),disabled:!rows.length,onClick:()=>setIncidentDialog(`${kind}-excel`)},
  ]}/>})(),
 })[tab]


 return <Page fill className="registry-fill-page" title={measures?L('Δείκτες & Στόχοι','Indicators & objectives'):t('quality')} subtitle={measures?L('Οι δείκτες της πλατφόρμας και των μητρώων, οι στόχοι ποιότητας και τα ερωτηματολόγια ικανοποίησης.','The platform and register indicators, the quality objectives and the satisfaction questionnaires.'):L('Από την αναφορά και την απόκλιση ως τη διορθωτική ενέργεια, τους κινδύνους και τους πόρους.','From the report and deviation to corrective action, risks and resources.')}
  actions={<div className="row-actions">
   {download}
   <CreateAction options={createOptions} label={L('Δημιουργία','Create')}/>
  </div>}>
  {!measures&&<CanonicalTabs items={TABS.filter(item=>item.value!=='indicators'&&(!item.manage||canManage)&&(item.value!=='resources'||EQUIPMENT_SHOWN||suppliersOn)).map(item=>({value:item.value,icon:item.icon,label:item.label[en?1:0],count:tabCounts[item.value]||0}))} value={tab} onChange={setTab} ariaLabel={t('quality')}/>}
  {tab==='indicators'&&<CanonicalTabs items={INDICATOR_OPTIONS.map(option=>({value:option.value,icon:option.icon,label:option.label[en?1:0]}))} value={measureView} onChange={setMeasureView} ariaLabel={L('Δείκτες & Στόχοι','Indicators & objectives')}/>}
  {tab==='resources'&&suppliersOn&&RESOURCE_OPTIONS.length>1&&<CanonicalTabs items={RESOURCE_OPTIONS.map(option=>({value:option.value,icon:option.icon,label:option.label[en?1:0]}))} value={resourceView} onChange={setResourceView} ariaLabel={L('Πόροι','Resources')}/>}
  {tab==='audits'&&<CanonicalTabs className="lo-subtabs" items={AUDIT_VIEWS.map(item=>({value:item.id,icon:item.icon,label:item.label[en?1:0]}))} value={AUDIT_VIEWS.some(item=>item.id===auditView.filters.mode)?auditView.filters.mode:'programme'} onChange={value=>auditView.set('mode',value)} ariaLabel={L('Επιθεωρήσεις','Audits')}/>}
  <KpiFigures className={`quality-kpis${tab==='indicators'&&figures.length<4?' quality-kpis-quarter':''}`} label={t('quality')} figures={figures as KpiFigure[]}/>
  {tab==='overview'?<div className="workspace-fill quality-overview-scroll">
   <KpiFigures className="quality-kpis" label={L('Επισκόπηση','Overview')} loading={records.loading} error={records.error} figures={centerFigures}/>
   {records.error&&!records.loading&&<RegistryEmptyState error onRetry={records.reload}/>}
   {records.loading?<PageSkeleton metrics={0}/>:<QualityOverview reports={[...register.rows,...incidents.rows]} capas={records.data.capas} audits={records.data.audits} findings={records.data.findings} objectives={objectives.objectives} onMeetings={()=>navigate('/meetings?tab=departments')} language={language} categories={categories}
    onOpen={(type: string,id: string)=>openRecord(type,id,[id])} onGo={target=>target==='readiness'?(auditView.set('mode','readiness'),setTab('audits')):target==='objectives'?goObjectives():target==='actions'?goActions('dueSoon'):target==='incidents'?setTab('incidents'):setTab(target)}/>}
  </div>:<>
  {incidentDialog==='print'&&<PrintOptionsDialog storageKey="limoxis.quality.incidents.print" title={L('Μητρώο συμβάντων','Incident register')} options={[{key:'groupBy',label:L('Ομαδοποίηση','Group'),choices:[{value:'none',label:L('Χωρίς ομαδοποίηση','No grouping')},{value:'department',label:L('Ανά τμήμα','By department')},{value:'kind',label:L('Ανά είδος','By kind')},{value:'month',label:L('Ανά μήνα','By month')}]}]} onConfirm={printIncidents} onClose={()=>setIncidentDialog(null)}/>}
  {incidentDialog==='actions-print'&&<PrintOptionsDialog storageKey="limoxis.quality.actions.print" title={L('Διορθωτικές ενέργειες','Corrective actions')} options={[{key:'groupBy',label:L('Ομαδοποίηση','Group'),choices:[{value:'none',label:L('Χωρίς ομαδοποίηση','No grouping')},{value:'status',label:L('Ανά κατάσταση','By status')},{value:'department',label:L('Ανά τμήμα','By department')},{value:'owner',label:L('Ανά υπεύθυνο','By owner')},{value:'source',label:L('Ανά προέλευση','By source')}]}]} onConfirm={printActions} onClose={()=>setIncidentDialog(null)}/>}
  {incidentDialog==='actions-excel'&&<ExcelFieldsDialog storageKey="limoxis.quality.actions.excel" fields={tableFields(actionTable())} onClose={()=>setIncidentDialog(null)} onConfirm={keys=>{exportRegistry(pickColumns(actionTable(),keys));setIncidentDialog(null)}}/>}
  {incidentDialog==='deviations-print'&&<PrintOptionsDialog storageKey="limoxis.quality.deviations.print" title={L('Αποκλίσεις','Deviations')} options={[{key:'groupBy',label:L('Ομαδοποίηση','Group'),choices:[{value:'none',label:L('Χωρίς ομαδοποίηση','No grouping')},{value:'department',label:L('Ανά τμήμα','By department')},{value:'kind',label:L('Ανά είδος','By kind')},{value:'month',label:L('Ανά μήνα','By month')}]}]} onConfirm={printDeviations} onClose={()=>setIncidentDialog(null)}/>}
  {incidentDialog==='deviations-excel'&&<ExcelFieldsDialog storageKey="limoxis.quality.deviations.excel" fields={tableFields(deviationTable())} onClose={()=>setIncidentDialog(null)} onConfirm={keys=>{exportRegistry(pickColumns(deviationTable(),keys));setIncidentDialog(null)}}/>}
  {['equipment','suppliers'].map(kind=>incidentDialog===`${kind}-print`&&<PrintOptionsDialog key={kind} storageKey={`limoxis.quality.${kind}.print`} title={RESOURCE_PRINT[kind].title} options={[{key:'groupBy',label:L('Ομαδοποίηση','Group'),choices:[{value:'none',label:L('Χωρίς ομαδοποίηση','No grouping')},...RESOURCE_PRINT[kind].groups.map(([value,,label])=>({value,label}))]}]} onConfirm={options=>printResources(kind,options)} onClose={()=>setIncidentDialog(null)}/>)}
  {['equipment','suppliers'].map(kind=>incidentDialog===`${kind}-excel`&&<ExcelFieldsDialog key={kind} storageKey={`limoxis.quality.${kind}.excel`} fields={tableFields(resourceTable(kind))} onClose={()=>setIncidentDialog(null)} onConfirm={keys=>{exportRegistry(pickColumns(resourceTable(kind),keys));setIncidentDialog(null)}}/>)}
  {incidentDialog==='excel'&&<ExcelFieldsDialog storageKey="limoxis.quality.incidents.excel" fields={tableFields(incidentTable())} onClose={()=>setIncidentDialog(null)} onConfirm={keys=>{exportRegistry(pickColumns(incidentTable(),keys));setIncidentDialog(null)}}/>}
  {tab==='audits'&&!['programme','self'].includes(auditView.filters.mode||'programme')&&<AuditsSummary rows={audits} counts={auditCount} view={auditView} loading={records.loading} language={language} filling={fillingProgramme} onFill={canManage?fillProgramme:null}/>}
  {tab==='indicators'&&measureView==='indicators'&&<PageEmbedProvider><IndicatorsPage defaultPeriod="year" registryKey="quality.indicators" actionsSlot={indicatorActions} withRegisters/></PageEmbedProvider>}
  {!(tab==='indicators'&&measureView==='indicators')&&<section className="surface registry-workspace workspace-column workspace-fill">
   {tab==='reports'&&<ReportRegister inbox totals view={register} loading={records.loading} language={language} t={t} categories={categories} registry={registry}
    onOpenReport={(row,items)=>openRecord('incidents',row.id,items.map(item=>item.id))}/>}
   {tab==='incidents'&&<ReportRegister compact totals view={incidents} loading={records.loading} language={language} t={t} categories={categories} registry={registry}
    onOpenReport={(row,items)=>openRecord('incidents',row.id,items.map(item=>item.id))}/>}
   {tab==='deviations'&&canManage&&<DeviationQueue view={deviations} loading={queue.loading} language={language} t={t}
    registry={registry} onOpenRow={(row,rows)=>row.type==='finding'?openRecord('findings',row.id,rows.filter(item=>item.type==='finding').map(item=>item.id)):(remember(),registry.openRecord(navigate,(row.item as DeviationItem).path,row.key,[]))}
    onCreateFindingCapa={finding=>{writeSessionValue(RETURN_KEY,'deviations');goTo('/quality/capas/new',{registry:'quality.actions',state:{qualitySource:capaSourceFor('findings',finding,language)}})}}
    onCreateCapa={prefill=>{writeSessionValue(RETURN_KEY,'deviations');goTo('/quality/capas/new',{registry:'quality.actions',state:{qualitySource:prefill}})}}/>}
   {tab==='actions'&&<ActionsList rows={actions} view={actionView} loading={records.loading} language={language} t={t} registry={registry}
    onOpen={(row,same)=>openRecord(row.kind==='capa'?'capas':'findings',row.id,same.map(item=>item.id))}
    onOpenSource={row=>{remember();goTo(row.sourcePath as string)}}
    onCreateCapa={canManage?finding=>{remember();goTo('/quality/capas/new',{registry:'quality.actions',state:{qualitySource:capaSourceFor('findings',finding,language)}})}:null}/>} 
   {tab==='audits'&&<AuditsList canManageSelf={canManage} onPrintSummary={printAuditSummary} rows={audits} view={auditView} loading={records.loading} language={language} t={t} registry={registry}
    onOpen={(row,same)=>openRecord('audits',row.id,same.map(item=>item.id))}
    onPlan={canManage?source=>{remember();goTo('/quality/audits/new',{registry:'quality.audits',state:{qualitySource:source}})}:null} onRound={canManage?()=>{remember();goTo('/quality/audits/round')}:null} findings={records.data.findings}
    onOpenFinding={finding=>openRecord('findings',finding.id as string,[finding.id as string])}/>}
   {tab==='risks'&&<RiskAssessmentsPanel totals={asTotals(tabFigures.risks,L('Κίνδυνοι','Risks'))} list={riskList} organizationId={tenant?.id} en={en} locale={locale} creating={riskCreating} onCreatingChange={setRiskCreating} fileRef={riskFile} onRowsChange={setRiskRows}/>}
   {tab==='indicators'&&measureView==='registers'&&<RegistersPanel filterEnd={asTotals(tabFigures.registers,L('Μητρώα','Registers'))} list={registerList} only={staleOnly?isStaleRegister:null} onBeforeOpen={remember} onRowsChange={setRegisterRows}/>}
   {tab==='indicators'&&measureView==='objectives'&&<>
    <FilterBar query={objectiveFilters.query} onQueryChange={query=>setObjectiveFilters(current=>({...current,query}))} placeholder={L('Αναζήτηση στόχου ή υπευθύνου','Search objective or owner')} activeAdvancedCount={(objectiveFilters.state!=='all'?1:0)+(objectiveFilters.year!=='auto'?1:0)+(objectiveFilters.level!=='all'?1:0)} onClear={()=>setObjectiveFilters({query:'',state:'all',year:'auto',level:'all'})} end={objectivesLoaded&&<RegistryTotals label={L('Σύνολα','Totals')} items={[
     {key:'all',always:true,value:objectiveBase.length,label:L('στόχοι','objectives'),active:objectiveFilters.state==='all',onClick:()=>setObjectiveState('all')},
     {key:'met',value:objectiveBase.filter(item=>item.current?.status==='met').length,label:L('επιτυγχάνονται','met'),active:objectiveFilters.state==='met',onClick:()=>setObjectiveState('met')},
     {key:'missed',value:objectiveBase.filter(item=>item.kind!=='plan'&&isMissed(item)).length,label:L('δεν επιτυγχάνονται','not met'),active:objectiveFilters.state==='missed',onClick:()=>setObjectiveState('missed')},
     {key:'pending',value:objectiveBase.filter(item=>item.kind!=='plan'&&item.current?.status==='pending').length,label:L('σε εξέλιξη','in progress'),active:objectiveFilters.state==='pending',onClick:()=>setObjectiveState('pending')},
    ]}/>}>
     <FilterSelect label={L('Έτος','Year')} value={objectiveYear} onChange={year=>setObjectiveFilters(current=>({...current,year}))}><option value="all">{L('Όλα τα έτη','All years')}</option>{objectiveYears.map(year=>{const value=String(year);return <option key={value} value={value}>{value}</option>})}</FilterSelect>
     <FilterSelect label={L('Επίπεδο','Level')} value={objectiveFilters.level} onChange={level=>setObjectiveFilters(current=>({...current,level}))}><option value="all">{L('Όλα τα επίπεδα','All levels')}</option>{OBJECTIVE_LEVELS.map(level=><option key={level} value={level}>{levelLabel(level,en)}</option>)}</FilterSelect>
     <FilterSelect label={t('status')} value={objectiveFilters.state} onChange={state=>setObjectiveFilters(current=>({...current,state}))}><option value="all">{t('all')}</option><option value="missed">{L('Δεν επιτυγχάνεται','Not met')}</option><option value="met">{L('Επιτυγχάνεται','Met')}</option><option value="pending">{L('Σε εξέλιξη','In progress')}</option></FilterSelect>
    </FilterBar>
    <ObjectivesTable rows={visibleObjectives} loading={objectives.loading} error={objectives.error} onRetry={objectives.reload} onOpen={objective=>{if(objective.kind==='plan'){writeSessionValue(RETURN_KEY,'indicators:objectives');navigate(`/committees/${objective.committeeCode}`);return}openRecord('objectives',objective.id,visibleObjectives.filter(item=>item.kind!=='plan').map(item=>item.id))}}/>
   </>}
   {tab==='indicators'&&measureView==='surveys'&&<SurveysList filterEnd={(()=>{const all=surveys.surveys||[];const quick=(key: string)=>setSurveyFilters(current=>({...current,status:'all',quick:current.quick===key?null:key}));return <RegistryTotals label={L('Σύνολα','Totals')} items={[
    {key:'all',always:true,value:all.length,label:L('ερωτηματολόγια','questionnaires'),active:!surveyFilters.quick&&surveyFilters.status==='all',onClick:()=>setSurveyFilters(current=>({...current,status:'all',quick:null}))},
    {key:'open',value:all.filter(item=>isSurveyOpen(item)).length,label:L('σε εξέλιξη','open'),active:surveyFilters.quick==='open',onClick:()=>quick('open')},
    {key:'closed',value:all.filter(item=>item.status==='closed').length,label:L('ολοκληρώθηκαν','closed'),active:surveyFilters.status==='closed',onClick:()=>setSurveyFilters(current=>({...current,quick:null,status:current.status==='closed'?'all':'closed'}))},
    {key:'draft',value:all.filter(item=>item.status==='draft').length,label:L('προσχέδια','drafts'),active:surveyFilters.quick==='draft',onClick:()=>quick('draft')},
   ]}/>})()} list={surveys} registry={registry} filters={surveyFilters} setFilters={setSurveyFilters} onOpen={survey=>{writeSessionValue(RETURN_KEY,'indicators:surveys');registry.openRecord(navigate,`/quality/surveys/${survey.id}`,survey.id)}}/>}
   {tab==='resources'&&resourceView==='equipment'&&<EquipmentList filterEnd={asTotals(tabFigures.equipment,L('Εξοπλισμός','Equipment'))} list={resources} registry={registry} filters={equipmentFilters} setFilters={setEquipmentFilters} onOpen={row=>{writeSessionValue(RETURN_KEY,'resources:equipment');registry.openRecord(navigate,`/quality/equipment/${row.id}`,row.id)}}/>}
   {tab==='resources'&&resourceView==='suppliers'&&suppliersOn&&<SuppliersList filterEnd={asTotals(tabFigures.suppliers,L('Προμηθευτές','Suppliers'))} list={resources} registry={registry} filters={supplierFilters} setFilters={setSupplierFilters} onOpen={row=>{writeSessionValue(RETURN_KEY,'resources:suppliers');registry.openRecord(navigate,`/quality/suppliers/${row.id}`,row.id)}}/>}
  </section>}</>}
 </Page>
}

function CreateAction({options,label}: { options: CreateOption[], label: string }){
 if(!options.length)return null
 if(options.length===1){const [only]=options;return <ActionButton label={only.label} tone="primary" onClick={only.onClick}><Plus size={18}/><span>{label}</span></ActionButton>}
 return <OverflowMenu label={label} triggerTone="primary" width={240} trigger={<><Plus size={18} aria-hidden="true"/>{label}</>} items={options}/>
}

function riskAssessmentsExport(items: RiskAssessment[],language: string){
 const en=language==='en'
 return {
  name:en?'risk-assessments':'ektimiseis-kindynou',
  headers:en?['Code','Period','Assessment','Date','Next assessment','Risks','Very high (residual)','High (residual)','Status']:['Κωδικός','Περίοδος','Εκτίμηση','Ημερομηνία','Επόμενη αξιολόγηση','Κίνδυνοι','Πολύ υψηλοί (υπολειπόμενοι)','Υψηλοί (υπολειπόμενοι)','Κατάσταση'],
  rows:items.map(item=>{const summary=summarizeRisks(item.risks||[]);return [item.code,item.periodLabel,(en?item.titleEn:item.title)||item.title,formatDay(item.assessedOn,language),formatDay(item.nextReviewOn,language),summary.total,summary.levels.residual.very_high,summary.levels.residual.high,item.status]}),
 }
}

function registersExport(registers: Register[],language: string){
 const en=language==='en'
 return {
  name:en?'department-registers':'mitroa-tmimaton',
  headers:en?['Code','Register','Department','Kind','Entries','Last entry','Indicators','Status']:['Κωδικός','Μητρώο','Τμήμα','Είδος','Καταχωρίσεις','Τελευταία καταχώριση','Δείκτες','Κατάσταση'],
  rows:registers.map((item: Register)=>[item.code,en?item.nameEn:item.name,en?item.departmentEn:item.department,registerKindLabel(item.kind,language),item.entryCount??0,formatDay(item.lastEntry,language),item.indicators?.length||0,registerStatusLabel(item.status,language)]),
 }
}
