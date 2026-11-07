import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Info } from 'lucide-react'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { useTableSort } from '../../design-system/useTableSort'
import { downloadCsv } from '../../core/export/csvExport'
import { escapeHtml, printReport } from '../../core/export/reportDocument'
import { formatDay } from '../../core/i18n/formatDay'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { frequencyLabel, linesFrequencyLabel } from './controlScheduling'
import { ChoiceChips } from '../../design-system/ChoiceChips'
import { DEFAULT_PERIOD, isToday, adherenceTone, entryDaysFromHistory, groupAdherenceByDepartment, groupAdherenceLines, missedDays, monthRanges, periodAdherence, periodRange, programmeAdherence } from './controlAdherence'
import { loadControlAdherenceCounts, loadControlEntryTimes } from './controlCloudService'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { ControlMissedDialog } from './ControlMissedDialog'
import './controlAdherence.css'

// What covered the programme (never more than was due), and the entries beyond it on their own.
export const doneOf = (row) => row.counted ?? Math.min(row.performed, row.expected)
export const extraOf = (row) => Math.max(0, row.performed - doneOf(row))
const extraText = (row, en) => (extraOf(row) ? (en ? `+${extraOf(row)} extra` : `+${extraOf(row)} επιπλέον`) : '')

const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

// Done and on-time counts per assignment for a period, counted in the database.
// null until loaded, and in the demo (whose history is complete and counted locally).
export function useAdherenceCounts(organizationId, period, refreshKey, now = null) {
  const [state, setState] = useState({ key: '', counts: null, failed: false })
  const nowIso = now ? new Date(now).toISOString() : ''
  const key = `${organizationId || ''}|${period}|${nowIso}`
  useEffect(() => {
    if (!organizationId) return undefined
    let active = true
    loadControlAdherenceCounts(organizationId, periodRange(period, nowIso ? new Date(nowIso) : new Date()))
      .then((counts) => { if (active) setState({ key, counts, failed: false }) })
      // A failed read is not a period with nothing done: the report says it could not load.
      .catch(() => { if (active) setState({ key, counts: null, failed: true }) })
    return () => { active = false }
  }, [organizationId, period, key, nowIso, refreshKey])
  return state.key === key ? state : { counts: null, failed: false }
}

const isDemoData = () => isDemoDataEnvironment()

// The entries per day of every assignment in the period (null until read, and in the demo).
function useEntryDays(organizationId, period, refreshKey, now) {
  const [state, setState] = useState({ key: '', days: null })
  const nowIso = now ? new Date(now).toISOString() : ''
  const key = `${organizationId || ''}|${period}|${nowIso}`
  useEffect(() => {
    if (!organizationId || isToday(period)) return undefined
    let active = true
    loadControlEntryTimes(organizationId, periodRange(period, nowIso ? new Date(nowIso) : new Date()))
      .then((days) => { if (active) setState({ key, days }) })
      .catch(() => { if (active) setState({ key, days: null }) })
    return () => { active = false }
  }, [organizationId, period, key, nowIso, refreshKey])
  return state.key === key ? state.days : null
}

// The adherence of each month of a 6- or 12-month period: [{ key, rate, expected, counted }].
function useMonthlyTrend(rows, organizationId, period, refreshKey, now) {
  const [state, setState] = useState({ key: '', counts: null })
  const nowIso = now ? new Date(now).toISOString() : ''
  const key = `${organizationId || ''}|${period}|${nowIso}`
  useEffect(() => {
    const months = monthRanges(period, nowIso ? new Date(nowIso) : new Date())
    if (!organizationId || !months.length) return undefined
    let active = true
    Promise.all(months.map((month) => loadControlAdherenceCounts(organizationId, month)))
      .then((counts) => { if (active) setState({ key, counts }) })
      .catch(() => { if (active) setState({ key, counts: [] }) })
    return () => { active = false }
  }, [organizationId, period, key, nowIso, refreshKey])
  const counts = state.key === key ? state.counts : null
  return useMemo(() => {
    const months = monthRanges(period, now || new Date())
    if (!months.length || counts === null || (counts.length && counts.length !== months.length)) return []
    return months.map((month, index) => ({ key: month.key, ...programmeAdherence(rows, month, counts[index] ?? null).totals }))
  }, [rows, period, now, counts])
}

// Programme adherence: due vs done vs on time per control and department.
// The page owns the report (period + downloads) so its Download button sits
// in the page header like every other list; the period is the page's.
// The adherence lines of a period (control × department), each with the
// executions missed and their dates and times: one place for the report and for a
// control's own page. rows: [{ item, departments }].
export function useAdherenceLines(rows, organizationId, period, refreshKey, now = null) {
  const { counts, failed } = useAdherenceCounts(organizationId, period, refreshKey, now)
  const { lines: periodLines, totals: periodTotals } = useMemo(() => (failed ? periodAdherence([], period, new Map(), now || new Date()) : periodAdherence(rows, period, counts, now || new Date())), [rows, period, counts, failed, now])
  const entryDays = useEntryDays(organizationId, period, refreshKey, now)
  // The days each line missed (daily controls) or the weeks (weekly ones).
  const lines = useMemo(() => {
    if (isToday(period)) return periodLines
    const range = periodRange(period, now || new Date())
    return periodLines.map((line) => {
      const assignment = line.item.assignments?.[line.department] || {}
      const days = entryDays === null ? (organizationId && !isDemoData() ? null : entryDaysFromHistory(assignment.history || [])) : entryDays.get(assignment.dbId) || new Map()
      if (!days) return line
      // Daily and weekly controls: «missed» is what the ended days (weeks)
      // missed, the same the dates show; not the nominal count of the period.
      const frequency = line.frequency || line.item.frequency
      const missed = missedDays(frequency, days, range, assignment.createdAt || line.item.createdAt)
      const named = ['daily', 'weekly'].includes(frequency?.kind)
      const count = named ? missed.reduce((sum, miss) => sum + miss.missing, 0) : line.missed
      // A rate rounded up to 100% never sits beside a missed execution.
      return { ...line, missedDays: missed, missed: count, rate: count && line.rate === 100 ? 99 : line.rate }
    })
  }, [periodLines, period, now, entryDays, organizationId])
  const totals = useMemo(() => ({ ...periodTotals, missed: lines.reduce((sum, line) => sum + line.missed, 0) }), [periodTotals, lines])
  return { lines, totals, failed }
}

export function useControlAdherenceReport(rows, tx, language, organizationId, refreshKey, now = null, period = DEFAULT_PERIOD) {
  const en = language === 'en'
  const { notify } = useFeedback()
  const reportRef = useRef(null)
  const { lines, totals, failed } = useAdherenceLines(rows, organizationId, period, refreshKey, now)
  const trend = useMonthlyTrend(rows, organizationId, period, refreshKey, now)
  const title = (item) => (en ? item.titleEn || item.title : item.title)
  const pct = (value) => (value == null ? '—' : `${value}%`)

  const loadFailedText = en ? 'The adherence could not be loaded. Try again.' : 'Δεν ήταν δυνατή η φόρτωση της τήρησης. Δοκιμάστε ξανά.'
  function exportCsv() {
    if (failed) { notify(loadFailedText, 'danger'); return }
    downloadCsv(`${en ? 'control-programme-adherence' : 'tirisi-programmatos-elegxon'}-${period}.csv`,
      [en ? 'Control' : 'Έλεγχος', en ? 'Department' : 'Τμήμα', en ? 'Frequency' : 'Συχνότητα', tx.expected, tx.performed, tx.onTime, tx.missed, tx.adherenceRate],
      [...lines.map((line) => [title(line.item), line.department, frequencyLabel(line.frequency || line.item.frequency, language), line.expected, line.performed, line.onTime, line.missed, pct(line.rate)]),
        [tx.total, '', '', totals.expected, totals.performed, totals.onTime, totals.missed, pct(totals.rate)]])
  }
  // The whole programme (every line, not the page on screen) on the shared document layout.
  function exportPdf(pdf) {
    if (failed) { notify(loadFailedText, 'danger'); return }
    const { from, to } = periodRange(period, now || new Date())
    const numbers = (row) => [{ text: String(row.expected), className: 'rd-num' }, { text: `${doneOf(row)}${extraOf(row) ? ` (${extraText(row, en)})` : ''}`, className: 'rd-num' }, { text: `${row.onTime}${row.late ? ` (${en ? `${row.late} late` : `${row.late} με καθυστέρηση`})` : ''}`, className: 'rd-num' }, { text: String(row.missed), className: row.missed ? 'rd-num rd-bad' : 'rd-num' }, { text: pct(row.rate), className: `rd-num ${{ good: 'rd-good', fair: 'rd-warn', low: 'rd-bad' }[adherenceTone(row.rate)] || ''}` }]
    const tableRows = groupAdherenceLines(lines).flatMap((group) => group.lines.length === 1
      ? [[{ html: `<strong>${escapeHtml(title(group.item))}</strong><small>${escapeHtml(`${group.lines[0].department} · ${group.item.category || ''}`)}</small>` }, linesFrequencyLabel(group.lines, group.item, language), ...numbers(group.lines[0])]]
      : [[{ html: `<strong>${escapeHtml(title(group.item))}</strong><small>${escapeHtml(`${group.item.category || ''} · ${en ? `${group.lines.length} departments` : `${group.lines.length} τμήματα`}`)}</small>` }, linesFrequencyLabel(group.lines, group.item, language), ...numbers(group.totals)],
         ...group.lines.map((line) => [{ text: line.department, className: 'rd-sub-cell' }, '', ...numbers(line)])])
    const ok = printReport({
      language, orientation: 'landscape',
      kind: en ? 'Controls' : 'Έλεγχοι',
      code: tx[`p${period}`],
      title: en ? 'Control programme adherence' : 'Τήρηση προγράμματος ελέγχων',
      meta: [[tx.period, `${tx[`p${period}`]} (${formatDay(dayKey(from), language)} – ${formatDay(dayKey(to), language)})`], [tx.adherence, pct(totals.rate)], [tx.performed, `${doneOf(totals)} / ${totals.expected}${extraOf(totals) ? ` (${extraText(totals, en)})` : ''}`], [tx.onTime, pct(totals.onTimeRate)], [tx.missed, String(totals.missed)], [en ? 'Controls' : 'Έλεγχοι', String(lines.length)]],
      sections: [{ title: en ? 'Adherence per control and department' : 'Τήρηση ανά έλεγχο και τμήμα', note: tx.adherenceNote, table: { columns: [en ? 'Control / department' : 'Έλεγχος / τμήμα', en ? 'Frequency' : 'Συχνότητα', tx.expected, tx.performed, tx.onTime, tx.missed, tx.adherenceRate], rows: tableRows, foot: [tx.total, '', ...numbers(totals)], empty: tx.noAdherence } }],
      signatures: [en ? 'Prepared by' : 'Συντάχθηκε', en ? 'Reviewed by' : 'Ελέγχθηκε'],
      filename: en ? 'control-programme-adherence' : 'tirisi-programmatos-elegxon',
    }, { pdf: pdf === true })
    if (!ok) notify(en ? 'Allow pop-ups to print.' : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'error')
  }

  return { period, lines, totals, trend, reportRef, exporting: false, exportCsv, exportPdf, failed, loadFailedText, until: now }
}

// «Up to 18/10/2026»: the reports end on the last day with entries.
export function UntilNote({ until, language }) {
  const en = language === 'en'
  const day = formatDay(dayKey(new Date(until)), language)
  return <span className="control-until-note" title={en ? 'The controls are still recorded elsewhere: the figures end on the last day with entries.' : 'Οι έλεγχοι καταγράφονται ακόμα αλλού: τα στοιχεία σταματούν στην τελευταία ημέρα με καταγραφές.'}>{en ? `Up to ${day}` : `Έως ${day}`}</span>
}

// One look for a rate: a bar with the figure beside it.
export function RateMeter({ rate }) {
  const tone = adherenceTone(rate)
  return <span className={`control-adherence-meter ${tone}`}>
    <i aria-hidden="true"><b style={{ width: `${rate ?? 0}%` }} /></i>
    <strong>{rate == null ? '—' : `${rate}%`}</strong>
  </span>
}

const MONTHS = { el: ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] }
const shortDay = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

// The adherence of each month: one bar per month, the rate above it.
function AdherenceTrend({ months, language }) {
  const en = language === 'en'
  if (!months.length) return null
  return <div className="control-adherence-trend" role="img" aria-label={en ? 'Adherence per month' : 'Τήρηση ανά μήνα'}>
    {months.map((month) => <div key={month.key} className={`control-adherence-trend-month ${adherenceTone(month.rate)}`} title={`${MONTHS[en ? 'en' : 'el'][Number(month.key.slice(5, 7)) - 1]} ${month.key.slice(0, 4)}: ${month.rate == null ? '—' : `${month.rate}%`} · ${en ? `${doneOf(month)} of ${month.expected} done` : `έγιναν ${doneOf(month)} από ${month.expected}`}`}>
      <strong>{month.rate == null ? '—' : `${month.rate}%`}</strong>
      <i><b style={{ height: `${month.rate ?? 0}%` }} /></i>
      <span>{MONTHS[en ? 'en' : 'el'][Number(month.key.slice(5, 7)) - 1]}</span>
    </div>)}
  </div>
}

// «Missed: 3» and the days: the latest three, the rest counted; the count opens them all.
function MissedCell({ row, language, onShow }) {
  const en = language === 'en'
  const days = row.missedDays || []
  const latest = days.slice(-3).map((x) => shortDay(x.day))
  return <td className={row.missed ? 'control-adherence-missed' : ''}>
    {row.missed && onShow ? <button type="button" className="control-adherence-missed-link" title={en ? 'Dates and times' : 'Ημερομηνίες και ώρες'} onClick={(event) => { event.stopPropagation(); onShow() }}>{row.missed}</button> : row.missed}
    {latest.length > 0 && <small className="control-adherence-days" title={days.map((x) => shortDay(x.day)).join(', ')}>{latest.join(', ')}{days.length > 3 ? (en ? ` +${days.length - 3} more` : ` +${days.length - 3} ακόμα`) : ''}</small>}
  </td>
}

// «Why» a line sits under the 90% target (owner, 7/11/2026): nothing recorded, fewer times a day than set, the
// weekends missed, or whole days (weeks) missed. null at or above the target.
export function adherenceReason(line) {
  if (line.rate == null || adherenceTone(line.rate) === 'good') return null
  if (!line.performed) return 'none'
  const frequency = line.frequency || line.item?.frequency || {}
  const days = line.missedDays || []
  if (frequency.kind === 'daily' && days.length) {
    const required = Number(frequency.timesPerDay || 1)
    if (required > 1 && days.filter((x) => x.missing < required).length >= days.length / 2) return 'perday'
    const whole = days.filter((x) => x.missing >= required)
    const weekend = whole.filter((x) => [0, 6].includes(new Date(`${x.day}T12:00:00Z`).getUTCDay())).length
    if (frequency.weekdaysOnly !== true && whole.length >= 4 && weekend >= whole.length * 0.6) return 'weekdays'
  }
  return frequency.kind === 'daily' ? 'days' : 'periods'
}
const REASONS = {
  none: ['No entries', 'Χωρίς καταχώριση'], perday: ['Fewer times a day', 'Λιγότερες φορές την ημέρα'], weekdays: ['Mostly weekdays', 'Κυρίως εργάσιμες'],
  days: ['Days missed', 'Χάνονται μέρες'], periods: ['Executions missed', 'Χάνονται εκτελέσεις'],
}
export const reasonLabel = (reason, language) => (reason ? REASONS[reason][language === 'en' ? 0 : 1] : '')
// A group (a department or a control in several): the most frequent reason of its lines under the target.
function groupReason(lines) {
  const counts = new Map()
  for (const line of lines) { const reason = adherenceReason(line); if (reason) counts.set(reason, (counts.get(reason) || 0) + 1) }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || null
}

export function ControlAdherencePanel({ report, tx, language, onOpen }) {
  const en = language === 'en'
  const { lines, trend = [], reportRef, failed, loadFailedText, until } = report
  const departments = useMemo(() => new Set(lines.map((line) => line.department)).size, [lines])
  const [mode, setMode] = useState('')
  const [missed, setMissed] = useState(null)
  // Per department, a department opens to its controls on a click.
  const [open, setOpen] = useState(() => new Set())
  const toggle = (key) => setOpen((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next })
  const byDepartment = (mode || (departments > 1 ? 'department' : 'control')) === 'department' && departments > 1
  // «Stopped» (owner, 2/11/2026): the daily and weekly controls with no entry for 7 days or more, or never, as of the
  // report's end (the last day with entries while those come in from elsewhere): who to call to start them again.
  const stopped = useMemo(() => stoppedControls(lines, until || new Date()), [lines, until])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const title = (item) => (en ? item.titleEn || item.title : item.title)
  const pct = (value) => (value == null ? '—' : `${value}%`)
  const groups = useMemo(() => (byDepartment ? groupAdherenceByDepartment(lines) : groupAdherenceLines(lines)), [lines, byDepartment])
  // The arrows in the headers sort the whole list of groups (worst first by default); then the page is cut.
  const figures = (group) => group.totals || group.lines[0]
  const { sorted: sortedGroups, sort, onSort } = useTableSort(groups, {
    control: (group) => (byDepartment ? group.department : title(group.item)),
    performed: (group) => doneOf(figures(group)),
    onTime: (group) => { const row = figures(group); return row.onTimeRate ?? (row.performed ? Math.round((row.onTime / row.performed) * 100) : null) },
    missed: (group) => figures(group).missed,
    rate: (group) => figures(group).rate,
  }, { key: null, dir: 'asc' }, byDepartment)
  useEffect(() => setPage(1), [sort])
  const totalPages = Math.max(1, Math.ceil(groups.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const shown = sortedGroups.slice((safePage - 1) * pageSize, safePage * pageSize)
  const numbers = (row, rowLines, label) => <>
    <td className="control-adherence-done"><b>{doneOf(row)}</b> {en ? 'of' : 'από'} {row.expected}{extraOf(row) > 0 && <small>{extraText(row, en)}</small>}</td>
    <td>{pct(row.onTimeRate ?? (row.performed ? Math.round((row.onTime / row.performed) * 100) : null))}{row.late > 0 && <small>{en ? `${row.late} late` : `${row.late} με καθυστέρηση`}</small>}</td>
    <MissedCell row={row} language={language} onShow={() => setMissed({ lines: rowLines, title: label })} />
    <td><RateMeter rate={row.rate} /></td>
    <td className="control-adherence-reason">{adherenceReason(row) && reasonLabel(rowLines.length === 1 ? adherenceReason(rowLines[0]) : groupReason(rowLines), language)}</td>
  </>
  const frequencyOf = (line) => frequencyLabel(line.frequency || line.item.frequency, language)
  const rowsOf = (group) => {
    if (byDepartment) return [{ key: `${group.key}-group`, kind: 'group', group }, ...(open.has(group.key) ? group.lines.map((line) => ({ key: `${group.key}-${line.item.id}`, kind: 'member', line })) : [])]
    return group.lines.length === 1 ? [{ key: group.key, kind: 'single', group }] : [{ key: `${group.key}-group`, kind: 'group', group }, ...group.lines.map((line) => ({ key: `${line.item.id}-${line.department}`, kind: 'member', line }))]
  }
  return <div className="control-adherence" ref={reportRef}>
    <div className="control-adherence-toolbar">
      {departments > 1 && <ChoiceChips className="control-adherence-mode" label="" options={[{ value: 'department', label: en ? 'Per department' : 'Ανά τμήμα' }, { value: 'control', label: en ? 'Per control' : 'Ανά έλεγχο' }, ...(stopped.length ? [{ value: 'stopped', label: `${en ? 'Stopped' : 'Σταμάτησαν'} (${stopped.length})` }] : [])]} selected={[mode === 'stopped' ? 'stopped' : byDepartment ? 'department' : 'control']} onToggle={(value) => { setMode(value); setPage(1) }} />}
      {departments <= 1 && stopped.length > 0 && <ChoiceChips className="control-adherence-mode" label="" options={[{ value: 'stopped', label: `${en ? 'Stopped' : 'Σταμάτησαν'} (${stopped.length})` }]} selected={mode === 'stopped' ? ['stopped'] : []} onToggle={(value) => { setMode(mode === value ? '' : value); setPage(1) }} />}
      {until && <UntilNote until={until} language={language} />}
      <span className="control-info-tip" tabIndex={0} title={tx.adherenceNote} aria-label={tx.adherenceNote} data-pdf-ignore=""><Info size={15} aria-hidden="true" /></span>
    </div>
    {mode === 'stopped' ? <StoppedTable rows={stopped} language={language} onOpen={onOpen} /> : <>
    <AdherenceTrend months={trend} language={language} />
    <RegistryTable sort={sort} onSort={onSort}
      className="control-adherence-table"
      columns={[{ key: 'control', label: byDepartment ? (en ? 'Department / control' : 'Τμήμα / έλεγχος') : (en ? 'Control / department' : 'Έλεγχος / τμήμα'), sortable: true }, { key: 'performed', label: tx.performed, sortable: true }, { key: 'onTime', label: tx.onTime, sortable: true }, { key: 'missed', label: tx.missed, sortable: true }, { key: 'rate', label: tx.adherenceRate, sortable: true }, { key: 'reason', label: en ? 'Why' : 'Γιατί' }]}
      rows={shown.flatMap(rowsOf)}
      rowKey={(entry) => entry.key}
      emptyTitle={failed ? loadFailedText : lines.length ? undefined : tx.noAdherence}
      emptyText={failed ? undefined : en ? 'Change the period or the search.' : 'Αλλάξτε την περίοδο ή την αναζήτηση.'}
      renderRow={(entry) => entry.kind === 'single'
        ? <tr className="control-adherence-single" onClick={() => onOpen?.(entry.group.item)}>
            <td><strong>{title(entry.group.item)}</strong><small>{entry.group.lines[0].department} · {linesFrequencyLabel(entry.group.lines, entry.group.item, language)}</small></td>
            {numbers(entry.group.lines[0], entry.group.lines, `${title(entry.group.item)} · ${entry.group.lines[0].department}`)}
          </tr>
        : entry.kind === 'group'
        ? <tr className={`control-adherence-group${byDepartment ? ' is-department' : ''}`} onClick={byDepartment ? () => toggle(entry.group.key) : () => onOpen?.(entry.group.item)} aria-expanded={byDepartment ? open.has(entry.group.key) : undefined}>
            <td><strong>{byDepartment && (open.has(entry.group.key) ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />)}{byDepartment ? entry.group.department : title(entry.group.item)}</strong><small>{byDepartment ? (en ? `${entry.group.lines.length} ${entry.group.lines.length === 1 ? 'control' : 'controls'}` : `${entry.group.lines.length} ${entry.group.lines.length === 1 ? 'έλεγχος' : 'έλεγχοι'}`) : `${linesFrequencyLabel(entry.group.lines, entry.group.item, language)} · ${en ? `${entry.group.lines.length} ${entry.group.lines.length === 1 ? 'department' : 'departments'}` : `${entry.group.lines.length} ${entry.group.lines.length === 1 ? 'τμήμα' : 'τμήματα'}`}`}</small></td>
            {numbers(entry.group.totals, entry.group.lines, byDepartment ? entry.group.department : title(entry.group.item))}
          </tr>
        : <tr className="control-adherence-member" onClick={() => onOpen?.(entry.line.item)}>
            <td className="control-adherence-department">{byDepartment ? <>{title(entry.line.item)}<small>{frequencyOf(entry.line)}</small></> : entry.line.department}</td>
            {numbers(entry.line, [entry.line], `${title(entry.line.item)} · ${entry.line.department}`)}
          </tr>}
    />
    {missed && <ControlMissedDialog lines={missed.lines} title={missed.title} language={language} onClose={() => setMissed(null)} />}
    {groups.length > 0 && <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={groups.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />}
    </>}
  </div>
}

const STOPPED_DAYS = 7
// The daily and weekly controls of the lines that have no entry for STOPPED_DAYS days or more (or none at all), per
// department, the longest silence first.
export function stoppedControls(lines = [], asOf = new Date()) {
  const seen = new Set(), out = []
  for (const line of lines) {
    const key = `${line.item.id}|${line.department}`
    if (seen.has(key)) continue
    seen.add(key)
    const assignment = line.item.assignments?.[line.department] || {}
    const frequency = line.frequency || assignment.frequency || line.item.frequency || {}
    if (!['daily', 'weekly'].includes(frequency.kind) || assignment.status === 'paused') continue
    const history = (assignment.history || []).filter((row) => row?.at && !row.cancelledAt && row.status !== 'cancelled')
    const last = assignment.lastCompletedAt || history.map((row) => row.at).sort().pop() || null
    const days = last ? Math.floor((new Date(asOf) - new Date(last)) / 86400000) : null
    if (last && days < STOPPED_DAYS) continue
    out.push({ key, item: line.item, department: line.department, frequency, last, days })
  }
  return out.sort((a, b) => a.department.localeCompare(b.department, 'el') || (b.days ?? Infinity) - (a.days ?? Infinity))
}

function StoppedTable({ rows, language, onOpen }) {
  const en = language === 'en'
  return <RegistryTable className="control-adherence-table control-stopped-table"
    columns={[{ key: 'department', label: en ? 'Department' : 'Τμήμα' }, { key: 'control', label: en ? 'Control' : 'Έλεγχος' }, { key: 'last', label: en ? 'Last entry' : 'Τελευταία καταχώριση' }, { key: 'days', label: en ? 'Days without entry' : 'Ημέρες χωρίς καταχώριση' }]}
    rows={rows} rowKey={(row) => row.key}
    emptyTitle={en ? 'No control has stopped.' : 'Κανένας έλεγχος δεν έχει σταματήσει.'}
    renderRow={(row) => <tr className="registry-row-clickable" onClick={() => onOpen?.(row.item)}>
      <td><strong>{row.department}</strong></td>
      <td>{en ? row.item.titleEn || row.item.title : row.item.title}<small>{frequencyLabel(row.frequency, language)}</small></td>
      <td>{row.last ? formatDay(row.last, language) : <span className="status-badge danger">{en ? 'Never' : 'Ποτέ'}</span>}</td>
      <td>{row.days == null ? '—' : <b className={row.days >= 30 ? 'control-stopped-long' : ''}>{row.days}</b>}</td>
    </tr>}
  />
}
