import './departmentHome.css'
import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { Card, CardHeader } from '../../design-system/Card'
import { HandHygieneChart, WeeklyPositivesChart } from './DepartmentHomeCharts'
import { DepartmentFocusCard } from './DepartmentHomeFocus'
import { OrganismsCard } from './DepartmentHomeOrganisms'
import { useDepartmentFocus } from './departmentFocusService'
import { SERIES_COLORS } from '../analysis/AnalysisCharts'
import type { DepartmentHomeOverview } from './departmentHomeModel'

// «Το τμήμα μου» of the Department Manager (owner, 20/11/2026, final layout): the department's figures; then the
// positive samples per week and «Μικρόβια του τμήματος» (numbers only); then «Για μένα σήμερα», the department's
// register (without one, hand hygiene per month; without that either, its incidents) and the announcements with
// the department's 30 days. One screen at 1440×900 without the page scrolling; the to-do list and the announcements
// scroll, the organisms, register and incidents cards never do (a fixed number of lines).
// A figure, chart or card of a module the hospital has locked is not shown.
type Tone = 'danger' | 'warning' | 'success' | null
interface Tile { key: string, label: string, value: string, detail: string, tone: Tone, to: string }
export interface DepartmentHomeProps {
  overview: DepartmentHomeOverview | null
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
  // «Τελευταία θετικά» gave way to the department's register, or its incidents (owner, 20/11/2026).
  // The incidents only as the last choice: no register and the hand hygiene chart locked.
  const focus = useDepartmentFocus(moduleEnabled('quality') && !moduleEnabled('prevention'))
  const open = (to: string) => { if (canOpen(to)) onOpen(to) }
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
        <strong className="dephome-tile-value">{loading ? '…' : tile.value}</strong>
        <small className="dephome-tile-detail">{loading ? '' : tile.detail}</small>
      </button>)}
    </div>
    {moduleEnabled('laboratory') && <div className="dephome-charts">
      <Card className="dashboard-card dephome-chart-card">
        <CardHeader title={tr('Θετικά δείγματα ανά εβδομάδα', 'Positive samples per week')} subtitle={tr('τελευταίες 12 εβδομάδες', 'last 12 weeks')} actions={<>
          <span className="dephome-legend"><span><i style={{ background: SERIES_COLORS[1] }}/>MDR/XDR</span><span><i style={{ background: SERIES_COLORS[0] }}/>{tr('Λοιπά', 'Other')}</span></span>
          {chartAction('/laboratory')}
        </>}/>
        <WeeklyPositivesChart rows={o?.weeklyPositives || []} en={en} label={tr('Θετικά δείγματα ανά εβδομάδα', 'Positive samples per week')}/>
      </Card>
      <OrganismsCard overview={o} loading={loading} language={language} action={chartAction('/laboratory')}/>
    </div>}
    <div className="dephome-cards">
      {todoCard}
      {focus.kind !== 'register' && focus.kind !== 'loading' && moduleEnabled('prevention') ? <Card className="dashboard-card dephome-chart-card">
        <CardHeader title={tr('Υγιεινή χεριών ανά μήνα', 'Hand hygiene per month')} subtitle={`${tr('στόχος', 'target')} ${target}%`} actions={chartAction('/prevention?tab=handHygiene')}/>
        <HandHygieneChart rows={o?.monthlyHandHygiene || []} target={target} en={en} label={tr('Υγιεινή χεριών ανά μήνα', 'Hand hygiene per month')}/>
      </Card> : <DepartmentFocusCard focus={focus} language={language} canOpen={canOpen} onOpen={onOpen}/>}
      {announcementsCard(footer)}
    </div>
  </div>
}
