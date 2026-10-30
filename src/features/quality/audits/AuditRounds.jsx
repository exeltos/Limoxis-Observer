import { useMemo } from 'react'
import { CalendarRange, Plus } from 'lucide-react'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { Button } from '../../../design-system/Button'

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

// The year's two audit rounds as cards: when each runs, how many departments, and the departments by day.
export function AuditRounds({ audits = [], year, language, onRound = null }) {
  const en = language === 'en'
  const rounds = useMemo(() => [0, 1].map(half => ({ half, list: roundOfHalf(audits, year, half) })), [audits, year])
  const dayLabel = iso => new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`))
  return <section className="audit-rounds" aria-label={L(en, 'Κύκλοι επιθεώρησης', 'Audit rounds')}>
    <p className="audit-rounds-hint"><CalendarRange size={15} aria-hidden="true" />{L(en, 'Κάθε τμήμα επιθεωρείται δύο φορές τον χρόνο, σε κύκλο τριών ημερών.', 'Every department is audited twice a year, in a round of three days.')}</p>
    <div className="audit-rounds-grid">
      {rounds.map(({ half, list }) => {
        const title = half === 0 ? L(en, `Κύκλος Άνοιξης ${year}`, `Spring round ${year}`) : L(en, `Κύκλος Φθινοπώρου ${year}`, `Autumn round ${year}`)
        if (!list.length) return <article key={half} className="audit-round is-empty">
          <header><strong>{title}</strong></header>
          <p>{L(en, 'Δεν έχει οριστεί κύκλος.', 'No round set.')}</p>
          {onRound && <Button variant="secondary" onClick={onRound}><Plus size={14} />{L(en, 'Προγραμματισμός κύκλου', 'Plan a round')}</Button>}
        </article>
        const days = [...new Set(list.map(audit => String(audit.plannedDate)))].sort()
        const done = list.filter(audit => audit.status === 'completed').length
        const complete = done === list.length
        return <article key={half} className={`audit-round${complete ? ' is-done' : ''}`}>
          <header>
            <strong>{title}</strong>
            <StatusBadge tone={complete ? 'success' : 'info'}>{complete ? L(en, 'Ολοκληρώθηκε', 'Completed') : L(en, 'Προγραμματισμένος', 'Planned')}</StatusBadge>
          </header>
          <p className="audit-round-count"><b>{list.length}</b> {L(en, 'τμήματα', 'departments')} · {days.length} {L(en, days.length === 1 ? 'ημέρα' : 'ημέρες', days.length === 1 ? 'day' : 'days')}{!complete && done > 0 ? ` · ${done} ${L(en, 'ολοκληρώθηκαν', 'done')}` : ''}</p>
          <ul>{days.map(day => { const here = list.filter(audit => String(audit.plannedDate) === day); return <li key={day}>
            <span>{dayLabel(day)}</span><b>{here.length}</b><small>{here.slice(0, 4).map(audit => (en ? audit.departmentEn : audit.department) || audit.department).join(' · ')}{here.length > 4 ? ` · +${here.length - 4}` : ''}</small>
          </li> })}</ul>
        </article>
      })}
    </div>
  </section>
}
