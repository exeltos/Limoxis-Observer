import { useMemo, useState } from 'react'
import { CalendarRange, ChevronDown, Plus } from 'lucide-react'

const L = (en, el, english) => (en ? english : el)
const DAY = 86400000
const ACTIVE = audit => audit.status !== 'cancelled' && audit.lifecycleStatus !== 'voided' && audit.plannedDate && !audit.plannedMonthOnly && audit.department

// The audit round of one half of the year: the densest stretch of three working days (five calendar days)
// holding at least three department audits. Returns the audits of that stretch, or none.
export function roundOfHalf(audits, year, half) {
  const from = half === 0 ? `${year}-01-01` : `${year}-07-01`
  const to = half === 0 ? `${year}-06-30` : `${year}-12-31`
  const list = audits.filter(ACTIVE).filter(audit => String(audit.plannedDate) >= from && String(audit.plannedDate) <= to).sort((a, b) => String(a.plannedDate).localeCompare(String(b.plannedDate)))
  let best = []
  for (const audit of list) {
    const start = Date.parse(`${audit.plannedDate}T12:00:00Z`)
    const within = list.filter(item => { const at = Date.parse(`${item.plannedDate}T12:00:00Z`); return at >= start && at <= start + 4 * DAY })
    if (within.length > best.length) best = within
  }
  return best.length >= 3 ? best : []
}

// The year's two audit rounds on one slim line: when each runs and how many departments. A click on a
// round opens the departments by day under the line; an empty half offers to plan a round.
export function AuditRounds({ audits = [], year, language, onRound = null }) {
  const en = language === 'en'
  const [open, setOpen] = useState(null)
  const rounds = useMemo(() => [0, 1].map(half => ({ half, list: roundOfHalf(audits, year, half) })), [audits, year])
  const locale = en ? 'en-GB' : 'el-GR'
  const dayLabel = iso => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`))
  const range = days => {
    const first = new Date(`${days[0]}T12:00:00Z`), last = new Date(`${days[days.length - 1]}T12:00:00Z`)
    const month = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })
    return days.length === 1 ? `${first.getUTCDate()} ${month.format(first)}` : `${first.getUTCDate()}–${last.getUTCDate()} ${month.format(last)}`
  }
  const shown = rounds.find(item => item.half === open && item.list.length)
  const days = shown ? [...new Set(shown.list.map(audit => String(audit.plannedDate)))].sort() : []
  return <div className="audit-rounds" role="group" aria-label={L(en, 'Κύκλοι επιθεώρησης', 'Audit rounds')}>
    <div className="audit-rounds-line">
      <span className="audit-rounds-label" title={L(en, 'Κάθε τμήμα επιθεωρείται δύο φορές τον χρόνο, σε κύκλο τριών ημερών.', 'Every department is audited twice a year, in a round of three days.')}><CalendarRange size={15} aria-hidden="true" />{L(en, 'Κύκλοι', 'Rounds')}</span>
      {rounds.map(({ half, list }) => {
        const name = half === 0 ? L(en, 'Άνοιξη', 'Spring') : L(en, 'Φθινόπωρο', 'Autumn')
        if (!list.length) return <span key={half} className="audit-round-chip is-empty">
          <b>{name} {year}</b><span>{L(en, 'δεν έχει οριστεί', 'not set')}</span>
          {onRound && <button type="button" onClick={onRound}><Plus size={13} aria-hidden="true" />{L(en, 'Προγραμματισμός', 'Plan')}</button>}
        </span>
        const done = list.every(audit => audit.status === 'completed')
        const dates = [...new Set(list.map(audit => String(audit.plannedDate)))].sort()
        return <button key={half} type="button" className={`audit-round-chip${done ? ' is-done' : ''}${open === half ? ' is-open' : ''}`} aria-expanded={open === half} onClick={() => setOpen(open === half ? null : half)}>
          <b>{name} {year}</b><span>{range(dates)} · {list.length} {L(en, 'τμήματα', 'departments')}</span>
          <em>{done ? L(en, 'Ολοκληρώθηκε', 'Completed') : L(en, 'Προγραμματισμένος', 'Planned')}</em><ChevronDown size={14} aria-hidden="true" />
        </button>
      })}
    </div>
    {shown && <ul className="audit-round-days">{days.map(day => { const here = shown.list.filter(audit => String(audit.plannedDate) === day); return <li key={day}>
      <span>{dayLabel(day)}</span><b>{here.length}</b><small>{here.slice(0, 8).map(audit => (en ? audit.departmentEn : audit.department) || audit.department).join(' · ')}{here.length > 8 ? ` · +${here.length - 8}` : ''}</small>
    </li> })}</ul>}
  </div>
}
