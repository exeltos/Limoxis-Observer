import { Activity, ArrowRight, BarChart3, Building2, FlaskConical, Settings, ShieldCheck } from 'lucide-react'
import { Page } from '../../design-system/Page'

function DashboardAction({ icon, title, description, meta, onClick }) {
  return (
    <button type="button" className="platform-control-card platform-owner-clickable-row" onClick={onClick}>
      <span className="platform-control-card-icon">{icon}</span>
      <span className="platform-control-card-copy">
        <strong>{title}</strong>
        <small>{description}</small>
        {meta ? <span className="platform-control-card-meta">{meta}</span> : null}
      </span>
      <span className="platform-control-card-arrow" aria-hidden="true"><ArrowRight size={17}/></span>
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
        <div className="platform-control-grid">
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
