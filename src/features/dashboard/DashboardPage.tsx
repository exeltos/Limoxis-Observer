import './dashboardScreens.css'
import { SECTION_TABS,sectionTabsFor } from '../../core/navigation/sectionTabs'
import { Suspense,useEffect,useMemo,useState,type ReactNode } from 'react'
import { type LucideIcon, Activity, ArrowRight, Award, Beaker, BedDouble, Bell, Building2, CalendarDays, CheckCheck, ClipboardCheck, Clock, FileText, FlaskConical, ListChecks, Megaphone, Pill, ShieldAlert, Stethoscope, Syringe, TestTube, TriangleAlert, UserPlus, Users } from 'lucide-react'
import { Card, CardHeader } from '../../design-system/Card'
import { Page } from '../../design-system/Page'
import { navigationFor } from '../../app/navigation'
import { useTenant } from '../../core/tenant/TenantContext'
import { useNotifications } from '../../core/notifications/NotificationContext'
import { CAPABILITIES, ROLES, can, isProfileDisabled } from '../../core/permissions/roles'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { loadDashboardMetrics, peekDashboardMetrics, readStoredDashboardMetrics, type DashboardMetrics } from './dashboardCloudService'
import { FirstStepsCard, firstSteps } from './FirstStepsCard'
import { collectDemoDashboardMetrics, collectDemoDepartmentHome, collectDemoDepartmentMatrix } from './demoDashboardMetrics'
import { loadDepartmentHomeOverview, peekDepartmentHomeOverview } from './departmentHomeService'
import { windowSubtitleParts, type DepartmentHomeOverview } from './departmentHomeModel'
import { DepartmentPeriodControls, useDepartmentHomeWindow } from './DepartmentHomePeriod'
import { loadHospitalMatrix } from './hospitalMatrixService'
import type { ClusterLike, HospitalMatrix } from './hospitalMatrixModel'
import { loadActiveClustersAsync } from '../surveillance/outbreakClusterService'
import { DEPARTMENT_ROLES, pendingActionsOf } from './dashboardTasks'
import './dashboard.css'
import { roleTitleText } from '../../core/i18n/roleTitles'
import { adminHomeTiles, departmentsNeedingAttention, otherDecisionItems, overdueControlDepartments, weekSummary } from './adminHomeModel'
import { loadActiveIsolationCount } from './adminHomeService'
import { countPendingTrainingRequestsAsync } from '../training/trainingRequestService'
import { useObjectives } from '../quality/review/QualityObjectives'
import { calendarKindsFor, useCalendarSources } from '../calendar/useCalendarSources'
import { buildCalendarEvents, calendarKindLabel, dayKey } from '../calendar/calendarEvents'
import { addDay, eventWithinScope } from '../calendar/calendarView'
import { useCalendarScope } from '../calendar/useCalendarScope'
import { hospitalToday } from '../../core/dates/hospitalDate'
import { departmentOverdueCount, departmentWeek, ownCertificatesDue, ownTrainings, todayTaskCount } from './userHomeModel'
import { loadDepartmentIsolationCount } from './userHomeService'
import { useSamplesAwaitingReview } from '../laboratory/hooks/useSamplesAwaitingReview'
import { canReviewSamples } from '../laboratory/sampleReviewModel'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { lazyPage } from '../../core/errors/chunkRecovery'
import { RouteLoading } from '../../design-system/RouteLoading'
import type { NotificationItem } from '../../core/notifications/notificationTypes'

// The Division Director's home (its departments, rosters and interviews): its own chunk.
const DivisionHome=lazyPage(()=>import('../division/DivisionHome'),'DivisionHome')
// The Department Manager's «Το τμήμα μου» (figures, charts, register or incidents): its own chunk.
const DepartmentHome=lazyPage(()=>import('./DepartmentHome'),'DepartmentHome')
// The Department User's and the Link Nurse's home (four figures, their day, trainings, the department's week): its own chunk.
const UserHome=lazyPage(()=>import('./UserHome'),'UserHome')
// The hospital administrator's home (five figures, the departments, what else needs a decision, the week): its own chunk.
const AdminHome=lazyPage(()=>import('./AdminHome'),'AdminHome')
type AdminDecision=import('./AdminHome').AdminDecision


type Metrics=Record<string, number | undefined>
// [label, value, capability, metric key]
type KpiRow=[string, number | string, string | undefined, string]
type Tone='danger' | 'warning' | 'info'
interface TodoItem { key: string, title: string, count: number | null, to: string | null, tone: Tone, task?: NotificationItem, state?: unknown }
// What the home reads of an objective (still an open record in the Quality module): its year, status and where it stands now.
type ObjectiveState = { year?: number | string, status?: string, current?: { status?: string } }

const n=(v: unknown)=>Number.isFinite(Number(v))?Number(v):'—'
function roleKpis(role: string | null,m: Metrics,english: boolean,unread: number): KpiRow[]{
  return roleKpiRows(role,m,english,unread).filter(([, , capability])=>!capability||!isProfileDisabled(capability))
}
// [label, value, capability the tile belongs to, metric key] — a tile of a module the operating profile switches off is hidden.
function roleKpiRows(role: string | null,m: Metrics,english: boolean,unread: number): KpiRow[]{
  const tr=(el: string,en: string)=>english?en:el
  switch(role){
    case ROLES.HOSPITAL_ADMIN:{
      const pending=m.pendingActions??pendingActionsOf(m)
      return [[tr('Ενεργοί χρήστες','Active users'),n(m.activeUsers),undefined,'activeUsers'],[tr('Ενεργά τμήματα','Active departments'),n(m.activeDepartments),undefined,'activeDepartments'],[tr('Εκκρεμείς ενέργειες','Pending actions'),pending,undefined,'pendingActions'],[tr('Μη αναγνωσμένες ειδοποιήσεις','Unread notifications'),n(unread),undefined,'unread']]
    }
    case ROLES.INFECTION_CONTROL_LEAD:
      return [[tr('Νέα MDR/XDR/PDR','New MDR/XDR/PDR'),n(m.recentMdro),undefined,'recentMdro'],[tr('Επανεκτιμήσεις απομόνωσης','Isolation reviews'),n(m.isolationReviewsDue),CAPABILITIES.VIEW_SURVEILLANCE,'isolationReviewsDue'],[tr('Εκπρόθεσμοι έλεγχοι','Overdue controls'),n(m.overdueControls),CAPABILITIES.VIEW_CONTROLS,'overdueControls'],[tr('Κρίσιμα εργαστηρίου','Critical lab alerts'),n(m.criticalUncommunicated),undefined,'criticalUncommunicated']]
    case ROLES.INFECTION_CONTROL_MEMBER:
      return [[tr('Ενεργές επιτηρήσεις','Active surveillance'),n(m.activeSurveillance),CAPABILITIES.VIEW_SURVEILLANCE,'activeSurveillance'],[tr('Θετικά εργαστηρίου','Positive laboratory results'),n(m.positiveLab),undefined,'positiveLab'],[tr('Επανεκτιμήσεις απομόνωσης','Isolation reviews'),n(m.isolationReviewsDue),CAPABILITIES.VIEW_SURVEILLANCE,'isolationReviewsDue'],[tr('Εκπρόθεσμοι έλεγχοι','Overdue controls'),n(m.overdueControls),CAPABILITIES.VIEW_CONTROLS,'overdueControls']]
    case ROLES.DEPARTMENT_MANAGER:
      return [[tr('Νοσηλευόμενοι','Inpatients'),n(m.inpatients),undefined,'inpatients'],[tr('Ενεργές επιτηρήσεις','Active surveillance'),n(m.activeSurveillance),CAPABILITIES.VIEW_SURVEILLANCE,'activeSurveillance'],[tr('Εκκρεμή δείγματα','Pending samples'),n(m.pendingSamples),undefined,'pendingSamples'],[tr('Εκπρόθεσμοι έλεγχοι','Overdue controls'),n(m.overdueControls),CAPABILITIES.VIEW_CONTROLS,'overdueControls']]
    case ROLES.LINK_NURSE:
      return [[tr('Έλεγχοι για σήμερα','Controls due today'),n(m.controlsDueToday),CAPABILITIES.VIEW_CONTROLS,'controlsDueToday'],[tr('Εκπρόθεσμοι έλεγχοι','Overdue controls'),n(m.overdueControls),CAPABILITIES.VIEW_CONTROLS,'overdueControls'],[tr('Ενεργές επιτηρήσεις','Active surveillance'),n(m.activeSurveillance),CAPABILITIES.VIEW_SURVEILLANCE,'activeSurveillance'],[tr('Επανεκτιμήσεις απομόνωσης','Isolation reviews'),n(m.isolationReviewsDue),CAPABILITIES.VIEW_SURVEILLANCE,'isolationReviewsDue']]
    case ROLES.LABORATORY:
      return [[tr('Νέα δείγματα σήμερα','New samples today'),n(m.newSamplesToday),undefined,'newSamplesToday'],[tr('Εκκρεμή δείγματα','Pending samples'),n(m.pendingSamples),undefined,'pendingSamples'],[tr('Θετικά αποτελέσματα','Positive results'),n(m.positiveLab),undefined,'positiveLab'],[tr('Κρίσιμα μη επικοινωνημένα','Critical uncommunicated'),n(m.criticalUncommunicated),undefined,'criticalUncommunicated']]
    case ROLES.COMMITTEE_SECRETARIAT:
      return [[tr('Επόμενες συνεδριάσεις','Upcoming meetings'),n(m.upcomingMeetings),CAPABILITIES.VIEW_COMMITTEES,'upcomingMeetings'],[tr('Πρακτικά εκκρεμή','Minutes pending'),n(m.pendingMinutes),CAPABILITIES.VIEW_COMMITTEES,'pendingMinutes'],[tr('Αποφάσεις ανοικτές','Open decisions'),n(m.openDecisions),CAPABILITIES.VIEW_COMMITTEES,'openDecisions']]
    case ROLES.HR_OFFICE:
      return [[tr('Ενεργοί εργαζόμενοι','Active employees'),n(m.activeEmployees),undefined,'activeEmployees'],[tr('Νέες εγγραφές','New records'),n(m.newEmployees30d),undefined,'newEmployees30d'],[tr('Εργαζόμενοι χωρίς τμήμα','Employees without a department'),n(m.employeesWithoutDepartment),undefined,'employeesWithoutDepartment']]
    case ROLES.OCCUPATIONAL_PHYSICIAN:
      return [[tr('Επισκέψεις σήμερα','Visits today'),n(m.ohVisitsToday),CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH,'ohVisitsToday'],[tr('Επανέλεγχοι σε εκκρεμότητα','Follow-ups due'),n(m.ohFollowupsDue),CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH,'ohFollowupsDue'],[tr('Εμβολιασμοί προς ανανέωση','Vaccinations due'),n(m.vaccinationsDue),CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH,'vaccinationsDue']]
    case ROLES.PHARMACY:
      return [[tr('Εγκρίσεις σε αναμονή','Pending approvals'),n(m.pendingApprovals),undefined,'pendingApprovals'],[tr('Αντιμικροβιακές αγωγές','Antimicrobial therapies'),n(m.antimicrobialTherapies),CAPABILITIES.MANAGE_ANTIMICROBIAL_THERAPY,'antimicrobialTherapies'],[tr('Καταγεγραμμένες χορηγήσεις','Administrations recorded'),n(m.administrations),CAPABILITIES.MANAGE_ANTIMICROBIAL_THERAPY,'administrations']]
    case ROLES.DOCTOR_REVIEWER:
      return [[tr('Εγκρίσεις σε αναμονή','Pending approvals'),n(m.pendingApprovals),undefined,'pendingApprovals'],[tr('Αντιμικροβιακές αγωγές','Antimicrobial therapies'),n(m.antimicrobialTherapies),CAPABILITIES.MANAGE_ANTIMICROBIAL_THERAPY,'antimicrobialTherapies']]
    case ROLES.QUALITY_MANAGER:
      return [[tr('Ανοιχτά συμβάντα','Open incidents'),n(m.openIncidents),CAPABILITIES.VIEW_QUALITY,'openIncidents'],[tr('Σοβαρά ανοικτά','Severe open'),n(m.severeOpenIncidents),CAPABILITIES.VIEW_QUALITY,'severeOpenIncidents'],[tr('Εκπρόθεσμες διορθωτικές ενέργειες','Overdue CAPA'),n(m.overdueCapa),CAPABILITIES.VIEW_QUALITY,'overdueCapa']]
    default:return []
  }
}


// Icon and destination of each dashboard tile, by metric key. A tile opens its
// screen only when that screen is in the user's menu.
const TILES: Record<string, [LucideIcon, string?]>={
  activeUsers:[Users,'/management'],activeDepartments:[Building2,'/management'],pendingActions:[ListChecks],unread:[Bell],
  activeSurveillance:[Activity,'/surveillance'],recentMdro:[ShieldAlert,'/surveillance'],isolationReviewsDue:[Clock,'/surveillance'],
  overdueControls:[ClipboardCheck,'/controls'],positiveLab:[FlaskConical,'/laboratory'],pendingSamples:[Beaker,'/laboratory'],
  newSamplesToday:[TestTube,'/laboratory'],criticalUncommunicated:[TriangleAlert,'/laboratory'],inpatients:[BedDouble,'/surveillance?tab=registry'],
  antimicrobialTherapies:[Pill,'/pharmacy'],administrations:[Pill,'/pharmacy'],pendingApprovals:[CheckCheck,'/pharmacy'],
  activeEmployees:[Users,'/employees'],newEmployees30d:[UserPlus,'/employees'],employeesWithoutDepartment:[Building2,'/employees'],ohVisitsToday:[Stethoscope,'/occupational-health'],
  ohFollowupsDue:[Clock,'/occupational-health'],vaccinationsDue:[Syringe,'/occupational-health'],upcomingMeetings:[CalendarDays,'/meetings'],
  pendingMinutes:[FileText,'/meetings'],openDecisions:[ListChecks,'/meetings'],openIncidents:[Award,'/quality'],
  severeOpenIncidents:[TriangleAlert,'/quality'],overdueCapa:[Clock,'/quality'],controlsDueToday:[CalendarDays,'/controls?due=today'],
}
// A role that reaches the same records from another screen: the Doctor Reviewer approves therapies in the patient's surveillance.
const ROLE_TILE_SCREENS: Record<string, Record<string, string>>={[ROLES.DOCTOR_REVIEWER]:{pendingApprovals:'/surveillance',antimicrobialTherapies:'/surveillance'}}

// How a tile's count reads against its target: work that should be at zero
// (danger: off target while above it; warning: needs attention), and the period it counts.
const TILE_TARGETS: Record<string, Tone>={overdueControls:'danger',criticalUncommunicated:'danger',overdueCapa:'danger',severeOpenIncidents:'danger',isolationReviewsDue:'warning',employeesWithoutDepartment:'warning',pendingApprovals:'warning',pendingMinutes:'warning',ohFollowupsDue:'warning',vaccinationsDue:'warning',pendingActions:'warning'}



// The list shows its first eight items; the week its first six events.
const TODO_FOLDED=8,WEEK_SHOWN=6
// The hospital's home (AdminHome, owner 24/11/2026): the administrator, the infection control roles and the Quality Manager.
const HOSPITAL_HOME_ROLES: ReadonlySet<string>=new Set([ROLES.HOSPITAL_ADMIN,ROLES.INFECTION_CONTROL_LEAD,ROLES.INFECTION_CONTROL_MEMBER,ROLES.QUALITY_MANAGER])

// title/subtitle/showKpis let the department home reuse this layout: its
// counts are organization-wide, so the department view hides them.
// departmentHome: the Department Manager's «Το τμήμα μου» (figures and charts of the department above the cards).
// userHome: the Department User's and the Link Nurse's home (four figures, then their day, the department's week and the announcements).
export function DashboardPage({title,subtitle,showKpis=true,department=null,departmentHome=false,userHome=false}: { title?: string, subtitle?: string, showKpis?: boolean, department?: string | null, departmentHome?: boolean, userHome?: boolean }={}) {
  const { role: actualRole, actualRole: signedInRole, tenant, isDemo, moduleEnabled, membership } = useTenant()
  // Inside a hospital the Platform Owner (and the demo account) see the full
  // hospital overview, not the platform workspace.
  const role=actualRole===ROLES.DEMO||(actualRole===ROLES.PLATFORM_OWNER&&tenant)?ROLES.HOSPITAL_ADMIN:actualRole
  // A Division Director has a home of their own (DivisionHome): the departments of the divisions they direct.
  const divisionHome=role===ROLES.DIVISION_DIRECTOR&&showKpis&&!department
  const {language}=useLanguage()
  const english=language==='en'
  const tr=(el: string,en: string)=>english?en:el
  const nctx=useNotifications()
  const navigate=useNavigate()
  const menuPaths=useMemo(()=>new Set(navigationFor({role,addOns:membership?.capabilities??[],customCapabilities:membership?.customCapabilities??[],hasAssignments:Boolean(membership?.assignments?.length)}).map(item=>item.to)),[role,membership])
  const [metrics,setMetrics]=useState<DashboardMetrics>({})
  // 'loading' until the first read ends; 'stale' while the last counts of this user show and the fresh ones load;
  // 'error' when it failed, so a failed read never shows as «—» (the last counts stay, if there are any).
  const [metricsState,setMetricsState]=useState('loading')
  useEffect(()=>{
    let active=true,fresh=false,shownStored=false
    if(isDemo||!tenant?.id||divisionHome){setMetrics({});setMetricsState('ready');return()=>{active=false}}
    const scope={departmentIds:DEPARTMENT_ROLES.has(String(role))?membership?.departmentIds:null}
    // Back on the home page within a couple of minutes: the counts just read show at once, with no new read.
    const kept=peekDashboardMetrics(tenant.id,scope)
    if(kept){setMetrics(kept);setMetricsState('ready');return()=>{active=false}}
    setMetricsState('loading')
    readStoredDashboardMetrics(tenant.id,scope).then(stored=>{if(active&&!fresh&&stored){shownStored=true;setMetrics(stored);setMetricsState('stale')}}).catch(()=>{})
    loadDashboardMetrics(tenant.id,scope).then(data=>{fresh=true;if(!active)return;if(shownStored&&!Object.keys(data).length){setMetricsState('error');return}setMetrics(data);setMetricsState('ready')}).catch(()=>{fresh=true;if(active){if(!shownStored)setMetrics({});setMetricsState('error')}})
    return()=>{active=false}
  },[tenant?.id,isDemo,role,membership?.departmentIds,divisionHome])
  const demo=useMemo(()=>isDemo?collectDemoDashboardMetrics({department}):null,[isDemo,department])
  // «Το τμήμα μου»: one read of the department's figures for the chosen period and its comparison (department_home_period_overview);
  // the Demo counts its sample records. A failed read shows the error line and empty figures, never the Demo's.
  const departmentPeriod=useDepartmentHomeWindow()
  const periodWindow=departmentPeriod.window
  // The hospital's home (owner, 24/11/2026): the administrator, the infection control roles and the Quality Manager read
  // the same figures for the whole hospital (no departments: all of them, or the role's own departments).
  const adminHome=HOSPITAL_HOME_ROLES.has(String(role))&&showKpis&&!department
  // Laboratory and surveillance figures only for whoever reads clinical data (not the Quality Manager).
  const clinicalHome=role!==ROLES.QUALITY_MANAGER
  const periodHome=departmentHome||adminHome
  const periodDepartments=adminHome?null:membership?.departmentIds
  const [departmentOverview,setDepartmentOverview]=useState<{data: DepartmentHomeOverview | null, status: 'loading' | 'ready' | 'error'}>(()=>{const kept=periodHome&&!isDemo?peekDepartmentHomeOverview(tenant?.id,periodDepartments,periodWindow):null;return kept?{data:kept,status:'ready'}:{data:null,status:'loading'}})
  const demoOverview=useMemo(()=>periodHome&&isDemo?collectDemoDepartmentHome({department:adminHome?null:department,window:periodWindow}):null,[periodHome,adminHome,isDemo,department,periodWindow])
  useEffect(()=>{
    let active=true
    if(!periodHome||isDemo)return()=>{active=false}
    // A period read a moment ago shows at once; a new period clears the figures until its own answer arrives: never the
    // previous period under the new labels.
    const kept=peekDepartmentHomeOverview(tenant?.id,periodDepartments,periodWindow)
    if(kept){setDepartmentOverview({data:kept,status:'ready'});return()=>{active=false}}
    setDepartmentOverview({data:null,status:'loading'})
    loadDepartmentHomeOverview(tenant?.id,periodDepartments,periodWindow).then(data=>{if(active)setDepartmentOverview({data,status:'ready'})}).catch(()=>{if(active)setDepartmentOverview({data:null,status:'error'})})
    return()=>{active=false}
  },[periodHome,isDemo,tenant?.id,periodDepartments,periodWindow])
  // «Χάρτης τμημάτων»: the period's figures by department (the Demo counts its own records).
  const [hospitalMatrix,setHospitalMatrix]=useState<{data: HospitalMatrix | null, status: 'loading' | 'ready' | 'error'}>({data:null,status:'loading'})
  const demoMatrix=useMemo(()=>adminHome&&isDemo?collectDemoDepartmentMatrix({window:periodWindow}):null,[adminHome,isDemo,periodWindow])
  useEffect(()=>{
    let active=true
    if(!adminHome||isDemo)return()=>{active=false}
    setHospitalMatrix({data:null,status:'loading'})
    loadHospitalMatrix(tenant?.id,periodWindow).then(data=>{if(active)setHospitalMatrix({data,status:'ready'})}).catch(()=>{if(active)setHospitalMatrix({data:null,status:'error'})})
    return()=>{active=false}
  },[adminHome,isDemo,tenant?.id,periodWindow])
  // «Επισημάνσεις»: the active possible clusters (14 days, 3 patients), for the clinical roles.
  const clustersOn=adminHome&&clinicalHome&&moduleEnabled('surveillance')
  const [clusters,setClusters]=useState<ClusterLike[] | null>(null)
  useEffect(()=>{
    let active=true
    // A hospital switched on the same page: never the previous hospital's clusters while the new ones load.
    setClusters(null)
    if(!clustersOn){setClusters([]);return()=>{active=false}}
    loadActiveClustersAsync(tenant?.id).then(rows=>{if(active)setClusters(rows.map(row=>({department:row.department,organism:row.organism,count:row.count,windowDays:row.windowDays})))}).catch(()=>{if(active)setClusters([])})
    return()=>{active=false}
  },[clustersOn,tenant?.id])
  const overview=demoOverview||departmentOverview.data
  const overviewStatus=demoOverview?'ready':departmentOverview.status
  const values: Metrics=demo?demo.metrics:metrics
  const roleRows=useMemo(()=>roleKpis(role,values,english,nctx.unreadCount),[role,values,english,nctx.unreadCount])
  // «Προς έλεγχο (N)»: new positive samples with no episode and no decision, for the infection-control roles.
  const reviewCard=showKpis&&!department&&canReviewSamples(role)&&menuPaths.has('/surveillance')
  // The administrator's home counts them in its period figures (positives «προς έλεγχο»): no list read there.
  const awaitingReview=useSamplesAwaitingReview({enabled:reviewCard&&!adminHome&&Boolean(isDemo||tenant?.id)})
  const tasks=nctx.operational
  // A tile opens a screen of the menu; a tab of a merged section (?tab=) only when the role may open that tab.
  const canOpen=(to: string | null | undefined)=>{const [path,search='']=String(to||'').split('?');if(!menuPaths.has(path))return false;const tab=new URLSearchParams(search).get('tab');const section=Object.keys(SECTION_TABS).find(id=>SECTION_TABS[id].path===path);return !tab||!section||sectionTabsFor(section,{role,addOns:membership?.capabilities??[],customCapabilities:membership?.customCapabilities??[]}).some(item=>item.id===tab)}
  // Tiles without a screen of their own lead to the card listing what they count.
  const announcements=nctx.visibleAnnouncements.slice(0,4)
  // A Demo comes set up: its evaluation guide lives in the Demo line instead.
  // The hospital's own administrator sets the hospital up: not the Platform Owner looking in.
  const setupSteps=role===ROLES.HOSPITAL_ADMIN&&signedInRole!==ROLES.PLATFORM_OWNER&&showKpis&&!tenant?.is_demo?firstSteps(values,{needsPatientDays:moduleEnabled('surveillance')||moduleEnabled('indicators')}):null

  // The objectives off course, for whoever has «Indicators & objectives» in the menu.
  const objectivesOn=showKpis&&!department&&menuPaths.has('/quality/measures')
  const objectiveList=useObjectives(tenant?.id,{enabled:objectivesOn})
  const missedObjectives=objectivesOn?objectiveList.objectives.filter((item: ObjectiveState)=>Number(item.year)===new Date().getFullYear()&&(item.status||'active')==='active'&&item.current!.status==='missed').length:0
  // «Επόμενες 7 ημέρες»: the calendar's events of the coming week the user may see.
  const mayDo=(capability: string)=>can(role,capability,membership?.capabilities??[],membership?.customCapabilities??[])
  const calendarKinds=calendarKindsFor(mayDo)
  const calendarKey=calendarKinds.join(',')
  const allowedKinds=useMemo(()=>calendarKey?calendarKey.split(','):[],[calendarKey])
  const calendarOn=menuPaths.has('/calendar')&&allowedKinds.length>0
  const calendarSources=useCalendarSources(tenant?.id,allowedKinds,language,{enabled:calendarOn||((userHome||adminHome)&&allowedKinds.length>0)})
  // What the user may see of the calendar (eventWithinScope): a department role its departments' items, by name.
  const calendarScope=useCalendarScope()
  const week=useMemo(()=>{if(!calendarOn)return []; if(!calendarSources)return null;const today=dayKey(new Date()),to=dayKey(new Date(Date.now()+7*24*60*60*1000));return buildCalendarEvents(calendarSources,{from:today,to,today,language}).filter(event=>allowedKinds.includes(event.kind)&&event.state!=='overdue'&&event.date>=today&&event.date<=to&&eventWithinScope(event,calendarScope))},[calendarOn,calendarSources,allowedKinds,language,calendarScope])
  // The user's home: the department's events of the coming week and its overdue ones (scoped), their own trainings and certificates.
  const homeToday=hospitalToday()
  const homeEvents=useMemo(()=>{if(!userHome||!calendarSources)return null;return buildCalendarEvents(calendarSources,{from:homeToday,to:addDay(homeToday,6),today:homeToday,language}).filter(event=>allowedKinds.includes(event.kind)&&eventWithinScope(event,calendarScope))},[userHome,calendarSources,homeToday,language,allowedKinds,calendarScope])
  const isolationOn=userHome&&moduleEnabled('surveillance')
  const [isolationCount,setIsolationCount]=useState<number | null | undefined>(undefined)
  useEffect(()=>{
    let active=true
    if(!isolationOn||isDemo)return()=>{active=false}
    setIsolationCount(undefined)
    loadDepartmentIsolationCount(tenant?.id).then(count=>{if(active)setIsolationCount(count)}).catch(()=>{if(active)setIsolationCount(null)})
    return()=>{active=false}
  },[isolationOn,isDemo,tenant?.id])
  // The administrator's home: the calendar's coming week and its overdue items (controls, corrective actions, staff
  // certificates, each with its department), the training requests waiting and the hospital's patients in isolation.
  const adminEvents=useMemo(()=>{if(!adminHome||!calendarSources)return null;return buildCalendarEvents(calendarSources,{from:homeToday,to:addDay(homeToday,6),today:homeToday,language}).filter(event=>allowedKinds.includes(event.kind))},[adminHome,calendarSources,homeToday,language,allowedKinds])
  // The counts by department read the events in Greek (one name per department in every language) and the hospital's time.
  const adminCountEvents=useMemo(()=>{if(!adminHome||!calendarSources)return null;if(language==='el')return adminEvents;return buildCalendarEvents(calendarSources,{from:homeToday,to:addDay(homeToday,6),today:homeToday,language:'el'}).filter(event=>allowedKinds.includes(event.kind))},[adminHome,calendarSources,homeToday,language,allowedKinds,adminEvents])
  const adminNow={date:homeToday,time:new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Athens',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date())}
  const trainingRequestsOn=adminHome&&moduleEnabled('training')&&mayDo(CAPABILITIES.MANAGE_TRAINING)&&menuPaths.has('/training')
  const [trainingRequests,setTrainingRequests]=useState<number | null | undefined>(undefined)
  useEffect(()=>{
    let active=true
    if(!trainingRequestsOn){setTrainingRequests(null);return()=>{active=false}}
    countPendingTrainingRequestsAsync(tenant?.id).then(count=>{if(active)setTrainingRequests(count)}).catch(()=>{if(active)setTrainingRequests(null)})
    return()=>{active=false}
  },[trainingRequestsOn,tenant?.id])
  const adminIsolationOn=adminHome&&moduleEnabled('surveillance')
  const [adminIsolation,setAdminIsolation]=useState<number | null>(null)
  useEffect(()=>{
    let active=true
    if(!adminIsolationOn||isDemo){setAdminIsolation(null);return()=>{active=false}}
    loadActiveIsolationCount(tenant?.id).then(count=>{if(active)setAdminIsolation(count)}).catch(()=>{if(active)setAdminIsolation(null)})
    return()=>{active=false}
  },[adminIsolationOn,isDemo,tenant?.id])
  // «Για μένα σήμερα»: everything that waits for this user in one list, the most urgent first: the administrator's decisions
  // (or the role's own work), new positive samples to review, objectives off course and what the notifications assign.
  const todo=(()=>{
   const items: TodoItem[]=[]
   const add=(item: TodoItem)=>{if(item&&item.count!==0&&!items.some(other=>other.key===item.key||other.title===item.title))items.push(item)}
   if(reviewCard&&!awaitingReview.loading&&awaitingReview.rows.length)add({key:'review',title:tr('Θετικά δείγματα προς έλεγχο','Positive samples to review'),count:awaitingReview.rows.length,to:'/surveillance?tab=episodes&review=1',tone:'danger'})
   // The role's tasks (dashboardTasks: «LIVE-<role>-<metric>») first, with their fuller titles; a tile counting the same metric adds nothing.
   const metricOf=(task: NotificationItem)=>String(task.id||'').startsWith('LIVE-')?String(task.id).split('-').slice(2).join('-'):task.id
   if(!adminHome)for(const task of tasks){const key=metricOf(task);add({key,title:task.title,count:task.count??null,to:task.to||null,tone:TILE_TARGETS[key]||'info',task})}
   if(!adminHome&&showKpis)for(const [label,value,,key] of roleRows){const tone=TILE_TARGETS[key];const to=ROLE_TILE_SCREENS[String(role)]?.[key]??TILES[key]?.[1];if(tone&&Number(value)>0)add({key,title:label,count:Number(value),to:to&&canOpen(to)?to:null,tone})}
   // The department's own waiting work on «Το τμήμα μου»: roster requests to answer and training that falls due within 30 days.
   if(departmentHome&&overview){
    if(overview.pendingRosterRequests>0)add({key:'rosterRequests',title:tr('Αιτήματα βαρδιών σε αναμονή','Roster requests waiting'),count:overview.pendingRosterRequests,to:canOpen('/rosters')?'/rosters':null,tone:'warning'})
    if(Number(overview.trainingExpiring30)>0)add({key:'trainingExpiring',title:tr('Εκπαιδεύσεις που λήγουν σε 30 ημέρες','Training due within 30 days'),count:Number(overview.trainingExpiring30),to:canOpen('/training')?'/training':null,tone:'info'})
   }
   if(missedObjectives>0)add({key:'objectives',title:tr('Στόχοι που δεν επιτυγχάνονται','Objectives not met'),count:missedObjectives,to:'/quality/measures',tone:'warning'})
   const rank: Record<Tone, number>={danger:0,warning:1,info:2}
   return items.sort((a,b)=>rank[a.tone]-rank[b.tone])
  })()
  const [allTodo,setAllTodo]=useState(false)
  const shownTodo=allTodo?todo:todo.slice(0,TODO_FOLDED)
  const openTodo=(item: TodoItem)=>{if(!item.to)return;if(item.task)nctx.markRead(item.task.id);navigate(item.to,item.state?{state:item.state}:undefined)}
  const dayLabel=(date: string)=>{const today=dayKey(new Date()),tomorrow=dayKey(new Date(Date.now()+24*60*60*1000));if(date===today)return tr('Σήμερα','Today');if(date===tomorrow)return tr('Αύριο','Tomorrow');return new Intl.DateTimeFormat(english?'en-GB':'el-GR',{weekday:'short',day:'numeric',month:'numeric'}).format(new Date(`${date}T12:00:00`))}

  // «Επόμενες 7 ημέρες»: the calendar's coming week, on the home of every role.
  const weekCard=calendarOn&&<Card className="dashboard-card dashboard-week">
    <CardHeader icon={CalendarDays} title={tr('Επόμενες 7 ημέρες','Next 7 days')} subtitle={tr('Συνεδριάσεις, επιθεωρήσεις και προθεσμίες.','Meetings, audits and deadlines.')} actions={<button type="button" className="text-button" onClick={()=>navigate('/calendar')}>{tr('Ημερολόγιο','Calendar')}<ArrowRight size={14}/></button>}/>
    {week===null?<TableSkeleton/>:week.length?<div className="dashboard-week-list">{week.slice(0,WEEK_SHOWN).map(event=><button type="button" key={event.id} disabled={!event.path} onClick={()=>event.path&&navigate(event.path)}><span className="dashboard-week-day">{dayLabel(event.date)}</span><span className="dashboard-week-copy"><strong>{event.title}</strong><small>{calendarKindLabel(event.kind,language)}{event.department?` · ${event.department}`:''}</small></span></button>)}</div>:<div className="inline-empty">{tr('Τίποτα προγραμματισμένο για τις επόμενες 7 ημέρες.','Nothing planned for the next 7 days.')}</div>}
  </Card>
  // «Για μένα σήμερα» and the announcements: the same cards on every home; «Το τμήμα μου» adds the department's 30 days under the announcements.
  const todoCard=<Card className="dashboard-card dashboard-todo" id="dashboard-tasks" tabIndex={-1}>
        <CardHeader icon={ListChecks} title={tr('Για μένα σήμερα','For me today')} subtitle={todo.length?tr('Τα πιο επείγοντα πρώτα.','The most urgent first.'):tr('Τίποτα δεν περιμένει από εσάς.','Nothing is waiting for you.')}/>
        {metricsState==='stale'&&<div className="inline-empty" role="status">{tr('Ενημερώνεται…','Updating…')}</div>}
        {metricsState==='error'&&<div className="inline-empty">{tr('Κάποιες εκκρεμότητες δεν φορτώθηκαν.','Some pending items did not load.')}</div>}
        {todo.length?<div className="task-list">{shownTodo.map(item=><button className="task-row" key={item.key} disabled={!item.to} onClick={()=>openTodo(item)}><span className={`priority ${item.tone==='danger'?'high':item.tone==='warning'?'medium':'low'}`}/><span className="task-copy"><strong>{item.title}</strong></span>{item.count!=null&&<b className={`task-count${item.tone==='danger'?' urgent':''}`}>{item.count}</b>}{item.to&&<ArrowRight size={17}/>}</button>)}</div>:metricsState!=='loading'&&<div className="inline-empty">{tr('Όλα είναι σε τάξη.','All is in order.')}</div>}
        {todo.length>TODO_FOLDED&&<button type="button" className="text-button dashboard-more" onClick={()=>setAllTodo(value=>!value)}>{allTodo?tr('Λιγότερα','Fewer'):tr(`Όλα (${todo.length})`,`All (${todo.length})`)}</button>}
      </Card>
  const shownAnnouncements=departmentHome?announcements.slice(0,3):announcements
  const announcementsCard=(footer: ReactNode)=><Card className="dashboard-card" id="dashboard-announcements" tabIndex={-1}>
          <CardHeader icon={Megaphone} title={departmentHome?tr('Ανακοινώσεις','Announcements'):tr('Ενημερώσεις & ανακοινώσεις','Updates & announcements')} subtitle={nctx.unreadCount?`${nctx.unreadCount} ${tr('μη αναγνωσμένες ειδοποιήσεις','unread notifications')}`:tr('Όλα διαβασμένα','All caught up')} actions={nctx.unreadCount>0&&<button type="button" className="text-button" onClick={nctx.markAllRead}><Bell size={14}/>{tr('Σήμανση όλων','Mark all read')}</button>}/>
          {shownAnnouncements.length?<div className="dashboard-announcements">{shownAnnouncements.map(a=><button key={a.id} onClick={()=>nctx.markRead(a.id)}><span className={`announcement-icon ${a.priority}`}><Megaphone size={15}/></span><span><strong>{a.title}</strong><small>{a.message}</small><em>{roleTitleText(a.createdBy,language) as string}</em></span>{!nctx.notificationItems.find(x=>x.id===a.id)?.read&&<i/>}</button>)}</div>:<div className="inline-empty">{tr('Οι νέες ενημερώσεις του οργανισμού θα εμφανίζονται εδώ.','New organization updates will appear here.')}</div>}
          {footer}
        </Card>
  const subtitleParts=windowSubtitleParts(periodWindow,language)
  if(divisionHome)return <Suspense fallback={<RouteLoading/>}><DivisionHome weekCard={weekCard||null}/></Suspense>
  if(userHome){
    const trainingOn=moduleEnabled('training')&&allowedKinds.includes('training')
    const training=calendarSources?.training||null
    // The department's overdue controls and cultures: the same count as «Για μένα σήμερα» (dashboard metrics); the calendar's when there is none.
    const overdueMetric=values.overdueControls
    const figures={overdue:metricsState==='loading'?undefined:overdueMetric!=null?Number(overdueMetric):homeEvents?departmentOverdueCount(homeEvents):undefined,today:metricsState==='loading'?undefined:todayTaskCount(todo),certificates:calendarSources?ownCertificatesDue(training,calendarScope,homeToday):null,isolation:isDemo?(demo?.metrics.activeIsolation??null):isolationCount}
    return <Page fill className="dashboard-page" title={title||tr('Το τμήμα μου','My department')} subtitle={subtitle}>
      <Suspense fallback={<RouteLoading/>}><UserHome language={language} figures={figures} trainingOn={trainingOn} isolationOn={isolationOn} trainings={calendarSources?ownTrainings(training,calendarScope,homeToday):null} week={homeEvents?departmentWeek(homeEvents,calendarScope,homeToday):null} canOpen={canOpen} onOpen={navigate} todoCard={todoCard} announcementsCard={announcementsCard(null)}/></Suspense>
    </Page>
  }
  if(departmentHome)return <Page fill className="dashboard-page" title={title||tr('Το τμήμα μου','My department')} subtitle={<><span className="dephome-subtitle-period">{subtitleParts.period} </span>{subtitleParts.compare}</>} actions={<DepartmentPeriodControls window={periodWindow} language={language} onKind={departmentPeriod.setKind} onChoice={departmentPeriod.setChoice} onStep={departmentPeriod.step}/>}>
    <Suspense fallback={<RouteLoading/>}><DepartmentHome overview={overview} window={periodWindow} status={overviewStatus} language={language} moduleEnabled={moduleEnabled} canOpen={canOpen} onOpen={navigate} todoCard={todoCard} announcementsCard={announcementsCard}/></Suspense>
  </Page>

  if(adminHome){
    const tileSources={loading:metricsState==='loading',awaitingReview:null,isolation:isDemo?(demo?.metrics.activeIsolation??null):adminIsolation,overdueControlDepartments:adminCountEvents?overdueControlDepartments(adminCountEvents,adminNow):null,openCapa:calendarSources&&allowedKinds.includes('capa')?(calendarSources.capas||[]).filter(capa=>capa.lifecycleStatus!=='voided'&&!['closed','completed','cancelled'].includes(String(capa.status))).length:null}
    const certificatesOn=moduleEnabled('training')&&allowedKinds.includes('training')
    // «Χρειάζονται και αυτά απόφαση»: what the figures do not show, with the objectives off course and the training requests the home counts.
    const decisionMetrics={...values,missedObjectives,trainingRequests:trainingRequests??undefined}
    const openDecision=(item: AdminDecision)=>item.key==='trainingRequests'?navigate(item.to,{state:{trainingView:'requests'}}):navigate(item.to)
    const latest=nctx.visibleAnnouncements[0]
    // The five figures: the hospital's period figures and, without a period, the overdue corrective actions.
    const capaTiles=adminHomeTiles(values,tileSources,{moduleEnabled,canOpen,language}).filter(tile=>tile.key==='overdueCapa')
    return <Page fill className="dashboard-page" title={title||tr('Αρχική','Home')} subtitle={<><span className="dephome-subtitle-period">{subtitleParts.period} </span>{subtitleParts.compare}</>} actions={<DepartmentPeriodControls window={periodWindow} language={language} onKind={departmentPeriod.setKind} onChoice={departmentPeriod.setChoice} onStep={departmentPeriod.step}/>}>
      <FirstStepsCard steps={setupSteps} language={language} onOpen={navigate} storageKey={tenant?.id?`limoxis.firstSteps.closed.${tenant.id}`:null}/>
      <Suspense fallback={<RouteLoading/>}><AdminHome language={language} overview={overview} window={periodWindow} status={overviewStatus} moduleEnabled={moduleEnabled} tiles={capaTiles}
        matrix={demoMatrix||hospitalMatrix.data} matrixStatus={demoMatrix?'ready':hospitalMatrix.status} clusters={clusters} clinical={clinicalHome}
        departments={adminCountEvents?departmentsNeedingAttention(adminCountEvents,calendarSources?.training,Number.POSITIVE_INFINITY,adminNow):null} departmentColumns={{controls:moduleEnabled('controls')&&allowedKinds.includes('controls'),capa:moduleEnabled('quality')&&allowedKinds.includes('capa'),certificates:certificatesOn}}
        decisions={metricsState==='loading'?null:otherDecisionItems(decisionMetrics,{moduleEnabled,canOpen,language})} decisionsNote={metricsState==='error'?tr('Κάποιες εκκρεμότητες δεν φορτώθηκαν.','Some pending items did not load.'):null} onDecision={openDecision}
        week={adminEvents?weekSummary(adminEvents,homeToday,language):null} calendarOn={calendarOn}
        announcements={{unread:nctx.unreadCount,latest:latest?.title||null,items:nctx.visibleAnnouncements.slice(0,6).map(item=>({id:String(item.id),title:String(item.title||''),message:String(item.message||'')})),onMarkAll:nctx.markAllRead,onOpen:()=>window.dispatchEvent(new CustomEvent('limoxis:open-notifications'))}} canOpen={canOpen} onOpen={navigate}/></Suspense>
    </Page>
  }
  return <Page fill className="dashboard-page" title={title||tr('Αρχική','Home')} subtitle={subtitle||tr('Τι χρειάζεται σήμερα','What needs doing today')}>
    <FirstStepsCard steps={setupSteps} language={language} onOpen={navigate} storageKey={tenant?.id?`limoxis.firstSteps.closed.${tenant.id}`:null}/>
    <div className="dashboard-home">
      {todoCard}
      <div className="dashboard-side">
        {announcementsCard(null)}
        {weekCard}
      </div>
    </div>
  </Page>
}
