import './dashboardScreens.css'
import { SECTION_TABS,sectionTabsFor } from '../../core/navigation/sectionTabs'
import { Suspense,useEffect,useMemo,useState } from 'react'
import { type LucideIcon, Activity, ArrowRight, Award, Beaker, BedDouble, Bell, Building2, CalendarDays, CheckCheck, ClipboardCheck, Clock, FileText, FlaskConical, ListChecks, Megaphone, Pill, ShieldAlert, Stethoscope, Syringe, TestTube, TriangleAlert, UserPlus, Users } from 'lucide-react'
import { Card, CardHeader } from '../../design-system/Card'
import { Page } from '../../design-system/Page'
import { navigationFor } from '../../app/navigation'
import { useTenant } from '../../core/tenant/TenantContext'
import { useNotifications } from '../../core/notifications/NotificationContext'
import { CAPABILITIES, ROLES, can, isProfileDisabled } from '../../core/permissions/roles'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { loadDashboardMetrics, type DashboardMetrics } from './dashboardCloudService'
import { FirstStepsCard, firstSteps } from './FirstStepsCard'
import { collectDemoDashboardMetrics } from './demoDashboardMetrics'
import { DEPARTMENT_ROLES, pendingActionsOf } from './dashboardTasks'
import './dashboard.css'
import { roleTitleText } from '../../core/i18n/roleTitles'
import { decisionItems } from './adminHomeModel'
import { useObjectives } from '../quality/review/QualityObjectives'
import { calendarKindsFor, useCalendarSources } from '../calendar/useCalendarSources'
import { buildCalendarEvents, calendarKindLabel, dayKey } from '../calendar/calendarEvents'
import { useSamplesAwaitingReview } from '../laboratory/hooks/useSamplesAwaitingReview'
import { canReviewSamples } from '../laboratory/sampleReviewModel'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { lazyPage } from '../../core/errors/chunkRecovery'
import { RouteLoading } from '../../design-system/RouteLoading'
import type { NotificationItem } from '../../core/notifications/notificationTypes'

// The Division Director's home (its departments, rosters and interviews): its own chunk.
const DivisionHome=lazyPage(()=>import('../division/DivisionHome'),'DivisionHome')


type Metrics=Record<string, number | undefined>
// [label, value, capability, metric key]
type KpiRow=[string, number | string, string | undefined, string]
type Tone='danger' | 'warning' | 'info'
interface TodoItem { key: string, title: string, count: number | null, to: string | null, tone: Tone, task?: NotificationItem }
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

// title/subtitle/showKpis let the department home reuse this layout: its
// counts are organization-wide, so the department view hides them.
export function DashboardPage({title,subtitle,showKpis=true,department=null}: { title?: string, subtitle?: string, showKpis?: boolean, department?: string | null }={}) {
  const { role: actualRole, actualRole: signedInRole, tenant, isDemo, moduleEnabled, membership, canAccessRecord } = useTenant()
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
  // 'loading' until the first read ends; 'error' when it failed, so a failed read never shows as «—».
  const [metricsState,setMetricsState]=useState('loading')
  useEffect(()=>{
    let active=true
    if(isDemo||!tenant?.id||divisionHome){setMetrics({});setMetricsState('ready');return()=>{active=false}}
    setMetricsState('loading')
    loadDashboardMetrics(tenant.id,{departmentIds:DEPARTMENT_ROLES.has(String(role))?membership?.departmentIds:null}).then(data=>{if(active){setMetrics(data);setMetricsState('ready')}}).catch(()=>{if(active){setMetrics({});setMetricsState('error')}})
    return()=>{active=false}
  },[tenant?.id,isDemo,role,membership?.departmentIds,divisionHome])
  const demo=useMemo(()=>isDemo?collectDemoDashboardMetrics({department}):null,[isDemo,department])
  const values: Metrics=demo?demo.metrics:metrics
  const roleRows=useMemo(()=>roleKpis(role,values,english,nctx.unreadCount),[role,values,english,nctx.unreadCount])
  // «Προς έλεγχο (N)»: new positive samples with no episode and no decision, for the infection-control roles.
  const reviewCard=showKpis&&!department&&canReviewSamples(role)&&menuPaths.has('/surveillance')
  const awaitingReview=useSamplesAwaitingReview({enabled:reviewCard&&Boolean(isDemo||tenant?.id)})
  const tasks=nctx.operational
  const adminHome=role===ROLES.HOSPITAL_ADMIN&&showKpis
  // A tile opens a screen of the menu; a tab of a merged section (?tab=) only when the role may open that tab.
  const canOpen=(to: string | null | undefined)=>{const [path,search='']=String(to||'').split('?');if(!menuPaths.has(path))return false;const tab=new URLSearchParams(search).get('tab');const section=Object.keys(SECTION_TABS).find(id=>SECTION_TABS[id].path===path);return !tab||!section||sectionTabsFor(section,{role,addOns:membership?.capabilities??[],customCapabilities:membership?.customCapabilities??[]}).some(item=>item.id===tab)}
  const decisions=adminHome?decisionItems(values,{moduleEnabled,canOpen,language}):[]
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
  const calendarSources=useCalendarSources(tenant?.id,allowedKinds,language,{enabled:calendarOn})
  const week=useMemo(()=>{if(!calendarOn)return []; if(!calendarSources)return null;const today=dayKey(new Date()),to=dayKey(new Date(Date.now()+7*24*60*60*1000));return buildCalendarEvents(calendarSources,{from:today,to,today,language}).filter(event=>allowedKinds.includes(event.kind)&&event.state!=='overdue'&&event.date>=today&&event.date<=to&&(!event.department||canAccessRecord({department:event.department})))},[calendarOn,calendarSources,allowedKinds,language,canAccessRecord])
  // «Για μένα σήμερα»: everything that waits for this user in one list, the most urgent first: the administrator's decisions
  // (or the role's own work), new positive samples to review, objectives off course and what the notifications assign.
  const todo=(()=>{
   const items: TodoItem[]=[]
   const add=(item: TodoItem)=>{if(item&&item.count!==0&&!items.some(other=>other.key===item.key||other.title===item.title))items.push(item)}
   if(reviewCard&&!awaitingReview.loading&&awaitingReview.rows.length)add({key:'review',title:tr('Θετικά δείγματα προς έλεγχο','Positive samples to review'),count:awaitingReview.rows.length,to:'/surveillance?tab=episodes&review=1',tone:'danger'})
   for(const item of decisions)add({key:item.key,title:item.title,count:item.count,to:item.to,tone:item.urgent?'danger':'warning'})
   // The role's tasks (dashboardTasks: «LIVE-<role>-<metric>») first, with their fuller titles; a tile counting the same metric adds nothing.
   const metricOf=(task: NotificationItem)=>String(task.id||'').startsWith('LIVE-')?String(task.id).split('-').slice(2).join('-'):task.id
   if(!adminHome)for(const task of tasks){const key=metricOf(task);add({key,title:task.title,count:task.count??null,to:task.to||null,tone:TILE_TARGETS[key]||'info',task})}
   if(!adminHome&&showKpis)for(const [label,value,,key] of roleRows){const tone=TILE_TARGETS[key];const to=ROLE_TILE_SCREENS[String(role)]?.[key]??TILES[key]?.[1];if(tone&&Number(value)>0)add({key,title:label,count:Number(value),to:to&&canOpen(to)?to:null,tone})}
   if(missedObjectives>0)add({key:'objectives',title:tr('Στόχοι που δεν επιτυγχάνονται','Objectives not met'),count:missedObjectives,to:'/quality/measures',tone:'warning'})
   const rank: Record<Tone, number>={danger:0,warning:1,info:2}
   return items.sort((a,b)=>rank[a.tone]-rank[b.tone])
  })()
  const [allTodo,setAllTodo]=useState(false)
  const shownTodo=allTodo?todo:todo.slice(0,TODO_FOLDED)
  const openTodo=(item: TodoItem)=>{if(!item.to)return;if(item.task)nctx.markRead(item.task.id);navigate(item.to)}
  const dayLabel=(date: string)=>{const today=dayKey(new Date()),tomorrow=dayKey(new Date(Date.now()+24*60*60*1000));if(date===today)return tr('Σήμερα','Today');if(date===tomorrow)return tr('Αύριο','Tomorrow');return new Intl.DateTimeFormat(english?'en-GB':'el-GR',{weekday:'short',day:'numeric',month:'numeric'}).format(new Date(`${date}T12:00:00`))}

  // «Επόμενες 7 ημέρες»: the calendar's coming week, on the home of every role.
  const weekCard=calendarOn&&<Card className="dashboard-card dashboard-week">
    <CardHeader icon={CalendarDays} title={tr('Επόμενες 7 ημέρες','Next 7 days')} subtitle={tr('Συνεδριάσεις, επιθεωρήσεις και προθεσμίες.','Meetings, audits and deadlines.')} actions={<button type="button" className="text-button" onClick={()=>navigate('/calendar')}>{tr('Ημερολόγιο','Calendar')}<ArrowRight size={14}/></button>}/>
    {week===null?<TableSkeleton/>:week.length?<div className="dashboard-week-list">{week.slice(0,WEEK_SHOWN).map(event=><button type="button" key={event.id} disabled={!event.path} onClick={()=>event.path&&navigate(event.path)}><span className="dashboard-week-day">{dayLabel(event.date)}</span><span className="dashboard-week-copy"><strong>{event.title}</strong><small>{calendarKindLabel(event.kind,language)}{event.department?` · ${event.department}`:''}</small></span></button>)}</div>:<div className="inline-empty">{tr('Τίποτα προγραμματισμένο για τις επόμενες 7 ημέρες.','Nothing planned for the next 7 days.')}</div>}
  </Card>
  if(divisionHome)return <Suspense fallback={<RouteLoading/>}><DivisionHome weekCard={weekCard||null}/></Suspense>

  return <Page fill className="dashboard-page" title={title||tr('Αρχική','Home')} subtitle={subtitle||tr('Τι χρειάζεται σήμερα','What needs doing today')}>
    <FirstStepsCard steps={setupSteps} language={language} onOpen={navigate} storageKey={tenant?.id?`limoxis.firstSteps.closed.${tenant.id}`:null}/>
    <div className="dashboard-home">
      <Card className="dashboard-card dashboard-todo" id="dashboard-tasks" tabIndex={-1}>
        <CardHeader icon={ListChecks} title={tr('Για μένα σήμερα','For me today')} subtitle={todo.length?tr('Τα πιο επείγοντα πρώτα.','The most urgent first.'):tr('Τίποτα δεν περιμένει από εσάς.','Nothing is waiting for you.')}/>
        {metricsState==='error'&&<div className="inline-empty">{tr('Κάποιες εκκρεμότητες δεν φορτώθηκαν.','Some pending items did not load.')}</div>}
        {todo.length?<div className="task-list">{shownTodo.map(item=><button className="task-row" key={item.key} disabled={!item.to} onClick={()=>openTodo(item)}><span className={`priority ${item.tone==='danger'?'high':item.tone==='warning'?'medium':'low'}`}/><span className="task-copy"><strong>{item.title}</strong></span>{item.count!=null&&<b className={`task-count${item.tone==='danger'?' urgent':''}`}>{item.count}</b>}{item.to&&<ArrowRight size={17}/>}</button>)}</div>:metricsState!=='loading'&&<div className="inline-empty">{tr('Όλα είναι σε τάξη.','All is in order.')}</div>}
        {todo.length>TODO_FOLDED&&<button type="button" className="text-button dashboard-more" onClick={()=>setAllTodo(value=>!value)}>{allTodo?tr('Λιγότερα','Fewer'):tr(`Όλα (${todo.length})`,`All (${todo.length})`)}</button>}
      </Card>
      <div className="dashboard-side">
        <Card className="dashboard-card" id="dashboard-announcements" tabIndex={-1}>
          <CardHeader icon={Megaphone} title={tr('Ενημερώσεις & ανακοινώσεις','Updates & announcements')} subtitle={nctx.unreadCount?`${nctx.unreadCount} ${tr('μη αναγνωσμένες ειδοποιήσεις','unread notifications')}`:tr('Όλα διαβασμένα','All caught up')} actions={nctx.unreadCount>0&&<button type="button" className="text-button" onClick={nctx.markAllRead}><Bell size={14}/>{tr('Σήμανση όλων','Mark all read')}</button>}/>
          {announcements.length?<div className="dashboard-announcements">{announcements.map(a=><button key={a.id} onClick={()=>nctx.markRead(a.id)}><span className={`announcement-icon ${a.priority}`}><Megaphone size={15}/></span><span><strong>{a.title}</strong><small>{a.message}</small><em>{roleTitleText(a.createdBy,language) as string}</em></span>{!nctx.notificationItems.find(x=>x.id===a.id)?.read&&<i/>}</button>)}</div>:<div className="inline-empty">{tr('Οι νέες ενημερώσεις του οργανισμού θα εμφανίζονται εδώ.','New organization updates will appear here.')}</div>}
        </Card>
        {weekCard}
      </div>
    </div>
  </Page>
}
