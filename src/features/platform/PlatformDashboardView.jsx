import { useEffect,useMemo,useState } from 'react'
import { Activity, ArrowRight, BarChart3, Building2, Clock3, FlaskConical, Settings, ShieldCheck } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { RegistryPagination } from '../../design-system/RegistryPagination'

function DashboardAction({ icon, title, description, meta, onClick }) {
  return (
    <button
      type="button"
      className="platform-control-card platform-owner-clickable-row"
      onClick={onClick}
      style={{minHeight:168,padding:22,gridTemplateColumns:'auto minmax(0,1fr) auto',alignItems:'start'}}
    >
      <span className="platform-control-card-icon" style={{width:46,height:46,borderRadius:13}}>{icon}</span>
      <span className="platform-control-card-copy" style={{gap:8,paddingTop:2}}>
        <strong style={{fontSize:15,lineHeight:1.25}}>{title}</strong>
        <small style={{fontSize:11.5,lineHeight:1.55,maxWidth:310}}>{description}</small>
        {meta ? <span className="platform-control-card-meta" style={{marginTop:5}}>{meta}</span> : null}
      </span>
      <span aria-hidden="true" style={{display:'grid',placeItems:'center',width:30,height:30,borderRadius:9,color:'var(--lo-color-primary)',background:'var(--lo-color-surface-subtle)'}}><ArrowRight size={16}/></span>
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
  const language=tx('el','en')
  const [demoPage,setDemoPage]=useState(1)
  const [demoPageSize,setDemoPageSize]=useState(15)
  const demoTotalPages=Math.max(1,Math.ceil(activeDemos.length/demoPageSize))
  const safeDemoPage=Math.min(demoPage,demoTotalPages)
  const pagedDemos=useMemo(()=>activeDemos.slice((safeDemoPage-1)*demoPageSize,safeDemoPage*demoPageSize),[activeDemos,safeDemoPage,demoPageSize])
  useEffect(()=>{if(demoPage>demoTotalPages)setDemoPage(demoTotalPages)},[demoPage,demoTotalPages])
  useEffect(()=>setDemoPage(1),[demoPageSize])

  return (
    <Page
      title={tx('Dashboard Πλατφόρμας', 'Platform Dashboard')}
      subtitle={tx(
        'Κεντρικός έλεγχος οργανισμών, πρόσβασης, analytics και λειτουργικής κατάστασης.',
        'Central control of organizations, access, analytics and operational status.'
      )}
    >
      <section className="platform-center-section platform-control-plane" style={{padding:18}}>
        <div className="platform-control-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:14}}>
          <DashboardAction
            icon={<Building2 size={21} />}
            title={tx('Οργανισμοί', 'Organizations')}
            description={tx('Registry, χρήστες, πρόσβαση και ρυθμίσεις οργανισμού.', 'Registry, users, access and organization settings.')}
            meta={`${activeOrganizations}/${organizations.length} ${tx('ενεργοί','active')}`}
            onClick={() => onNavigate('/platform#organizations')}
          />
          <DashboardAction
            icon={<BarChart3 size={21} />}
            title={tx('Ανάλυση', 'Analytics')}
            description={tx('Canonical analytics για όλη την πλατφόρμα ή επιλεγμένο οργανισμό.', 'Canonical analytics for the whole platform or a selected organization.')}
            meta={tx('Συγκεντρωτική εικόνα','Platform overview')}
            onClick={() => onNavigate('/platform#reports')}
          />
          <DashboardAction
            icon={<FlaskConical size={21} />}
            title="Demo"
            description={tx('Διαχείριση demo πρόσβασης, διάρκειας και lifecycle.', 'Manage demo access, duration and lifecycle.')}
            meta={loadingStats ? '—' : `${activeDemos.length} ${tx('ενεργά','active')}`}
            onClick={() => onNavigate('/platform#demo')}
          />
          <DashboardAction
            icon={<Activity size={21} />}
            title={tx('Υγεία Πλατφόρμας', 'Platform Health')}
            description={tx('Συγκεντρωτική λειτουργική εικόνα, αποτυχίες και προειδοποιήσεις όλων των οργανισμών.', 'Aggregated operational health, failures and warnings across organizations.')}
            meta={tx('Ζωντανή εικόνα', 'Live view')}
            onClick={() => onNavigate('/platform/health')}
          />
          <DashboardAction
            icon={<ShieldCheck size={21} />}
            title={tx('Audit & Ασφάλεια', 'Audit & Security')}
            description={tx('Ιχνηλασιμότητα ενεργειών Platform Owner, αλλαγών πρόσβασης και κρίσιμων διοικητικών ενεργειών.', 'Trace Platform Owner actions, access changes and critical administrative operations.')}
            meta={tx('Μόνο ανάγνωση', 'Read only')}
            onClick={() => onNavigate('/platform/audit')}
          />
          <DashboardAction
            icon={<Settings size={21} />}
            title={tx('Ρυθμίσεις Πλατφόρμας', 'Platform Settings')}
            description={tx('Καθολικές λειτουργικές προεπιλογές και ανακοινώσεις πλατφόρμας.', 'Global operational defaults and platform notices.')}
            meta={tx('Διαχείριση','Manage')}
            onClick={() => onNavigate('/platform/settings')}
          />
        </div>
      </section>

      <section className="platform-center-section workspace-column">
        <div className="platform-section-heading">
          <div>
            <h2>{tx('Demo που βρίσκονται σε εξέλιξη', 'Active demos')}</h2>
            <p>{tx('Παρακολούθηση διάρκειας και έγκαιρη ειδοποίηση πριν τη λήξη.', 'Track duration and upcoming expiry.')}</p>
          </div>
        </div>
        {activeDemos.length ? (
          <>
            <div className="platform-demo-list">
              {pagedDemos.map(demo => {
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
            <RegistryPagination language={language} page={safeDemoPage} totalPages={demoTotalPages} totalItems={activeDemos.length} pageSize={demoPageSize} onPageChange={setDemoPage} onPageSizeChange={setDemoPageSize}/>
          </>
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
