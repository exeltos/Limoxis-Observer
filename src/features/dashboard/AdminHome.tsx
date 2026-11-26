import './departmentHome.css'
import './adminHome.css'
import { useState } from 'react'
import { ArrowRight, Bell, CalendarDays } from 'lucide-react'
import { Card, CardHeader } from '../../design-system/Card'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { SERIES_COLORS } from '../analysis/AnalysisCharts'
import { PositivesChart } from './DepartmentHomeCharts'
import { OrganismsCard } from './DepartmentHomeOrganisms'
import { PeriodTiles, periodTiles, type PeriodTile } from './homePeriodTiles'
import { periodRangeLabel, type DepartmentHomeOverview, type DepartmentHomeWindow } from './departmentHomeModel'
import { DepartmentMapCard } from './AdminHomeDepartmentMap'
import { HomeAlertsCard } from './AdminHomeAlerts'
import { departmentMap, homeAlerts, type ClusterLike, type HomeAlert, type HospitalMatrix, type MapColumn } from './hospitalMatrixModel'
import type { AdminTile, DepartmentAttention, WeekDay } from './adminHomeModel'

// The home of the hospital administrator, and of the Platform Owner inside a hospital (owner, 24/11/2026, «ναι σε όλα»):
// the whole hospital for the period chosen in the page's header, with its change from the comparison period, in one
// screen at 1440×900 and 1024×768 without the page scrolling —
// five figures (the four of «Το τμήμα μου» for every department, and the overdue corrective actions);
// «Χάρτης τμημάτων» (owner, 24/11/2026, 2nd part: one line per department, one coloured cell per subject, those that need
// attention first) beside «Επισημάνσεις» (possible clusters, hand hygiene under target, then the decisions); then the positive samples per week, «Μικρόβια του νοσοκομείου» and «Η εβδομάδα» (only the days
// that have something, each opening the calendar on that day) with the announcements in one line under it.
export interface DepartmentColumns { controls: boolean, capa: boolean, certificates: boolean }
export interface AdminDecision { key: string, title: string, count: number, to: string, urgent: boolean }
export interface AdminHomeProps {
  language: string
  // The hospital's figures for the period (department_home_period_overview for all its departments).
  overview: DepartmentHomeOverview | null
  window: DepartmentHomeWindow
  status: 'loading' | 'ready' | 'error'
  moduleEnabled: (module: string) => boolean
  // The figures of the home that have no period (the overdue corrective actions).
  tiles: AdminTile[]
  // Today's overdue corrective actions and expired staff certificates by department (the calendar's).
  departments: DepartmentAttention[] | null
  departmentColumns: DepartmentColumns
  // The period's figures by department (hospital_department_period_matrix) and the active possible clusters.
  matrix: HospitalMatrix | null
  matrixStatus: 'loading' | 'ready' | 'error'
  // The departments hidden on the Controls screen: «—» in the map's controls columns.
  hiddenControls?: ReadonlySet<string> | null
  clusters: ClusterLike[] | null
  // Laboratory and surveillance: only for whoever reads clinical data (not the Quality Manager).
  clinical: boolean
  // null while the counts load; note: a line when some could not be read.
  decisions: AdminDecision[] | null
  decisionsNote?: string | null
  week: WeekDay[] | null
  calendarOn: boolean
  // items: the latest announcements, read or not, with their message («Άνοιγμα» shows them again after they are read).
  announcements: { unread: number, latest: string | null, items?: { id: string, title?: string, message?: string, createdAt?: string }[], onMarkAll: () => void, onOpen: () => void }
  canOpen: (to: string) => boolean
  onOpen: (to: string) => void
  onDecision: (item: AdminDecision) => void
}

export function AdminHome({ language, overview, window, status, moduleEnabled, tiles, departments, departmentColumns, matrix, matrixStatus, hiddenControls = null, clusters, clinical, decisions, decisionsNote, week, calendarOn, announcements, canOpen, onOpen, onDecision }: AdminHomeProps) {
  const [announcementsOpen, setAnnouncementsOpen] = useState(false)
  const en = language === 'en'
  const tr = (el: string, enText: string) => en ? enText : el
  const number = (value: number) => new Intl.NumberFormat(en ? 'en-GB' : 'el-GR').format(value)
  const link = (to: string, label: string) => canOpen(to) && <button type="button" className="text-button" onClick={() => onOpen(to)}>{label}<ArrowRight size={14}/></button>
  // The Quality Manager sees no laboratory or surveillance figures.
  const shownModule = (module: string) => moduleEnabled(module) && (clinical || (module !== 'laboratory' && module !== 'surveillance'))

  // The five figures: the period's four for the whole hospital, then the overdue corrective actions (today, no period).
  const loading = status === 'loading' && !overview
  const comparing = window.choice !== 'none'
  const periodText = periodRangeLabel(window.period, language)
  const compareText = periodRangeLabel(window.compare, language)
  const figures: PeriodTile[] = [
    ...periodTiles(overview, { language, moduleEnabled: shownModule }),
    ...tiles.map(tile => ({ key: tile.key, label: tile.label, value: tile.value === undefined ? '…' : number(tile.value), detail: tile.value === undefined ? '' : tile.detail, tone: tile.tone, to: tile.to, change: null })),
  ]
  const labOn = shownModule('laboratory')
  const positivesTitle = window.bucket === 'month' ? tr('Θετικά δείγματα ανά μήνα', 'Positive samples per month') : tr('Θετικά δείγματα ανά εβδομάδα', 'Positive samples per week')
  // «Η εβδομάδα»: today and the days after it that have something.
  const busyDays = (week || []).filter(day => day.today || day.chips.length > 0)

  const columns: MapColumn[] = [
    ...(shownModule('laboratory') ? ['positives' as const] : []),
    ...(shownModule('surveillance') ? ['episodes' as const] : []),
    ...(shownModule('prevention') ? ['handHygiene' as const] : []),
    ...(shownModule('controls') ? ['overdueControls' as const, 'lateControls' as const] : []),
    ...(departmentColumns.capa ? ['capa' as const] : []),
    ...(departmentColumns.certificates ? ['certificates' as const] : []),
  ]
  const mapRows = departmentMap(matrix, departments, { columns, comparing, language, hiddenControls })
  const alerts = homeAlerts({ clusters: clinical ? clusters : [], matrix: shownModule('prevention') ? matrix : null, decisions, canOpen, language })
  const openAlert = (alert: HomeAlert) => {
    const decision = (decisions || []).find(item => item.key === alert.key)
    if (decision) onDecision(decision)
    else if (alert.to) onOpen(alert.to)
  }

  return <div className="adminhome">
    {status === 'error' && <div className="inline-empty dephome-error" role="status">{tr('Τα στοιχεία της περιόδου δεν φορτώθηκαν. Δοκιμάστε ξανά σε λίγο.', 'The figures of the period did not load. Please try again shortly.')}</div>}
    {figures.length > 0 && <PeriodTiles tiles={figures} loading={loading} comparing={comparing} language={language} compareText={compareText} canOpen={canOpen} onOpen={onOpen}/>}
    <div className="adminhome-columns">
      {columns.length > 0 && <DepartmentMapCard rows={mapRows} columns={columns} loading={matrixStatus === 'loading' && !matrix} error={matrixStatus === 'error'} language={language} canOpen={canOpen} onOpen={onOpen}/>}
      <HomeAlertsCard alerts={alerts} loading={decisions === null} note={decisionsNote} language={language} onAlert={openAlert}/>
    </div>
    <div className="adminhome-lower">
      {labOn && <Card className="dashboard-card dephome-chart-card">
        <CardHeader title={positivesTitle} subtitle={tr(`όλο το νοσοκομείο · ${periodText}`, `whole hospital · ${periodText}`)} actions={link('/laboratory', tr('Άνοιγμα', 'Open'))}/>
        <span className="dephome-legend adminhome-chart-legend"><span><i style={{ background: SERIES_COLORS[1] }}/>MDR/XDR</span><span><i style={{ background: SERIES_COLORS[0] }}/>{tr('Λοιπά', 'Other')}</span>{comparing && <span><i className="dephome-legend-compare"/>{compareText}</span>}</span>
        <PositivesChart rows={overview?.positivesSeries || []} compareRows={comparing ? overview?.positivesCompareSeries || [] : []} bucket={window.bucket} from={window.period.from} en={en} label={positivesTitle} compareLabel={compareText}/>
      </Card>}
      {labOn && <OrganismsCard overview={overview} loading={loading} language={language} action={link('/laboratory', tr('Άνοιγμα', 'Open'))} periodText={periodText} comparing={comparing} title={tr('Μικρόβια του νοσοκομείου', 'Hospital organisms')}/>}
      <Card className="dashboard-card adminhome-week" id="dashboard-announcements" tabIndex={-1}>
        {calendarOn ? <>
          <CardHeader icon={CalendarDays} title={tr('Η εβδομάδα', 'The week')} subtitle={tr('σήμερα και οι επόμενες ημέρες', 'today and the days ahead')} actions={link('/calendar', tr('Ημερολόγιο', 'Calendar'))}/>
          {week === null ? <TableSkeleton/> : <ol className="adminhome-week-days">
            {busyDays.map(day => <li key={day.date}><button type="button" className={day.today ? 'is-today' : undefined} disabled={!canOpen('/calendar')} onClick={() => onOpen(day.path)} title={`${day.label}: ${day.chips.map(chip => chip.text).join(' · ') || tr('τίποτα προγραμματισμένο', 'nothing planned')}`}>
              <span className="adminhome-week-label">{day.label}</span>
              <span className="adminhome-week-chips">{day.chips.length ? day.chips.map(chip => <span key={chip.key} className={`adminhome-chip is-${chip.kind}${chip.named ? ' is-named' : ''}`}>{chip.text}</span>) : <small>{tr('τίποτα προγραμματισμένο', 'nothing planned')}</small>}</span>
            </button></li>)}
          </ol>}
        </> : <CardHeader icon={Bell} title={tr('Ανακοινώσεις', 'Announcements')}/>}
        <div className="adminhome-announcement-line">
          <button type="button" className="adminhome-announcement-open" onClick={() => announcements.items?.length ? setAnnouncementsOpen(true) : announcements.onOpen()}>
            <Bell size={14} aria-hidden="true"/>
            <span>{announcements.unread ? <strong>{announcements.unread === 1 ? tr('1 μη αναγνωσμένη ανακοίνωση', '1 unread announcement') : tr(`${announcements.unread} μη αναγνωσμένες ανακοινώσεις`, `${announcements.unread} unread announcements`)}</strong> : tr('Όλες οι ανακοινώσεις διαβασμένες', 'All announcements read')}{announcements.latest && <>{' · '}«{announcements.latest}»</>}</span>
          </button>
          {announcements.unread > 0 && <button type="button" className="text-button" onClick={announcements.onMarkAll}>{tr('Σήμανση όλων', 'Mark all read')}</button>}
        </div>
      </Card>
    </div>
    {announcementsOpen && <ObserverDialog title={tr('Ανακοινώσεις', 'Announcements')} onClose={() => setAnnouncementsOpen(false)}>
      <ul className="adminhome-announcement-list">{(announcements.items || []).map(item => <li key={item.id}><strong>{item.title}</strong>{item.message && <p>{item.message}</p>}</li>)}</ul>
    </ObserverDialog>}
  </div>
}
