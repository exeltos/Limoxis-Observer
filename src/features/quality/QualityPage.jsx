import { useCallback,useEffect,useMemo,useRef,useState } from 'react'
import { AlertOctagon,AlertTriangle,CalendarClock,CalendarDays,CheckCircle2,CheckSquare2,ClipboardCheck,ClipboardList,ClipboardSignature,Clock3,FileSpreadsheet,FileWarning,Gauge,GraduationCap,LayoutDashboard,ListChecks,Plus,Scale,SearchCheck,ShieldAlert,ShieldCheck,Smile,Star,Stethoscope,Target,TrendingDown,Truck,UserRound,Users,Wrench } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { ActionButton } from '../../design-system/ActionButton'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { ExportMenu } from '../../design-system/ExportMenu'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { MetricCard } from '../../design-system/MetricCard'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can,CAPABILITIES,ROLES } from '../../core/permissions/roles'
import { registryStorageKey,useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { readSessionValue,writeSessionJson,writeSessionValue } from '../../core/storage/browserStorage'
import { formatDay } from '../../core/i18n/formatDay'
import { exportRegistry,qualityExport } from '../../core/export/registryExports'
import { QUALITY_RETURN_KEY as RETURN_KEY,qualityTabOf } from './qualityReturnSection'
import { loadQualityRecords } from './qualityService'
import { DeviationQueue,ReportRegister,deviationsExport,reportRegisterExport,stageLabel,useDeviationQueue,useDeviations,useReportRegister } from './QualityReportRegister'
import { QualityOverview } from './QualityOverview'
import { ActionsList,AuditsList,actionCounts,actionRows,auditCounts,auditRows,filterActions,filterAudits,isOverdueAction,useListFilters } from './QualityLists'
import { capaSourceFor } from './qualityDeviations'
import { useLibraries } from '../management/useLibraries'
import { RiskAssessmentsPanel } from './risk/RiskAssessmentsPanel'
import { useRiskAssessmentList } from './risk/useRiskAssessmentList'
import { summarizeRisks } from './risk/riskModel'
import { RegistersPanel,useRegisterList } from '../registers/RegistersPanel'
import { registerKindLabel,registerStatusLabel } from '../registers/registerText'
import { ObjectiveDialog,ObjectivesTable,ReviewsTable,newObjective,objectivesExport,reviewsExport,useObjectives,useReviews } from './review/QualityObjectives'
import { MeetingsList,filterMeetings,meetingsExport,useMeetings } from './meetings/MeetingsPanel'
import { SurveysList,filterSurveys,surveyCounts,surveysExport,useSurveys } from './surveys/SurveysPanel'
import { EquipmentList,SuppliersList,useResources } from './resources/ResourcesPanel'
import { NO_EQUIPMENT_FILTERS,NO_SUPPLIER_FILTERS,equipmentCounts,equipmentExport,filterEquipment,filterSuppliers,supplierCounts,suppliersExport } from './resources/resourceModel'
import { departmentMeetingStatus,latestMeetings,lateDecisions as meetingLateDecisions,openDecisions as meetingOpenDecisions } from './meetings/meetingModel'
import './quality.css'

// The Quality Center follows the frame of the risk assessment: each tab's
// figures above one card with its filter row, list and pager. A figure filters
// its list; a second click clears it. «Create» is always top right.
const TABS=[
 {value:'overview',icon:LayoutDashboard,label:['Επισκόπηση','Overview']},
 {value:'reports',icon:AlertTriangle,label:['Αναφορές','Reports']},
 {value:'deviations',icon:FileWarning,label:['Αποκλίσεις','Deviations'],manage:true},
 {value:'actions',icon:CheckSquare2,label:['Ενέργειες','Actions']},
 {value:'audits',icon:ClipboardCheck,label:['Επιθεωρήσεις','Audits']},
 {value:'risks',icon:ShieldAlert,label:['Κίνδυνοι','Risks']},
 {value:'indicators',icon:Target,label:['Δείκτες & Στόχοι','Indicators & objectives']},
 {value:'resources',icon:Stethoscope,label:['Πόροι','Resources']},
 {value:'review',icon:Users,label:['Συναντήσεις','Meetings']},
]
const STAGE_ICON={toAssess:Clock3,investigating:SearchCheck,action:Wrench,effectiveness:Scale,toClose:CheckCircle2}
const MEETING_OPTIONS=[
 {value:'meetings',icon:Users,label:['Τμημάτων','Departments']},
 {value:'reviews',icon:ClipboardSignature,label:['Ανασκόπηση Διοίκησης','Management review']},
]
const INDICATOR_OPTIONS=[
 {value:'registers',icon:ClipboardList,label:['Μητρώα','Registers']},
 {value:'objectives',icon:Target,label:['Στόχοι','Objectives']},
 {value:'surveys',icon:Smile,label:['Έρευνες','Surveys']},
]
const RESOURCE_OPTIONS=[
 {value:'equipment',icon:Stethoscope,label:['Εξοπλισμός','Equipment']},
 {value:'suppliers',icon:Truck,label:['Προμηθευτές','Suppliers']},
]
const ACTION_DEFAULTS={query:'',kind:'all',status:'all',department:'all',quick:null}
const AUDIT_DEFAULTS={query:'',status:'all',type:'all',department:'all',mode:'programme',quick:null}
const STALE_DAYS=45
// A review's decisions still open, and those past their due date.
const openDecisions=review=>(review.actions||[]).filter(action=>action.status==='open')
const lateDecisions=review=>openDecisions(review).filter(action=>action.dueDate&&action.dueDate<new Date().toISOString().slice(0,10))

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
 // Entering Quality always starts on the overview; the last tab is restored only
 // when coming back from a record opened here (the flag is consumed once).
 const [initial]=useState(()=>qualityTabOf(readSessionValue(RETURN_KEY,''))||{tab:'overview',view:null})
 useEffect(()=>{writeSessionValue(RETURN_KEY,'')},[])
 const [tab,setTab]=useState(initial.tab)
 const [measureView,setMeasureView]=useState(initial.tab==='indicators'&&initial.view||'registers')
 const [meetingView,setMeetingView]=useState(initial.tab==='review'&&initial.view||'meetings')
 const [resourceView,setResourceView]=useState(initial.tab==='resources'&&initial.view||'equipment')
 const [equipmentFilters,setEquipmentFilters]=useState(NO_EQUIPMENT_FILTERS)
 const [supplierFilters,setSupplierFilters]=useState(NO_SUPPLIER_FILTERS)
 const [meetingFilters,setMeetingFilters]=useState({query:'',department:'all',status:'all',quick:null})
 const [surveyFilters,setSurveyFilters]=useState({query:'',audience:'all',status:'all',quick:null})
 const [reviewQuick,setReviewQuick]=useState(null)
 const registry=useRegistryMemory(`quality.${tab}`)

 const addOns=membership?.capabilities??[];const custom=membership?.customCapabilities??[]
 const ownerFullAccess=!isRolePreview&&actualRole===ROLES.PLATFORM_OWNER
 const canManage=ownerFullAccess||can(role,CAPABILITIES.MANAGE_QUALITY,addOns,custom)
 const canReportIncident=ownerFullAccess||can(role,CAPABILITIES.REPORT_INCIDENT,addOns,custom)

 const records=useQualityRecords(tenant?.id)
 const queue=useDeviationQueue(tenant?.id,canManage)
 const {libraries}=useLibraries()
 const categories=libraries.incidentCategories||[]
 const register=useReportRegister(records.data.incidents,records.data.capas,language)
 const deviations=useDeviations(queue.sources,language)
 const actions=useMemo(()=>actionRows(records.data.findings,records.data.capas,records.data.incidents),[records.data.findings,records.data.capas,records.data.incidents])
 const audits=useMemo(()=>auditRows(records.data.audits,records.data.findings),[records.data.audits,records.data.findings])
 const actionView=useListFilters('quality.actions',ACTION_DEFAULTS)
 const auditView=useListFilters('quality.audits',AUDIT_DEFAULTS)
 const riskList=useRiskAssessmentList(tenant?.id,tab==='risks')
 const [riskCreating,setRiskCreating]=useState(false)
 const riskFile=useRef(null)
 // What the risk and register lists show after their own filters: «Download» exports exactly that.
 const [riskRows,setRiskRows]=useState([])
 const [registerRows,setRegisterRows]=useState([])
 const [staleOnly,setStaleOnly]=useState(false)
 const registerList=useRegisterList()
 const objectives=useObjectives(tenant?.id)
 const reviews=useReviews(tenant?.id)
 const meetings=useMeetings()
 const visibleMeetings=useMemo(()=>filterMeetings(meetings.meetings,meetingFilters,en),[meetings.meetings,meetingFilters,en])
 const surveys=useSurveys()
 const visibleSurveys=useMemo(()=>filterSurveys(surveys.surveys,surveyFilters),[surveys.surveys,surveyFilters])
 const resources=useResources(tab==='resources')
 const visibleEquipment=useMemo(()=>filterEquipment(resources.equipment,equipmentFilters),[resources.equipment,equipmentFilters])
 const visibleSuppliers=useMemo(()=>filterSuppliers(resources.suppliers,supplierFilters),[resources.suppliers,supplierFilters])
 const [objectiveFilters,setObjectiveFilters]=useState({query:'',state:'all'})
 const [reviewQuery,setReviewQuery]=useState('')
 const [editingObjective,setEditingObjective]=useState(null)

 // Only active objectives need attention (achieved, not achieved and cancelled ones are settled).
 const isMissed=item=>(item.status||'active')==='active'&&item.current.status==='missed'
 const visibleObjectives=useMemo(()=>{const q=objectiveFilters.query.trim().toLowerCase();return objectives.objectives.filter(item=>!q||`${item.code} ${item.title} ${item.ownerLabel||''}`.toLowerCase().includes(q)).filter(item=>objectiveFilters.state==='all'||(objectiveFilters.state==='missed'?isMissed(item):item.current.status===objectiveFilters.state))},[objectives.objectives,objectiveFilters])
 const todayIso=new Date().toISOString().slice(0,10)
 const visibleReviews=useMemo(()=>{const q=reviewQuery.trim().toLowerCase();return reviews.reviews.filter(item=>!q||`${item.code} ${item.reviewDate||''}`.toLowerCase().includes(q)).filter(item=>reviewQuick==='open'?openDecisions(item).length>0:reviewQuick==='late'?lateDecisions(item).length>0:true)},[reviews.reviews,reviewQuery,reviewQuick])

 // What needs attention, across the whole Center: the overview's figures,
 // and those of the tabs that have no figures of their own yet.
 const overdueActions=actions.filter(isOverdueAction).length
 const missedObjectives=objectives.objectives.filter(isMissed).length
 const toggle=(view,key,value)=>view.set(key,view.filters[key]===value?null:value)
 const goReports=quick=>{setTab('reports');register.clear();register.set('quick',quick)}
 const goActions=quick=>{setTab('actions');actionView.set('quick',quick)}
 const goObjectives=()=>{setTab('indicators');setMeasureView('objectives');setObjectiveFilters(current=>({...current,state:'missed'}))}
 const centerFigures=[
  {key:'open',icon:Clock3,value:register.counts.open,label:L('Ανοιχτές αναφορές','Open reports'),go:()=>goReports('open')},
  {key:'sentinel',icon:AlertOctagon,value:register.counts.sentinel,label:L('Ανοιχτά συμβάντα-φρουροί','Open sentinel events'),tone:register.counts.sentinel?'danger':'neutral',go:()=>goReports('sentinel')},
  ...(canManage?[{key:'deviations',icon:FileWarning,value:queue.loading?'—':deviations.counts.total,label:L('Αποκλίσεις χωρίς ενέργεια','Deviations without action'),go:()=>setTab('deviations')}]:[]),
  {key:'overdue',icon:AlertTriangle,value:overdueActions,label:L('Εκπρόθεσμες ενέργειες','Overdue actions'),tone:overdueActions?'danger':'neutral',go:()=>goActions('overdue')},
  {key:'objectives',icon:TrendingDown,value:objectives.loading?'—':missedObjectives,label:L('Στόχοι που δεν επιτυγχάνονται','Objectives not met'),go:goObjectives},
 ]
 const actionCount=actionCounts(actions)
 const auditCount=auditCounts(audits)
 const objectiveState=state=>{setMeasureView('objectives');setObjectiveFilters(current=>({...current,state:current.state===state&&measureView==='objectives'?'all':state}))}
 const activeObjectives=objectives.objectives.filter(item=>(item.status||'active')==='active')
 // Stable across renders: the register list reports its rows back on every change.
 const isStaleRegister=useCallback(item=>item.status!=='archived'&&(!item.lastEntry||(Date.parse(todayIso)-Date.parse(item.lastEntry))/86400000>STALE_DAYS),[todayIso])
 const staleRegisters=registerList.registers.filter(isStaleRegister).length
 const latestReview=[...reviews.reviews].sort((a,b)=>String(b.reviewDate).localeCompare(String(a.reviewDate)))[0]
 const nextReviewLate=Boolean(latestReview?.nextReviewDate&&latestReview.nextReviewDate<todayIso)
 const latestAssessment=[...riskList.items].sort((a,b)=>String(b.assessedOn||'').localeCompare(String(a.assessedOn||'')))[0]
 const latestRisks=latestAssessment?summarizeRisks(latestAssessment.risks||[]):null
 const quickFigure=(view,key,icon,value,label,tone)=>({key,icon,value,label,tone,active:view.filters.quick===key,go:()=>toggle(view,'quick',key)})
 const tabFigures={
  actions:[quickFigure(actionView,'open',CheckSquare2,actionCount.open,L('Ανοιχτές ενέργειες','Open actions')),
   quickFigure(actionView,'overdue',AlertTriangle,actionCount.overdue,L('Εκπρόθεσμες','Overdue'),actionCount.overdue?'danger':'neutral'),
   quickFigure(actionView,'dueSoon',CalendarClock,actionCount.dueSoon,L('Λήγουν σε 14 ημέρες','Due in 14 days')),
   quickFigure(actionView,'verification',Scale,actionCount.verification,L('Έλεγχος αποτελεσματικότητας','Effectiveness check')),
   quickFigure(actionView,'orphans',SearchCheck,actionCount.orphans,L('Ευρήματα χωρίς ενέργεια','Findings without an action'),actionCount.orphans?'warning':'neutral')],
  audits:[quickFigure(auditView,'planned',CalendarDays,auditCount.planned,L('Μένουν φέτος','Left this year')),
   quickFigure(auditView,'month',CalendarClock,auditCount.month,L('Αυτόν τον μήνα','This month')),
   quickFigure(auditView,'overdue',AlertTriangle,auditCount.overdue,L('Εκπρόθεσμες','Overdue'),auditCount.overdue?'danger':'neutral'),
   quickFigure(auditView,'withFindings',SearchCheck,auditCount.withFindings,L('Με ανοιχτά ευρήματα','With open findings'),auditCount.withFindings?'warning':'neutral'),
   {...quickFigure(auditView,'completed',Gauge,auditCount.compliance==null?'—':`${auditCount.compliance}%`,L('Μέση συμμόρφωση φέτος','Average compliance this year'))}],
  risks:latestRisks?[
   {key:'assessments',icon:ShieldAlert,value:riskList.items.length,label:L('Εκτιμήσεις κινδύνου','Risk assessments')},
   {key:'risks',icon:ClipboardList,value:latestRisks.total,label:L(`Κίνδυνοι · ${latestAssessment.periodLabel}`,`Risks · ${latestAssessment.periodLabel}`)},
   {key:'veryHigh',icon:AlertOctagon,value:latestRisks.levels.residual.very_high,label:L('Πολύ υψηλοί (υπολ.)','Very high (residual)'),tone:latestRisks.levels.residual.very_high?'danger':'neutral'},
   {key:'high',icon:AlertTriangle,value:latestRisks.levels.residual.high,label:L('Υψηλοί (υπολ.)','High (residual)')},
   {key:'next',icon:CalendarClock,value:formatDay(latestAssessment.nextReviewOn,language)||'—',label:L('Επόμενη αξιολόγηση','Next assessment')},
  ]:[],
  indicators:[{key:'registers',icon:ClipboardList,value:registerList.loading?'—':registerList.registers.length,label:L('Μητρώα τμημάτων','Department registers'),active:measureView==='registers'&&!staleOnly,go:()=>{setMeasureView('registers');setStaleOnly(false)}},
   {key:'stale',icon:Clock3,value:registerList.loading?'—':staleRegisters,label:L(`Χωρίς καταχώριση ${STALE_DAYS}+ ημέρες`,`No entry for ${STALE_DAYS}+ days`),tone:staleRegisters?'warning':'neutral',active:measureView==='registers'&&staleOnly,go:()=>{setMeasureView('registers');setStaleOnly(value=>measureView!=='registers'||!value)}},
   {key:'objectives',icon:Target,value:objectives.loading?'—':activeObjectives.length,label:L('Ενεργοί στόχοι','Active objectives'),active:measureView==='objectives'&&objectiveFilters.state==='all',go:()=>objectiveState('all')},
   {key:'met',icon:CheckCircle2,value:activeObjectives.filter(item=>item.current.status==='met').length,label:L('Επιτυγχάνονται','Met'),active:measureView==='objectives'&&objectiveFilters.state==='met',go:()=>objectiveState('met')},
   {key:'missed',icon:TrendingDown,value:missedObjectives,label:L('Δεν επιτυγχάνονται','Not met'),tone:missedObjectives?'danger':'neutral',active:measureView==='objectives'&&objectiveFilters.state==='missed',go:()=>objectiveState('missed')},
   {key:'pending',icon:Clock3,value:activeObjectives.filter(item=>item.current.status==='pending').length,label:L('Σε εξέλιξη','In progress'),active:measureView==='objectives'&&objectiveFilters.state==='pending',go:()=>objectiveState('pending')}],
  equipment:(()=>{const count=equipmentCounts(resources.equipment);const dash=value=>resources.loading?'—':value;const quick=key=>setEquipmentFilters(current=>({...current,quick:current.quick===key?null:key}));return [
   {key:'all',icon:Stethoscope,value:dash(count.total),label:L('Εξοπλισμός σε χρήση','Equipment in use'),active:!equipmentFilters.quick,go:()=>setEquipmentFilters(current=>({...current,quick:null}))},
   {key:'overdue',icon:AlertTriangle,value:dash(count.overdue),label:L('Εκπρόθεσμη συντήρηση / διακρίβωση','Overdue maintenance / calibration'),tone:count.overdue?'danger':'neutral',active:equipmentFilters.quick==='overdue',go:()=>quick('overdue')},
   {key:'dueSoon',icon:CalendarClock,value:dash(count.dueSoon),label:L('Οφείλονται σε 30 ημέρες','Due within 30 days'),tone:count.dueSoon?'warning':'neutral',active:equipmentFilters.quick==='dueSoon',go:()=>quick('dueSoon')},
   {key:'down',icon:AlertOctagon,value:dash(count.down),label:L('Εκτός λειτουργίας','Out of service'),tone:count.down?'danger':'neutral',active:equipmentFilters.quick==='down',go:()=>quick('down')},
   {key:'critical',icon:ShieldAlert,value:dash(count.critical),label:L('Υψηλής κρισιμότητας','High criticality'),active:equipmentFilters.quick==='critical',go:()=>quick('critical')}]})(),
  suppliers:(()=>{const count=supplierCounts(resources.suppliers);const dash=value=>resources.loading?'—':value;const quick=key=>setSupplierFilters(current=>({...current,quick:current.quick===key?null:key}));return [
   {key:'all',icon:Truck,value:dash(count.total),label:L('Ενεργοί προμηθευτές','Active suppliers'),active:!supplierFilters.quick,go:()=>setSupplierFilters(current=>({...current,quick:null}))},
   {key:'approved',icon:CheckCircle2,value:dash(count.approved),label:L('Εγκεκριμένοι','Approved'),active:supplierFilters.quick==='approved',go:()=>quick('approved')},
   {key:'attention',icon:AlertTriangle,value:dash(count.attention),label:L('Υπό όρους / απορρίπτονται','Conditional / rejected'),tone:count.attention?'warning':'neutral',active:supplierFilters.quick==='attention',go:()=>quick('attention')},
   {key:'evaluationDue',icon:Star,value:dash(count.evaluationDue),label:L('Οφείλεται αξιολόγηση','Evaluation due'),tone:count.evaluationDue?'warning':'neutral',active:supplierFilters.quick==='evaluationDue',go:()=>quick('evaluationDue')},
   {key:'certificates',icon:ShieldCheck,value:dash(count.certificates),label:L('Πιστοποιητικά που λήγουν','Certificates expiring'),tone:count.certificates?'warning':'neutral',active:supplierFilters.quick==='certificates',go:()=>quick('certificates')},
   {key:'nonconformities',icon:FileWarning,value:dash(count.nonconformities),label:L('Ανοιχτές μη συμμορφώσεις','Open nonconformities'),tone:count.nonconformities?'danger':'neutral',active:supplierFilters.quick==='nonconformities',go:()=>quick('nonconformities')}]})(),
  surveys:(()=>{const count=surveyCounts(surveys.surveys);const toggleSurvey=key=>setSurveyFilters(current=>({...current,quick:current.quick===key?null:key}));return [
   {key:'all',icon:Smile,value:surveys.loading?'—':surveys.surveys.length,label:L('Έρευνες','Surveys'),active:!surveyFilters.quick,go:()=>setSurveyFilters(current=>({...current,quick:null}))},
   {key:'open',icon:CheckCircle2,value:count.open,label:L('Σε εξέλιξη','Open'),active:surveyFilters.quick==='open',go:()=>toggleSurvey('open')},
   {key:'recent',icon:Users,value:count.recent,label:L('Απαντήσεις 30 ημερών','Responses in 30 days')},
   {key:'responses',icon:ClipboardList,value:count.responses,label:L('Απαντήσεις συνολικά','Responses in all')},
   {key:'closing',icon:CalendarClock,value:count.closing,label:L('Λήγουν σε 14 ημέρες','Close within 14 days'),tone:count.closing?'warning':'neutral',active:surveyFilters.quick==='closing',go:()=>toggleSurvey('closing')},
   {key:'draft',icon:Clock3,value:count.drafts,label:L('Προσχέδια','Drafts'),active:surveyFilters.quick==='draft',go:()=>toggleSurvey('draft')}]})(),
  meetings:(()=>{const yearMeetings=meetings.meetings.filter(item=>String(item.meetingDate).startsWith(todayIso.slice(0,4)));const status=departmentMeetingStatus(meetings.meetings,todayIso);const late=status.filter(item=>item.overdue).length;const toggleMeeting=key=>setMeetingFilters(current=>({...current,quick:current.quick===key?null:key}));return [
   {key:'year',icon:Users,value:meetings.loading?'—':yearMeetings.length,label:L('Συναντήσεις φέτος','Meetings this year'),active:!meetingFilters.quick,go:()=>setMeetingFilters(current=>({...current,quick:null}))},
   {key:'departments',icon:ClipboardList,value:status.length,label:L('Τμήματα με συναντήσεις','Departments meeting')},
   {key:'nextLate',icon:CalendarClock,value:late,label:L('Εκπρόθεσμη επόμενη συνάντηση','Next meeting overdue'),tone:late?'warning':'neutral'},
   {key:'open',icon:ListChecks,value:latestMeetings(meetings.meetings).reduce((sum,item)=>sum+meetingOpenDecisions(item).length,0),label:L('Ανοιχτές αποφάσεις','Open decisions'),active:meetingFilters.quick==='open',go:()=>toggleMeeting('open')},
   {key:'late',icon:AlertTriangle,value:latestMeetings(meetings.meetings).reduce((sum,item)=>sum+meetingLateDecisions(item).length,0),label:L('Εκπρόθεσμες αποφάσεις','Overdue decisions'),tone:latestMeetings(meetings.meetings).some(item=>meetingLateDecisions(item).length)?'danger':'neutral',active:meetingFilters.quick==='late',go:()=>toggleMeeting('late')},
   {key:'draft',icon:Clock3,value:meetings.meetings.filter(item=>item.status==='draft').length,label:L('Πρακτικά σε πρόχειρο','Draft minutes'),active:meetingFilters.quick==='draft',go:()=>toggleMeeting('draft')},
  ]})(),
  review:[{key:'reviews',icon:ClipboardSignature,value:reviews.loading?'—':reviews.reviews.length,label:L('Ανασκοπήσεις','Reviews'),active:!reviewQuick,go:()=>setReviewQuick(null)},
   {key:'last',icon:CalendarDays,value:formatDay(latestReview?.reviewDate,language)||'—',label:L('Τελευταία ανασκόπηση','Last review')},
   {key:'next',icon:CalendarClock,value:formatDay(latestReview?.nextReviewDate,language)||'—',label:nextReviewLate?L('Επόμενη · εκπρόθεσμη','Next · overdue'):L('Επόμενη ανασκόπηση','Next review'),tone:nextReviewLate?'danger':'neutral'},
   {key:'open',icon:ListChecks,value:reviews.reviews.reduce((sum,item)=>sum+openDecisions(item).length,0),label:L('Ανοιχτές αποφάσεις','Open decisions'),active:reviewQuick==='open',go:()=>setReviewQuick(current=>current==='open'?null:'open')},
   {key:'late',icon:AlertTriangle,value:reviews.reviews.reduce((sum,item)=>sum+lateDecisions(item).length,0),label:L('Εκπρόθεσμες αποφάσεις','Overdue decisions'),tone:reviews.reviews.some(item=>lateDecisions(item).length)?'danger':'neutral',active:reviewQuick==='late',go:()=>setReviewQuick(current=>current==='late'?null:'late')}],
 }
 const figures=({
  overview:centerFigures,
  // The open reports at each stage of their flow, and the sentinel events among them.
  reports:[...['toAssess','investigating','action','effectiveness','toClose'].map(stage=>({key:stage,icon:STAGE_ICON[stage],value:register.counts.stages?.[stage]??0,label:stageLabel(stage,language),active:register.filters.quick===stage,go:()=>toggle(register,'quick',stage)})),
   {key:'sentinel',icon:AlertOctagon,value:register.counts.sentinel,label:L('Συμβάντα-φρουροί','Sentinel events'),tone:register.counts.sentinel?'danger':'neutral',active:register.filters.quick==='sentinel',go:()=>toggle(register,'quick','sentinel')}],
  deviations:[{key:'all',icon:FileWarning,value:deviations.counts.total,label:L('Χωρίς διορθωτική ενέργεια','Without a corrective action'),active:deviations.filters.source==='all'&&deviations.filters.priority==='all',go:()=>{deviations.set('source','all');deviations.set('priority','all')}},
   ...[['control',ClipboardCheck,L('Από ελέγχους','From controls')],['bundle',ShieldCheck,L('Από bundles','From bundles')],['training',GraduationCap,L('Από εκπαιδεύσεις','From trainings')]].map(([source,icon,label])=>({key:source,icon,value:deviations.counts[source],label,active:deviations.filters.source===source,go:()=>deviations.set('source',deviations.filters.source===source?'all':source)})),
   {key:'high',icon:AlertTriangle,value:deviations.counts.high,label:L('Υψηλής προτεραιότητας','High priority'),tone:deviations.counts.high?'danger':'neutral',active:deviations.filters.priority==='high',go:()=>deviations.set('priority',deviations.filters.priority==='high'?'all':'high')}],
 })[tab]||(tab==='review'&&meetingView==='meetings'?tabFigures.meetings:tab==='indicators'&&measureView==='surveys'?tabFigures.surveys:tab==='resources'?tabFigures[resourceView]:tabFigures[tab])||[]

 // Where «Back» from a record or a new record returns.
 const returnValue=tab==='indicators'?`indicators:${measureView}`:tab==='review'?`review:${meetingView}`:tab==='resources'?`resources:${resourceView}`:tab
 const remember=()=>writeSessionValue(RETURN_KEY,returnValue)
 const create=path=>()=>{remember();goTo(path,{registry:`quality.${tab}`})}
 // The record page reads its previous / next sequence under its own type (quality.incidents, quality.capas…).
 const openRecord=(type,id,ids)=>{remember();writeSessionJson(registryStorageKey(`quality.${type}`,'sequence'),ids);registry.openRecord(navigate,`/quality/${type}/${id}`,id,ids)}

 const reportOption=canManage||canReportIncident?[{id:'report',label:L('Αναφορά συμβάντος','Incident report'),icon:AlertTriangle,onClick:create('/quality/incidents/new')}]:[]
 const createOptions=({
  overview:[...reportOption,...(canManage?[{id:'capa',label:L('Διορθωτική ενέργεια','Corrective action'),icon:CheckSquare2,onClick:create('/quality/capas/new')},{id:'audit',label:L('Επιθεώρηση','Audit'),icon:ClipboardCheck,onClick:create('/quality/audits/new')}]:[])],
  deviations:[],
  reports:reportOption,
  actions:canManage?[{id:'capa',label:L('Διορθωτική ενέργεια','Corrective action'),icon:CheckSquare2,onClick:create('/quality/capas/new')},{id:'finding',label:L('Εύρημα','Finding'),icon:SearchCheck,onClick:create('/quality/findings/new')}]:[],
  audits:canManage?[{id:'audit',label:L('Επιθεώρηση','Audit'),icon:ClipboardCheck,onClick:create('/quality/audits/new')}]:[],
  risks:canManage?[{id:'assessment',label:L('Εκτίμηση κινδύνου','Risk assessment'),icon:ShieldAlert,onClick:()=>setRiskCreating(true)},{id:'import',label:L('Εισαγωγή από Excel','Import from Excel'),icon:FileSpreadsheet,onClick:()=>riskFile.current?.click()}]:[],
  indicators:canManage?[{id:'register',label:L('Μητρώο τμήματος','Department register'),icon:ClipboardList,onClick:()=>{remember();goTo('/registers/new')}},{id:'objective',label:L('Στόχος ποιότητας','Quality objective'),icon:Target,onClick:()=>{setMeasureView('objectives');setEditingObjective(newObjective())}},{id:'survey',label:L('Έρευνα ικανοποίησης','Satisfaction survey'),icon:Smile,onClick:()=>{setMeasureView('surveys');writeSessionValue(RETURN_KEY,'indicators:surveys');goTo('/quality/surveys/new')}}]:[],
  resources:canManage?[{id:'equipment',label:L('Εξοπλισμός','Equipment'),icon:Stethoscope,onClick:()=>{setResourceView('equipment');writeSessionValue(RETURN_KEY,'resources:equipment');goTo('/quality/equipment/new')}},{id:'supplier',label:L('Προμηθευτής','Supplier'),icon:Truck,onClick:()=>{setResourceView('suppliers');writeSessionValue(RETURN_KEY,'resources:suppliers');goTo('/quality/suppliers/new')}}]:[],
  review:[{id:'meeting',label:L('Συνάντηση τμήματος','Department meeting'),icon:Users,onClick:()=>{setMeetingView('meetings');writeSessionValue(RETURN_KEY,'review:meetings');goTo('/meetings/new')}},...(canManage?[{id:'review',label:L('Ανασκόπηση Διοίκησης','Management review'),icon:ClipboardSignature,onClick:()=>{setMeetingView('reviews');writeSessionValue(RETURN_KEY,'review:reviews');navigate('/quality/reviews/new')}}]:[])],
 })[tab]

 const download=({
  overview:null,
  deviations:<ExportMenu disabled={!deviations.filtered.length} onExcel={()=>exportRegistry(deviationsExport(deviations.filtered,{language}))}/>,
  reports:<ExportMenu disabled={!register.filtered.length} onExcel={()=>exportRegistry(reportRegisterExport(register.filtered,{language,t,categories}))}/>,
  actions:(()=>{const rows=filterActions(actions,actionView.filters,en);const findings=rows.filter(row=>row.kind==='finding'),capas=rows.filter(row=>row.kind==='capa');return <ExportMenu items={[{id:'findings',label:L('Ευρήματα (.csv)','Findings (.csv)'),disabled:!findings.length,onClick:()=>exportRegistry(qualityExport('findings',findings,{en,t}))},{id:'capas',label:L('Διορθωτικές ενέργειες (.csv)','Corrective actions (.csv)'),disabled:!capas.length,onClick:()=>exportRegistry(qualityExport('capas',capas,{en,t}))}]}/>})(),
  audits:(()=>{const rows=filterAudits(audits,auditView.filters,en);return <ExportMenu disabled={!rows.length} onExcel={()=>exportRegistry(qualityExport('audits',rows,{en,t}))}/>})(),
  risks:<ExportMenu disabled={!riskRows.length} onExcel={()=>exportRegistry(riskAssessmentsExport(riskRows,language))}/>,
  indicators:measureView==='surveys'?<ExportMenu disabled={!visibleSurveys.length} onExcel={()=>exportRegistry(surveysExport(visibleSurveys,language))}/>:measureView==='registers'?<ExportMenu disabled={!registerRows.length} onExcel={()=>exportRegistry(registersExport(registerRows,language))}/>:<ExportMenu disabled={!visibleObjectives.length} onExcel={()=>exportRegistry(objectivesExport(visibleObjectives,language))}/>,
  resources:resourceView==='equipment'?<ExportMenu disabled={!visibleEquipment.length} onExcel={()=>exportRegistry(equipmentExport(visibleEquipment,language))}/>:<ExportMenu disabled={!visibleSuppliers.length} onExcel={()=>exportRegistry(suppliersExport(visibleSuppliers,language))}/>,
  review:meetingView==='meetings'?<ExportMenu disabled={!visibleMeetings.length} onExcel={()=>exportRegistry(meetingsExport(visibleMeetings,language))}/>:<ExportMenu disabled={!visibleReviews.length} onExcel={()=>exportRegistry(reviewsExport(visibleReviews,language))}/>,
 })[tab]

 const meetingSwitch=<ModeSwitch ariaLabel={L('Προβολή','View')} value={meetingView} onChange={setMeetingView} options={MEETING_OPTIONS.map(option=>({value:option.value,icon:option.icon,label:option.label[en?1:0]}))}/>
 const resourceSwitch=<ModeSwitch ariaLabel={L('Προβολή','View')} value={resourceView} onChange={setResourceView} options={RESOURCE_OPTIONS.map(option=>({value:option.value,icon:option.icon,label:option.label[en?1:0]}))}/>
 const measureSwitch=<ModeSwitch ariaLabel={L('Προβολή','View')} value={measureView} onChange={setMeasureView} options={INDICATOR_OPTIONS.map(option=>({value:option.value,icon:option.icon,label:option.label[en?1:0]}))}/>

 return <Page fill className="registry-fill-page" title={t('quality')} subtitle={L('Από την αναφορά και το εύρημα ως τη διορθωτική ενέργεια, τους στόχους και την Ανασκόπηση Διοίκησης.','From the report and the finding to the corrective action, the objectives and the management review.')}
  actions={<div className="row-actions">
   {download}
   {tab==='reports'&&canReportIncident&&<ActionButton label={L('Οι αναφορές συμβάντων μου','My incident reports')} tone="neutral" onClick={()=>goTo('/quality/my-reports')}><UserRound size={17}/><span>{L('Οι αναφορές μου','My reports')}</span></ActionButton>}
   <CreateAction options={createOptions} label={L('Δημιουργία','Create')}/>
  </div>}>
  {figures.length>0&&<div className="workspace-summary"><div className="module-summary-strip quality-kpis" style={{'--quality-kpis':figures.length}}>
   {figures.map(figure=><MetricCard key={figure.key} icon={figure.icon} value={figure.value} label={figure.label} tone={figure.tone} onClick={figure.go} active={figure.active}/>)}
  </div></div>}
  <CanonicalTabs items={TABS.filter(item=>!item.manage||canManage).map(item=>({value:item.value,icon:item.icon,label:item.label[en?1:0],count:item.value==='reports'?register.counts.stages?.toAssess||0:item.value==='deviations'?deviations.counts.total:item.value==='actions'?overdueActions:0}))} value={tab} onChange={setTab} ariaLabel={t('quality')}/>
  {tab==='overview'?<div className="workspace-fill quality-overview-scroll">
   <QualityOverview reports={register.rows} capas={records.data.capas} audits={records.data.audits} objectives={objectives.objectives} language={language} categories={categories}
    onOpen={(type,id)=>openRecord(type,id,[id])} onGo={target=>target==='objectives'?goObjectives():target==='actions'?goActions('dueSoon'):setTab(target)}/>
  </div>:<section className="surface registry-workspace workspace-column workspace-fill">
   {tab==='reports'&&<ReportRegister view={register} loading={records.loading} language={language} t={t} categories={categories} registry={registry}
    onOpenReport={(row,items)=>openRecord('incidents',row.id,items.map(item=>item.id))}/>}
   {tab==='deviations'&&canManage&&<DeviationQueue view={deviations} loading={queue.loading} language={language} t={t}
    onCreateCapa={prefill=>{writeSessionValue(RETURN_KEY,'deviations');goTo('/quality/capas/new',{registry:'quality.actions',state:{qualitySource:prefill}})}}/>}
   {tab==='actions'&&<ActionsList rows={actions} view={actionView} loading={records.loading} language={language} t={t} registry={registry}
    onOpen={(row,same)=>openRecord(row.kind==='capa'?'capas':'findings',row.id,same.map(item=>item.id))}
    onCreateCapa={canManage?finding=>{remember();goTo('/quality/capas/new',{registry:'quality.actions',state:{qualitySource:capaSourceFor('findings',finding,language)}})}:null}/>}
   {tab==='audits'&&<AuditsList rows={audits} view={auditView} loading={records.loading} language={language} t={t} registry={registry}
    onOpen={(row,same)=>openRecord('audits',row.id,same.map(item=>item.id))}
    onPlan={canManage?source=>{remember();goTo('/quality/audits/new',{registry:'quality.audits',state:{qualitySource:source}})}:null}/>}
   {tab==='risks'&&<RiskAssessmentsPanel list={riskList} organizationId={tenant?.id} en={en} locale={locale} creating={riskCreating} onCreatingChange={setRiskCreating} fileRef={riskFile} onRowsChange={setRiskRows}/>}
   {tab==='indicators'&&measureView==='registers'&&<RegistersPanel list={registerList} only={staleOnly?isStaleRegister:null} onBeforeOpen={remember} filterEnd={measureSwitch} onRowsChange={setRegisterRows}/>}
   {tab==='indicators'&&measureView==='objectives'&&<>
    <FilterBar query={objectiveFilters.query} onQueryChange={query=>setObjectiveFilters(current=>({...current,query}))} placeholder={L('Αναζήτηση στόχου ή υπευθύνου','Search objective or owner')} activeAdvancedCount={objectiveFilters.state!=='all'?1:0} onClear={()=>setObjectiveFilters({query:'',state:'all'})} end={measureSwitch}>
     <FilterSelect label={t('status')} value={objectiveFilters.state} onChange={state=>setObjectiveFilters(current=>({...current,state}))}><option value="all">{t('all')}</option><option value="missed">{L('Δεν επιτυγχάνεται','Not met')}</option><option value="met">{L('Επιτυγχάνεται','Met')}</option><option value="pending">{L('Σε εξέλιξη','In progress')}</option></FilterSelect>
    </FilterBar>
    <ObjectivesTable rows={visibleObjectives} loading={objectives.loading} onOpen={objective=>canManage&&setEditingObjective(objective)}/>
   </>}
   {tab==='indicators'&&measureView==='surveys'&&<SurveysList list={surveys} filters={surveyFilters} setFilters={setSurveyFilters} filterEnd={measureSwitch} onOpen={survey=>{writeSessionValue(RETURN_KEY,'indicators:surveys');goTo(`/quality/surveys/${survey.id}`)}}/>}
   {tab==='resources'&&resourceView==='equipment'&&<EquipmentList list={resources} filters={equipmentFilters} setFilters={setEquipmentFilters} filterEnd={resourceSwitch} onOpen={row=>{writeSessionValue(RETURN_KEY,'resources:equipment');goTo(`/quality/equipment/${row.id}`)}}/>}
   {tab==='resources'&&resourceView==='suppliers'&&<SuppliersList list={resources} filters={supplierFilters} setFilters={setSupplierFilters} filterEnd={resourceSwitch} onOpen={row=>{writeSessionValue(RETURN_KEY,'resources:suppliers');goTo(`/quality/suppliers/${row.id}`)}}/>}
   {tab==='review'&&meetingView==='meetings'&&<MeetingsList list={meetings} filters={meetingFilters} setFilters={setMeetingFilters} filterEnd={meetingSwitch} onOpen={meeting=>{writeSessionValue(RETURN_KEY,'review:meetings');goTo(`/meetings/${meeting.id}`)}}/>}
   {tab==='review'&&meetingView==='reviews'&&<>
    <FilterBar query={reviewQuery} onQueryChange={setReviewQuery} placeholder={L('Αναζήτηση ανασκόπησης','Search review')} onClear={()=>{setReviewQuery('');setReviewQuick(null)}} end={meetingSwitch}/>
    <ReviewsTable rows={visibleReviews} loading={reviews.loading} onOpen={review=>{writeSessionValue(RETURN_KEY,'review:reviews');navigate(`/quality/reviews/${review.id}`)}}/>
   </>}
  </section>}
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
