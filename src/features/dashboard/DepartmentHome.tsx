import './departmentHome.css'
import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { Card, CardHeader } from '../../design-system/Card'
import { HandHygieneChart, PositivesChart } from './DepartmentHomeCharts'
import { DepartmentFocusCard } from './DepartmentHomeFocus'
import { OrganismsCard } from './DepartmentHomeOrganisms'
import { useDepartmentFocus } from './departmentFocusService'
import { SERIES_COLORS } from '../analysis/AnalysisCharts'
import { periodRangeLabel, type DepartmentHomeOverview, type DepartmentHomeWindow } from './departmentHomeModel'
import { PeriodTiles, numberText, percentText, periodTiles } from './homePeriodTiles'

// «Το τμήμα μου» of the Department Manager (owner, 20/11/2026, final layout): the department's figures; then the
// positive samples per week and «Μικρόβια του τμήματος» (numbers only); then «Για μένα σήμερα», the department's
// register (without one, hand hygiene per month; without that either, its incidents) and the announcements with
// the department's 30 days. One screen at 1440×900 without the page scrolling; the to-do list and the announcements
// scroll, the organisms, register and incidents cards never do (a fixed number of lines).
// The figures, the charts, the organisms and the register follow the period chosen in the page's header, each with
// its change from the comparison period; «Για μένα σήμερα» and the announcements (with their footer) do not.
// A figure, chart or card of a module the hospital has locked is not shown.
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

export function DepartmentHome({ overview, window, status, language, moduleEnabled, canOpen, onOpen, todoCard, announcementsCard }: DepartmentHomeProps) {
  const en = language === 'en'
  const tr = (el: string, enText: string) => en ? enText : el
  const o = overview
  const tiles = periodTiles(o, { language, moduleEnabled })
  const target = o?.handHygieneTarget ?? 80
  const loading = status === 'loading' && !o
  const periodText = periodRangeLabel(window.period, language)
  const compareText = periodRangeLabel(window.compare, language)
  // «Χωρίς σύγκριση»: no changes, no comparison line, no legend for it (owner, 20/11/2026).
  const comparing = window.choice !== 'none'
  // «Τελευταία θετικά» gave way to the department's register, or its incidents (owner, 20/11/2026).
  // The incidents only as the last choice: no register and the hand hygiene chart locked.
  const focus = useDepartmentFocus(moduleEnabled('quality') && !moduleEnabled('prevention'), window.period, window.compare, window.choice)
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
    <PeriodTiles tiles={tiles} loading={loading} comparing={comparing} language={language} compareText={compareText} canOpen={canOpen} onOpen={to => onOpen(to)}/>
    {moduleEnabled('laboratory') && <div className="dephome-charts">
      <Card className="dashboard-card dephome-chart-card">
        <CardHeader title={positivesTitle} subtitle={periodText} actions={<>
          <span className="dephome-legend"><span><i style={{ background: SERIES_COLORS[1] }}/>MDR/XDR</span><span><i style={{ background: SERIES_COLORS[0] }}/>{tr('Λοιπά', 'Other')}</span>{comparing && <span><i className="dephome-legend-compare"/>{compareText}</span>}</span>
          {chartAction('/laboratory')}
        </>}/>
        <PositivesChart rows={o?.positivesSeries || []} compareRows={comparing ? o?.positivesCompareSeries || [] : []} bucket={window.bucket} from={window.period.from} en={en} label={positivesTitle} compareLabel={compareText}/>
      </Card>
      <OrganismsCard overview={o} loading={loading} language={language} action={chartAction('/laboratory')} periodText={periodText} comparing={comparing}/>
    </div>}
    <div className="dephome-cards">
      {todoCard}
      {focus.kind !== 'register' && focus.kind !== 'loading' && moduleEnabled('prevention') ? <Card className="dashboard-card dephome-chart-card">
        <CardHeader title={tr('Υγιεινή χεριών ανά μήνα', 'Hand hygiene per month')} subtitle={`${tr('στόχος', 'target')} ${target}%`} actions={<>
          {comparing && <span className="dephome-legend"><span><i className="dephome-legend-compare"/>{compareText}</span></span>}
          {chartAction('/prevention?tab=handHygiene')}
        </>}/>
        <HandHygieneChart rows={o?.monthlyHandHygiene || []} compareRows={comparing ? o?.monthlyHandHygieneCompare || [] : []} target={target} en={en} label={tr('Υγιεινή χεριών ανά μήνα', 'Hand hygiene per month')} compareLabel={compareText}/>
      </Card> : <DepartmentFocusCard focus={focus} language={language} canOpen={canOpen} onOpen={onOpen}/>}
      {announcementsCard(footer)}
    </div>
  </div>
}
