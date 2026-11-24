import './departmentHome.css'
import './adminHome.css'
import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, Bell, Building2, CalendarDays, ListChecks } from 'lucide-react'
import { Card, CardHeader } from '../../design-system/Card'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { SERIES_COLORS } from '../analysis/AnalysisCharts'
import { PositivesChart } from './DepartmentHomeCharts'
import { OrganismsCard } from './DepartmentHomeOrganisms'
import { PeriodTiles, periodTiles, type PeriodTile } from './homePeriodTiles'
import { periodRangeLabel, type DepartmentHomeOverview, type DepartmentHomeWindow } from './departmentHomeModel'
import type { AdminTile, DepartmentAttention, WeekDay } from './adminHomeModel'

// The home of the hospital administrator, and of the Platform Owner inside a hospital (owner, 24/11/2026, «ναι σε όλα»):
// the whole hospital for the period chosen in the page's header, with its change from the comparison period, in one
// screen at 1440×900 and 1024×768 without the page scrolling —
// five figures (the four of «Το τμήμα μου» for every department, and the overdue corrective actions);
// «Τμήματα με τις περισσότερες εκκρεμότητες» (one stacked bar per department, as many as fit, up to eight) beside
// «Χρειάζονται απόφαση»; then the positive samples per week, «Μικρόβια του νοσοκομείου» and «Η εβδομάδα» (only the days
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
  departments: DepartmentAttention[] | null
  departmentColumns: DepartmentColumns
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

// How many lines of a fixed height fit in the list's box (the box shares the card's height).
const BAR_ROW = 28
function useFittingRows(rowHeight: number, fallback = 8) {
  const ref = useRef<HTMLDivElement>(null)
  const [rows, setRows] = useState(fallback)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return undefined
    const measure = () => { if (element.clientHeight > 0) setRows(Math.max(1, Math.floor(element.clientHeight / rowHeight))) }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    return () => observer.disconnect()
  }, [rowHeight])
  return [ref, rows] as const
}

type PartKey = 'controls' | 'capa' | 'certificates'
// The screen of a department's largest part.
const PART_SCREEN: Record<PartKey, string> = { controls: '/controls', capa: '/quality?tab=actions', certificates: '/training' }

export function AdminHome({ language, overview, window, status, moduleEnabled, tiles, departments, departmentColumns, decisions, decisionsNote, week, calendarOn, announcements, canOpen, onOpen, onDecision }: AdminHomeProps) {
  const [announcementsOpen, setAnnouncementsOpen] = useState(false)
  const en = language === 'en'
  const tr = (el: string, enText: string) => en ? enText : el
  const number = (value: number) => new Intl.NumberFormat(en ? 'en-GB' : 'el-GR').format(value)
  const [barsRef, barRows] = useFittingRows(BAR_ROW)
  const parts = ([
    ['controls', tr('Εκπρόθεσμοι έλεγχοι', 'Overdue controls')],
    ['capa', tr('Εκπρόθεσμες διορθωτικές', 'Overdue corrective actions')],
    ['certificates', tr('Ληγμένα πιστοποιητικά προσωπικού', 'Expired staff certificates')],
  ] as const).filter(([key]) => departmentColumns[key])
  // The legend sits right under the last bar, inside the measured box, so it takes one line of it.
  const shownDepartments = (departments || []).slice(0, Math.min(8, Math.max(1, barRows - 1)))
  const most = Math.max(1, ...shownDepartments.map(row => row.total))
  const link = (to: string, label: string) => canOpen(to) && <button type="button" className="text-button" onClick={() => onOpen(to)}>{label}<ArrowRight size={14}/></button>
  const departmentTarget = (row: DepartmentAttention) => {
    const largest = parts.map(([key]) => key).sort((a, b) => row[b] - row[a])[0]
    return largest && canOpen(PART_SCREEN[largest]) ? PART_SCREEN[largest] : canOpen('/controls') ? '/controls' : null
  }

  // The five figures: the period's four for the whole hospital, then the overdue corrective actions (today, no period).
  const loading = status === 'loading' && !overview
  const comparing = window.choice !== 'none'
  const periodText = periodRangeLabel(window.period, language)
  const compareText = periodRangeLabel(window.compare, language)
  const figures: PeriodTile[] = [
    ...periodTiles(overview, { language, moduleEnabled }),
    ...tiles.map(tile => ({ key: tile.key, label: tile.label, value: tile.value === undefined ? '…' : number(tile.value), detail: tile.value === undefined ? '' : tile.detail, tone: tile.tone, to: tile.to, change: null })),
  ]
  const labOn = moduleEnabled('laboratory')
  const positivesTitle = window.bucket === 'month' ? tr('Θετικά δείγματα ανά μήνα', 'Positive samples per month') : tr('Θετικά δείγματα ανά εβδομάδα', 'Positive samples per week')
  // «Η εβδομάδα»: today and the days after it that have something.
  const busyDays = (week || []).filter(day => day.today || day.chips.length > 0)

  const decisionsCard = <Card className="dashboard-card adminhome-decisions-card">
    <CardHeader icon={ListChecks} title={tr('Χρειάζονται απόφαση', 'Need a decision')} subtitle={tr('ό,τι περιμένει απόφαση σήμερα', 'what waits for a decision today')}/>
    {decisions === null ? <TableSkeleton/> : decisions.length ? <ul className="adminhome-decisions">{decisions.map(item => <li key={item.key}>
      <button type="button" onClick={() => onDecision(item)} title={`${item.title}: ${number(item.count)}`}>
        <span className={`adminhome-decision-dot${item.urgent ? ' is-danger' : ''}`} aria-hidden="true"/>
        <span className="adminhome-decision-title">{item.title}</span>
        <b className={item.urgent ? 'is-danger' : undefined}>{number(item.count)}</b>
      </button>
    </li>)}</ul> : <p className="adminhome-decisions-empty">{tr('Τίποτα σε εκκρεμότητα.', 'Nothing pending.')}</p>}
    {decisionsNote && <p className="adminhome-decisions-empty" role="status">{decisionsNote}</p>}
  </Card>

  return <div className="adminhome">
    {status === 'error' && <div className="inline-empty dephome-error" role="status">{tr('Τα στοιχεία της περιόδου δεν φορτώθηκαν. Δοκιμάστε ξανά σε λίγο.', 'The figures of the period did not load. Please try again shortly.')}</div>}
    {figures.length > 0 && <PeriodTiles tiles={figures} loading={loading} comparing={comparing} language={language} compareText={compareText} canOpen={canOpen} onOpen={onOpen}/>}
    <div className="adminhome-columns">
      {parts.length > 0 && <Card className="dashboard-card adminhome-attention">
        <CardHeader icon={Building2} title={tr('Τμήματα με τις περισσότερες εκκρεμότητες', 'Departments with the most pending items')} actions={link('/controls', tr('Όλα τα τμήματα', 'All departments'))}/>
        <div className="adminhome-bars" ref={barsRef}>
          {departments === null ? <TableSkeleton/> : shownDepartments.length ? shownDepartments.map(row => {
            const to = departmentTarget(row)
            const label = `${row.department}: ${parts.map(([key, name]) => `${name} ${row[key]}`).join(', ')}`
            return <button type="button" key={row.department} className="adminhome-bar-row" disabled={!to} onClick={() => to && onOpen(to)} title={label} aria-label={label}>
              <span className="adminhome-bar-name">{row.department}</span>
              <span className="adminhome-bar" aria-hidden="true">{parts.map(([key]) => row[key] > 0 && <i key={key} className={`is-${key}`} style={{ width: `${(row[key] / most) * 100}%` }}/>)}</span>
              <b className="adminhome-bar-total">{number(row.total)}</b>
            </button>
          }) : <div className="inline-empty">{tr('Κανένα τμήμα με εκπρόθεσμα.', 'No department has overdue items.')}</div>}
          {shownDepartments.length > 0 && <ul className="adminhome-legend" aria-hidden="true">{parts.map(([key, name]) => <li key={key}><i className={`is-${key}`}/>{name}</li>)}</ul>}
        </div>
      </Card>}
      {decisionsCard}
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
