import { useEffect,useMemo,useState } from 'react'
import { ArrowRight, Bell, Megaphone } from 'lucide-react'
import { Card } from '../../design-system/Card'
import { Page } from '../../design-system/Page'
import { useTenant } from '../../core/tenant/TenantContext'
import { useNotifications } from '../../core/notifications/NotificationContext'
import { ROLES } from '../../core/permissions/roles'
import { workspaceFor } from '../workspaces/workspaceConfig'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { loadDashboardMetrics } from './dashboardCloudService'

function hospitalAdminWorkspace(english){
  return english?{
    title:'Hospital Overview', subtitle:'Administrative overview of the organization, users, departments and operational pending work.',
    kpis:[['Active users','—'],['Active departments','—'],['Pending actions','—'],['Critical notifications','—']],
    actionTitle:'Administrative pending work', tasks:['Users requiring activation or access review','Pending organization settings','Audit events requiring administrative review'],
    focusTitle:'Operational status',
    statusItems:['Users & access','Organization settings','Records & data','Critical pending work'],
  }:{
    title:'Επισκόπηση Νοσοκομείου', subtitle:'Διοικητική εικόνα του οργανισμού, των χρηστών, των τμημάτων και των λειτουργικών εκκρεμοτήτων.',
    kpis:[['Ενεργοί χρήστες','—'],['Ενεργά τμήματα','—'],['Εκκρεμείς ενέργειες','—'],['Κρίσιμες ειδοποιήσεις','—']],
    actionTitle:'Διοικητικές εκκρεμότητες', tasks:['Χρήστες που χρειάζονται ενεργοποίηση ή έλεγχο πρόσβασης','Εκκρεμείς ρυθμίσεις οργανισμού','Συμβάντα καταγραφής που χρειάζονται διοικητικό έλεγχο'],
    focusTitle:'Κατάσταση λειτουργίας',
    statusItems:['Χρήστες & πρόσβαση','Ρυθμίσεις οργανισμού','Καταχωρίσεις & δεδομένα','Κρίσιμες εκκρεμότητες'],
  }
}

const n=v=>Number.isFinite(Number(v))?Number(v):'—'
function roleKpis(role,m,english,unread){
  const tr=(el,en)=>english?en:el
  switch(role){
    case ROLES.HOSPITAL_ADMIN:{
      const pending=['overdueControls','pendingSamples','openIncidents','overdueCapa'].reduce((sum,key)=>sum+(Number(m[key])||0),0)
      return [[tr('Ενεργοί χρήστες','Active users'),n(m.activeUsers)],[tr('Ενεργά τμήματα','Active departments'),n(m.activeDepartments)],[tr('Εκκρεμείς ενέργειες','Pending actions'),pending],[tr('Μη αναγνωσμένες ειδοποιήσεις','Unread notifications'),n(unread)]]
    }
    case ROLES.INFECTION_CONTROL_LEAD:
      return [[tr('Νέα MDR/XDR/PDR · 30ημ.','New MDR/XDR/PDR · 30d'),n(m.recentMdro)],[tr('Isolation reviews','Isolation reviews'),n(m.isolationReviewsDue)],[tr('Εκπρόθεσμοι έλεγχοι','Overdue controls'),n(m.overdueControls)],[tr('Κρίσιμα εργαστηρίου','Critical lab alerts'),n(m.criticalUncommunicated)]]
    case ROLES.INFECTION_CONTROL_MEMBER:
      return [[tr('Ενεργές επιτηρήσεις','Active surveillance'),n(m.activeSurveillance)],[tr('Θετικά εργαστηρίου','Positive laboratory results'),n(m.positiveLab)],[tr('Isolation reviews','Isolation reviews'),n(m.isolationReviewsDue)],[tr('Εκπρόθεσμοι έλεγχοι','Overdue controls'),n(m.overdueControls)]]
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
    case ROLES.QUALITY_MANAGER:
      return [[tr('Ανοιχτά συμβάντα','Open incidents'),n(m.openIncidents)],[tr('Σοβαρά ανοικτά','Severe open'),n(m.severeOpenIncidents)],[tr('CAPA εκπρόθεσμα','Overdue CAPA'),n(m.overdueCapa)]]
    default:return []
  }
}

export function DashboardPage() {
  const { role, tenant, isDemo } = useTenant()
  const {language}=useLanguage()
  const english=language==='en'
  const workspace=role===ROLES.HOSPITAL_ADMIN?hospitalAdminWorkspace(english):workspaceFor(role,language)
  const nctx=useNotifications()
  const navigate=useNavigate()
  const [metrics,setMetrics]=useState({})
  useEffect(()=>{
    let active=true
    if(isDemo||!tenant?.id){setMetrics({});return()=>{active=false}}
    loadDashboardMetrics(tenant.id).then(data=>{if(active)setMetrics(data)}).catch(()=>{if(active)setMetrics({})})
    return()=>{active=false}
  },[tenant?.id,isDemo])
  const liveKpis=useMemo(()=>isDemo?[]:roleKpis(role,metrics,english,nctx.unreadCount),[role,metrics,english,nctx.unreadCount,isDemo])
  const kpis=liveKpis.length?liveKpis:workspace.kpis.map(([label])=>[label,'—'])
  const tasks=nctx.operational.length?nctx.operational:workspace.tasks.map((title,index)=>({id:`workspace-${index}`,title,count:null,to:null,fallback:true}))
  const announcements=nctx.visibleAnnouncements.slice(0,4)

  return <Page className="dashboard-page" title={workspace.title} subtitle={workspace.subtitle}>
    {kpis.length > 0 && <div className="kpi-grid role-kpis">{kpis.map(([label,value])=><article className="kpi-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>}
    <div className="workspace-grid dashboard-workspace">
      <Card title={workspace.actionTitle??(english?'Priority work':'Εργασίες προτεραιότητας')}>
        <div className="task-list">{tasks.map((task,index)=><button className="task-row" key={task.id} disabled={!task.to} onClick={()=>{if(!task.to)return;nctx.markRead(task.id);navigate(task.to)}}><span className={`priority ${index===0?'high':'medium'}`}/><span className="task-copy"><strong>{task.title}</strong>{task.count!=null&&<small>{task.count} {english?'pending':'σε εκκρεμότητα'}</small>}</span>{task.to&&<ArrowRight size={17}/>}</button>)}</div>
      </Card>
      <Card title={english?'Updates & announcements':'Ενημερώσεις & ανακοινώσεις'}>{announcements.length?<div className="dashboard-announcements">{announcements.map(a=><button key={a.id} onClick={()=>nctx.markRead(a.id)}><span className={`announcement-icon ${a.priority}`}><Megaphone size={15}/></span><span><strong>{a.title}</strong><small>{a.message}</small><em>{a.createdBy}</em></span>{!nctx.notificationItems.find(x=>x.id===a.id)?.read&&<i/>}</button>)}</div>:<div className="context-card"><div><strong>{english?'No new announcements':'Δεν υπάρχουν νέες ανακοινώσεις'}</strong><span>{english?'New organization updates will appear here.':'Οι νέες ενημερώσεις του οργανισμού θα εμφανίζονται εδώ.'}</span></div></div>}</Card>
      <Card title={workspace.focusTitle??(english?'Today at a glance':'Σήμερα με μια ματιά')}>
        {workspace.statusItems?<div className="task-list">{workspace.statusItems.map(label=><div className="task-row" key={label}><span className="priority medium"/><span className="task-copy"><strong>{label}</strong><small>{english?'Status is calculated from authorized organization data.':'Η κατάσταση υπολογίζεται από τα εξουσιοδοτημένα δεδομένα του οργανισμού.'}</small></span></div>)}</div>:<div className="context-card"><div><strong>{workspace.focus??workspace.title}</strong><span>{workspace.focusText??workspace.subtitle}</span>{tenant?.name&&<small>{tenant.name}</small>}</div></div>}
      </Card>
      <Card title={english?'Notifications':'Ειδοποιήσεις'}><div className="dashboard-notification-summary"><Bell size={20}/><strong>{nctx.unreadCount}</strong><span>{english?'unread notifications':'μη αναγνωσμένες ειδοποιήσεις'}</span><button onClick={nctx.markAllRead}>{english?'Mark all as read':'Σήμανση όλων ως αναγνωσμένων'}</button></div></Card>
    </div>
  </Page>
}
