import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Grid3x3 } from 'lucide-react'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { IconButton } from '../../design-system/IconButton'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { environmentalMethodLabel } from '../laboratory/laboratoryCloudService'
import { isOutsideLimit } from '../laboratory/environmentalLimit'
import { CULTURE_GROUPS, cultureItems, cultureYear, offProgramme, samplingRounds } from './culturePlan'
import { loadCultureControls, loadCultureSamples } from './cultureProgrammeService'
import './cultureProgramme.css'

// Surveillance › Culture programme (infection control lead, hospital administrator): the environmental cultures of the
// programme month by month and across the year — done (from the laboratory's environmental samples), missed, due, planned —
// and, on a culture, its results at once.
const MONTHS = {
  el: ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}
const STATE_LABEL = {
  done: ['Έγινε', 'Done'], missed: ['Χάθηκε', 'Missed'], due: ['Οφείλεται', 'Due'], planned: ['Προγραμματισμένη', 'Planned'],
}
const fmtDay = (day, en) => new Date(`${day}T12:00:00`).toLocaleDateString(en ? 'en-GB' : 'el-GR', { day: 'numeric', month: 'numeric' })
// The name of a culture's row: its department, or its group (staff, air, network water).
const rowName = (item, en) => (item.group ? CULTURE_GROUPS[item.group].label[en ? 1 : 0] : item.department)
const everyText = (every, en) => (every === 1 ? (en ? 'monthly' : 'κάθε μήνα') : every === 12 ? (en ? 'yearly' : 'κάθε χρόνο') : en ? `every ${every} months` : `κάθε ${every} μήνες`)

export function CultureProgrammePage() {
  const { language, t } = useLanguage()
  const en = language === 'en'
  const { tenant } = useTenant()
  const today = useMemo(() => new Date(), [])
  const [view, setView] = useState('year')
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(null)

  useEffect(() => {
    let live = true
    setData(null); setError('')
    Promise.all([loadCultureControls(tenant?.id), loadCultureSamples(tenant?.id, `${year - 1}-01-01`)])
      .then(([controls, samples]) => { if (live) setData({ items: cultureItems(controls), rounds: samplingRounds(samples) }) })
      .catch(reason => { if (live) setError(reason?.message || 'error') })
    return () => { live = false }
  }, [tenant?.id, year])

  const lines = useMemo(() => (data ? data.items.map(item => ({ item, months: cultureYear(item, data.rounds, year, today, data.rounds[0]?.day) })) : []), [data, year, today])
  const extra = useMemo(() => (data ? offProgramme(data.items, data.rounds, year) : []), [data, year])
  const counts = useMemo(() => {
    const cells = lines.flatMap(line => line.months.filter(cell => cell.month <= today.getMonth() || year < today.getFullYear()))
    return { done: cells.filter(cell => cell.state === 'done').length, missed: cells.filter(cell => cell.state === 'missed').length, due: cells.filter(cell => cell.state === 'due').length }
  }, [lines, today, year])

  const step = delta => {
    if (view === 'year') { setYear(value => value + delta); return }
    const next = month + delta
    if (next < 0) { setMonth(11); setYear(value => value - 1) } else if (next > 11) { setMonth(0); setYear(value => value + 1) } else setMonth(next)
  }
  const label = view === 'year' ? String(year) : `${MONTHS[en ? 'en' : 'el'][month]} ${year}`

  return <section className="culture-programme">
    <div className="culture-programme-bar">
      <CanonicalTabs className="culture-programme-tabs" value={view} onChange={setView} ariaLabel={en ? 'Culture programme view' : 'Προβολή προγράμματος καλλιεργειών'} items={[{ value: 'month', label: en ? 'Month' : 'Μήνας', icon: CalendarDays }, { value: 'year', label: en ? 'Year' : 'Έτος', icon: Grid3x3 }]} />
      <div className="culture-programme-period">
        <IconButton label={en ? 'Previous' : 'Προηγούμενο'} onClick={() => step(-1)}><ChevronLeft size={16} /></IconButton>
        <strong>{label}</strong>
        <IconButton label={en ? 'Next' : 'Επόμενο'} onClick={() => step(1)}><ChevronRight size={16} /></IconButton>
      </div>
    </div>
    {data && <p className="culture-programme-figures"><span><b>{counts.done}</b> {en ? 'done' : 'έγιναν'}</span><span className={counts.missed ? 'is-bad' : ''}><b>{counts.missed}</b> {en ? 'missed' : 'χάθηκαν'}</span><span className={counts.due ? 'is-warn' : ''}><b>{counts.due}</b> {en ? 'due this month' : 'οφείλονται αυτόν τον μήνα'}</span><span><b>{data.items.length}</b> {en ? 'cultures in the programme' : 'καλλιέργειες στο πρόγραμμα'}</span></p>}
    {error && <div className="inline-empty">{en ? 'The programme could not be read.' : 'Το πρόγραμμα δεν διαβάστηκε.'}</div>}
    {!data && !error && <TableSkeleton rows={8} />}
    {data && !data.items.length && <div className="inline-empty">{en ? 'No environmental culture in the controls programme.' : 'Δεν υπάρχει περιβαλλοντική καλλιέργεια στο πρόγραμμα ελέγχων.'}</div>}
    {data && data.items.length > 0 && (view === 'year'
      ? <YearTable lines={lines} extra={extra} year={year} en={en} onOpen={setOpen} />
      : <MonthCalendar lines={lines} extra={extra} year={year} month={month} en={en} onOpen={setOpen} />)}
    {open && <ResultsDialog open={open} en={en} t={t} onClose={() => setOpen(null)} />}
  </section>
}

function YearTable({ lines, extra, year, en, onOpen }) {
  const months = MONTHS[en ? 'en' : 'el']
  return <div className="scroll-table culture-year-wrap">
    <table className="data-table culture-year">
      <thead><tr><th>{en ? 'Culture' : 'Καλλιέργεια'}</th>{months.map(name => <th key={name} className="culture-month">{name}</th>)}</tr></thead>
      <tbody>
        {lines.map(({ item, months: cells }, index) => [item.group && !lines[index - 1]?.item.group && <tr key="groups-head" className="culture-extra-head"><th colSpan={13}>{en ? 'By category' : 'Ανά κατηγορία'}</th></tr>, <tr key={item.id}>
          <td><strong>{rowName(item, en)}</strong><small>{item.title} · {everyText(item.every, en)}</small></td>
          {cells.map(cell => <td key={cell.month} className={`culture-cell is-${cell.state || 'none'}`}>
            {cell.state === 'done'
              ? cell.rounds.map(round => <button key={round.key} type="button" className={`culture-round${round.outside ? ' is-outside' : ''}`} title={`${round.department} · ${fmtDay(round.day, en)}`} onClick={() => onOpen({ item, round })}>{fmtDay(round.day, en)}{item.group && <small> {round.department}</small>}</button>)
              : cell.state ? <span title={STATE_LABEL[cell.state][en ? 1 : 0]}>{cell.state === 'missed' ? '✗' : cell.state === 'due' ? '!' : '◦'}</span> : null}
          </td>)}
        </tr>])}
        {extra.length > 0 && <tr className="culture-extra-head"><th colSpan={13}>{en ? 'Out of programme' : 'Εκτός προγράμματος'}</th></tr>}
        {groupByDepartment(extra).map(([department, rounds]) => <tr key={`extra-${department}`}>
          <td><strong>{department}</strong><small>{en ? 'no culture of the programme' : 'χωρίς καλλιέργεια στο πρόγραμμα'}</small></td>
          {Array.from({ length: 12 }, (_, index) => <td key={index} className="culture-cell">{rounds.filter(round => Number(round.day.slice(5, 7)) - 1 === index && round.day.startsWith(String(year))).map(round => <button key={round.key} type="button" className={`culture-round${round.outside ? ' is-outside' : ''}`} onClick={() => onOpen({ item: null, round })}>{fmtDay(round.day, en)}</button>)}</td>)}
        </tr>)}
      </tbody>
    </table>
    <p className="culture-legend"><span className="culture-round">1/3</span> {en ? 'done (red: a result out of limit)' : 'έγινε (κόκκινο: αποτέλεσμα εκτός ορίου)'} · ✗ {en ? 'missed' : 'χάθηκε'} · ! {en ? 'due this month' : 'οφείλεται αυτόν τον μήνα'} · ◦ {en ? 'planned' : 'προγραμματισμένη'}</p>
  </div>
}

const groupByDepartment = rounds => [...rounds.reduce((map, round) => map.set(round.department, [...(map.get(round.department) || []), round]), new Map())]

function MonthCalendar({ lines, extra, year, month, en, onOpen }) {
  const first = new Date(year, month, 1), days = new Date(year, month + 1, 0).getDate()
  const offset = (first.getDay() + 6) % 7
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const rounds = [...lines.flatMap(line => line.months[month].rounds.map(round => ({ round, item: line.item }))), ...extra.filter(round => round.day.startsWith(prefix)).map(round => ({ round, item: null }))]
  const pending = lines.filter(line => ['due', 'planned', 'missed'].includes(line.months[month].state))
  const weekdays = en ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ', 'Κυρ']
  return <div className="culture-month-view">
    {pending.length > 0 && <div className="culture-pending"><strong>{en ? 'Not yet done this month' : 'Δεν έχουν γίνει ακόμα αυτόν τον μήνα'}:</strong> {pending.map(line => <span key={line.item.id} className={`culture-chip is-${line.months[month].state}`}>{rowName(line.item, en)} · {line.item.title}</span>)}</div>}
    <div className="culture-calendar" role="grid">
      {weekdays.map(day => <div key={day} className="culture-weekday">{day}</div>)}
      {Array.from({ length: offset }, (_, index) => <div key={`empty-${index}`} className="culture-day is-empty" />)}
      {Array.from({ length: days }, (_, index) => {
        const day = `${prefix}-${String(index + 1).padStart(2, '0')}`
        const onDay = rounds.filter(entry => entry.round.day === day)
        return <div key={day} className="culture-day"><span className="culture-day-number">{index + 1}</span>
          {onDay.map(({ round, item }) => <button key={round.key} type="button" className={`culture-chip is-done${round.outside ? ' is-outside' : ''}`} onClick={() => onOpen({ item, round })}>{round.department} · {round.samples.length}</button>)}
        </div>
      })}
    </div>
  </div>
}

// The results of one sampling round at once: every sample with its plate, method, organism and colonies against the limit.
function ResultsDialog({ open, en, t, onClose }) {
  const navigate = useNavigate()
  const { item, round } = open
  const rows = round.samples.flatMap(sample => {
    const results = sample.microbiologyResults?.length ? sample.microbiologyResults : [null]
    return results.map((result, index) => ({ key: `${sample.id}-${index}`, sample, result }))
  })
  return <ObserverDialog width="wide" eyebrow={en ? 'Culture results' : 'Αποτελέσματα καλλιέργειας'} title={`${round.department} · ${new Date(`${round.day}T12:00:00`).toLocaleDateString(en ? 'en-GB' : 'el-GR')}`} subtitle={item ? item.title : (en ? 'Out of programme' : 'Εκτός προγράμματος')} onClose={onClose}>
    <div className="scroll-table">
      <table className="data-table culture-results">
        <thead><tr><th>{en ? 'Point' : 'Σημείο λήψης'}</th><th>{en ? 'Plate' : 'Τρυβλίο'}</th><th>{en ? 'Method' : 'Μέθοδος'}</th><th>{en ? 'Organism' : 'Μικροοργανισμός'}</th><th className="register-num">{en ? 'Colonies / limit' : 'Αποικίες / όριο'}</th><th>{en ? 'Result' : 'Αποτέλεσμα'}</th></tr></thead>
        <tbody>{rows.map(({ key, sample, result }) => {
          const outside = result ? isOutsideLimit(result) : false
          const pending = !result || result.resultStatus === 'draft'
          return <tr key={key} className="registry-row-clickable" tabIndex={0} onClick={() => navigate(`/laboratory/${encodeURIComponent(sample.id)}`)}>
            <td><strong>{sample.point || sample.location || sample.source || '—'}</strong>{sample.environmentalPosition && <small>{en ? 'spot' : 'θέση'} {sample.environmentalPosition}</small>}</td>
            <td>{sample.environmentalPlate || '—'}</td>
            <td>{environmentalMethodLabel(sample.environmentalMethod, t) || '—'}</td>
            <td>{result?.organism || (pending ? (en ? 'Pending' : 'Σε εξέλιξη') : (en ? 'No growth' : 'Χωρίς ανάπτυξη'))}</td>
            <td className="register-num">{result?.cfuCount ?? '—'}{result?.cfuLimit != null ? ` / ${result.cfuLimit}` : ''}</td>
            <td>{pending ? '—' : <span className={`status-badge ${outside ? 'danger' : 'active'}`}>{outside ? (en ? 'Out of limit' : 'Εκτός ορίου') : (en ? 'Within limit' : 'Εντός ορίου')}</span>}</td>
          </tr>
        })}</tbody>
      </table>
    </div>
  </ObserverDialog>
}
