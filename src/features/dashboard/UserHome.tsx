import './departmentHome.css'
import './userHome.css'
import type { ReactNode } from 'react'
import { ArrowRight, CalendarDays, GraduationCap } from 'lucide-react'
import { Card, CardHeader } from '../../design-system/Card'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { calendarItemLine } from '../calendar/calendarView'
import type { CalendarGroup } from '../calendar/calendarView'
import type { OwnTraining, OwnTrainingStatus } from './userHomeModel'

// The home of the Department User and the Link Nurse (owner, 20/11/2026; the Department Manager keeps «Το τμήμα μου»):
// four figures above three columns — «Για μένα σήμερα» with «Οι εκπαιδεύσεις μου» under it, the department's next 7 days
// (the user's own items tagged «δικό μου») and the announcements. One screen at 1440×900 and on a tablet without the page
// scrolling: the lists scroll inside their cards. «Σε απομόνωση τώρα» is a number only, never who.
export interface UserHomeFigures {
  overdue: number | null
  today: number | null
  certificates: { count: number, expired: number } | null
  isolation: number | null | undefined
}
export interface UserHomeProps {
  language: string
  figures: UserHomeFigures
  trainingOn: boolean
  isolationOn: boolean
  trainings: OwnTraining[] | null
  week: Array<{ group: CalendarGroup, own: boolean }> | null
  canOpen: (to: string) => boolean
  onOpen: (to: string) => void
  todoCard: ReactNode
  announcementsCard: ReactNode
}
type Tone = 'danger' | 'warning' | null
interface Tile { key: string, label: string, value: number | null | undefined, detail: string, tone: Tone, to: string }

const shortDate = (key: string, en: boolean) => key ? new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { day: 'numeric', month: 'numeric', year: '2-digit' }).format(new Date(`${key}T12:00:00`)) : ''
const STATUS_TONE: Record<OwnTrainingStatus, string> = { overdue: 'danger', expired: 'danger', due: 'info', expiring: 'warning', completed: 'success' }

// A record's page (/training/TRN-001) is open to whoever may open its section (/training).
const sectionPath = (path: string) => `/${String(path || '').split('?')[0].split('/').filter(Boolean)[0] || ''}`

export function UserHome({ language, figures, trainingOn, isolationOn, trainings, week, canOpen, onOpen, todoCard, announcementsCard }: UserHomeProps) {
  const en = language === 'en'
  const tr = (el: string, enText: string) => en ? enText : el
  const tiles: Tile[] = [
    { key: 'overdue', label: tr('Εκπρόθεσμα του τμήματος', 'Department overdue'), value: figures.overdue, detail: tr('έλεγχοι και καλλιέργειες', 'controls and cultures'), tone: Number(figures.overdue) > 0 ? 'danger' : null, to: '/my-department/calendar?view=list' },
    { key: 'today', label: tr('Για σήμερα', 'For today'), value: figures.today, detail: tr('έλεγχοι, δείγματα, επανεκτιμήσεις', 'controls, samples, reassessments'), tone: null, to: '/controls?due=today' },
  ]
  if (trainingOn) {
    const expired = figures.certificates?.expired || 0
    tiles.push({ key: 'certificates', label: tr('Τα πιστοποιητικά μου', 'My certificates'), value: figures.certificates?.count, tone: Number(figures.certificates?.count) > 0 ? 'warning' : null, to: '/my-profile',
      detail: expired ? (en ? `${expired} expired · others within 90 days` : `${expired} ${expired === 1 ? 'έληξε' : 'έληξαν'} · τα άλλα σε 90 ημέρες`) : tr('λήγουν σε 90 ημέρες', 'expire within 90 days') })
  }
  if (isolationOn) tiles.push({ key: 'isolation', label: tr('Σε απομόνωση τώρα', 'In isolation now'), value: figures.isolation, detail: tr('ασθενείς του τμήματος', 'patients of the department'), tone: null, to: '/surveillance' })
  const dayLabel = (date: string) => new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { weekday: 'short', day: 'numeric', month: 'numeric' }).format(new Date(`${date}T12:00:00`))
  const statusText = (row: OwnTraining) => ({
    overdue: tr('Εκπρόθεσμη', 'Overdue'), expired: tr('Έληξε', 'Expired'), due: tr('Σε εξέλιξη', 'In progress'),
    expiring: tr('Λήγει', 'Expires'), completed: tr('Ολοκληρώθηκε', 'Completed'),
  })[row.status]
  const dateText = (row: OwnTraining) => !row.date ? '' : row.status === 'completed' ? `${tr('στις', 'on')} ${shortDate(row.date, en)}` : row.status === 'expired' || row.status === 'expiring' ? `${tr('πιστοποιητικό', 'certificate')} ${shortDate(row.date, en)}` : `${tr('έως', 'by')} ${shortDate(row.date, en)}`

  return <div className="userhome">
    <div className="dephome-tiles" style={{ '--dephome-tiles': tiles.length }}>
      {tiles.map(tile => <button type="button" key={tile.key} className={`dephome-tile${tile.tone ? ` is-${tile.tone}` : ''}`} disabled={!canOpen(tile.to)} onClick={() => onOpen(tile.to)} aria-busy={tile.value === undefined || undefined}>
        <span className="dephome-tile-label">{tile.label}</span>
        <span className="dephome-tile-figure"><strong className="dephome-tile-value">{tile.value === undefined ? '…' : tile.value === null ? '—' : tile.value}</strong></span>
        <small className="dephome-tile-detail">{tile.detail}</small>
      </button>)}
    </div>
    <div className="userhome-columns">
      <div className={`userhome-stack${trainingOn ? '' : ' is-single'}`}>
        {todoCard}
        {trainingOn && <Card className="dashboard-card userhome-trainings-card">
          <CardHeader icon={GraduationCap} title={tr('Οι εκπαιδεύσεις μου', 'My trainings')} actions={canOpen('/my-profile') && <button type="button" className="text-button" onClick={() => onOpen('/my-profile')}>{tr('Όλες', 'All')}<ArrowRight size={14}/></button>}/>
          {trainings === null ? <TableSkeleton/> : trainings.length ? <ul className="userhome-trainings">{trainings.map(row => <li key={row.id}><button type="button" disabled={!canOpen(sectionPath(row.path))} onClick={() => onOpen(row.path)}>
            <span className="userhome-training-copy"><strong title={row.title}>{row.title}</strong><small>{dateText(row)}</small></span>
            <span className={`status-badge ${STATUS_TONE[row.status]}`}>{statusText(row)}</span>
          </button></li>)}</ul> : <div className="inline-empty">{tr('Δεν σας έχει ανατεθεί εκπαίδευση.', 'No training is assigned to you.')}</div>}
        </Card>}
      </div>
      <Card className="dashboard-card userhome-week-card">
        <CardHeader icon={CalendarDays} title={tr('Επόμενες 7 ημέρες στο τμήμα', 'Next 7 days in the department')} subtitle={tr('Έλεγχοι, καλλιέργειες, εκπαιδεύσεις, συναντήσεις και λήξεις.', 'Controls, cultures, trainings, meetings and expiries.')}/>
        {week === null ? <TableSkeleton/> : week.length ? <div className="dashboard-week-list">{week.map(({ group, own }) => <button type="button" key={group.key} disabled={!group.first.path} onClick={() => group.first.path && onOpen(group.first.path)}>
          <span className="dashboard-week-day">{dayLabel(group.date)}</span>
          <span className="dashboard-week-copy"><strong title={group.first.title}>{calendarItemLine(group.first, language)}{group.items.length > 1 ? ` · ${group.items.length}` : ''}</strong><small>{own && <em className="userhome-own">{tr('δικό μου', 'mine')}</em>}{group.first.detail}</small></span>
        </button>)}</div> : <div className="inline-empty">{tr('Τίποτα προγραμματισμένο για τις επόμενες 7 ημέρες.', 'Nothing planned for the next 7 days.')}</div>}
        {canOpen('/my-department/calendar') && <button type="button" className="text-button userhome-calendar-link" onClick={() => onOpen('/my-department/calendar')}>{tr('Ημερολόγιο τμήματος', 'Department calendar')}<ArrowRight size={14}/></button>}
      </Card>
      {announcementsCard}
    </div>
  </div>
}
