import { ArrowRight, Building2, CalendarClock, FlaskConical, PauseCircle, Trash2 } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { MetricCard } from '../../design-system/MetricCard'
import { BarList, DonutChart } from '../analysis/AnalysisCharts'
import './platformDashboard.css'

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
  // The overview: the four counts (each opening its registry), what needs action, then the charts.
  // The work areas themselves are in the menu.
  return <Page title={tx('Επισκόπηση','Overview')} subtitle={demoPreview?tx('Προεπισκόπηση με συνθετικά δεδομένα demo.','Preview with synthetic demo data.'):tx('Οργανισμοί, Demo και ό,τι χρειάζεται ενέργεια στην πλατφόρμα.','Organizations, Demos and what needs action on the platform.')} actions={demoPreview?<span className="status-badge temporary">DEMO</span>:<span className="platform-live-pill"><i/>{tx('Πλατφόρμα ενεργή','Platform active')}</span>}>
    <div className="platform-dashboard">
      <div className="kpi-grid platform-dashboard-kpis">
        <MetricCard icon={Building2} label={`${tx('Οργανισμοί','Organizations')} · ${activeOrganizations} ${tx('ενεργοί','active')}`} value={organizations.length} onClick={()=>onNavigate('/platform#organizations')}/>
        <MetricCard icon={PauseCircle} label={tx('Ανενεργοί οργανισμοί','Inactive organizations')} value={inactive} tone={inactive?'warning':'neutral'} onClick={()=>onNavigate('/platform#organizations')}/>
        <MetricCard icon={FlaskConical} label={tx('Ενεργά Demo','Active Demos')} value={loadingStats?'—':activeDemos.length} onClick={()=>onNavigate('/platform#demo')}/>
        <MetricCard icon={CalendarClock} label={tx('Demo που λήγουν σε 14 ημέρες','Demos ending within 14 days')} value={loadingStats?'—':expiringDemos.length} tone={expiringDemos.length?'warning':'neutral'} onClick={()=>onNavigate('/platform#demo')}/>
      </div>

      {!demoPreview&&<ActionList tx={tx} demos={expiringDemos} organizations={organizations} demoProgress={demoProgress} onOpenDemo={onOpenDemo} onNavigate={onNavigate}/>}

      <div className="platform-dashboard-charts">
        <section className="platform-dashboard-panel"><header><div><h3>{tx('Κατάσταση οργανισμών','Organization status')}</h3><p>{tx('Ενεργοί, σε παύση και προσβάσεις demo.','Active, suspended and demo access.')}</p></div></header><div className="platform-dashboard-chart-body"><DonutChart en={tx('el','en')==='en'} centerLabel={tx('σύνολο','total')} rows={[[tx('Ενεργοί','Active'),activeOrganizations],[tx('Ανενεργοί / σε παύση','Inactive / suspended'),inactive],['Demo',loadingStats?0:activeDemos.length]]}/></div></section>
        <section className="platform-dashboard-panel"><header><div><h3>{tx('Οργανισμοί ανά περιφέρεια','Organizations by region')}</h3><p>{tx('Πού βρίσκονται οι οργανισμοί της πλατφόρμας.','Where the platform organizations are.')}</p></div></header><div className="platform-dashboard-chart-body"><BarList en={tx('el','en')==='en'} rows={Object.entries(organizations.reduce((acc,org)=>{const key=org.region||tx('Χωρίς περιφέρεια','No region');acc[key]=(acc[key]||0)+1;return acc},{})).sort((a,b)=>b[1]-a[1])}/></div></section>
      </div>
    </div>
  </Page>
}
