import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Grid3x3 } from 'lucide-react'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { IconButton } from '../../design-system/IconButton'
import { ExportMenu } from '../../design-system/ExportMenu'
import { registryMenu } from '../../core/export/registryExports'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { environmentalMethodLabel, resolveEnvironmentalStandard } from '../laboratory/laboratoryCloudService'
import { useLaboratoryRepository } from '../laboratory/hooks/useLaboratoryRepository'
import { isOutsideLimit, resultLimit } from '../laboratory/environmentalLimit'
import { CULTURE_GROUPS, cultureItems, cultureYear, offProgramme, samplingRounds } from './culturePlan'
import { loadCultureControls, loadCultureSamples } from './cultureProgrammeService'
import './cultureProgramme.css'
import type { CultureItem, CultureLine, CultureMonth, CultureResultRow, CultureProgrammeData, EnvironmentalResult, EnvironmentalStandard, OpenRound, SamplingRound } from './environmentTypes'
import type { Handler } from './surveillanceTypes'

// Surveillance › Culture programme (infection control lead, hospital administrator): the environmental cultures of the
// programme month by month and across the year — done (from the laboratory's environmental samples), missed, due, planned —
// and, on a culture, its results at once.
const MONTHS = {
  el: ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}
const STATE_LABEL: Record<string, string[]> = {
  done: ['Έγινε', 'Done'], missed: ['Χάθηκε', 'Missed'], due: ['Οφείλεται', 'Due'], planned: ['Προγραμματισμένη', 'Planned'],
}
const fmtDay = (day: string, en: boolean) => new Date(`${day}T12:00:00`).toLocaleDateString(en ? 'en-GB' : 'el-GR', { day: 'numeric', month: 'numeric' })
// The name of a culture's row: its department, or its group (staff, air, network water).
const rowName = (item: CultureItem, en: boolean) => (item.group ? CULTURE_GROUPS[item.group].label[en ? 1 : 0] : item.department)
const everyText = (every: number, en: boolean) => (every === 1 ? (en ? 'monthly' : 'κάθε μήνα') : every === 12 ? (en ? 'yearly' : 'κάθε χρόνο') : en ? `every ${every} months` : `κάθε ${every} μήνες`)

export function CultureProgrammePage() {
  const { language, t } = useLanguage()
  const en = language === 'en'
  const { tenant } = useTenant()
  const { notify } = useFeedback()
  const today = useMemo(() => new Date(), [])
  const [view, setView] = useState('year')
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [data, setData] = useState<CultureProgrammeData | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<OpenRound | null>(null)

  useEffect(() => {
    let live = true
    setData(null); setError('')
    Promise.all([loadCultureControls(tenant?.id), loadCultureSamples(tenant?.id, `${year - 1}-01-01`)])
      .then(([controls, samples]) => { if (live) setData({ items: cultureItems(controls), rounds: samplingRounds(samples) }) })
      .catch(reason => { if (live) setError(reason?.message || 'error') })
    return () => { live = false }
  }, [tenant?.id, year])

  const lines = useMemo(() => (data ? data.items.map((item: CultureItem): CultureLine => ({ item, months: cultureYear(item, data.rounds, year, today, data.rounds[0]?.day) })) : []), [data, year, today])
  const extra = useMemo(() => (data ? offProgramme(data.items, data.rounds, year) : []), [data, year])
  const counts = useMemo(() => {
    const cells = lines.flatMap((line: CultureLine) => line.months.filter((cell: CultureMonth) => cell.month <= today.getMonth() || year < today.getFullYear()))
    return { done: cells.filter((cell: CultureMonth) => cell.state === 'done').length, missed: cells.filter((cell: CultureMonth) => cell.state === 'missed').length, due: cells.filter((cell: CultureMonth) => cell.state === 'due').length }
  }, [lines, today, year])

  const step = (delta: number) => {
    if (view === 'year') { setYear(value => value + delta); return }
    const next = month + delta
    if (next < 0) { setMonth(11); setYear(value => value - 1) } else if (next > 11) { setMonth(0); setYear(value => value + 1) } else setMonth(next)
  }
  const label = view === 'year' ? String(year) : `${MONTHS[en ? 'en' : 'el'][month]} ${year}`
  // The year as the table shows it, or the month as a list: what is printed or sent to Excel is what is on the screen.
  const exportMenu = registryMenu(() => cultureProgrammeExport({ lines, extra, view, year, month, en }), {
    language, kind: en ? 'Surveillance' : 'Επιτήρηση', title: `${en ? 'Culture programme' : 'Πρόγραμμα καλλιεργειών'} ${label}`,
    onBlocked: () => notify(en ? 'Allow pop-ups to print.' : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'error'),
  })

  return <section className="culture-programme">
    <div className="culture-programme-bar">
      <CanonicalTabs className="culture-programme-tabs" value={view} onChange={setView} ariaLabel={en ? 'Culture programme view' : 'Προβολή προγράμματος καλλιεργειών'} items={[{ value: 'month', label: en ? 'Month' : 'Μήνας', icon: CalendarDays }, { value: 'year', label: en ? 'Year' : 'Έτος', icon: Grid3x3 }]} />
      <div className="culture-programme-period">
        <IconButton label={en ? 'Previous' : 'Προηγούμενο'} onClick={() => step(-1)}><ChevronLeft size={16} /></IconButton>
        <strong>{label}</strong>
        <IconButton label={en ? 'Next' : 'Επόμενο'} onClick={() => step(1)}><ChevronRight size={16} /></IconButton>
      </div>
      <ExportMenu {...exportMenu} disabled={!data?.items.length} />
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

interface CultureProgrammeExportOptions {
  lines: CultureLine[]
  extra: SamplingRound[]
  view: string
  year: number
  month: number
  en: boolean
}
// «5/3» for a done culture (its department too for a category), ✗ missed, ! due, ◦ planned: the same marks as the table, in words for the month list.
function cultureProgrammeExport({ lines, extra, view, year, month, en }: CultureProgrammeExportOptions) {
  const months = MONTHS[en ? 'en' : 'el'], state = (cell: CultureMonth) => (cell.state === 'planned' && view !== 'month' ? (en ? 'Plan' : 'Πλάνο') : STATE_LABEL[cell.state]?.[en ? 1 : 0] || '')
  const done = (item: CultureItem, cell: CultureMonth) => cell.rounds.map((round: SamplingRound) => `${fmtDay(round.day, en)}${item?.group ? ` ${round.department}` : ''}${round.outside ? (en ? ' (out of limit)' : ' (εκτός ορίου)') : ''}`).join(', ')
  if (view === 'month') {
    return {
      name: `${en ? 'culture-programme' : 'programma-kalliergeion'}-${year}-${String(month + 1).padStart(2, '0')}`,
      headers: [en ? 'Culture' : 'Καλλιέργεια', en ? 'Frequency' : 'Συχνότητα', en ? 'Status' : 'Κατάσταση', en ? 'Dates' : 'Ημερομηνίες'],
      rows: [
        ...lines.filter(line => line.months[month].state).map(({ item, months: cells }) => [rowName(item, en), everyText(item.every, en), state(cells[month]), cells[month].state === 'done' ? done(item, cells[month]) : '']),
        ...extra.filter((round: SamplingRound) => round.day.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).map((round: SamplingRound) => [round.department, en ? 'Out of programme' : 'Εκτός προγράμματος', en ? 'Done' : 'Έγινε', fmtDay(round.day, en)]),
      ],
    }
  }
  return {
    name: `${en ? 'culture-programme' : 'programma-kalliergeion'}-${year}`,
    headers: [en ? 'Culture' : 'Καλλιέργεια', en ? 'Frequency' : 'Συχνότητα', ...months],
    rows: [
      ...lines.map(({ item, months: cells }) => [rowName(item, en), everyText(item.every, en), ...cells.map((cell: CultureMonth) => (cell.state === 'done' ? done(item, cell) : cell.state ? state(cell) : ''))]),
      ...groupByDepartment(extra).map(([department, rounds]) => [department, en ? 'Out of programme' : 'Εκτός προγράμματος', ...months.map((_, index) => rounds.filter((round: SamplingRound) => Number(round.day.slice(5, 7)) - 1 === index && round.day.startsWith(String(year))).map((round: SamplingRound) => fmtDay(round.day, en)).join(', '))]),
    ],
  }
}

interface YearTableProps {
  lines: CultureLine[]
  extra: SamplingRound[]
  year: number
  en: boolean
  onOpen: Handler
}
function YearTable({ lines, extra, year, en, onOpen }: YearTableProps) {
  const months = MONTHS[en ? 'en' : 'el']
  return <div className="scroll-table culture-year-wrap">
    <table className="data-table culture-year">
      <thead><tr><th>{en ? 'Culture' : 'Καλλιέργεια'}</th>{months.map(name => <th key={name} className="culture-month">{name}</th>)}</tr></thead>
      <tbody>
        {lines.map(({ item, months: cells }, index) => [item.group && !lines[index - 1]?.item.group && <tr key="groups-head" className="culture-extra-head"><th colSpan={13}>{en ? 'By category' : 'Ανά κατηγορία'}</th></tr>, <tr key={item.id}>
          <td><strong>{rowName(item, en)}</strong><small>{item.title} · {everyText(item.every, en)}</small></td>
          {cells.map((cell: CultureMonth) => <td key={cell.month} className={`culture-cell is-${cell.state || 'none'}`}>
            {cell.state === 'done'
              ? cell.rounds.map((round: SamplingRound) => <button key={round.key} type="button" className={`culture-round${round.outside ? ' is-outside' : ''}`} title={`${round.department} · ${fmtDay(round.day, en)}`} onClick={() => onOpen({ item, round })}>{fmtDay(round.day, en)}{item.group && <small> {round.department}</small>}</button>)
              : cell.state ? <span title={STATE_LABEL[cell.state][en ? 1 : 0]}>{cell.state === 'missed' ? '✗' : cell.state === 'due' ? '!' : '◦'}</span> : null}
          </td>)}
        </tr>])}
        {extra.length > 0 && <tr className="culture-extra-head"><th colSpan={13}>{en ? 'Out of programme' : 'Εκτός προγράμματος'}</th></tr>}
        {groupByDepartment(extra).map(([department, rounds]) => <tr key={`extra-${department}`}>
          <td><strong>{department}</strong><small>{en ? 'no culture of the programme' : 'χωρίς καλλιέργεια στο πρόγραμμα'}</small></td>
          {Array.from({ length: 12 }, (_, index) => <td key={index} className="culture-cell">{rounds.filter((round: SamplingRound) => Number(round.day.slice(5, 7)) - 1 === index && round.day.startsWith(String(year))).map((round: SamplingRound) => <button key={round.key} type="button" className={`culture-round${round.outside ? ' is-outside' : ''}`} onClick={() => onOpen({ item: null, round })}>{fmtDay(round.day, en)}</button>)}</td>)}
        </tr>)}
      </tbody>
    </table>
    <p className="culture-legend"><span className="culture-round">1/3</span> {en ? 'done (red: a result out of limit)' : 'έγινε (κόκκινο: αποτέλεσμα εκτός ορίου)'} · ✗ {en ? 'missed' : 'χάθηκε'} · ! {en ? 'due this month' : 'οφείλεται αυτόν τον μήνα'} · ◦ {en ? 'planned' : 'προγραμματισμένη'}</p>
  </div>
}

const groupByDepartment = (rounds: SamplingRound[]): [string, SamplingRound[]][] => [...rounds.reduce((map: Map<string, SamplingRound[]>, round: SamplingRound) => map.set(round.department, [...(map.get(round.department) || []), round]), new Map())]

interface MonthCalendarProps {
  lines: CultureLine[]
  extra: SamplingRound[]
  year: number
  month: number
  en: boolean
  onOpen: Handler
}
function MonthCalendar({ lines, extra, year, month, en, onOpen }: MonthCalendarProps) {
  const first = new Date(year, month, 1), days = new Date(year, month + 1, 0).getDate()
  const offset = (first.getDay() + 6) % 7
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const rounds = [...lines.flatMap(line => line.months[month].rounds.map((round: SamplingRound) => ({ round, item: line.item }))), ...extra.filter((round: SamplingRound) => round.day.startsWith(prefix)).map((round: SamplingRound) => ({ round, item: null }))]
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

// The results of one sampling round at once: every sample with its plate, method, organism and colonies against the limit
// (the one the result was assessed with, else the protocol's). Positive results first, then by plate and position.
const isGrowth = (result: EnvironmentalResult | null) => Boolean(result && (result.result === 'positive' || result.organism || Number(result.cfuCount) > 0))
interface ResultsDialogProps {
  open: OpenRound
  en: boolean
  t: (key: string) => string
  onClose: Handler
}
function ResultsDialog({ open, en, t, onClose }: ResultsDialogProps) {
  const navigate = useNavigate()
  const repository = useLaboratoryRepository()
  const [standards, setStandards] = useState<EnvironmentalStandard[]>([])
  useEffect(() => { let live = true; Promise.resolve(repository.loadStandards?.()).then(rows => { if (live) setStandards(rows || []) }).catch(() => {}); return () => { live = false } }, [repository])
  const { item, round } = open
  const rows = round.samples.flatMap((sample): CultureResultRow[] => {
    const results = sample.microbiologyResults?.length ? sample.microbiologyResults : [null]
    // The kind of sample as read (a sample without one matches no standard).
    const standard = resolveEnvironmentalStandard(standards, sample.type as string, sample.environmentalMethod)
    return results.map((result: EnvironmentalResult | null, index: number) => ({ key: `${sample.id}-${index}`, sample, result, limit: result ? resultLimit(result, standard) : null }))
  }).sort((a: CultureResultRow, b: CultureResultRow) => Number(isGrowth(b.result)) - Number(isGrowth(a.result)) || String(a.sample.environmentalPlate || '').localeCompare(String(b.sample.environmentalPlate || '')) || Number(a.sample.environmentalPosition || 0) - Number(b.sample.environmentalPosition || 0))
  const positives = rows.filter((row: CultureResultRow) => isGrowth(row.result)).length
  return <ObserverDialog width="wide" eyebrow={en ? 'Culture results' : 'Αποτελέσματα καλλιέργειας'} title={`${round.department} · ${new Date(`${round.day}T12:00:00`).toLocaleDateString(en ? 'en-GB' : 'el-GR')}`} subtitle={`${item ? item.title : (en ? 'Out of programme' : 'Εκτός προγράμματος')} · ${rows.length} ${en ? 'points' : 'σημεία'} · ${positives} ${en ? 'positive' : 'θετικά'}`} onClose={onClose}>
    <div className="scroll-table">
      <table className="data-table culture-results">
        <thead><tr><th>{en ? 'Point' : 'Σημείο λήψης'}</th><th>{en ? 'Plate' : 'Τρυβλίο'}</th><th>{en ? 'Method' : 'Μέθοδος'}</th><th>{en ? 'Organism' : 'Μικροοργανισμός'}</th><th className="culture-cfu">{en ? 'Colonies / limit' : 'Αποικίες / όριο'}</th><th>{en ? 'Result' : 'Αποτέλεσμα'}</th></tr></thead>
        <tbody>{rows.map(({ key, sample, result, limit }: CultureResultRow) => {
          const outside = result ? isOutsideLimit(result, limit == null ? null : { limitCfu: limit }) : false
          const pending = !result || result.resultStatus === 'draft'
          const growth = isGrowth(result)
          return <tr key={key} className="registry-row-clickable" tabIndex={0} onClick={() => navigate(`/laboratory/${encodeURIComponent(sample.id as string)}`)}>
            <td><strong>{sample.point || sample.location || sample.source || '—'}</strong>{sample.environmentalPosition && <small>{en ? 'spot' : 'θέση'} {sample.environmentalPosition}</small>}</td>
            <td>{sample.environmentalPlate || '—'}</td>
            <td>{environmentalMethodLabel(sample.environmentalMethod, t) || '—'}</td>
            <td>{result?.organism || (pending ? (en ? 'Pending' : 'Σε εξέλιξη') : growth ? (en ? 'Growth, not identified' : 'Ανάπτυξη χωρίς ταυτοποίηση') : (en ? 'No growth' : 'Χωρίς ανάπτυξη'))}</td>
            <td className="culture-cfu"><b>{result?.cfuCount ?? (pending ? '—' : 0)}</b><span>/</span><span>{limit ?? (en ? 'no limit' : 'χωρίς όριο')}</span></td>
            <td>{pending ? '—' : <span className="culture-verdict"><span className={`status-badge ${growth ? 'warning' : 'neutral'}`}>{growth ? (en ? 'Positive' : 'Θετικό') : (en ? 'Negative' : 'Αρνητικό')}</span>{limit != null && <span className={`status-badge ${outside ? 'danger' : 'active'}`}>{outside ? (en ? 'Out of limit' : 'Εκτός ορίου') : (en ? 'Within limit' : 'Εντός ορίου')}</span>}</span>}</td>
          </tr>
        })}</tbody>
      </table>
    </div>
  </ObserverDialog>
}
