import './departmentHome.css'
import type { ReactNode } from 'react'
import { ArrowRight, FlaskConical } from 'lucide-react'
import { Card, CardHeader } from '../../design-system/Card'
import { HandHygieneChart, WeeklyPositivesChart } from './DepartmentHomeCharts'
import { SERIES_COLORS } from '../analysis/AnalysisCharts'
import type { DepartmentHomeOverview } from './departmentHomeModel'

// «Το τμήμα μου» of the Department Manager (owner, 20/11/2026): five figures of the department,
// two charts, then «Για μένα σήμερα», «Τελευταία θετικά» and the announcements with the
// department's 30 days. One screen at 1440×900 without the page scrolling; the lists scroll.
// A figure, chart or card of a module the hospital has locked is not shown.
type Tone = 'danger' | 'warning' | 'success' | null
interface Tile { key: string, label: string, value: string, detail: string, tone: Tone, to: string }
export interface DepartmentHomeProps {
  overview: DepartmentHomeOverview | null
  status: 'loading' | 'ready' | 'error'
  language: string
  moduleEnabled: (module: string) => boolean
  canOpen: (to: string) => boolean
  onOpen: (to: string) => void
  todoCard: ReactNode
  announcementsCard: (footer: ReactNode) => ReactNode
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
const numberText = (value: number | null | undefined, en: boolean) => value == null ? '—' : new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(value)
const percentText = (value: number | null | undefined, en: boolean) => value == null ? '—' : `${new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 0 }).format(Math.round(value))}%`

export function DepartmentHome({ overview, status, language, moduleEnabled, canOpen, onOpen, todoCard, announcementsCard }: DepartmentHomeProps) {
  const en = language === 'en'
  const tr = (el: string, enText: string) => en ? enText : el
  const o = overview
  const n = (value: number | null | undefined) => Number(value) || 0
  const tiles: Tile[] = []
  // No inpatients tile (owner, 20/11/2026): the figures that need attention only.
  if (moduleEnabled('laboratory')) tiles.push({
    key: 'positives', label: tr('Θετικά δείγματα (30 ημ.)', 'Positive samples (30 days)'), value: numberText(o?.positives30, en), tone: n(o?.positivesMdr30) > 0 ? 'danger' : null, to: '/laboratory',
    detail: `${n(o?.positivesMdr30)} MDR/XDR · ${tr(`${n(o?.positivesAwaiting30)} προς έλεγχο`, `${n(o?.positivesAwaiting30)} to review`)}`,
  })
  if (moduleEnabled('surveillance')) tiles.push({
    key: 'surveillance', label: tr('Σε επιτήρηση / απομόνωση', 'Surveillance / isolation'), value: `${numberText(o?.activeSurveillance, en)} / ${numberText(o?.activeIsolation, en)}`, tone: null, to: '/surveillance?tab=episodes',
    detail: en ? plural(n(o?.reassessmentsDueToday), 'reassessment today', 'reassessments today') : plural(n(o?.reassessmentsDueToday), 'επανεκτίμηση σήμερα', 'επανεκτιμήσεις σήμερα'),
  })
  const target = o?.handHygieneTarget ?? 80
  if (moduleEnabled('prevention')) tiles.push({
    key: 'handHygiene', label: tr('Υγιεινή χεριών', 'Hand hygiene'), value: percentText(o?.handHygienePct, en), to: '/prevention?tab=handHygiene',
    tone: o?.handHygienePct == null ? null : o.handHygienePct >= target ? 'success' : 'warning',
    detail: `${tr('στόχος', 'target')} ${target}% · ${en ? plural(n(o?.handHygieneObservations), 'observation', 'observations') : plural(n(o?.handHygieneObservations), 'παρατήρηση', 'παρατηρήσεις')}`,
  })
  if (moduleEnabled('controls')) tiles.push({
    key: 'controls', label: tr('Εκπρόθεσμοι έλεγχοι', 'Overdue controls'), value: numberText(o?.overdueControls, en), tone: n(o?.overdueControls) > 0 ? 'danger' : null, to: '/controls',
    detail: tr(`${n(o?.controlsDueToday)} για σήμερα`, `${n(o?.controlsDueToday)} due today`),
  })
  const loading = status === 'loading' && !o
  const latest = o?.latestPositives || []
  const dateText = (value: string | null) => value ? new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { timeZone: 'Europe/Athens', day: 'numeric', month: 'numeric' }).format(new Date(value)) : ''
  const open = (to: string) => { if (canOpen(to)) onOpen(to) }
  const chartAction = (to: string) => canOpen(to) && <button type="button" className="text-button" onClick={() => onOpen(to)}>{tr('Άνοιγμα', 'Open')}<ArrowRight size={14}/></button>

  // «Το τμήμα (30 ημ.)»: falls / pressure ulcers, training completion and influenza vaccination (each when its module is on).
  const footerRows: Array<[string, string]> = []
  if (moduleEnabled('quality')) footerRows.push([tr('Πτώσεις / κατακλίσεις', 'Falls / pressure ulcers'), `${numberText(o?.falls30, en)} / ${numberText(o?.pressureUlcers30, en)}`])
  if (moduleEnabled('training')) footerRows.push([tr('Ολοκλήρωση εκπαιδεύσεων', 'Training completion'), percentText(o?.trainingPct, en)])
  if (moduleEnabled('occupational_health')) footerRows.push([tr('Εμβολιασμός γρίπης προσωπικού', 'Staff flu vaccination'), percentText(o?.fluPct, en)])
  const footer = footerRows.length > 0 && <div className="dephome-month">
    <strong>{tr('Το τμήμα (30 ημ.)', 'The department (30 days)')}</strong>
    <dl>{footerRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </div>

  return <div className="dephome">
    {status === 'error' && <div className="inline-empty dephome-error" role="status">{tr('Τα στοιχεία του τμήματος δεν φορτώθηκαν. Δοκιμάστε ξανά σε λίγο.', 'The department figures did not load. Please try again shortly.')}</div>}
    <div className="dephome-tiles" style={{ '--dephome-tiles': tiles.length }}>
      {tiles.map(tile => <button type="button" key={tile.key} className={`dephome-tile${tile.tone ? ` is-${tile.tone}` : ''}`} disabled={!canOpen(tile.to)} onClick={() => open(tile.to)} aria-busy={loading || undefined}>
        <span className="dephome-tile-label">{tile.label}</span>
        <strong className="dephome-tile-value">{loading ? '…' : tile.value}</strong>
        <small className="dephome-tile-detail">{loading ? '' : tile.detail}</small>
      </button>)}
    </div>
    {(moduleEnabled('laboratory') || moduleEnabled('prevention')) && <div className="dephome-charts">
      {moduleEnabled('laboratory') && <Card className="dashboard-card dephome-chart-card">
        <CardHeader title={tr('Θετικά δείγματα ανά εβδομάδα', 'Positive samples per week')} subtitle={tr('τελευταίες 12 εβδομάδες', 'last 12 weeks')} actions={<>
          <span className="dephome-legend"><span><i style={{ background: SERIES_COLORS[1] }}/>MDR/XDR</span><span><i style={{ background: SERIES_COLORS[0] }}/>{tr('Λοιπά', 'Other')}</span></span>
          {chartAction('/laboratory')}
        </>}/>
        <WeeklyPositivesChart rows={o?.weeklyPositives || []} en={en} label={tr('Θετικά δείγματα ανά εβδομάδα', 'Positive samples per week')}/>
      </Card>}
      {moduleEnabled('prevention') && <Card className="dashboard-card dephome-chart-card">
        <CardHeader title={tr('Υγιεινή χεριών ανά μήνα', 'Hand hygiene per month')} subtitle={`${tr('στόχος', 'target')} ${target}%`} actions={chartAction('/prevention?tab=handHygiene')}/>
        <HandHygieneChart rows={o?.monthlyHandHygiene || []} target={target} en={en} label={tr('Υγιεινή χεριών ανά μήνα', 'Hand hygiene per month')}/>
      </Card>}
    </div>}
    <div className="dephome-cards">
      {todoCard}
      {moduleEnabled('laboratory') && <Card className="dashboard-card dephome-latest">
        <CardHeader icon={FlaskConical} title={tr('Τελευταία θετικά', 'Latest positives')} subtitle={tr('Τα 5 πιο πρόσφατα του τμήματος.', 'The department’s 5 most recent.')} actions={chartAction('/laboratory')}/>
        {latest.length ? <div className="dephome-latest-list">{latest.map(row => {
          const to = `/laboratory/${encodeURIComponent(row.sampleCode)}`
          return <button type="button" key={row.sampleCode} disabled={!canOpen('/laboratory')} onClick={() => onOpen(to)}>
            <span className="dephome-latest-copy"><strong>{(en ? row.patientEn || row.patient : row.patient) || row.sampleCode}</strong><small><em>{row.organism || tr('Θετικό', 'Positive')}</em>{row.awaiting && <span className="dephome-tag is-review">{tr('προς έλεγχο', 'to review')}</span>}</small></span>
            {row.resistance && <span className="dephome-tag is-mdr">{row.resistance}</span>}
            <time>{dateText(row.collectedAt)}</time>
          </button>
        })}</div> : <div className="inline-empty">{loading ? tr('Φόρτωση…', 'Loading…') : tr('Κανένα θετικό δείγμα τις τελευταίες 12 εβδομάδες.', 'No positive samples in the last 12 weeks.')}</div>}
      </Card>}
      {announcementsCard(footer)}
    </div>
  </div>
}
