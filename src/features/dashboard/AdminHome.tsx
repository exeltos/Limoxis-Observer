import './departmentHome.css'
import './adminHome.css'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Bell, Building2, CalendarDays, LayoutGrid, Megaphone } from 'lucide-react'
import { Card, CardHeader } from '../../design-system/Card'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import type { CalendarGroup } from '../calendar/calendarView'
import { adminWeekLine, type AdminTile, type DepartmentAttention, type moduleStatusRows } from './adminHomeModel'

// The home of the hospital administrator, and of the Platform Owner inside a hospital (owner, 21/11/2026, «ναι σε όλα»):
// five figures, then three columns in one screen at 1440×900 and 1024×768 without the page scrolling —
// «Απαιτούν απόφαση» with «Τμήματα που θέλουν προσοχή» under it, «Οι ενότητες με μια ματιά», and the coming 7 days
// (one line per item, the same control of many departments once) with a one-line announcements card under them.
// The week shows the lines that fit and «+N ακόμη» to the calendar; nothing scrolls but the decision list.
type ModuleRow = ReturnType<typeof moduleStatusRows>[number]
export interface DepartmentColumns { controls: boolean, capa: boolean, certificates: boolean }
export interface AdminHomeProps {
  language: string
  today: string
  tiles: AdminTile[]
  decisionCard: ReactNode
  departments: DepartmentAttention[] | null
  departmentColumns: DepartmentColumns
  modules: ModuleRow[]
  week: CalendarGroup[] | null
  calendarOn: boolean
  // items: the latest announcements, read or not, with their message («Άνοιγμα» shows them again after they are read).
  announcements: { unread: number, latest: string | null, items?: { id: string, title?: string, message?: string, createdAt?: string }[], onMarkAll: () => void, onOpen: () => void }
  canOpen: (to: string) => boolean
  onOpen: (to: string) => void
}

// How many lines of a fixed height fit in the list's box (the box shares the card's height).
const WEEK_ROW = 44
function useFittingRows(rowHeight: number, fallback = 6) {
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

export function AdminHome({ language, today, tiles, decisionCard, departments, departmentColumns, modules, week, calendarOn, announcements, canOpen, onOpen }: AdminHomeProps) {
  const [announcementsOpen, setAnnouncementsOpen] = useState(false)
  const en = language === 'en'
  const tr = (el: string, enText: string) => en ? enText : el
  const number = (value: number) => new Intl.NumberFormat(en ? 'en-GB' : 'el-GR').format(value)
  const [weekRef, weekRows] = useFittingRows(WEEK_ROW)
  const weekList = week || []
  const weekShown = weekList.length > weekRows ? weekList.slice(0, Math.max(0, weekRows - 1)) : weekList
  const weekMore = weekList.length - weekShown.length
  const dayLabel = (date: string) => date === today ? tr('Σήμερα', 'Today') : new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { weekday: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`))
  const columns = ([['controls', tr('Έλεγχοι', 'Controls'), tr('Εκπρόθεσμοι έλεγχοι', 'Overdue controls')], ['capa', tr('Διορθ.', 'CAPA'), tr('Εκπρόθεσμες διορθωτικές ενέργειες', 'Overdue corrective actions')], ['certificates', tr('Πιστ.', 'Cert.'), tr('Ληγμένα πιστοποιητικά προσωπικού', 'Expired staff certificates')]] as const).filter(([key]) => departmentColumns[key])
  const link = (to: string, label: string) => canOpen(to) && <button type="button" className="text-button" onClick={() => onOpen(to)}>{label}<ArrowRight size={14}/></button>

  return <div className="adminhome">
    {tiles.length > 0 && <div className="dephome-tiles" style={{ '--dephome-tiles': tiles.length }}>
      {tiles.map(tile => <button type="button" key={tile.key} className={`dephome-tile${tile.tone ? ` is-${tile.tone}` : ''}`} onClick={() => onOpen(tile.to)} aria-busy={tile.value === undefined || undefined}>
        <span className="dephome-tile-label">{tile.label}</span>
        <span className="dephome-tile-figure"><strong className="dephome-tile-value">{tile.value === undefined ? '…' : number(tile.value)}</strong></span>
        <small className="dephome-tile-detail">{tile.value === undefined ? '' : tile.detail}</small>
      </button>)}
    </div>}
    <div className="adminhome-columns">
      <div className={`adminhome-stack${columns.length ? '' : ' is-single'}`}>
        {decisionCard}
        {columns.length > 0 && <Card className="dashboard-card adminhome-departments">
          <CardHeader icon={Building2} title={tr('Τμήματα που θέλουν προσοχή', 'Departments needing attention')} actions={link('/controls', tr('Όλα', 'All'))}/>
          {departments === null ? <TableSkeleton/> : departments.length ? <table className="adminhome-departments-table">
            <thead><tr><th scope="col">{tr('Τμήμα', 'Department')}</th>{columns.map(([key, short, full]) => <th scope="col" key={key} title={full}><abbr title={full}>{short}</abbr></th>)}</tr></thead>
            <tbody>{departments.map(row => <tr key={row.department}><th scope="row" title={row.department}>{row.department}</th>{columns.map(([key]) => <td key={key} className={row[key] ? 'is-late' : ''}>{row[key]}</td>)}</tr>)}</tbody>
          </table> : <div className="inline-empty">{tr('Κανένα τμήμα με εκπρόθεσμα.', 'No department has overdue items.')}</div>}
        </Card>}
      </div>
      <Card className="dashboard-card adminhome-modules">
        <CardHeader icon={LayoutGrid} title={tr('Οι ενότητες με μια ματιά', 'Modules at a glance')}/>
        {modules.length ? <ul className="adminhome-module-list">{modules.map(row => {
          const figures = row.values.filter(item => item.value != null)
          return <li key={row.module}><button type="button" disabled={!canOpen(row.to)} onClick={() => onOpen(row.to)}>
            <span className={`adminhome-module-dot is-${row.status}`} aria-hidden="true"/>
            <strong>{row.title}</strong>
            <span className="adminhome-module-figures">{figures.length ? figures.map((item, index) => <span key={item.key} className={item.tone ? `is-${item.tone}` : undefined}>{index > 0 && <i aria-hidden="true"> · </i>}<b>{number(Number(item.value))}</b> {item.label}</span>) : '—'}</span>
          </button></li>
        })}</ul> : <div className="inline-empty">{tr('Δεν υπάρχουν ενεργές ενότητες.', 'No module is enabled.')}</div>}
      </Card>
      <div className="adminhome-stack is-week">
        {calendarOn ? <Card className="dashboard-card adminhome-week">
          <CardHeader icon={CalendarDays} title={tr('Επόμενες 7 ημέρες', 'Next 7 days')} actions={link('/calendar', tr('Ημερολόγιο', 'Calendar'))}/>
          <div className="adminhome-week-list" ref={weekRef}>
            {week === null ? <TableSkeleton/> : weekList.length ? <>
              {weekShown.map(group => { const line = adminWeekLine(group, language); return <button type="button" key={group.key} disabled={!group.first.path} onClick={() => group.first.path && onOpen(group.first.path)} title={line.text}>
                <span className="dashboard-week-day">{dayLabel(group.date)}</span>
                <strong>{line.what}</strong>
                {line.where && <small>{line.where}</small>}
              </button> })}
              {weekMore > 0 && <button type="button" className="adminhome-week-more" onClick={() => onOpen('/calendar')}>{en ? `+${weekMore} more` : `+${weekMore} ακόμη`}<ArrowRight size={14}/></button>}
            </> : <div className="inline-empty">{tr('Τίποτα προγραμματισμένο για τις επόμενες 7 ημέρες.', 'Nothing planned for the next 7 days.')}</div>}
          </div>
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
