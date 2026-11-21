import './departmentHome.css'
import './adminHome.css'
import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, Bell, Building2, CalendarDays, ListChecks, Megaphone } from 'lucide-react'
import { Card, CardHeader } from '../../design-system/Card'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import type { AdminTile, DepartmentAttention, WeekDay } from './adminHomeModel'

// The home of the hospital administrator, and of the Platform Owner inside a hospital (owner, 21/11/2026, «ναι σε όλα»):
// five figures, then two columns in one screen at 1440×900 and 1024×768 without the page scrolling —
// on the left «Τμήματα με τις περισσότερες εκκρεμότητες» (one stacked bar per department, as many as fit, up to eight)
// with «Χρειάζονται και αυτά απόφαση» under it (only what the figures do not already show); on the right «Η εβδομάδα»
// (seven lines, today and the next six days, each opening the calendar on that day) and the one-line announcements.
export interface DepartmentColumns { controls: boolean, capa: boolean, certificates: boolean }
export interface AdminDecision { key: string, title: string, count: number, to: string, urgent: boolean }
export interface AdminHomeProps {
  language: string
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

export function AdminHome({ language, tiles, departments, departmentColumns, decisions, decisionsNote, week, calendarOn, announcements, canOpen, onOpen, onDecision }: AdminHomeProps) {
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
  const shownDepartments = (departments || []).slice(0, Math.min(8, barRows))
  const most = Math.max(1, ...shownDepartments.map(row => row.total))
  const link = (to: string, label: string) => canOpen(to) && <button type="button" className="text-button" onClick={() => onOpen(to)}>{label}<ArrowRight size={14}/></button>
  const departmentTarget = (row: DepartmentAttention) => {
    const largest = parts.map(([key]) => key).sort((a, b) => row[b] - row[a])[0]
    return largest && canOpen(PART_SCREEN[largest]) ? PART_SCREEN[largest] : canOpen('/controls') ? '/controls' : null
  }
  const others = <>
    {decisions === null ? <TableSkeleton/> : decisions.length ? <ul className="adminhome-decisions">{decisions.map(item => <li key={item.key}>
      <button type="button" onClick={() => onDecision(item)} title={`${item.title}: ${number(item.count)}`}>
        <span className={`adminhome-decision-dot${item.urgent ? ' is-danger' : ''}`} aria-hidden="true"/>
        <span className="adminhome-decision-title">{item.title}</span>
        <b className={item.urgent ? 'is-danger' : undefined}>{number(item.count)}</b>
      </button>
    </li>)}</ul> : <p className="adminhome-decisions-empty">{tr('Τίποτα άλλο σε εκκρεμότητα.', 'Nothing else pending.')}</p>}
    {decisionsNote && <p className="adminhome-decisions-empty" role="status">{decisionsNote}</p>}
  </>

  return <div className="adminhome">
    {tiles.length > 0 && <div className="dephome-tiles" style={{ '--dephome-tiles': tiles.length }}>
      {tiles.map(tile => <button type="button" key={tile.key} className={`dephome-tile${tile.tone ? ` is-${tile.tone}` : ''}`} onClick={() => onOpen(tile.to)} aria-busy={tile.value === undefined || undefined}>
        <span className="dephome-tile-label">{tile.label}</span>
        <span className="dephome-tile-figure"><strong className="dephome-tile-value">{tile.value === undefined ? '…' : number(tile.value)}</strong></span>
        <small className="dephome-tile-detail">{tile.value === undefined ? '' : tile.detail}</small>
      </button>)}
    </div>}
    <div className="adminhome-columns">
      {parts.length > 0 ? <Card className="dashboard-card adminhome-attention">
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
        </div>
        {shownDepartments.length > 0 && <ul className="adminhome-legend" aria-hidden="true">{parts.map(([key, name]) => <li key={key}><i className={`is-${key}`}/>{name}</li>)}</ul>}
        <div className="adminhome-others">
          <h3>{tr('Χρειάζονται και αυτά απόφαση', 'Also need a decision')}</h3>
          {others}
        </div>
      </Card> : <Card className="dashboard-card adminhome-attention">
        <CardHeader icon={ListChecks} title={tr('Χρειάζονται απόφαση', 'Need a decision')}/>
        <div className="adminhome-others">{others}</div>
      </Card>}
      <div className="adminhome-stack">
        {calendarOn ? <Card className="dashboard-card adminhome-week">
          <CardHeader icon={CalendarDays} title={tr('Η εβδομάδα', 'The week')} subtitle={tr('τι έχει κάθε ημέρα', 'what each day holds')} actions={link('/calendar', tr('Ημερολόγιο', 'Calendar'))}/>
          {week === null ? <TableSkeleton/> : <ol className="adminhome-week-days">
            {week.map(day => <li key={day.date}><button type="button" className={day.today ? 'is-today' : undefined} disabled={!canOpen('/calendar')} onClick={() => onOpen(day.path)} title={`${day.label}: ${day.chips.map(chip => chip.text).join(' · ') || tr('τίποτα προγραμματισμένο', 'nothing planned')}`}>
              <span className="adminhome-week-label">{day.label}</span>
              <span className="adminhome-week-chips">{day.chips.length ? day.chips.map(chip => <span key={chip.key} className={`adminhome-chip is-${chip.kind}${chip.named ? ' is-named' : ''}`}>{chip.text}</span>) : <small>{tr('τίποτα προγραμματισμένο', 'nothing planned')}</small>}</span>
            </button></li>)}
          </ol>}
        </Card> : null}
        <Card className="dashboard-card adminhome-announcements" id="dashboard-announcements" tabIndex={-1}>
          <CardHeader icon={Megaphone} title={tr('Ανακοινώσεις', 'Announcements')} actions={<>
            {announcements.unread > 0 && <button type="button" className="text-button" onClick={announcements.onMarkAll}><Bell size={14}/>{tr('Σήμανση όλων', 'Mark all read')}</button>}
            <button type="button" className="text-button" onClick={() => announcements.items?.length ? setAnnouncementsOpen(true) : announcements.onOpen()}>{tr('Άνοιγμα', 'Open')}<ArrowRight size={14}/></button>
          </>}/>
          <p className="adminhome-announcement-line">
            {announcements.latest ? <><strong>{announcements.unread ? tr(`${announcements.unread} μη αναγνωσμένες`, `${announcements.unread} unread`) : tr('Όλα διαβασμένα', 'All caught up')}</strong>{' · '}{tr('τελευταία:', 'latest:')} «{announcements.latest}»</> : announcements.unread ? <strong>{tr(`${announcements.unread} μη αναγνωσμένες`, `${announcements.unread} unread`)}</strong> : tr('Καμία νέα ανακοίνωση.', 'No new announcements.')}
          </p>
        </Card>
      </div>
    </div>
    {announcementsOpen && <ObserverDialog title={tr('Ανακοινώσεις', 'Announcements')} onClose={() => setAnnouncementsOpen(false)}>
      <ul className="adminhome-announcement-list">{(announcements.items || []).map(item => <li key={item.id}><strong>{item.title}</strong>{item.message && <p>{item.message}</p>}</li>)}</ul>
    </ObserverDialog>}
  </div>
}
