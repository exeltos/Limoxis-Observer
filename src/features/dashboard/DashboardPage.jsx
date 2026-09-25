import { useEffect,useMemo,useState } from 'react'
import { Activity, ArrowRight, Bell, ListChecks, Megaphone, PieChart } from 'lucide-react'
import { Card, CardHeader } from '../../design-system/Card'
import { Page } from '../../design-system/Page'
import { useTenant } from '../../core/tenant/TenantContext'
import { useNotifications } from '../../core/notifications/NotificationContext'
import { ROLES } from '../../core/permissions/roles'
import { workspaceFor } from '../workspaces/workspaceConfig'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { loadDashboardMetrics } from './dashboardCloudService'
import { collectAnalysisDemoSnapshot } from '../analysis/analysisDemoSnapshot'
import { DonutChart, TrendChart } from '../analysis/AnalysisCharts'
import { loadAnalysisSnapshot } from '../platform/platformService'
import './dashboard.css'

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
  const tr=(el,en)=>english?en:el
  switch(role){
    case ROLES.HOSPITAL_ADMIN:{
      const pending=m.pendingActions??['overdueControls','pendingSamples','openIncidents','overdueCapa'].reduce((sum,key)=>sum+(Number(m[key])||0),0)
      return [[tr('Ενεργοί χρήστες','Active users'),n(m.activeUsers)],[tr('Ενεργά τμήματα','Active departments'),n(m.activeDepartments)],[tr('Εκκρεμείς ενέργειες','Pending actions'),pending],[tr('Μη αναγνωσμένες ειδοποιήσεις','Unread notifications'),n(unread)]]
    }
    case ROLES.INFECTION_CONTROL_LEAD:
      return [[tr('Νέα MDR/XDR/PDR · 30ημ.','New MDR/XDR/PDR · 30d'),n(m.recentMdro)],[tr('Επανεκτιμήσεις απομόνωσης','Isolation reviews'),n(m.isolationReviewsDue)],[tr('Εκπρόθεσμοι έλεγχοι','Overdue controls'),n(m.overdueControls)],[tr('Κρίσιμα εργαστηρίου','Critical lab alerts'),n(m.criticalUncommunicated)]]
    case ROLES.INFECTION_CONTROL_MEMBER:
      return [[tr('Ενεργές επιτηρήσεις','Active surveillance'),n(m.activeSurveillance)],[tr('Θετικά εργαστηρίου','Positive laboratory results'),n(m.positiveLab)],[tr('Επανεκτιμήσεις απομόνωσης','Isolation reviews'),n(m.isolationReviewsDue)],[tr('Εκπρόθεσμοι έλεγχοι','Overdue controls'),n(m.overdueControls)]]
    case ROLES.DEPARTMENT_MANAGER:
      return [[tr('Νοσηλευόμενοι','Inpatients'),n(m.inpatients)],[tr('Ενεργές επιτηρήσεις','Active surveillance'),n(m.activeSurveillance)],[tr('Εκκρεμή δείγματα','Pending samples'),n(m.pendingSamples)],[tr('Εκπρόθεσμοι έλεγχοι','Overdue controls'),n(m.overdueControls)]]
    case ROLES.LABORATORY:
      return [[tr('Νέα δείγματα σήμερα','New samples today'),n(m.newSamplesToday)],[tr('Εκκρεμή δείγματα','Pending samples'),n(m.pendingSamples)],[tr('Θετικά αποτελέσματα','Positive results'),n(m.positiveLab)],[tr('Κρίσιμα μη επικοινωνημένα','Critical uncommunicated'),n(m.criticalUncommunicated)]]
    case ROLES.COMMITTEE_SECRETARIAT:
      return [[tr('Επόμενες συνεδριάσεις','Upcoming meetings'),n(m.upcomingMeetings)],[tr('Πρακτικά εκκρεμή','Minutes pending'),n(m.pendingMinutes)],[tr('Αποφάσεις ανοικτές','Open decisions'),n(m.openDecisions)]]
    case ROLES.HR_OFFICE:
      return [[tr('Ενεργοί εργαζόμενοι','Active employees'),n(m.activeEmployees)],[tr('Νέες εγγραφές · 30ημ.','New records · 30d'),n(m.newEmployees30d)]]
    case ROLES.OCCUPATIONAL_PHYSICIAN:
      return [[tr('Επισκέψεις σήμερα','Visits today'),n(m.ohVisitsToday)],[tr('Επανέλεγχοι σε εκκρεμότητα','Follow-ups due'),n(m.ohFollowupsDue)],[tr('Εμβολιασμοί προς ανανέωση','Vaccinations due'),n(m.vaccinationsDue)]]
    case ROLES.PHARMACY:
      return [[tr('Εγκρίσεις σε αναμονή','Pending approvals'),n(m.pendingApprovals)],[tr('Αντιμικροβιακές αγωγές','Antimicrobial therapies'),n(m.antimicrobialTherapies)],[tr('Καταγεγραμμένες χορηγήσεις','Administrations recorded'),n(m.administrations)]]
    case ROLES.DOCTOR_REVIEWER:
      return [[tr('Εγκρίσεις σε αναμονή','Pending approvals'),n(m.pendingApprovals)],[tr('Αντιμικροβιακές αγωγές','Antimicrobial therapies'),n(m.antimicrobialTherapies)]]
    case ROLES.QUALITY_MANAGER:
      return [[tr('Ανοιχτά συμβάντα','Open incidents'),n(m.openIncidents)],[tr('Σοβαρά ανοικτά','Severe open'),n(m.severeOpenIncidents)],[tr('CAPA εκπρόθεσμα','Overdue CAPA'),n(m.overdueCapa)]]
    default:return []
  }
}

const CHART_ROLES=new Set([ROLES.HOSPITAL_ADMIN,ROLES.DEMO,ROLES.INFECTION_CONTROL_LEAD,ROLES.INFECTION_CONTROL_MEMBER,ROLES.LABORATORY,ROLES.QUALITY_MANAGER])

// Demo mode reads the same fixtures as Analysis so the numbers agree across
// screens; values the fixtures do not model fall back to the demo task list.
function demoMetrics(snapshot,operational){
  const s=snapshot?.summary||{},m=snapshot?.microbiology||{}
  const taskCount=path=>Number(operational.find(task=>task.to===path)?.count)||0
  const mdro=(m.resistance||[]).filter(([key])=>['MDR','XDR','PDR'].includes(key)).reduce((sum,[,value])=>sum+(Number(value)||0),0)
  return {pendingActions:operational.reduce((sum,task)=>sum+(Number(task.count)||0),0),activeUsers:3,activeDepartments:m.departmentCount,activeSurveillance:s.activeSurveillance??s.surveillance,positiveLab:m.totalPositive,criticalUncommunicated:m.totalCritical,recentMdro:mdro,pendingSamples:s.pendingSamples,newSamplesToday:0,isolationReviewsDue:taskCount('/surveillance'),overdueControls:taskCount('/controls'),inpatients:s.inpatients,activeEmployees:s.employees,newEmployees30d:0,ohVisitsToday:s.occupationalHealth,ohFollowupsDue:taskCount('/occupational-health'),vaccinationsDue:0,openIncidents:s.quality,severeOpenIncidents:0,overdueCapa:taskCount('/quality'),upcomingMeetings:s.committees,pendingMinutes:0,openDecisions:0,pendingApprovals:s.antimicrobial?.pending,antimicrobialTherapies:s.antimicrobial?.total,administrations:s.antimicrobial?.administrations}
}

function domainShare(snapshot,tr){const s=snapshot?.summary||{};return [[tr('Επιτήρηση','Surveillance'),s.surveillance],[tr('Εργαστήριο','Laboratory'),s.laboratory],[tr('Πρόληψη','Prevention'),s.prevention],[tr('Έλεγχοι','Controls'),s.controls],[tr('Ποιότητα','Quality'),s.quality],[tr('Εκπαίδευση','Training'),s.training]].filter(([,value])=>Number(value)>0)}

// title/subtitle/showKpis let the department home reuse this layout: its
// counts are organization-wide, so the department view hides them.
export function DashboardPage({title,subtitle,showKpis=true}={}) {
  const { role: actualRole, tenant, isDemo } = useTenant()
  // Inside a hospital the Platform Owner (and the demo account) see the full
  // hospital overview, not the platform workspace.
  const role=actualRole===ROLES.DEMO||(actualRole===ROLES.PLATFORM_OWNER&&tenant)?ROLES.HOSPITAL_ADMIN:actualRole
  const {language}=useLanguage()
  const english=language==='en'
  const tr=(el,en)=>english?en:el
  const workspace=role===ROLES.HOSPITAL_ADMIN?hospitalAdminWorkspace(english):workspaceFor(role,language)
  const nctx=useNotifications()
  const navigate=useNavigate()
  const [metrics,setMetrics]=useState({})
  const [liveSnapshot,setLiveSnapshot]=useState(null)
  const showCharts=showKpis&&CHART_ROLES.has(role)
  useEffect(()=>{
    let active=true
    if(isDemo||!tenant?.id){setMetrics({});return()=>{active=false}}
    loadDashboardMetrics(tenant.id).then(data=>{if(active)setMetrics(data)}).catch(()=>{if(active)setMetrics({})})
    return()=>{active=false}
  },[tenant?.id,isDemo])
  useEffect(()=>{
    let active=true
    if(isDemo||!tenant?.id||!showCharts){setLiveSnapshot(null);return()=>{active=false}}
    const to=new Date(),from=new Date(to.getFullYear(),to.getMonth()-11,1)
    loadAnalysisSnapshot({organizationId:tenant.id,from:from.toISOString().slice(0,10),to:to.toISOString().slice(0,10)}).then(data=>{if(active)setLiveSnapshot(data)}).catch(()=>{if(active)setLiveSnapshot(null)})
    return()=>{active=false}
  },[tenant?.id,isDemo,showCharts])
  const snapshot=useMemo(()=>isDemo?collectAnalysisDemoSnapshot():liveSnapshot,[isDemo,liveSnapshot])
  const values=useMemo(()=>isDemo?demoMetrics(snapshot,nctx.operational):metrics,[isDemo,snapshot,nctx.operational,metrics])
  const roleRows=useMemo(()=>roleKpis(role,values,english,nctx.unreadCount),[role,values,english,nctx.unreadCount])
  const kpis=roleRows.length?roleRows:workspace.kpis.map(([label])=>[label,'—'])
  const tasks=nctx.operational.length?nctx.operational:workspace.tasks.map((title,index)=>({id:`workspace-${index}`,title,count:null,to:null,fallback:true}))
  const announcements=nctx.visibleAnnouncements.slice(0,4)
  const monthly=snapshot?.microbiology?.monthly||[]
  const donut=role===ROLES.LABORATORY?{title:tr('Κατηγορίες αντοχής','Resistance classes'),subtitle:tr('MDR / XDR / PDR στα θετικά αποτελέσματα.','MDR / XDR / PDR among positive results.'),rows:snapshot?.microbiology?.resistance||[],center:tr('στελέχη','isolates')}:{title:tr('Δραστηριότητα ανά ενότητα','Activity by module'),subtitle:tr('Καταγραφές του οργανισμού ανά ενότητα.','Organization records by module.'),rows:domainShare(snapshot,tr),center:tr('σύνολο','total')}
  const hasCharts=showCharts&&snapshot&&(monthly.length>1||donut.rows.length>1)

  return <Page className="dashboard-page" title={title||workspace.title} subtitle={subtitle||workspace.subtitle}>
    {showKpis&&kpis.length > 0 && <div className="kpi-grid role-kpis">{kpis.map(([label,value])=><article className="kpi-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>}
    <div className="dashboard-workspace-v2">
      <Card className="dashboard-card">
        <CardHeader icon={ListChecks} title={workspace.actionTitle??tr('Εργασίες προτεραιότητας','Priority work')} subtitle={tr('Ό,τι χρειάζεται ενέργεια από εσάς.','What needs your action.')}/>
        <div className="task-list">{tasks.map((task,index)=><button className="task-row" key={task.id} disabled={!task.to} onClick={()=>{if(!task.to)return;nctx.markRead(task.id);navigate(task.to)}}><span className={`priority ${index===0?'high':'medium'}`}/><span className="task-copy"><strong>{task.title}</strong>{task.count!=null&&<small>{task.count} {tr('σε εκκρεμότητα','pending')}</small>}</span>{task.count!=null&&<b className="task-count">{task.count}</b>}{task.to&&<ArrowRight size={17}/>}</button>)}</div>
      </Card>
      <Card className="dashboard-card">
        <CardHeader icon={Megaphone} title={tr('Ενημερώσεις & ανακοινώσεις','Updates & announcements')} subtitle={nctx.unreadCount?`${nctx.unreadCount} ${tr('μη αναγνωσμένες ειδοποιήσεις','unread notifications')}`:tr('Όλα διαβασμένα','All caught up')} actions={nctx.unreadCount>0&&<button type="button" className="text-button" onClick={nctx.markAllRead}><Bell size={14}/>{tr('Σήμανση όλων','Mark all read')}</button>}/>
        {announcements.length?<div className="dashboard-announcements">{announcements.map(a=><button key={a.id} onClick={()=>nctx.markRead(a.id)}><span className={`announcement-icon ${a.priority}`}><Megaphone size={15}/></span><span><strong>{a.title}</strong><small>{a.message}</small><em>{a.createdBy}</em></span>{!nctx.notificationItems.find(x=>x.id===a.id)?.read&&<i/>}</button>)}</div>:<div className="inline-empty">{tr('Οι νέες ενημερώσεις του οργανισμού θα εμφανίζονται εδώ.','New organization updates will appear here.')}</div>}
      </Card>
    </div>
    {hasCharts&&<div className="dashboard-charts">
      <Card className="dashboard-card dashboard-chart-wide"><CardHeader icon={Activity} title={tr('Θετικές καλλιέργειες ανά μήνα','Positive cultures by month')} subtitle={tr('Τελευταίοι 12 μήνες · περάστε το ποντίκι για τιμές.','Last 12 months · hover for values.')}/><TrendChart points={monthly} en={english} label={tr('Θετικές καλλιέργειες ανά μήνα','Positive cultures by month')}/></Card>
      <Card className="dashboard-card"><CardHeader icon={PieChart} title={donut.title} subtitle={donut.subtitle}/><DonutChart rows={donut.rows} en={english} centerLabel={donut.center}/></Card>
    </div>}
  </Page>
}
