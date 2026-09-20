import { Activity, ArrowRight, BarChart3, Building2, FlaskConical, Settings, ShieldCheck } from 'lucide-react'
import { Page } from '../../design-system/Page'

function Metric({label,value,detail,tone='default'}){
  return <div className={`platform-dashboard-metric tone-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
}
function WorkspaceLink({icon,title,description,meta,onClick}){
  return <button type="button" className="platform-workspace-link" onClick={onClick}><span className="platform-workspace-link-icon">{icon}</span><span className="platform-workspace-link-copy"><strong>{title}</strong><small>{description}</small>{meta?<b>{meta}</b>:null}</span><ArrowRight size={16}/></button>
}

export function PlatformDashboardView({tx,organizations,activeOrganizations,activeDemos,expiringDemos=[],loadingStats,onNavigate,onEnterDemo}) {
  const inactive=Math.max(0,organizations.length-activeOrganizations)
  return <Page title={tx('Κέντρο Πλατφόρμας','Platform Center')} subtitle={tx('Επισκόπηση λειτουργίας, οργανισμών και διακυβέρνησης Limoxis Observer.','Operational, organization and governance overview for Limoxis Observer.')}>
    <div className="platform-dashboard">
      <section className="platform-dashboard-overview">
        <div className="platform-dashboard-overview-heading"><div><span className="platform-eyebrow">PLATFORM OWNER</span><h2>{tx('Επισκόπηση πλατφόρμας','Platform overview')}</h2><p>{tx('Η συνολική διοικητική εικόνα χωρίς είσοδο σε οργανισμό.','The administrative overview without entering an organization.')}</p></div><div className="platform-dashboard-overview-actions"><button type="button" className="button button-secondary platform-enter-demo" onClick={onEnterDemo}><FlaskConical size={16}/>{tx('Είσοδος Demo','Enter Demo')}</button><span className="platform-live-pill"><i/>{tx('Πλατφόρμα ενεργή','Platform active')}</span></div></div>
        <div className="platform-dashboard-metrics">
          <Metric label={tx('Οργανισμοί','Organizations')} value={organizations.length} detail={`${activeOrganizations} ${tx('ενεργοί','active')}`} />
          <Metric label={tx('Ανενεργοί','Inactive')} value={inactive} detail={tx('οργανισμοί','organizations')} tone={inactive?'warning':'default'} />
          <Metric label="Demo" value={loadingStats?'—':activeDemos.length} detail={tx('ενεργές προσβάσεις','active access')} />
          <Metric label={tx('Demo που λήγουν','Demo expiring')} value={loadingStats?'—':expiringDemos.length} detail={tx('εντός 14 ημερών','within 14 days')} tone={expiringDemos.length?'warning':'default'} />
        </div>
      </section>

      <div className="platform-dashboard-columns">
        <section className="platform-dashboard-panel platform-dashboard-primary">
          <header><div><h3>{tx('Διαχείριση','Management')}</h3><p>{tx('Οι βασικοί χώροι εργασίας του Platform Owner.','Primary Platform Owner workspaces.')}</p></div></header>
          <div className="platform-workspace-list">
            <WorkspaceLink icon={<Building2 size={18}/>} title={tx('Οργανισμοί','Organizations')} description={tx('Νοσοκομεία, χρήστες, ρόλοι και πρόσβαση.','Hospitals, users, roles and access.')} meta={`${activeOrganizations}/${organizations.length} ${tx('ενεργοί','active')}`} onClick={()=>onNavigate('/platform#organizations')}/>
            <WorkspaceLink icon={<FlaskConical size={18}/>} title="Demo" description={tx('Προσβάσεις επίδειξης και διάρκεια ισχύος.','Demo access and validity periods.')} meta={loadingStats?'—':`${activeDemos.length} ${tx('ενεργά','active')}`} onClick={()=>onNavigate('/platform#demo')}/>
            <WorkspaceLink icon={<BarChart3 size={18}/>} title={tx('Ανάλυση','Analytics')} description={tx('Συγκεντρωτικά δεδομένα σε επίπεδο πλατφόρμας.','Aggregated platform-level data.')} onClick={()=>onNavigate('/platform#reports')}/>
          </div>
        </section>

        <section className="platform-dashboard-panel">
          <header><div><h3>{tx('Διακυβέρνηση & λειτουργία','Governance & operations')}</h3><p>{tx('Έλεγχος λειτουργίας, ασφάλειας και καθολικών ρυθμίσεων.','Operations, security and global settings.')}</p></div></header>
          <div className="platform-workspace-list compact">
            <WorkspaceLink icon={<Activity size={18}/>} title={tx('Υγεία Πλατφόρμας','Platform Health')} description={tx('Σφάλματα, προειδοποιήσεις και λειτουργικά συμβάντα.','Failures, warnings and operational events.')} meta={tx('Ζωντανή εικόνα','Live view')} onClick={()=>onNavigate('/platform/health')}/>
            <WorkspaceLink icon={<ShieldCheck size={18}/>} title={tx('Audit & Ασφάλεια','Audit & Security')} description={tx('Ενέργειες, αλλαγές πρόσβασης και ιχνηλασιμότητα.','Actions, access changes and traceability.')} meta={tx('Μόνο ανάγνωση','Read only')} onClick={()=>onNavigate('/platform/audit')}/>
            <WorkspaceLink icon={<Settings size={18}/>} title={tx('Ρυθμίσεις Πλατφόρμας','Platform Settings')} description={tx('Καθολικές προεπιλογές και ανακοινώσεις.','Global defaults and notices.')} onClick={()=>onNavigate('/platform/settings')}/>
          </div>
        </section>
      </div>

      <section className="platform-dashboard-organizations">
        <header><div><h3>{tx('Οργανισμοί','Organizations')}</h3><p>{tx('Άμεση πρόσβαση στους οργανισμούς της πλατφόρμας.','Quick access to platform organizations.')}</p></div><button type="button" onClick={()=>onNavigate('/platform#organizations')}>{tx('Προβολή όλων','View all')} <ArrowRight size={14}/></button></header>
        {organizations.length?<div className="platform-dashboard-org-list">{organizations.slice(0,6).map(org=><button key={org.id} type="button" onClick={()=>onNavigate(`/platform#organizations?organization=${org.id}&tab=details`)}><span className="platform-org-mark"><Building2 size={15}/></span><span><strong>{org.name||org.code}</strong><small>{[org.code,org.city].filter(Boolean).join(' · ')||'—'}</small></span><span className={`status-badge ${org.status==='active'?'active':'temporary'}`}>{org.status==='active'?tx('Ενεργός','Active'):tx('Ανενεργός','Inactive')}</span><ArrowRight size={14}/></button>)}</div>:<div className="inline-empty">{tx('Δεν υπάρχουν οργανισμοί.','No organizations found.')}</div>}
      </section>
    </div>
  </Page>
}
