import { SECTION_TABS,sectionTabsFor } from '../../core/navigation/sectionTabs'
import { useEffect,useMemo,useState } from 'react'
import { Activity, ArrowRight, Award, Gauge, Gavel, LayoutGrid, Beaker, BedDouble, Bell, Building2, CalendarDays, CheckCheck, ClipboardCheck, Clock, FileText, FlaskConical, ListChecks, Megaphone, PieChart, Pill, ShieldAlert, Stethoscope, Syringe, TestTube, TriangleAlert, UserPlus, Users } from 'lucide-react'
import { Card, CardHeader } from '../../design-system/Card'
import { Page } from '../../design-system/Page'
import { MetricCard } from '../../design-system/MetricCard'
import { navigationFor } from '../../app/navigation'
import { useTenant } from '../../core/tenant/TenantContext'
import { useNotifications } from '../../core/notifications/NotificationContext'
import { CAPABILITIES, ROLES, isProfileDisabled } from '../../core/permissions/roles'
import { workspaceFor } from '../workspaces/workspaceConfig'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { loadDashboardMetrics } from './dashboardCloudService'
import { FirstStepsCard, firstSteps } from './FirstStepsCard'
import { collectDemoDashboardMetrics } from './demoDashboardMetrics'
import { DEPARTMENT_ROLES, pendingActionsOf } from './dashboardTasks'
import { DonutChart, TrendChart } from '../analysis/AnalysisCharts'
import { loadAnalysisSnapshot } from '../platform/platformService'
import './dashboard.css'
import { roleTitleText } from '../../core/i18n/roleTitles'
import { decisionItems, moduleStatusRows } from './adminHomeModel'
import { ClipboardCheck as ReviewIcon } from 'lucide-react'
import { useSamplesAwaitingReview } from '../laboratory/hooks/useSamplesAwaitingReview'
import { canReviewSamples } from '../laboratory/sampleReviewModel'

function hospitalAdminWorkspace(english){
  return english?{
    title:'Hospital Overview', subtitle:'Administrative overview of the organization, users, departments and operational pending work.',
    kpis:[['Active users','—'],['Active departments','—'],['Pending actions','—'],['Critical notifications','—']],
    actionTitle:'Administrative pending work', tasks:['Users requiring activation or access review','Pending organization settings','Audit events requiring administrative review'],
  }:{
    title:'Επισκόπηση Νοσοκομείου', subtitle:'Διοικητική εικόνα του οργανισμού, των χρηστών, των τμημάτων και των λειτουργικών εκκρεμοτήτων.',
    kpis:[['Ενεργοί χρήστες','—'],['Ενεργά τμήματα','—'],['Εκκρεμείς ενέργειες','—'],['Κρίσιμες ειδοποιήσεις','—']],
    actionTitle:'Διοικητικές εκκρεμότητες', tasks:['Χρήστες που χρειάζονται ενεργοποίηση ή έλεγχο πρόσβασης','Εκκρεμείς ρυθμίσεις οργανισμού','Συμβάντα καταγραφής που χρειάζονται διοικητικό έλεγχο'],
  }
}

const n=v=>Number.isFinite(Number(v))?Number(v):'—'
function roleKpis(role,m,english,unread){
  return roleKpiRows(role,m,english,unread).filter(([, , capability])=>!capability||!isProfileDisabled(capability))
}
// [label, value, capability the tile belongs to, metric key] — a tile of a module the operating profile switches off is hidden.
function roleKpiRows(role,m,english,unread){
  const tr=(el,en)=>english?en:el
  switch(role){
    case ROLES.HOSPITAL_ADMIN:{
      const pending=m.pendingActions??pendingActionsOf(m)
      return [[tr('Ενεργοί χρήστες','Active users'),n(m.activeUsers),undefined,'activeUsers'],[tr('Ενεργά τμήματα','Active departments'),n(m.activeDepartments),undefined,'activeDepartments'],[tr('Εκκρεμείς ενέργειες','Pending actions'),pending,undefined,'pendingActions'],[tr('Μη αναγνωσμένες ειδοποιήσεις','Unread notifications'),n(unread),undefined,'unread']]
    }
    case ROLES.INFECTION_CONTROL_LEAD:
      return [[tr('Νέα MDR/XDR/PDR · 30ημ.','New MDR/XDR/PDR · 30d'),n(m.recentMdro),undefined,'recentMdro'],[tr('Επανεκτιμήσεις απομόνωσης','Isolation reviews'),n(m.isolationReviewsDue),CAPABILITIES.VIEW_SURVEILLANCE,'isolationReviewsDue'],[tr('Εκπρόθεσμοι έλεγχοι','Overdue controls'),n(m.overdueControls),CAPABILITIES.VIEW_CONTROLS,'overdueControls'],[tr('Κρίσιμα εργαστηρίου','Critical lab alerts'),n(m.criticalUncommunicated),undefined,'criticalUncommunicated']]
    case ROLES.INFECTION_CONTROL_MEMBER:
      return [[tr('Ενεργές επιτηρήσεις','Active surveillance'),n(m.activeSurveillance),CAPABILITIES.VIEW_SURVEILLANCE,'activeSurveillance'],[tr('Θετικά εργαστηρίου','Positive laboratory results'),n(m.positiveLab),undefined,'positiveLab'],[tr('Επανεκτιμήσεις απομόνωσης','Isolation reviews'),n(m.isolationReviewsDue),CAPABILITIES.VIEW_SURVEILLANCE,'isolationReviewsDue'],[tr('Εκπρόθεσμοι έλεγχοι','Overdue controls'),n(m.overdueControls),CAPABILITIES.VIEW_CONTROLS,'overdueControls']]
    case ROLES.DEPARTMENT_MANAGER:
      return [[tr('Νοσηλευόμενοι','Inpatients'),n(m.inpatients),undefined,'inpatients'],[tr('Ενεργές επιτηρήσεις','Active surveillance'),n(m.activeSurveillance),CAPABILITIES.VIEW_SURVEILLANCE,'activeSurveillance'],[tr('Εκκρεμή δείγματα','Pending samples'),n(m.pendingSamples),undefined,'pendingSamples'],[tr('Εκπρόθεσμοι έλεγχοι','Overdue controls'),n(m.overdueControls),CAPABILITIES.VIEW_CONTROLS,'overdueControls']]
    case ROLES.LABORATORY:
      return [[tr('Νέα δείγματα σήμερα','New samples today'),n(m.newSamplesToday),undefined,'newSamplesToday'],[tr('Εκκρεμή δείγματα','Pending samples'),n(m.pendingSamples),undefined,'pendingSamples'],[tr('Θετικά αποτελέσματα','Positive results'),n(m.positiveLab),undefined,'positiveLab'],[tr('Κρίσιμα μη επικοινωνημένα','Critical uncommunicated'),n(m.criticalUncommunicated),undefined,'criticalUncommunicated']]
    case ROLES.COMMITTEE_SECRETARIAT:
      return [[tr('Επόμενες συνεδριάσεις','Upcoming meetings'),n(m.upcomingMeetings),CAPABILITIES.VIEW_COMMITTEES,'upcomingMeetings'],[tr('Πρακτικά εκκρεμή','Minutes pending'),n(m.pendingMinutes),CAPABILITIES.VIEW_COMMITTEES,'pendingMinutes'],[tr('Αποφάσεις ανοικτές','Open decisions'),n(m.openDecisions),CAPABILITIES.VIEW_COMMITTEES,'openDecisions']]
    case ROLES.HR_OFFICE:
      return [[tr('Ενεργοί εργαζόμενοι','Active employees'),n(m.activeEmployees),undefined,'activeEmployees'],[tr('Νέες εγγραφές · 30ημ.','New records · 30d'),n(m.newEmployees30d),undefined,'newEmployees30d']]
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
const TILES={
  activeUsers:[Users,'/management'],activeDepartments:[Building2,'/management'],pendingActions:[ListChecks],unread:[Bell],
  activeSurveillance:[Activity,'/surveillance'],recentMdro:[ShieldAlert,'/surveillance'],isolationReviewsDue:[Clock,'/surveillance'],
  overdueControls:[ClipboardCheck,'/controls'],positiveLab:[FlaskConical,'/laboratory'],pendingSamples:[Beaker,'/laboratory'],
  newSamplesToday:[TestTube,'/laboratory'],criticalUncommunicated:[TriangleAlert,'/laboratory'],inpatients:[BedDouble,'/surveillance?tab=registry'],
  antimicrobialTherapies:[Pill,'/pharmacy'],administrations:[Pill,'/pharmacy'],pendingApprovals:[CheckCheck,'/pharmacy'],
  activeEmployees:[Users,'/employees'],newEmployees30d:[UserPlus,'/employees'],ohVisitsToday:[Stethoscope,'/occupational-health'],
  ohFollowupsDue:[Clock,'/occupational-health'],vaccinationsDue:[Syringe,'/occupational-health'],upcomingMeetings:[CalendarDays,'/meetings'],
  pendingMinutes:[FileText,'/meetings'],openDecisions:[ListChecks,'/meetings'],openIncidents:[Award,'/quality'],
  severeOpenIncidents:[TriangleAlert,'/quality'],overdueCapa:[Clock,'/quality'],
}

// The clinical charts belong to the clinical homes; the administrator's home shows
// what needs a decision and a status line per module instead.
const CHART_ROLES=new Set([ROLES.INFECTION_CONTROL_LEAD,ROLES.INFECTION_CONTROL_MEMBER,ROLES.LABORATORY,ROLES.QUALITY_MANAGER])

function domainShare(snapshot,tr){const s=snapshot?.summary||{};return [[tr('Επιτήρηση','Surveillance'),s.surveillance],[tr('Εργαστήριο','Laboratory'),s.laboratory],[tr('Πρόληψη','Prevention'),s.prevention],[tr('Έλεγχοι','Controls'),s.controls],[tr('Ποιότητα','Quality'),s.quality],[tr('Εκπαίδευση','Training'),s.training]].filter(([,value])=>Number(value)>0)}

// title/subtitle/showKpis let the department home reuse this layout: its
// counts are organization-wide, so the department view hides them.
export function DashboardPage({title,subtitle,showKpis=true,department=null}={}) {
  const { role: actualRole, tenant, isDemo, moduleEnabled, membership } = useTenant()
  // Inside a hospital the Platform Owner (and the demo account) see the full
  // hospital overview, not the platform workspace.
  const role=actualRole===ROLES.DEMO||(actualRole===ROLES.PLATFORM_OWNER&&tenant)?ROLES.HOSPITAL_ADMIN:actualRole
  const {language}=useLanguage()
  const english=language==='en'
  const tr=(el,en)=>english?en:el
  const workspace=role===ROLES.HOSPITAL_ADMIN?hospitalAdminWorkspace(english):workspaceFor(role,language)
  const nctx=useNotifications()
  const navigate=useNavigate()
  const menuPaths=useMemo(()=>new Set(navigationFor({role,addOns:membership?.capabilities??[],customCapabilities:membership?.customCapabilities??[],hasAssignments:Boolean(membership?.assignments?.length)}).map(item=>item.to)),[role,membership])
  const [metrics,setMetrics]=useState({})
  const [liveSnapshot,setLiveSnapshot]=useState(null)
  const showCharts=showKpis&&CHART_ROLES.has(role)
  useEffect(()=>{
    let active=true
    if(isDemo||!tenant?.id){setMetrics({});return()=>{active=false}}
    loadDashboardMetrics(tenant.id,{departmentIds:DEPARTMENT_ROLES.has(role)?membership?.departmentIds:null}).then(data=>{if(active)setMetrics(data)}).catch(()=>{if(active)setMetrics({})})
    return()=>{active=false}
  },[tenant?.id,isDemo,role,membership?.departmentIds])
  useEffect(()=>{
    let active=true
    if(isDemo||!tenant?.id||!showCharts){setLiveSnapshot(null);return()=>{active=false}}
    const to=new Date(),from=new Date(to.getFullYear(),to.getMonth()-11,1)
    loadAnalysisSnapshot({organizationId:tenant.id,from:from.toISOString().slice(0,10),to:to.toISOString().slice(0,10)}).then(data=>{if(active)setLiveSnapshot(data)}).catch(()=>{if(active)setLiveSnapshot(null)})
    return()=>{active=false}
  },[tenant?.id,isDemo,showCharts])
  const demo=useMemo(()=>isDemo?collectDemoDashboardMetrics({department}):null,[isDemo,department])
  const snapshot=demo?demo.snapshot:liveSnapshot
  const values=demo?demo.metrics:metrics
  const roleRows=useMemo(()=>roleKpis(role,values,english,nctx.unreadCount),[role,values,english,nctx.unreadCount])
  const kpis=roleRows.length?roleRows:workspace.kpis.map(([label])=>[label,'—'])
  // «Προς έλεγχο (N)»: new positive samples with no episode and no decision, for the infection-control roles.
  const reviewCard=showKpis&&!department&&canReviewSamples(role)&&menuPaths.has('/surveillance')
  const awaitingReview=useSamplesAwaitingReview({enabled:reviewCard&&Boolean(isDemo||tenant?.id)})
  const tasks=nctx.operational
  const adminHome=role===ROLES.HOSPITAL_ADMIN&&showKpis
  // A tile opens a screen of the menu; a tab of a merged section (?tab=) only when the role may open that tab.
  const canOpen=to=>{const [path,search='']=String(to||'').split('?');if(!menuPaths.has(path))return false;const tab=new URLSearchParams(search).get('tab');const section=Object.keys(SECTION_TABS).find(id=>SECTION_TABS[id].path===path);return !tab||!section||sectionTabsFor(section,{role,addOns:membership?.capabilities??[],customCapabilities:membership?.customCapabilities??[]}).some(item=>item.id===tab)}
  const decisions=adminHome?decisionItems(values,{moduleEnabled,canOpen,language}):[]
  const moduleRows=adminHome?moduleStatusRows(values,{moduleEnabled,canOpen,language}):[]
  // Tiles without a screen of their own lead to the card listing what they count.
  const showCard=id=>()=>{const card=document.getElementById(id);card?.scrollIntoView({behavior:'smooth',block:'start'});card?.focus({preventScroll:true})}
  const cardOf={pendingActions:'dashboard-tasks',unread:'dashboard-announcements'}
  const announcements=nctx.visibleAnnouncements.slice(0,4)
  const monthly=snapshot?.microbiology?.monthly||[]
  const donut=role===ROLES.LABORATORY?{title:tr('Κατηγορίες αντοχής','Resistance classes'),subtitle:tr('MDR / XDR / PDR στα θετικά αποτελέσματα.','MDR / XDR / PDR among positive results.'),rows:snapshot?.microbiology?.resistance||[],center:tr('στελέχη','isolates')}:{title:tr('Δραστηριότητα ανά ενότητα','Activity by module'),subtitle:tr('Καταγραφές του οργανισμού ανά ενότητα.','Organization records by module.'),rows:domainShare(snapshot,tr),center:tr('σύνολο','total')}
  const hasCharts=showCharts&&snapshot&&(monthly.length>1||donut.rows.length>1)
  // A Demo comes set up: its evaluation guide lives in the Demo line instead.
  const setupSteps=role===ROLES.HOSPITAL_ADMIN&&showKpis&&!tenant?.is_demo?firstSteps(values,{needsPatientDays:moduleEnabled('surveillance')||moduleEnabled('indicators')}):null

  return <Page className="dashboard-page" title={title||workspace.title} subtitle={subtitle||workspace.subtitle}>
    {showKpis&&kpis.length > 0 && <div className="kpi-grid role-kpis">{kpis.map(([label,value,,key])=>{const [Icon=Activity,to]=TILES[key]||[];const open=to&&canOpen(to);return <MetricCard key={label} className="summary-metric" icon={Icon} label={label} value={value} onClick={open?()=>navigate(to):cardOf[key]?showCard(cardOf[key]):undefined}/>})}</div>}
    <FirstStepsCard steps={setupSteps} language={language} onOpen={navigate}/>
    {reviewCard&&<Card className="dashboard-card dashboard-executive-link dashboard-review-link"><CardHeader icon={ReviewIcon} title={`${tr('Προς έλεγχο','To review')} (${awaitingReview.loading?'…':awaitingReview.rows.length})`} subtitle={awaitingReview.rows.length?tr('Νέα θετικά δείγματα χωρίς επεισόδιο: ανοίξτε επεισόδιο ή σημειώστε ότι δεν χρειάζεται επιτήρηση.','New positive samples with no episode: open an episode or mark that no surveillance is needed.'):tr('Κανένα νέο θετικό δείγμα δεν περιμένει απόφαση.','No new positive sample is waiting for a decision.')} actions={<button type="button" className="text-button" onClick={()=>navigate('/surveillance?tab=episodes&review=1')}>{tr('Προβολή λίστας','View list')}<ArrowRight size={14}/></button>}/></Card>}
    {showKpis&&(role===ROLES.HOSPITAL_ADMIN||role===ROLES.HOSPITAL_DIRECTOR)&&menuPaths.has('/executive')&&<Card className="dashboard-card dashboard-executive-link"><CardHeader icon={Gauge} title={tr('Δείκτες','Indicators')} subtitle={tr('Όλοι οι κρίσιμοι δείκτες του νοσοκομείου σε μία οθόνη, με σύγκριση περιόδων και αναφορά PDF.','Every key measure of the hospital on one screen, with period comparison and a PDF report.')} actions={<button type="button" className="text-button" onClick={()=>navigate('/executive')}>{tr('Άνοιγμα','Open')}<ArrowRight size={14}/></button>}/></Card>}
    <div className="dashboard-workspace-v2">
      {adminHome?<Card className="dashboard-card dashboard-decisions" id="dashboard-tasks" tabIndex={-1}>
        <CardHeader icon={Gavel} title={tr('Χρειάζεται απόφαση','Needs a decision')} subtitle={tr('Εγκρίσεις σε αναμονή, ληγμένα και εκπρόθεσμα — τα σοβαρότερα πρώτα.','Pending approvals, expired and overdue items — the most serious first.')}/>
        {decisions.length?<div className="task-list">{decisions.map(item=><button className="task-row" key={item.key} onClick={()=>navigate(item.to)}><span className={`priority ${item.urgent?'high':'medium'}`}/><span className="task-copy"><strong>{item.title}</strong></span><b className={`task-count${item.urgent?' urgent':''}`}>{item.count}</b><ArrowRight size={17}/></button>)}</div>:<div className="inline-empty">{tr('Τίποτα δεν περιμένει απόφασή σας αυτή τη στιγμή.','Nothing is waiting for your decision right now.')}</div>}
      </Card>:<Card className="dashboard-card" id="dashboard-tasks" tabIndex={-1}>
        <CardHeader icon={ListChecks} title={workspace.actionTitle??tr('Εργασίες προτεραιότητας','Priority work')} subtitle={tr('Ό,τι χρειάζεται ενέργεια από εσάς.','What needs your action.')}/>
        {tasks.length?<div className="task-list">{tasks.map((task,index)=><button className="task-row" key={task.id} disabled={!task.to} onClick={()=>{if(!task.to)return;nctx.markRead(task.id);navigate(task.to)}}><span className={`priority ${index===0?'high':'medium'}`}/><span className="task-copy"><strong>{task.title}</strong>{task.count!=null&&<small>{task.count} {tr('σε εκκρεμότητα','pending')}</small>}</span>{task.count!=null&&<b className="task-count">{task.count}</b>}{task.to&&<ArrowRight size={17}/>}</button>)}</div>:<div className="inline-empty">{tr('Δεν υπάρχει κάτι σε εκκρεμότητα αυτή τη στιγμή.','Nothing is pending right now.')}</div>}
      </Card>}
      <Card className="dashboard-card" id="dashboard-announcements" tabIndex={-1}>
        <CardHeader icon={Megaphone} title={tr('Ενημερώσεις & ανακοινώσεις','Updates & announcements')} subtitle={nctx.unreadCount?`${nctx.unreadCount} ${tr('μη αναγνωσμένες ειδοποιήσεις','unread notifications')}`:tr('Όλα διαβασμένα','All caught up')} actions={nctx.unreadCount>0&&<button type="button" className="text-button" onClick={nctx.markAllRead}><Bell size={14}/>{tr('Σήμανση όλων','Mark all read')}</button>}/>
        {announcements.length?<div className="dashboard-announcements">{announcements.map(a=><button key={a.id} onClick={()=>nctx.markRead(a.id)}><span className={`announcement-icon ${a.priority}`}><Megaphone size={15}/></span><span><strong>{a.title}</strong><small>{a.message}</small><em>{roleTitleText(a.createdBy,language)}</em></span>{!nctx.notificationItems.find(x=>x.id===a.id)?.read&&<i/>}</button>)}</div>:<div className="inline-empty">{tr('Οι νέες ενημερώσεις του οργανισμού θα εμφανίζονται εδώ.','New organization updates will appear here.')}</div>}
      </Card>
    </div>
    {moduleRows.length>0&&<Card className="dashboard-card dashboard-modules"><CardHeader icon={LayoutGrid} title={tr('Κατάσταση ενοτήτων','Module status')} subtitle={tr('Μία γραμμή ανά ενότητα του νοσοκομείου· πατήστε για να την ανοίξετε.','One line per module of the hospital; click to open it.')}/>
      <div className="dashboard-module-rows">{moduleRows.map(row=><button type="button" key={row.module} className={`dashboard-module-row tone-${row.status}`} onClick={()=>navigate(row.to)}><span className="dashboard-module-dot" aria-hidden="true"/><strong>{row.title}</strong><span className="dashboard-module-figures">{row.values.map(item=><span key={item.key} className={item.tone?`tone-${item.tone}`:''}><b>{item.value==null?'—':item.value}</b> {item.label}</span>)}</span><ArrowRight size={15}/></button>)}</div>
    </Card>}
    {hasCharts&&<div className="dashboard-charts">
      <Card className="dashboard-card dashboard-chart-wide"><CardHeader icon={Activity} title={tr('Θετικές καλλιέργειες ανά μήνα','Positive cultures by month')} subtitle={tr('Τελευταίοι 12 μήνες · περάστε το ποντίκι για τιμές.','Last 12 months · hover for values.')}/><TrendChart points={monthly} en={english} label={tr('Θετικές καλλιέργειες ανά μήνα','Positive cultures by month')}/></Card>
      <Card className="dashboard-card"><CardHeader icon={PieChart} title={donut.title} subtitle={donut.subtitle}/><DonutChart rows={donut.rows} en={english} centerLabel={donut.center}/></Card>
    </div>}
  </Page>
}
