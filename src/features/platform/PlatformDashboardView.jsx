import { Activity, ArrowRight, BarChart3, Building2, FlaskConical, Settings, ShieldCheck } from 'lucide-react'
import { Page } from '../../design-system/Page'

function DashboardAction({ icon, title, description, meta, onClick }) {
  return (
    <button
      type="button"
      className="platform-control-card platform-owner-clickable-row"
      onClick={onClick}
      style={{
        minHeight:154,
        padding:'20px 21px',
        gridTemplateColumns:'auto minmax(0,1fr) auto',
        alignItems:'start',
        border:'1px solid color-mix(in srgb,var(--lo-color-primary) 12%,var(--lo-color-border))',
        background:'linear-gradient(180deg,var(--lo-color-surface) 0%,color-mix(in srgb,var(--lo-color-primary) 2.5%,var(--lo-color-surface)) 100%)',
        boxShadow:'0 8px 22px rgba(31,52,73,.07)'
      }}
    >
      <span
        className="platform-control-card-icon"
        style={{
          width:44,
          height:44,
          borderRadius:11,
          background:'color-mix(in srgb,var(--lo-color-primary) 10%,var(--lo-color-surface))',
          border:'1px solid color-mix(in srgb,var(--lo-color-primary) 13%,var(--lo-color-border))'
        }}
      >{icon}</span>
      <span className="platform-control-card-copy" style={{gap:7,paddingTop:1}}>
        <strong style={{fontSize:15,lineHeight:1.25,color:'var(--lo-color-text)'}}>{title}</strong>
        <small style={{fontSize:11.25,lineHeight:1.52,maxWidth:330}}>{description}</small>
        {meta ? <span className="platform-control-card-meta" style={{marginTop:5,fontSize:10.75}}>{meta}</span> : null}
      </span>
      <span
        className="platform-control-card-arrow"
        aria-hidden="true"
        style={{display:'grid',placeItems:'center',width:30,height:30,borderRadius:8,color:'var(--lo-color-primary)',background:'color-mix(in srgb,var(--lo-color-primary) 7%,transparent)'}}
      ><ArrowRight size={17}/></span>
    </button>
  )
}

export function PlatformDashboardView({tx,organizations,activeOrganizations,activeDemos,loadingStats,onNavigate}) {
  return (
    <Page
      title={tx('Dashboard Πλατφόρμας', 'Platform Dashboard')}
      subtitle={tx(
        'Κεντρικός έλεγχος οργανισμών, πρόσβασης, analytics και λειτουργικής κατάστασης.',
        'Central control of organizations, access, analytics and operational status.'
      )}
    >
      <section className="platform-control-plane">
        <div className="platform-control-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:14}}>
          <DashboardAction
            icon={<Building2 size={21}/>} title={tx('Οργανισμοί','Organizations')}
            description={tx('Registry, χρήστες, πρόσβαση και ρυθμίσεις οργανισμού.','Registry, users, access and organization settings.')}
            meta={`${activeOrganizations}/${organizations.length} ${tx('ενεργοί','active')}`}
            onClick={()=>onNavigate('/platform#organizations')}
          />
          <DashboardAction
            icon={<BarChart3 size={21}/>} title={tx('Ανάλυση','Analytics')}
            description={tx('Canonical analytics για όλη την πλατφόρμα ή επιλεγμένο οργανισμό.','Canonical analytics for the whole platform or a selected organization.')}
            meta={tx('Συγκεντρωτική εικόνα','Platform overview')}
            onClick={()=>onNavigate('/platform#reports')}
          />
          <DashboardAction
            icon={<FlaskConical size={21}/>} title="Demo"
            description={tx('Διαχείριση demo πρόσβασης, διάρκειας και lifecycle.','Manage demo access, duration and lifecycle.')}
            meta={loadingStats?'—':`${activeDemos.length} ${tx('ενεργά','active')}`}
            onClick={()=>onNavigate('/platform#demo')}
          />
          <DashboardAction
            icon={<Activity size={21}/>} title={tx('Υγεία Πλατφόρμας','Platform Health')}
            description={tx('Συγκεντρωτική λειτουργική εικόνα, αποτυχίες και προειδοποιήσεις όλων των οργανισμών.','Aggregated operational health, failures and warnings across organizations.')}
            meta={tx('Ζωντανή εικόνα','Live view')}
            onClick={()=>onNavigate('/platform/health')}
          />
          <DashboardAction
            icon={<ShieldCheck size={21}/>} title={tx('Audit & Ασφάλεια','Audit & Security')}
            description={tx('Ιχνηλασιμότητα ενεργειών Platform Owner, αλλαγών πρόσβασης και κρίσιμων διοικητικών ενεργειών.','Trace Platform Owner actions, access changes and critical administrative operations.')}
            meta={tx('Μόνο ανάγνωση','Read only')}
            onClick={()=>onNavigate('/platform/audit')}
          />
          <DashboardAction
            icon={<Settings size={21}/>} title={tx('Ρυθμίσεις Πλατφόρμας','Platform Settings')}
            description={tx('Καθολικές λειτουργικές προεπιλογές και ανακοινώσεις πλατφόρμας.','Global operational defaults and platform notices.')}
            meta={tx('Διαχείριση','Manage')}
            onClick={()=>onNavigate('/platform/settings')}
          />
        </div>
      </section>
    </Page>
  )
}
