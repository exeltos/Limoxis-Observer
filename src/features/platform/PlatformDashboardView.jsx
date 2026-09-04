import { Activity, BarChart3, Building2, Clock3, FlaskConical } from 'lucide-react'
import { Page } from '../../design-system/Page'

function DashboardAction({ icon, title, description, meta, onClick }) {
  return (
    <button type="button" className="platform-control-card platform-owner-clickable-row" onClick={onClick}>
      <span className="platform-control-card-icon">{icon}</span>
      <span className="platform-control-card-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      {meta ? <span className="platform-control-card-meta">{meta}</span> : null}
    </button>
  )
}

export function PlatformDashboardView({
  tx,
  organizations,
  activeOrganizations,
  activeDemos,
  loadingStats,
  demoProgress,
  onOpenDemo,
  onNavigate,
}) {
  return (
    <Page
      title={tx('Dashboard Πλατφόρμας', 'Platform Dashboard')}
      subtitle={tx(
        'Κεντρικός έλεγχος οργανισμών, πρόσβασης, analytics και λειτουργικής κατάστασης.',
        'Central control of organizations, access, analytics and operational status.'
      )}
    >
      <section className="platform-center-section platform-control-plane">
        <div className="platform-section-heading">
          <div>
            <h2>{tx('Κέντρο ελέγχου', 'Control center')}</h2>
            <p>{tx(
              'Μία είσοδος για τις λειτουργίες του Platform Owner, χωρίς δεύτερες εκδόσεις των hospital workspaces.',
              'One entry point for Platform Owner operations without duplicate hospital workspaces.'
            )}</p>
          </div>
        </div>
        <div className="platform-control-grid">
          <DashboardAction
            icon={<Building2 size={18} />}
            title={tx('Οργανισμοί', 'Organizations')}
            description={tx('Registry, χρήστες, πρόσβαση και ρυθμίσεις οργανισμού.', 'Registry, users, access and organization settings.')}
            meta={`${activeOrganizations}/${organizations.length}`}
            onClick={() => onNavigate('/platform#organizations')}
          />
          <DashboardAction
            icon={<BarChart3 size={18} />}
            title={tx('Ανάλυση', 'Analytics')}
            description={tx('Canonical analytics για όλη την πλατφόρμα ή επιλεγμένο οργανισμό.', 'Canonical analytics for the whole platform or a selected organization.')}
            onClick={() => onNavigate('/platform#reports')}
          />
          <DashboardAction
            icon={<FlaskConical size={18} />}
            title="Demo"
            description={tx('Διαχείριση demo πρόσβασης και lifecycle.', 'Manage demo access and lifecycle.')}
            meta={loadingStats ? '—' : String(activeDemos.length)}
            onClick={() => onNavigate('/platform#demo')}
          />
          <DashboardAction
            icon={<Activity size={18} />}
            title={tx('Υγεία Πλατφόρμας', 'Platform Health')}
            description={tx('Συγκεντρωτική λειτουργική εικόνα, αποτυχίες και προειδοποιήσεις όλων των οργανισμών.', 'Aggregated operational health, failures and warnings across organizations.')}
            meta={tx('live εικόνα', 'live view')}
            onClick={() => onNavigate('/platform#health')}
          />
        </div>
      </section>

      <section className="platform-center-section">
        <div className="platform-section-heading">
          <div>
            <h2>{tx('Demo που βρίσκονται σε εξέλιξη', 'Active demos')}</h2>
            <p>{tx('Παρακολούθηση διάρκειας και έγκαιρη ειδοποίηση πριν τη λήξη.', 'Track duration and upcoming expiry.')}</p>
          </div>
        </div>
        {activeDemos.length ? (
          <div className="platform-demo-list">
            {activeDemos.map(demo => {
              const progress = demoProgress(demo)
              return (
                <button
                  type="button"
                  className="platform-demo-row platform-owner-clickable-row"
                  key={demo.id}
                  onClick={() => onOpenDemo(demo)}
                >
                  <div>
                    <strong>{demo.organization?.name || demo.label}</strong>
                    <small>
                      {demo.contact_name || demo.contact_email || 'Demo access'} · {tx('έως', 'until')}{' '}
                      {new Date(demo.valid_until).toLocaleDateString()}
                    </small>
                  </div>
                  <div className="platform-demo-progress">
                    <div><span style={{ width: `${progress.pct}%` }} /></div>
                    <small className={progress.remaining <= 14 ? 'warning' : ''}>
                      {progress.remaining} {tx('ημέρες υπόλοιπο', 'days remaining')}
                    </small>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="empty-state platform-empty">
            <Clock3 size={22} />
            <strong>{tx('Δεν υπάρχουν ενεργά Demo', 'No active demos')}</strong>
          </div>
        )}
      </section>
    </Page>
  )
}
