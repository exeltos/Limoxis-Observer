import './departmentHome.css'
import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { Card, CardHeader } from '../../design-system/Card'
import { HandHygieneChart, PositivesChart } from './DepartmentHomeCharts'
import { DepartmentFocusCard } from './DepartmentHomeFocus'
import { OrganismsCard } from './DepartmentHomeOrganisms'
import { useDepartmentFocus } from './departmentFocusService'
import { SERIES_COLORS } from '../analysis/AnalysisCharts'
import { delta, periodRangeLabel, type DepartmentHomeOverview, type DepartmentHomeWindow } from './departmentHomeModel'

// «Το τμήμα μου» of the Department Manager (owner, 20/11/2026, final layout): the department's figures; then the
// positive samples per week and «Μικρόβια του τμήματος» (numbers only); then «Για μένα σήμερα», the department's
// register (without one, hand hygiene per month; without that either, its incidents) and the announcements with
// the department's 30 days. One screen at 1440×900 without the page scrolling; the to-do list and the announcements
// scroll, the organisms, register and incidents cards never do (a fixed number of lines).
// The figures, the charts, the organisms and the register follow the period chosen in the page's header, each with
// its change from the comparison period; «Για μένα σήμερα» and the announcements (with their footer) do not.
// A figure, chart or card of a module the hospital has locked is not shown.
type Tone = 'danger' | 'warning' | 'success' | null
// The change of a tile: its value and whether more is worse (positives, episodes, late controls) or better (hand hygiene).
interface Change { value: number | null, worseUp: boolean, percentOf?: number | null, points?: boolean }
interface Tile { key: string, label: string, value: string, detail: string, tone: Tone, to: string, change: Change }
export interface DepartmentHomeProps {
  overview: DepartmentHomeOverview | null
  window: DepartmentHomeWindow
  status: 'loading' | 'ready' | 'error'
  language: string
  moduleEnabled: (module: string) => boolean
  canOpen: (to: string) => boolean
  onOpen: (to: string, options?: { state?: unknown }) => void
  todoCard: ReactNode
  announcementsCard: (footer: ReactNode) => ReactNode
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
const numberText = (value: number | null | undefined, en: boolean) => value == null ? '—' : new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(value)
const percentText = (value: number | null | undefined, en: boolean) => value == null ? '—' : `${new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 0 }).format(Math.round(value))}%`

export function DepartmentHome({ overview, window, status, language, moduleEnabled, canOpen, onOpen, todoCard, announcementsCard }: DepartmentHomeProps) {
  const en = language === 'en'
  const tr = (el: string, enText: string) => en ? enText : el
  const o = overview
  const c = o?.compare
  const n = (value: number | null | undefined) => Number(value) || 0
  const sum = (a: number | null | undefined, b: number | null | undefined) => a == null && b == null ? null : n(a) + n(b)
  const tiles: Tile[] = []
  // No inpatients tile (owner, 20/11/2026): the figures that need attention only, for the period chosen.
  if (moduleEnabled('laboratory')) tiles.push({
    key: 'positives', label: tr('Θετικά δείγματα', 'Positive samples'), value: numberText(o?.positives, en), tone: n(o?.positivesMdr) > 0 ? 'danger' : null, to: '/laboratory',
    detail: `${n(o?.positivesMdr)} MDR/XDR · ${tr(`${n(o?.positivesAwaiting)} προς έλεγχο`, `${n(o?.positivesAwaiting)} to review`)}`,
    change: { value: delta(o?.positives, c?.positives), worseUp: true, percentOf: c?.positives },
  })
  if (moduleEnabled('surveillance')) tiles.push({
    key: 'surveillance', label: tr('Νέα επεισόδια / απομονώσεις', 'New episodes / isolations'), value: `${numberText(o?.newSurveillance, en)} / ${numberText(o?.newIsolation, en)}`, tone: null, to: '/surveillance?tab=episodes',
    detail: en ? plural(n(o?.reassessmentsDueToday), 'reassessment today', 'reassessments today') : plural(n(o?.reassessmentsDueToday), 'επανεκτίμηση σήμερα', 'επανεκτιμήσεις σήμερα'),
    change: { value: delta(sum(o?.newSurveillance, o?.newIsolation), sum(c?.newSurveillance, c?.newIsolation)), worseUp: true },
  })
  const target = o?.handHygieneTarget ?? 80
  if (moduleEnabled('prevention')) tiles.push({
    key: 'handHygiene', label: tr('Υγιεινή χεριών', 'Hand hygiene'), value: percentText(o?.handHygienePct, en), to: '/prevention?tab=handHygiene',
    tone: o?.handHygienePct == null ? null : o.handHygienePct >= target ? 'success' : 'warning',
    detail: `${tr('στόχος', 'target')} ${target}% · ${en ? plural(n(o?.handHygieneObservations), 'observation', 'observations') : plural(n(o?.handHygieneObservations), 'παρατήρηση', 'παρατηρήσεις')}`,
    change: { value: delta(o?.handHygienePct == null ? null : Math.round(o.handHygienePct), c?.handHygienePct == null ? null : Math.round(c.handHygienePct)), worseUp: false, points: true },
  })
  // «Έλεγχοι εκτός χρόνου»: entries of the period done outside their window and assignments fallen overdue in it (not
  // done yet); the small line keeps today's overdue controls.
  if (moduleEnabled('controls')) tiles.push({
    key: 'controls', label: tr('Έλεγχοι εκτός χρόνου', 'Controls out of time'), value: numberText(o?.lateControls, en), tone: n(o?.lateControls) > 0 ? 'danger' : null, to: '/controls',
    detail: tr(`σήμερα: ${n(o?.overdueControls)} ${n(o?.overdueControls) === 1 ? 'εκπρόθεσμος' : 'εκπρόθεσμοι'}`, `today: ${n(o?.overdueControls)} overdue`),
    change: { value: delta(o?.lateControls, c?.lateControls), worseUp: true },
  })
  const loading = status === 'loading' && !o
  const periodText = periodRangeLabel(window.period, language)
  const compareText = periodRangeLabel(window.compare, language)
  // «Τελευταία θετικά» gave way to the department's register, or its incidents (owner, 20/11/2026).
  // The incidents only as the last choice: no register and the hand hygiene chart locked.
  const focus = useDepartmentFocus(moduleEnabled('quality') && !moduleEnabled('prevention'), window.period, window.compare, window.choice)
  const open = (to: string) => { if (canOpen(to)) onOpen(to) }
  const positivesTitle = window.bucket === 'month' ? tr('Θετικά δείγματα ανά μήνα', 'Positive samples per month') : tr('Θετικά δείγματα ανά εβδομάδα', 'Positive samples per week')
  const chartAction = (to: string) => canOpen(to) && <button type="button" className="text-button" onClick={() => onOpen(to)}>{tr('Άνοιγμα', 'Open')}<ArrowRight size={14}/></button>

  // «Το τμήμα (30 ημ.)»: falls / pressure ulcers, training completion and influenza vaccination (each when its module is on);
  // no falls / pressure ulcers while the incidents card shows them.
  const footerRows: Array<[string, string]> = []
  if (moduleEnabled('quality') && focus.kind !== 'incidents') footerRows.push([tr('Πτώσεις / κατακλίσεις', 'Falls / pressure ulcers'), `${numberText(o?.falls30, en)} / ${numberText(o?.pressureUlcers30, en)}`])
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
        <span className="dephome-tile-figure"><strong className="dephome-tile-value">{loading ? '…' : tile.value}</strong>{!loading && <TileChange change={tile.change} en={en} compareText={compareText}/>}</span>
        <small className="dephome-tile-detail">{loading ? '' : tile.detail}</small>
      </button>)}
    </div>
    {moduleEnabled('laboratory') && <div className="dephome-charts">
      <Card className="dashboard-card dephome-chart-card">
        <CardHeader title={positivesTitle} subtitle={periodText} actions={<>
          <span className="dephome-legend"><span><i style={{ background: SERIES_COLORS[1] }}/>MDR/XDR</span><span><i style={{ background: SERIES_COLORS[0] }}/>{tr('Λοιπά', 'Other')}</span><span><i className="dephome-legend-compare"/>{compareText}</span></span>
          {chartAction('/laboratory')}
        </>}/>
        <PositivesChart rows={o?.positivesSeries || []} compareRows={o?.positivesCompareSeries || []} bucket={window.bucket} from={window.period.from} en={en} label={positivesTitle} compareLabel={compareText}/>
      </Card>
      <OrganismsCard overview={o} loading={loading} language={language} action={chartAction('/laboratory')} periodText={periodText}/>
    </div>}
    <div className="dephome-cards">
      {todoCard}
      {focus.kind !== 'register' && focus.kind !== 'loading' && moduleEnabled('prevention') ? <Card className="dashboard-card dephome-chart-card">
        <CardHeader title={tr('Υγιεινή χεριών ανά μήνα', 'Hand hygiene per month')} subtitle={`${tr('στόχος', 'target')} ${target}%`} actions={<>
          <span className="dephome-legend"><span><i className="dephome-legend-compare"/>{compareText}</span></span>
          {chartAction('/prevention?tab=handHygiene')}
        </>}/>
        <HandHygieneChart rows={o?.monthlyHandHygiene || []} compareRows={o?.monthlyHandHygieneCompare || []} target={target} en={en} label={tr('Υγιεινή χεριών ανά μήνα', 'Hand hygiene per month')} compareLabel={compareText}/>
      </Card> : <DepartmentFocusCard focus={focus} language={language} canOpen={canOpen} onOpen={onOpen}/>}
      {announcementsCard(footer)}
    </div>
  </div>
}

// «▲ +3 (+38%)», «▼ −1», «▲ +5 μον.»: the change from the comparison period, red when worse and green when better.
function TileChange({ change, en, compareText }: { change: Change, en: boolean, compareText: string }) {
  const { value, worseUp, percentOf, points } = change
  if (value == null) return null
  const format = (number: number) => new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(number)
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±'
  const share = percentOf && value ? ` (${sign}${format(Math.round(Math.abs(value) / percentOf * 100))}%)` : ''
  const tone = value === 0 ? '' : (value > 0) === worseUp ? ' is-worse' : ' is-better'
  return <span className={`dephome-tile-change${tone}`} title={en ? `Compared with ${compareText}` : `Σε σύγκριση με ${compareText}`}>
    {value > 0 ? '▲ ' : value < 0 ? '▼ ' : ''}{sign}{format(Math.abs(value))}{points ? (en ? ' pts' : ' μον.') : ''}{share}
  </span>
}
