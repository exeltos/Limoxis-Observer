import { ArrowRight, Bell, Megaphone, ShieldCheck } from 'lucide-react'
import { Card } from '../../design-system/Card'
import { Page } from '../../design-system/Page'
import { useTenant } from '../../core/tenant/TenantContext'
import { useNotifications } from '../../core/notifications/NotificationContext'
import { workspaceFor } from '../workspaces/workspaceConfig'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../core/i18n/LanguageContext'

export function DashboardPage() {
  const { role, tenant } = useTenant(); const {language}=useLanguage(); const english=language==='en'; const workspace=workspaceFor(role,language); const n=useNotifications(); const navigate=useNavigate()
  return <Page title={workspace.title} subtitle={workspace.subtitle}>
    {workspace.kpis.length > 0 && <div className="kpi-grid role-kpis">{workspace.kpis.map(([label, value]) => <article className="kpi-card" key={label}><span>{label}</span><strong>{value}</strong><small>{tenant?.name ?? 'Limoxis Observer'}</small></article>)}</div>}
    <div className="workspace-grid dashboard-workspace">
      <Card title={english?'Needs action':'Χρειάζεται ενέργεια'}><div className="task-list">{n.operational.length?n.operational.map((task,index)=><button className="task-row" key={task.id} onClick={()=>{n.markRead(task.id);navigate(task.to)}}><span className={`priority ${index===0?'high':'medium'}`}/><span className="task-copy"><strong>{task.title}</strong><small>{task.count} {english?'items · according to role and scope':'στοιχεία · σύμφωνα με ρόλο και scope'}</small></span><ArrowRight size={17}/></button>):workspace.tasks.map((task,index)=><button className="task-row" key={task}><span className={`priority ${index===0?'high':'medium'}`}/><span className="task-copy"><strong>{task}</strong><small>{english?'Visibility is determined by role, scope and assignment.':'Η ορατότητα προκύπτει από ρόλο, scope και ανάθεση.'}</small></span><ArrowRight size={17}/></button>)}</div></Card>
      <Card title={english?'Updates & announcements':'Ενημερώσεις & ανακοινώσεις'}><div className="dashboard-announcements">{n.visibleAnnouncements.slice(0,4).map(a=><button key={a.id} onClick={()=>n.markRead(a.id)}><span className={`announcement-icon ${a.priority}`}><Megaphone size={15}/></span><span><strong>{a.title}</strong><small>{a.message}</small><em>{a.createdBy}</em></span>{!n.notificationItems.find(x=>x.id===a.id)?.read&&<i/>}</button>)}</div></Card>
      <Card title={english?'Access & security':'Πρόσβαση & ασφάλεια'}><div className="context-card"><ShieldCheck size={19}/><div><strong>Role-aware workspace</strong><span>{english?'Modules, pending work and notifications are filtered according to the user’s role and scope.':'Οι ενότητες, οι εκκρεμότητες και οι ειδοποιήσεις φιλτράρονται σύμφωνα με τον ρόλο και το scope του χρήστη.'}</span></div></div></Card>
      <Card title={english?'Notification center':'Κέντρο ειδοποιήσεων'}><div className="dashboard-notification-summary"><Bell size={20}/><strong>{n.unreadCount}</strong><span>{english?'unread notifications':'μη αναγνωσμένες ειδοποιήσεις'}</span><button onClick={n.markAllRead}>{english?'Mark all as read':'Σήμανση όλων ως αναγνωσμένων'}</button></div></Card>
    </div>
  </Page>
}
