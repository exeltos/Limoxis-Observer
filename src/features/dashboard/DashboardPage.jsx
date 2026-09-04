import { ArrowRight, Bell, Megaphone } from 'lucide-react'
import { Card } from '../../design-system/Card'
import { Page } from '../../design-system/Page'
import { useTenant } from '../../core/tenant/TenantContext'
import { useNotifications } from '../../core/notifications/NotificationContext'
import { workspaceFor } from '../workspaces/workspaceConfig'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../core/i18n/LanguageContext'

export function DashboardPage() {
  const { role, tenant } = useTenant()
  const {language}=useLanguage()
  const english=language==='en'
  const workspace=workspaceFor(role,language)
  const n=useNotifications()
  const navigate=useNavigate()
  const tasks=n.operational.length?n.operational:workspace.tasks.map((title,index)=>({id:`workspace-${index}`,title,count:null,to:null,fallback:true}))

  return <Page title={workspace.title} subtitle={workspace.subtitle}>
    {workspace.kpis.length > 0 && <div className="kpi-grid role-kpis">{workspace.kpis.map(([label,value])=><article className="kpi-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>}
    <div className="workspace-grid dashboard-workspace">
      <Card title={workspace.actionTitle??(english?'Priority work':'Εργασίες προτεραιότητας')}>
        <div className="task-list">{tasks.map((task,index)=><button className="task-row" key={task.id} disabled={!task.to} onClick={()=>{if(!task.to)return;n.markRead(task.id);navigate(task.to)}}><span className={`priority ${index===0?'high':'medium'}`}/><span className="task-copy"><strong>{task.title}</strong>{task.count!=null&&<small>{task.count} {english?'pending':'σε εκκρεμότητα'}</small>}</span>{task.to&&<ArrowRight size={17}/>}</button>)}</div>
      </Card>
      <Card title={english?'Updates & announcements':'Ενημερώσεις & ανακοινώσεις'}><div className="dashboard-announcements">{n.visibleAnnouncements.slice(0,4).map(a=><button key={a.id} onClick={()=>n.markRead(a.id)}><span className={`announcement-icon ${a.priority}`}><Megaphone size={15}/></span><span><strong>{a.title}</strong><small>{a.message}</small><em>{a.createdBy}</em></span>{!n.notificationItems.find(x=>x.id===a.id)?.read&&<i/>}</button>)}</div></Card>
      <Card title={workspace.focusTitle??(english?'Today at a glance':'Σήμερα με μια ματιά')}><div className="context-card"><div><strong>{workspace.focus??workspace.title}</strong><span>{workspace.focusText??workspace.subtitle}</span>{tenant?.name&&<small>{tenant.name}</small>}</div></div></Card>
      <Card title={english?'Notifications':'Ειδοποιήσεις'}><div className="dashboard-notification-summary"><Bell size={20}/><strong>{n.unreadCount}</strong><span>{english?'unread notifications':'μη αναγνωσμένες ειδοποιήσεις'}</span><button onClick={n.markAllRead}>{english?'Mark all as read':'Σήμανση όλων ως αναγνωσμένων'}</button></div></Card>
    </div>
  </Page>
}
