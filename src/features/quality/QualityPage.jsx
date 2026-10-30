import { useCallback,useEffect,useMemo,useRef,useState } from 'react'
import { STALE_DAYS,isStaleRegister as isStale } from '../registers/registerFigures'
import { KpiFigures } from '../../design-system/KpiCard'
import { AlertOctagon,AlertTriangle,CalendarClock,CheckCircle2,CheckSquare2,ClipboardCheck,ClipboardList,Clock3,FileSpreadsheet,FileWarning,Gauge,LayoutDashboard,ListChecks,Plus,ShieldAlert,ShieldCheck,Smile,Star,Stethoscope,Target,TrendingDown,Truck,Users } from 'lucide-react'
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
import { exportRegistry,printRegistry,qualityExport } from '../../core/export/registryExports'
import { QUALITY_RETURN_KEY as RETURN_KEY,qualityTabOf } from './qualityReturnSection'
import { fillAuditProgramme,loadQualityRecords } from './qualityService'
import { DeviationQueue,DeviationSummary,ReportRegister,ReportSummary,deviationsExport,reportRegisterExport,useDeviationQueue,useDeviations,useIncidentRegister,useReportRegister } from './QualityReportRegister'
import { printReport } from '../../core/export/reportDocument'
import { auditDetailedBatchDocument,auditFindingsExport } from './audits/auditReport'
import { QualityOverview } from './QualityOverview'
import { ActionsList,ActionsSummary,AUDIT_VIEWS,AuditsList,AuditsSummary,actionCounts,actionRows,auditCounts,auditRows,filterActions,filterAudits,isOverdueAction,useListFilters } from './QualityLists'
import { capaSourceFor } from './qualityDeviations'
import { useLibraries } from '../management/useLibraries'
import { RiskAssessmentsPanel } from './risk/RiskAssessmentsPanel'
import { useRiskAssessmentList } from './risk/useRiskAssessmentList'
import { summarizeRisks } from './risk/riskModel'
import { IndicatorsPage } from '../indicators/IndicatorsPage'
import { RegistersPanel,useRegisterList } from '../registers/RegistersPanel'
import { registerKindLabel,registerStatusLabel } from '../registers/registerText'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { ObjectiveDialog,ObjectivesTable,newObjective,objectivesExport,useObjectives } from './review/QualityObjectives'
import { SurveysList,filterSurveys,surveyCounts,surveysExport,useSurveys } from './surveys/SurveysPanel'
import { EquipmentList,SuppliersList,useResources } from './resources/ResourcesPanel'
import { NO_EQUIPMENT_FILTERS,NO_SUPPLIER_FILTERS,equipmentCounts,equipmentExport,filterEquipment,filterSuppliers,supplierCounts,suppliersExport } from './resources/resourceModel'
import './quality.css'

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
 {value:'resources',icon:Stethoscope,label:['Πόροι','Resources']},
]
const INDICATOR_OPTIONS=[
 {value:'indicators',icon:Gauge,label:['Δείκτες','Indicators']},
 {value:'registers',icon:ClipboardList,label:['Μητρώα','Registers']},
 {value:'objectives',icon:Target,label:['Στόχοι','Objectives']},
 {value:'surveys',icon:Smile,label:['Έρευνες','Surveys']},
]
const RESOURCE_OPTIONS=[
 {value:'equipment',icon:Stethoscope,label:['Εξοπλισμός','Equipment']},
 {value:'suppliers',icon:Truck,label:['Προμηθευτές','Suppliers']},
]
const ACTION_DEFAULTS={query:'',kind:'all',status:'all',department:'all',quick:null}
const AUDIT_DEFAULTS={query:'',status:'all',type:'all',standard:'all',department:'all',cycle:'all',mode:'programme',quick:null}

function useQualityRecords(organizationId){
 const [data,setData]=useState({incidents:[],findings:[],capas:[],audits:[]})
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

export function QualityPage(){
 const {t,language,locale}=useLanguage()
 const en=language==='en'
 const L=(el,enText)=>en?enText:el
 const {role,membership,tenant,actualRole,isRolePreview,moduleEnabled}=useTenant()
 const {notify,confirm}=useFeedback()
 // Where «Indicators» puts its «Export» and «⋯» (the top bar).
 const [indicatorActions,setIndicatorActions]=useState(null)
 const {user}=useAuth()
 const suppliersOn=moduleEnabled('suppliers')
 const navigate=useNavigate()
 const {goTo}=useContextualNavigation('/quality')
 const [initial]=useState(()=>qualityTabOf(new URLSearchParams(window.location.search).get('tab'))||qualityTabOf(readSessionValue(RETURN_KEY,''))||{tab:'overview',view:null})
 useEffect(()=>{writeSessionValue(RETURN_KEY,'')},[])
 const [tab,setTab]=useState(initial.tab)
 const [measureView,setMeasureView]=useState(initial.tab==='indicators'&&initial.view||'indicators')
 const [resourceView,setResourceView]=useState(initial.tab==='resources'&&initial.view||'equipment')
 useEffect(()=>{if(!suppliersOn&&resourceView==='suppliers')setResourceView('equipment')},[suppliersOn,resourceView])
 const [equipmentFilters,setEquipmentFilters]=useState(NO_EQUIPMENT_FILTERS)
 const [supplierFilters,setSupplierFilters]=useState(NO_SUPPLIER_FILTERS)
 const [surveyFilters,setSurveyFilters]=useState({query:'',audience:'all',status:'all',quick:null})
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
 const actionView=useListFilters('quality.actions',ACTION_DEFAULTS)
 const auditView=useListFilters('quality.audits',AUDIT_DEFAULTS)
 const riskList=useRiskAssessmentList(tenant?.id,true)
 const [riskCreating,setRiskCreating]=useState(false)
 const riskFile=useRef(null)
 const [riskRows,setRiskRows]=useState([])
 const [registerRows,setRegisterRows]=useState([])
 const [staleOnly,setStaleOnly]=useState(false)
 const registerList=useRegisterList()
 const objectives=useObjectives(tenant?.id)
 const surveys=useSurveys()
 const visibleSurveys=useMemo(()=>filterSurveys(surveys.surveys,surveyFilters),[surveys.surveys,surveyFilters])
 const resources=useResources(tab==='resources')
 const visibleEquipment=useMemo(()=>filterEquipment(resources.equipment,equipmentFilters),[resources.equipment,equipmentFilters])
 const visibleSuppliers=useMemo(()=>filterSuppliers(resources.suppliers,supplierFilters),[resources.suppliers,supplierFilters])
 const [objectiveFilters,setObjectiveFilters]=useState({query:'',state:'all'})
 const [editingObjective,setEditingObjective]=useState(null)

 const isMissed=item=>(item.status||'active')==='active'&&item.current.status==='missed'
 const visibleObjectives=useMemo(()=>{const q=objectiveFilters.query.trim().toLowerCase();return objectives.objectives.filter(item=>!q||`${item.code} ${item.title} ${item.titleEn||''} ${item.ownerLabel||''}`.toLowerCase().includes(q)).filter(item=>objectiveFilters.state==='all'||(objectiveFilters.state==='missed'?isMissed(item):item.current.status===objectiveFilters.state))},[objectives.objectives,objectiveFilters])
 const todayIso=new Date().toISOString().slice(0,10)

 const overdueActions=actions.filter(isOverdueAction).length
 const missedObjectives=objectives.objectives.filter(isMissed).length
 const goReports=quick=>{setTab('reports');register.clear();register.set('quick',quick)}
 const goIncidents=quick=>{setTab('incidents');incidents.clear();if(quick)incidents.set('quick',quick)}
 const goActions=quick=>{setTab('actions');actionView.set('quick',quick)}
 const goObjectives=()=>{setTab('indicators');setMeasureView('objectives');setObjectiveFilters(current=>({...current,state:'missed'}))}
 const centerFigures=[
  {key:'open',icon:Clock3,value:register.counts.open,label:L('Αναφορές προς αξιολόγηση','Reports to assess'),tone:'warning',go:()=>goReports('open')},
  {key:'sentinel',icon:AlertOctagon,value:incidents.counts.sentinel,label:L('Ανοιχτά συμβάντα-φρουροί','Open sentinel events'),status:incidents.counts.sentinel?'danger':'good',target:L('στόχος: 0','target: 0'),go:()=>goIncidents('sentinel')},
  {key:'overdue',icon:AlertTriangle,value:overdueActions,label:L('Εκπρόθεσμες ενέργειες','Overdue actions'),status:overdueActions?'danger':'good',target:L('στόχος: 0','target: 0'),go:()=>goActions('overdue')},
  {key:'objectives',icon:TrendingDown,value:missedObjectives,loading:objectives.loading,label:L('Στόχοι που δεν επιτυγχάνονται','Objectives not met'),tone:'danger',go:goObjectives},
  // The deviations without an action are counted on «Actions» and «Deviations».
 ]
 const actionCount=actionCounts(actions)
 const auditCount=auditCounts(audits)
 const objectiveState=state=>{setMeasureView('objectives');setObjectiveFilters(current=>({...current,state:current.state===state&&measureView==='objectives'?'all':state}))}
 const activeObjectives=objectives.objectives.filter(item=>(item.status||'active')==='active')
 const isStaleRegister=useCallback(item=>isStale(item,todayIso),[todayIso])
 const staleRegisters=registerList.registers.filter(isStaleRegister).length
 const latestAssessment=[...riskList.items].sort((a,b)=>String(b.assessedOn||'').localeCompare(String(a.assessedOn||'')))[0]
 const latestRisks=latestAssessment?summarizeRisks(latestAssessment.risks||[]):null
 const tabFigures={
  risks:latestRisks?[
   {key:'risks',icon:ClipboardList,value:latestRisks.total,label:L(`Κίνδυνοι · ${latestAssessment.periodLabel}`,`Risks · ${latestAssessment.periodLabel}`)},
   {key:'veryHigh',icon:AlertOctagon,value:latestRisks.levels.residual.very_high,label:L('Πολύ υψηλοί (μετά τα μέτρα)','Very high (after measures)'),status:latestRisks.levels.residual.very_high?'danger':'good',target:L('στόχος: 0','target: 0')},
   {key:'high',icon:AlertTriangle,value:latestRisks.levels.residual.high,label:L('Υψηλοί (μετά τα μέτρα)','High (after measures)'),tone:'warning'},
   {key:'next',icon:CalendarClock,value:formatDay(latestAssessment.nextReviewOn,language)||'—',label:L('Επόμενη αξιολόγηση','Next assessment'),hint:L(`${riskList.items.length} εκτιμήσεις`,`${riskList.items.length} assessments`)},
  ]:[],
  registers:[{key:'registers',icon:ClipboardList,value:registerList.loading?'—':registerList.registers.length,label:L('Μητρώα τμημάτων','Department registers'),active:measureView==='registers'&&!staleOnly,go:()=>{setMeasureView('registers');setStaleOnly(false)}},
   {key:'stale',icon:Clock3,value:registerList.loading?'—':staleRegisters,label:L(`Χωρίς καταχώριση ${STALE_DAYS}+ ημέρες`,`No entry for ${STALE_DAYS}+ days`),tone:'warning',active:measureView==='registers'&&staleOnly,go:()=>{setMeasureView('registers');setStaleOnly(value=>measureView!=='registers'||!value)}}],
  objectives:[
   {key:'objectives',icon:Target,value:objectives.loading?'—':activeObjectives.length,label:L('Ενεργοί στόχοι','Active objectives'),active:measureView==='objectives'&&objectiveFilters.state==='all',go:()=>objectiveState('all')},
   {key:'met',icon:CheckCircle2,value:activeObjectives.filter(item=>item.current.status==='met').length,label:L('Επιτυγχάνονται','Met'),active:measureView==='objectives'&&objectiveFilters.state==='met',go:()=>objectiveState('met')},
   {key:'missed',icon:TrendingDown,value:missedObjectives,label:L('Δεν επιτυγχάνονται','Not met'),status:missedObjectives?'danger':'good',target:L('στόχος: 0','target: 0'),active:measureView==='objectives'&&objectiveFilters.state==='missed',go:()=>objectiveState('missed')},
   {key:'pending',icon:Clock3,value:activeObjectives.filter(item=>item.current.status==='pending').length,label:L('Σε εξέλιξη','In progress'),active:measureView==='objectives'&&objectiveFilters.state==='pending',go:()=>objectiveState('pending')}],
  equipment:(()=>{const count=equipmentCounts(resources.equipment);const dash=value=>resources.loading?'—':value;const quick=key=>setEquipmentFilters(current=>({...current,quick:current.quick===key?null:key}));return [
   {key:'all',icon:Stethoscope,value:dash(count.total),label:L('Εξοπλισμός σε χρήση','Equipment in use'),hint:resources.loading?null:L(`${count.critical} υψηλής κρισιμότητας`,`${count.critical} high criticality`),active:!equipmentFilters.quick,go:()=>setEquipmentFilters(current=>({...current,quick:null}))},
   {key:'overdue',icon:AlertTriangle,value:dash(count.overdue),label:L('Εκπρόθεσμη συντήρηση / διακρίβωση','Overdue maintenance / calibration'),status:resources.loading?null:count.overdue?'danger':'good',target:L('στόχος: 0','target: 0'),active:equipmentFilters.quick==='overdue',go:()=>quick('overdue')},
   {key:'dueSoon',icon:CalendarClock,value:dash(count.dueSoon),label:L('Οφείλονται σε 30 ημέρες','Due within 30 days'),tone:'warning',active:equipmentFilters.quick==='dueSoon',go:()=>quick('dueSoon')},
   {key:'down',icon:AlertOctagon,value:dash(count.down),label:L('Εκτός λειτουργίας','Out of service'),tone:'danger',active:equipmentFilters.quick==='down',go:()=>quick('down')},
   ]})(),
  suppliers:(()=>{const count=supplierCounts(resources.suppliers);const dash=value=>resources.loading?'—':value;const quick=key=>setSupplierFilters(current=>({...current,quick:current.quick===key?null:key}));return [
   {key:'all',icon:Truck,value:dash(count.total),label:L('Ενεργοί προμηθευτές','Active suppliers'),hint:resources.loading?null:L(`${count.approved} εγκεκριμένοι · ${count.attention} υπό όρους / απορρίπτονται`,`${count.approved} approved · ${count.attention} conditional / rejected`),active:!supplierFilters.quick,go:()=>setSupplierFilters(current=>({...current,quick:null}))},
   {key:'evaluationDue',icon:Star,value:dash(count.evaluationDue),label:L('Οφείλεται αξιολόγηση','Evaluation due'),tone:'warning',active:supplierFilters.quick==='evaluationDue',go:()=>quick('evaluationDue')},
   {key:'certificates',icon:ShieldCheck,value:dash(count.certificates),label:L('Πιστοποιητικά που λήγουν','Certificates expiring'),tone:'warning',active:supplierFilters.quick==='certificates',go:()=>quick('certificates')},
   {key:'nonconformities',icon:FileWarning,value:dash(count.nonconformities),label:L('Ανοιχτές μη συμμορφώσεις','Open nonconformities'),status:resources.loading?null:count.nonconformities?'danger':'good',target:L('στόχος: 0','target: 0'),active:supplierFilters.quick==='nonconformities',go:()=>quick('nonconformities')}]})(),
  surveys:(()=>{const count=surveyCounts(surveys.surveys);const toggleSurvey=key=>setSurveyFilters(current=>({...current,quick:current.quick===key?null:key}));return [
   {key:'all',icon:Smile,value:surveys.loading?'—':surveys.surveys.length,label:L('Έρευνες','Surveys'),hint:count.drafts?L(`${count.drafts} προσχέδια`,`${count.drafts} drafts`):null,active:!surveyFilters.quick,go:()=>setSurveyFilters(current=>({...current,quick:null}))},
   {key:'open',icon:CheckCircle2,value:count.open,label:L('Σε εξέλιξη','Open'),active:surveyFilters.quick==='open',go:()=>toggleSurvey('open')},
   {key:'recent',icon:Users,value:count.recent,label:L('Απαντήσεις 30 ημερών','Responses in 30 days'),hint:L(`${count.responses} συνολικά`,`${count.responses} in all`)},
   {key:'closing',icon:CalendarClock,value:count.closing,label:L('Λήγουν σε 14 ημέρες','Close within 14 days'),tone:'warning',active:surveyFilters.quick==='closing',go:()=>toggleSurvey('closing')},
   ]})(),
 }
 const figures=({
  overview:[],
  reports:[],
  incidents:[],
  deviations:[],
  risks:[],
 })[tab]||(tab==='indicators'&&measureView==='indicators'?[]:tab==='indicators'?tabFigures[measureView]:tab==='resources'?tabFigures[resourceView]:tabFigures[tab])||[]

 // What each tab asks for: reports and incidents still open, deviations, overdue actions and audits, the high residual risks of the latest assessment, objectives not met and registers gone quiet, equipment and suppliers that need attention.
 const resourcesAttention=(()=>{const equipmentNow=equipmentCounts(resources.equipment),suppliersNow=supplierCounts(resources.suppliers);return equipmentNow.overdue+equipmentNow.down+suppliersNow.attention+suppliersNow.certificates})()
 const tabCounts={reports:register.counts.open,incidents:incidents.counts.open,deviations:deviations.counts.total-deviations.counts.closed,actions:actionCount.open,audits:auditCount.overdue,risks:latestRisks?(latestRisks.levels.residual.very_high||0)+(latestRisks.levels.residual.high||0):0,indicators:missedObjectives+staleRegisters,resources:resourcesAttention}
 const returnValue=tab==='indicators'?`indicators:${measureView}`:tab==='resources'?`resources:${resourceView}`:tab
 const remember=()=>writeSessionValue(RETURN_KEY,returnValue)
 const create=path=>()=>{remember();goTo(path,{registry:`quality.${tab}`})}
 const openRecord=(type,id,ids)=>{remember();writeSessionJson(registryStorageKey(`quality.${type}`,'sequence'),ids);registry.openRecord(navigate,`/quality/${type}/${id}`,id,ids)}

 const reportOption=canManage||canReportIncident?[{id:'report',label:L('Νέα αναφορά','New report'),icon:AlertTriangle,onClick:create('/quality/incidents/new')}]:[]
 const createOptions=({
  overview:[...reportOption,...(canManage?[{id:'capa',label:L('Διορθωτική ενέργεια','Corrective action'),icon:CheckSquare2,onClick:create('/quality/capas/new')},{id:'audit',label:L('Επιθεώρηση','Audit'),icon:ClipboardCheck,onClick:create('/quality/audits/new')}]:[])],
  reports:reportOption,
  incidents:reportOption,
  deviations:canManage?[{id:'finding',label:L('Απόκλιση','Deviation'),icon:FileWarning,onClick:create('/quality/findings/new')}]:[],
  actions:canManage?[{id:'capa',label:L('Διορθωτική ενέργεια','Corrective action'),icon:CheckSquare2,onClick:create('/quality/capas/new')}]:[],
  audits:[...(canManage?[{id:'audit',label:L('Επιθεώρηση','Audit'),icon:ClipboardCheck,onClick:create('/quality/audits/new')},{id:'round',label:L('Κύκλος επιθεώρησης','Audit round'),icon:ListChecks,onClick:create('/quality/audits/round')}]:[]),{id:'questionnaires',label:L('Ερωτηματολόγια επιθεώρησης','Audit questionnaires'),icon:ListChecks,onClick:()=>{remember();goTo('/quality/audit-questionnaires')}}],
  risks:canManage?[{id:'assessment',label:L('Εκτίμηση κινδύνου','Risk assessment'),icon:ShieldAlert,onClick:()=>setRiskCreating(true)},{id:'import',label:L('Εισαγωγή από Excel','Import from Excel'),icon:FileSpreadsheet,onClick:()=>riskFile.current?.click()}]:[],
  indicators:[...(canManageIndicators?[{id:'indicator',label:L('Δείκτης','Indicator'),icon:Gauge,onClick:()=>{remember();goTo('/indicators/new')}}]:[]),...(canManage?[{id:'register',label:L('Μητρώο τμήματος','Department register'),icon:ClipboardList,onClick:()=>{remember();goTo('/registers/new')}},{id:'objective',label:L('Στόχος ποιότητας','Quality objective'),icon:Target,onClick:()=>{setMeasureView('objectives');setEditingObjective(newObjective())}},{id:'survey',label:L('Έρευνα ικανοποίησης','Satisfaction survey'),icon:Smile,onClick:()=>{setMeasureView('surveys');writeSessionValue(RETURN_KEY,'indicators:surveys');goTo('/quality/surveys/new')}}]:[])],
  resources:canManage?[{id:'equipment',label:L('Εξοπλισμός','Equipment'),icon:Stethoscope,onClick:()=>{setResourceView('equipment');writeSessionValue(RETURN_KEY,'resources:equipment');goTo('/quality/equipment/new')}},...(suppliersOn?[{id:'supplier',label:L('Προμηθευτής','Supplier'),icon:Truck,onClick:()=>{setResourceView('suppliers');writeSessionValue(RETURN_KEY,'resources:suppliers');goTo('/quality/suppliers/new')}},{id:'templates',label:L('Πρότυπα αξιολόγησης','Evaluation templates'),icon:ListChecks,onClick:()=>{setResourceView('suppliers');writeSessionValue(RETURN_KEY,'resources:suppliers');goTo('/quality/suppliers/templates')}}]:[])]:[],
 })[tab]

 // Every list exports the same rows to print and to Excel.
 const printAuditSummary=list=>{if(!printReport(auditDetailedBatchDocument(list,records.data.findings,{language}),{pdf:false}))notify(L('Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','Allow pop-ups to print.'),'error')}
 const listExport=(rows,data,title)=><ExportMenu disabled={!rows.length} onPrint={()=>{if(!printRegistry(data(),{language,kind:t('quality'),title}))notify(L('Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','Allow pop-ups to print.'),'error')}} onExcel={()=>exportRegistry(data())}/>
 const download=({
  overview:null,
  deviations:listExport(deviations.filtered,()=>deviationsExport(deviations.filtered,{language,t}),L('Αποκλίσεις','Deviations')),
  reports:listExport(register.filtered,()=>reportRegisterExport(register.filtered,{language,t,categories}),L('Αναφορές προς αξιολόγηση','Reports to assess')),
  incidents:listExport(incidents.filtered,()=>reportRegisterExport(incidents.filtered,{language,t,categories}),L('Μητρώο συμβάντων','Incident register')),
  actions:(()=>{const rows=filterActions(actions,actionView.filters,en);const findings=rows.filter(row=>row.kind==='finding'),capas=rows.filter(row=>row.kind==='capa');return <ExportMenu disabled={!rows.length} onPrint={()=>{if(!printRegistry(qualityExport('capas',capas,{en,t}),{language,kind:t('quality'),title:L('Διορθωτικές ενέργειες','Corrective actions')}))notify(L('Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','Allow pop-ups to print.'),'error')}} items={[{id:'findings',label:L('Αποκλίσεις (.csv)','Deviations (.csv)'),disabled:!findings.length,onClick:()=>exportRegistry(qualityExport('findings',findings,{en,t}))},{id:'capas',label:L('Διορθωτικές ενέργειες (.csv)','Corrective actions (.csv)'),disabled:!capas.length,onClick:()=>exportRegistry(qualityExport('capas',capas,{en,t}))}]}/>})(),
  audits:(()=>{const rows=filterAudits(audits,auditView.filters,en);return <ExportMenu disabled={!rows.length} items={[
   {id:'summary-print',kind:'print',label:L('Συγκεντρωτική έκθεση','Summary report'),onClick:()=>printAuditSummary(rows)},
   {id:'findings-excel',kind:'excel',label:L('Ευρήματα (Excel)','Findings (Excel)'),onClick:()=>exportRegistry(auditFindingsExport(rows,records.data.findings,language))},
   {id:'list-excel',kind:'excel',label:L('Λίστα επιθεωρήσεων (Excel)','Audit list (Excel)'),onClick:()=>exportRegistry(qualityExport('audits',rows,{en,t}))},
  ]}/>})(),
  risks:listExport(riskRows,()=>riskAssessmentsExport(riskRows,language),L('Εκτιμήσεις κινδύνου','Risk assessments')),
  // «Indicators» puts its own «Export» here (actionsSlot).
  indicators:measureView==='indicators'?<div ref={setIndicatorActions} className="row-actions"/>:measureView==='surveys'?listExport(visibleSurveys,()=>surveysExport(visibleSurveys,language),L('Έρευνες ικανοποίησης','Satisfaction surveys')):measureView==='registers'?listExport(registerRows,()=>registersExport(registerRows,language),L('Μητρώα τμημάτων','Department registers')):listExport(visibleObjectives,()=>objectivesExport(visibleObjectives,language),L('Στόχοι ποιότητας','Quality objectives')),
  resources:resourceView==='equipment'?listExport(visibleEquipment,()=>equipmentExport(visibleEquipment,language),L('Εξοπλισμός','Equipment')):listExport(visibleSuppliers,()=>suppliersExport(visibleSuppliers,language),L('Προμηθευτές','Suppliers')),
 })[tab]


 return <Page fill className="registry-fill-page" title={t('quality')} subtitle={L('Από την αναφορά και την απόκλιση ως τη διορθωτική ενέργεια, τους στόχους και την Ανασκόπηση Διοίκησης.','From the report and deviation to corrective action, objectives and management review.')}
  actions={<div className="row-actions">
   {download}
   <CreateAction options={createOptions} label={L('Δημιουργία','Create')}/>
  </div>}>
  <CanonicalTabs items={TABS.filter(item=>!item.manage||canManage).map(item=>({value:item.value,icon:item.icon,label:item.label[en?1:0],count:tabCounts[item.value]||0}))} value={tab} onChange={setTab} ariaLabel={t('quality')}/>
  {tab==='indicators'&&<CanonicalTabs className="lo-subtabs" items={INDICATOR_OPTIONS.map(option=>({value:option.value,icon:option.icon,label:option.label[en?1:0]}))} value={measureView} onChange={setMeasureView} ariaLabel={L('Δείκτες & Στόχοι','Indicators & objectives')}/>}
  {tab==='resources'&&suppliersOn&&<CanonicalTabs className="lo-subtabs" items={RESOURCE_OPTIONS.map(option=>({value:option.value,icon:option.icon,label:option.label[en?1:0]}))} value={resourceView} onChange={setResourceView} ariaLabel={L('Πόροι','Resources')}/>}
  {tab==='audits'&&<CanonicalTabs className="lo-subtabs" items={AUDIT_VIEWS.map(item=>({value:item.id,icon:item.icon,label:item.label[en?1:0]}))} value={AUDIT_VIEWS.some(item=>item.id===auditView.filters.mode)?auditView.filters.mode:'programme'} onChange={value=>auditView.set('mode',value)} ariaLabel={L('Επιθεωρήσεις','Audits')}/>}
  <KpiFigures className="quality-kpis" label={t('quality')} figures={figures}/>
  {tab==='overview'?<div className="workspace-fill quality-overview-scroll">
   <KpiFigures className="quality-kpis" label={L('Επισκόπηση','Overview')} loading={records.loading} error={records.error} figures={centerFigures}/>
   {records.error&&!records.loading&&<RegistryEmptyState error onRetry={records.reload}/>}
   {records.loading?<PageSkeleton metrics={0}/>:<QualityOverview reports={[...register.rows,...incidents.rows]} capas={records.data.capas} audits={records.data.audits} findings={records.data.findings} objectives={objectives.objectives} onMeetings={()=>navigate('/meetings?tab=departments')} language={language} categories={categories}
    onOpen={(type,id)=>openRecord(type,id,[id])} onGo={target=>target==='readiness'?(auditView.set('mode','readiness'),setTab('audits')):target==='objectives'?goObjectives():target==='actions'?goActions('dueSoon'):target==='incidents'?setTab('incidents'):setTab(target)}/>}
  </div>:<>
  {tab==='reports'&&<ReportSummary inbox view={register} loading={records.loading} language={language}/>}
  {tab==='incidents'&&<ReportSummary view={incidents} loading={records.loading} language={language}/>}
  {tab==='deviations'&&canManage&&<DeviationSummary view={deviations} language={language}/>}
  {tab==='audits'&&!['programme','self'].includes(auditView.filters.mode||'programme')&&<AuditsSummary rows={audits} counts={auditCount} view={auditView} loading={records.loading} language={language} filling={fillingProgramme} onFill={canManage?fillProgramme:null}/>}
  {tab==='risks'&&<KpiFigures className="quality-kpis" label={L('Κίνδυνοι','Risks')} figures={tabFigures.risks||[]}/>}
  {tab==='actions'&&<ActionsSummary counts={actionCount} view={actionView} loading={records.loading} language={language}/>}
  {tab==='indicators'&&measureView==='indicators'&&<PageEmbedProvider><IndicatorsPage defaultPeriod="year" registryKey="quality.indicators" actionsSlot={indicatorActions}/></PageEmbedProvider>}
  {!(tab==='indicators'&&measureView==='indicators')&&<section className="surface registry-workspace workspace-column workspace-fill">
   {tab==='reports'&&<ReportRegister inbox view={register} loading={records.loading} language={language} t={t} categories={categories} registry={registry}
    onOpenReport={(row,items)=>openRecord('incidents',row.id,items.map(item=>item.id))}/>}
   {tab==='incidents'&&<ReportRegister compact view={incidents} loading={records.loading} language={language} t={t} categories={categories} registry={registry}
    onOpenReport={(row,items)=>openRecord('incidents',row.id,items.map(item=>item.id))}/>}
   {tab==='deviations'&&canManage&&<DeviationQueue view={deviations} loading={queue.loading} language={language} t={t}
    registry={registry} onOpenRow={(row,rows)=>row.type==='finding'?openRecord('findings',row.id,rows.filter(item=>item.type==='finding').map(item=>item.id)):(remember(),registry.openRecord(navigate,row.item.path,row.key,[]))}
    onCreateFindingCapa={finding=>{writeSessionValue(RETURN_KEY,'deviations');goTo('/quality/capas/new',{registry:'quality.actions',state:{qualitySource:capaSourceFor('findings',finding,language)}})}}
    onCreateCapa={prefill=>{writeSessionValue(RETURN_KEY,'deviations');goTo('/quality/capas/new',{registry:'quality.actions',state:{qualitySource:prefill}})}}/>}
   {tab==='actions'&&<ActionsList rows={actions} view={actionView} loading={records.loading} language={language} t={t} registry={registry}
    onOpen={(row,same)=>openRecord(row.kind==='capa'?'capas':'findings',row.id,same.map(item=>item.id))}
    onCreateCapa={canManage?finding=>{remember();goTo('/quality/capas/new',{registry:'quality.actions',state:{qualitySource:capaSourceFor('findings',finding,language)}})}:null}/>} 
   {tab==='audits'&&<AuditsList canManageSelf={canManage} onPrintSummary={printAuditSummary} rows={audits} view={auditView} loading={records.loading} language={language} t={t} registry={registry}
    onOpen={(row,same)=>openRecord('audits',row.id,same.map(item=>item.id))}
    onPlan={canManage?source=>{remember();goTo('/quality/audits/new',{registry:'quality.audits',state:{qualitySource:source}})}:null} onRound={canManage?()=>{remember();goTo('/quality/audits/round')}:null} findings={records.data.findings}
    onOpenFinding={finding=>openRecord('findings',finding.id,[finding.id])}/>}
   {tab==='risks'&&<RiskAssessmentsPanel list={riskList} organizationId={tenant?.id} en={en} locale={locale} creating={riskCreating} onCreatingChange={setRiskCreating} fileRef={riskFile} onRowsChange={setRiskRows}/>}
   {tab==='indicators'&&measureView==='registers'&&<RegistersPanel list={registerList} only={staleOnly?isStaleRegister:null} onBeforeOpen={remember} onRowsChange={setRegisterRows}/>}
   {tab==='indicators'&&measureView==='objectives'&&<>
    <FilterBar query={objectiveFilters.query} onQueryChange={query=>setObjectiveFilters(current=>({...current,query}))} placeholder={L('Αναζήτηση στόχου ή υπευθύνου','Search objective or owner')} activeAdvancedCount={objectiveFilters.state!=='all'?1:0} onClear={()=>setObjectiveFilters({query:'',state:'all'})} end={null}>
     <FilterSelect label={t('status')} value={objectiveFilters.state} onChange={state=>setObjectiveFilters(current=>({...current,state}))}><option value="all">{t('all')}</option><option value="missed">{L('Δεν επιτυγχάνεται','Not met')}</option><option value="met">{L('Επιτυγχάνεται','Met')}</option><option value="pending">{L('Σε εξέλιξη','In progress')}</option></FilterSelect>
    </FilterBar>
    <ObjectivesTable rows={visibleObjectives} loading={objectives.loading} error={objectives.error} onRetry={objectives.reload} onOpen={objective=>openRecord('objectives',objective.id,visibleObjectives.map(item=>item.id))}/>
   </>}
   {tab==='indicators'&&measureView==='surveys'&&<SurveysList list={surveys} registry={registry} filters={surveyFilters} setFilters={setSurveyFilters} onOpen={survey=>{writeSessionValue(RETURN_KEY,'indicators:surveys');registry.openRecord(navigate,`/quality/surveys/${survey.id}`,survey.id)}}/>}
   {tab==='resources'&&resourceView==='equipment'&&<EquipmentList list={resources} registry={registry} filters={equipmentFilters} setFilters={setEquipmentFilters} onOpen={row=>{writeSessionValue(RETURN_KEY,'resources:equipment');registry.openRecord(navigate,`/quality/equipment/${row.id}`,row.id)}}/>}
   {tab==='resources'&&resourceView==='suppliers'&&suppliersOn&&<SuppliersList list={resources} registry={registry} filters={supplierFilters} setFilters={setSupplierFilters} onOpen={row=>{writeSessionValue(RETURN_KEY,'resources:suppliers');registry.openRecord(navigate,`/quality/suppliers/${row.id}`,row.id)}}/>}
  </section>}</>}
  {editingObjective&&<ObjectiveDialog objective={editingObjective} registers={objectives.registers} onClose={()=>setEditingObjective(null)} onSaved={()=>{setEditingObjective(null);void objectives.reload()}}/>}
 </Page>
}

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
