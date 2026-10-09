import { Activity, ArrowRight, BarChart3, Building2, CalendarClock, Database, FlaskConical, Settings, ShieldCheck, Trash2 } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { BarList, DonutChart } from '../analysis/AnalysisCharts'
import './platformDashboard.css'

function Metric({label,value,detail,tone='default'}){
  return <div className={`platform-dashboard-metric tone-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
}
function WorkspaceLink({icon,title,description,meta,onClick}){
  return <button type="button" className="platform-workspace-link" onClick={onClick}><span className="platform-workspace-link-icon">{icon}</span><span className="platform-workspace-link-copy"><strong>{title}</strong><small>{description}</small>{meta?<b>{meta}</b>:null}</span><ArrowRight size={16}/></button>
}

const DAY=86400000
const daysUntil=value=>Math.ceil((new Date(`${String(value).slice(0,10)}T00:00:00`).getTime()-new Date(new Date().toDateString()).getTime())/DAY)
const shortDate=value=>new Intl.DateTimeFormat('el-GR').format(new Date(value))

// What the Owner must act on this week: Demos that end and hospitals whose
// deletion date is near or has passed (the same events the reminder e-mails cover).
function ActionList({tx,demos,organizations,demoProgress,onOpenDemo,onNavigate}){
  const items=[
    ...organizations.filter(o=>o.deletion_scheduled_at&&daysUntil(o.deletion_scheduled_at)<=7).map(o=>{const days=daysUntil(o.deletion_scheduled_at);return {key:`org-${o.id}`,order:days,tone:'danger',icon:<Trash2 size={16}/>,title:o.name,
      text:days<=0?tx('Έφτασε η ημερομηνία οριστικής διαγραφής','The deletion date has been reached'):days===1?tx(`Οριστική διαγραφή αύριο (${shortDate(o.deletion_scheduled_at)})`,`Permanent deletion tomorrow (${shortDate(o.deletion_scheduled_at)})`):tx(`Οριστική διαγραφή σε ${days} ημέρες (${shortDate(o.deletion_scheduled_at)})`,`Permanent deletion in ${days} days (${shortDate(o.deletion_scheduled_at)})`),
      action:()=>onNavigate(`/platform#organizations?organization=${o.id}&tab=offboarding`)}}),
    ...demos.filter(d=>(demoProgress?demoProgress(d).remaining:daysUntil(d.valid_until))<=7).map(d=>{const days=daysUntil(d.valid_until);return {key:`demo-${d.id}`,order:days+0.5,tone:'warning',icon:<CalendarClock size={16}/>,title:d.label||d.organization?.name||'Demo',
      text:days<=0?tx('Το Demo λήγει σήμερα','The Demo ends today'):days===1?tx(`Το Demo λήγει αύριο (${shortDate(d.valid_until)})`,`The Demo ends tomorrow (${shortDate(d.valid_until)})`):tx(`Το Demo λήγει σε ${days} ημέρες (${shortDate(d.valid_until)})`,`The Demo ends in ${days} days (${shortDate(d.valid_until)})`),
      action:()=>onOpenDemo?onOpenDemo(d):onNavigate(`/platform#demo?demo=${d.id}`)}}),
  ].sort((a,b)=>a.order-b.order)
  if(!items.length)return null
  return <section className="platform-dashboard-panel platform-dashboard-actions"><header><div><h3>{tx('Χρειάζονται ενέργεια','Needs action')}</h3><p>{tx('Λήξεις Demo και διαγραφές οργανισμών των επόμενων 7 ημερών. Για καθένα στέλνεται και υπενθύμιση με email.','Demo endings and organization deletions in the next 7 days. Each one also gets an e-mail reminder.')}</p></div></header>
    <div className="platform-action-list">{items.map(i=><button type="button" key={i.key} className={`platform-action-item tone-${i.tone}`} onClick={i.action}><span className="platform-action-icon">{i.icon}</span><span className="platform-action-copy"><strong>{i.title}</strong><small>{i.text}</small></span><ArrowRight size={16}/></button>)}</div>
  </section>
}

export function PlatformDashboardView({tx,organizations,activeOrganizations,activeDemos,expiringDemos=[],loadingStats,demoProgress,onOpenDemo,onNavigate,demoPreview}) {
  const inactive=Math.max(0,organizations.length-activeOrganizations)
  return <Page title={tx('Κέντρο Πλατφόρμας','Platform Center')} subtitle={tx('Επισκόπηση λειτουργίας, οργανισμών και διακυβέρνησης Limoxis Observer.','Operational, organization and governance overview for Limoxis Observer.')}>
    <div className="platform-dashboard">
      <section className={`platform-dashboard-overview${demoPreview?' demo-preview':''}`}>
        <div className="platform-dashboard-overview-heading"><div><span className="platform-eyebrow">{tx('ΙΔΙΟΚΤΗΤΗΣ ΠΛΑΤΦΟΡΜΑΣ','PLATFORM OWNER')}</span><h2>{tx('Επισκόπηση πλατφόρμας','Platform overview')}</h2><p>{demoPreview?tx('Προεπισκόπηση με συνθετικά δεδομένα demo.','Preview with synthetic demo data.'):tx('Η συνολική διοικητική εικόνα χωρίς είσοδο σε οργανισμό.','The administrative overview without entering an organization.')}</p></div><div className="platform-dashboard-overview-actions">{demoPreview?<span className="status-badge temporary">DEMO</span>:<span className="platform-live-pill"><i/>{tx('Πλατφόρμα ενεργή','Platform active')}</span>}</div></div>
        <div className="platform-dashboard-metrics">
          <Metric label={tx('Οργανισμοί','Organizations')} value={organizations.length} detail={`${activeOrganizations} ${tx('ενεργοί','active')}`} />
          <Metric label={tx('Ανενεργοί','Inactive')} value={inactive} detail={tx('οργανισμοί','organizations')} tone={inactive?'warning':'default'} />
          <Metric label="Demo" value={loadingStats?'—':activeDemos.length} detail={tx('ενεργές προσβάσεις','active access')} />
          <Metric label={tx('Demo που λήγουν','Demo expiring')} value={loadingStats?'—':expiringDemos.length} detail={tx('εντός 14 ημερών','within 14 days')} tone={expiringDemos.length?'warning':'default'} />
        </div>
      </section>

      {!demoPreview&&<ActionList tx={tx} demos={expiringDemos} organizations={organizations} demoProgress={demoProgress} onOpenDemo={onOpenDemo} onNavigate={onNavigate}/>}

      <div className="platform-dashboard-columns">
        <section className="platform-dashboard-panel platform-dashboard-primary">
          <header><div><h3>{tx('Διαχείριση','Management')}</h3><p>{tx('Οι βασικοί χώροι εργασίας του Ιδιοκτήτη Πλατφόρμας.','Primary Platform Owner workspaces.')}</p></div></header>
          <div className="platform-workspace-list">
            <WorkspaceLink icon={<Building2 size={18}/>} title={tx('Οργανισμοί','Organizations')} description={tx('Νοσοκομεία, χρήστες, ρόλοι και πρόσβαση.','Hospitals, users, roles and access.')} meta={`${activeOrganizations}/${organizations.length} ${tx('ενεργοί','active')}`} onClick={()=>onNavigate('/platform#organizations')}/>
            <WorkspaceLink icon={<FlaskConical size={18}/>} title="Demo" description={tx('Προσβάσεις επίδειξης και διάρκεια ισχύος.','Demo access and validity periods.')} meta={loadingStats?'—':`${activeDemos.length} ${tx('ενεργά','active')}`} onClick={()=>onNavigate('/platform#demo')}/>
            <WorkspaceLink icon={<BarChart3 size={18}/>} title={tx('Ανάλυση','Analytics')} description={tx('Συγκεντρωτικά δεδομένα σε επίπεδο πλατφόρμας.','Aggregated platform-level data.')} onClick={()=>onNavigate('/platform#reports')}/>
            <WorkspaceLink icon={<Database size={18}/>} title={tx('Κεντρική Διαχείριση','Central Management')} description={tx('Βιβλιοθήκες, δείκτες, δέσμες μέτρων και πηγές — κοινά σε όλα τα νοσοκομεία.','Libraries, indicators, bundles and references — shared across every hospital.')} onClick={()=>onNavigate('/platform#management')}/>
          </div>
        </section>

        <section className="platform-dashboard-panel">
          <header><div><h3>{tx('Διακυβέρνηση & λειτουργία','Governance & operations')}</h3><p>{tx('Έλεγχος λειτουργίας, ασφάλειας και καθολικών ρυθμίσεων.','Operations, security and global settings.')}</p></div></header>
          <div className="platform-workspace-list compact">
            <WorkspaceLink icon={<Activity size={18}/>} title={tx('Υγεία Πλατφόρμας','Platform Health')} description={tx('Σφάλματα, προειδοποιήσεις και λειτουργικά συμβάντα.','Failures, warnings and operational events.')} meta={tx('Ζωντανή εικόνα','Live view')} onClick={()=>onNavigate('/platform/health')}/>
            <WorkspaceLink icon={<ShieldCheck size={18}/>} title={tx('Ιστορικό & Ασφάλεια','Audit & Security')} description={tx('Ενέργειες, αλλαγές πρόσβασης και ιχνηλασιμότητα.','Actions, access changes and traceability.')} meta={tx('Μόνο ανάγνωση','Read only')} onClick={()=>onNavigate('/platform/audit')}/>
            <WorkspaceLink icon={<Settings size={18}/>} title={tx('Ρυθμίσεις Πλατφόρμας','Platform Settings')} description={tx('Καθολικές προεπιλογές και ανακοινώσεις.','Global defaults and notices.')} onClick={()=>onNavigate('/platform/settings')}/>
          </div>
        </section>
      </div>

      <div className="platform-dashboard-charts">
        <section className="platform-dashboard-panel"><header><div><h3>{tx('Κατάσταση οργανισμών','Organization status')}</h3><p>{tx('Ενεργοί, σε παύση και προσβάσεις demo.','Active, suspended and demo access.')}</p></div></header><div className="platform-dashboard-chart-body"><DonutChart en={tx('el','en')==='en'} centerLabel={tx('σύνολο','total')} rows={[[tx('Ενεργοί','Active'),activeOrganizations],[tx('Ανενεργοί / σε παύση','Inactive / suspended'),inactive],['Demo',loadingStats?0:activeDemos.length]]}/></div></section>
        <section className="platform-dashboard-panel"><header><div><h3>{tx('Οργανισμοί ανά περιφέρεια','Organizations by region')}</h3><p>{tx('Πού βρίσκονται οι οργανισμοί της πλατφόρμας.','Where the platform organizations are.')}</p></div></header><div className="platform-dashboard-chart-body"><BarList en={tx('el','en')==='en'} rows={Object.entries(organizations.reduce((acc,org)=>{const key=org.region||tx('Χωρίς περιφέρεια','No region');acc[key]=(acc[key]||0)+1;return acc},{})).sort((a,b)=>b[1]-a[1])}/></div></section>
      </div>
    </div>
  </Page>
}
