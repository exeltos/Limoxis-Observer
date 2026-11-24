import { ArrowRight, BellRing } from 'lucide-react'
import { Card, CardHeader } from '../../design-system/Card'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import type { HomeAlert } from './hospitalMatrixModel'

// «Επισημάνσεις» (owner, 24/11/2026): what the home found — possible clusters, departments under their hand hygiene
// target — then the decisions the figures do not show; the most urgent first, the card scrolls.
export function HomeAlertsCard({ alerts, loading, note, language, onAlert }: { alerts: HomeAlert[], loading: boolean, note?: string | null, language: string, onAlert: (alert: HomeAlert) => void }) {
  const en = language === 'en'
  const tr = (el: string, enText: string) => en ? enText : el
  const number = (value: number) => new Intl.NumberFormat(en ? 'en-GB' : 'el-GR').format(value)
  const ordered = [...alerts].sort((a, b) => Number(b.tone === 'danger') - Number(a.tone === 'danger'))
  return <Card className="dashboard-card adminhome-alerts">
    <CardHeader icon={BellRing} title={tr('Επισημάνσεις', 'Alerts')} subtitle={tr('ό,τι βρήκε η εφαρμογή και θέλει απόφαση', 'what the app found that needs a decision')}/>
    {loading && !alerts.length ? <TableSkeleton/> : ordered.length ? <ul className="adminhome-alert-list">{ordered.map(alert => <li key={alert.key}>
      <button type="button" className={`is-${alert.tone}`} disabled={!alert.to} onClick={() => onAlert(alert)} title={[alert.title, alert.detail].filter(Boolean).join(' · ')}>
        <span className="adminhome-alert-copy"><strong>{alert.title}</strong>{alert.detail && <small>{alert.detail}</small>}</span>
        {alert.count != null ? <b>{number(alert.count)}</b> : alert.to ? <ArrowRight size={15} aria-hidden="true"/> : null}
      </button>
    </li>)}</ul> : <p className="adminhome-decisions-empty">{tr('Τίποτα σε εκκρεμότητα.', 'Nothing pending.')}</p>}
    {note && <p className="adminhome-decisions-empty" role="status">{note}</p>}
  </Card>
}
