import { useEffect, useMemo, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { downloadCsv } from '../../core/export/csvExport'
import { escapeHtml, printReport } from '../../core/export/reportDocument'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { frequencyLabel, linesFrequencyLabel } from './controlScheduling'
import { calendarTone, calendarYearSummary, groupCalendarLines, programmeCalendar } from './controlCalendar'
import { loadControlCalendarMonths } from './controlCloudService'
import './controlCalendar.css'

const MONTHS = {
  el: ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιούν', 'Ιούλ', 'Αύγ', 'Σεπ', 'Οκτ', 'Νοέ', 'Δεκ'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

// Plain-text summary of one month, for the tooltip and the Excel file.
export function calendarCellText(cell, en) {
  if (cell.inactive) return ''
  const parts = []
  if (cell.frequent) {
    if (cell.when !== 'future' && (cell.expected || cell.done)) parts.push(en ? `${cell.done} of ${cell.expected} done` : `${cell.done} από ${cell.expected} έγιναν`)
    if (cell.late) parts.push(en ? `${cell.late} late` : `${cell.late} με καθυστέρηση`)
    if (cell.planned) parts.push(en ? `${cell.planned} planned` : `${cell.planned} προγραμματισμένοι`)
    return parts.join(' · ')
  }
  if (cell.done) parts.push(`${en ? 'Done' : 'Έγινε'} ${cell.marks.map((mark) => `${mark.day}${mark.late ? (en ? ' (late)' : ' (με καθυστέρηση)') : ''}`).join(', ')}`)
  if (cell.missed.length) parts.push(`${en ? 'Missed' : 'Χάθηκε'} ${cell.missed.join(', ')}`)
  if (cell.planned.length) parts.push(`${en ? 'Planned' : 'Προγραμματισμένος'} ${cell.planned.join(', ')}`)
  return parts.join(' · ')
}

// The year's month counts per assignment, counted in the database (null in the demo).
function useCalendarMonths(organizationId, year, refreshKey) {
  const [state, setState] = useState({ key: '', months: null, failed: false })
  const key = `${organizationId || ''}|${year}`
  useEffect(() => {
    if (!organizationId) return undefined
    let active = true
    loadControlCalendarMonths(organizationId, year)
      .then((months) => { if (active) setState({ key, months, failed: false }) })
      // A failed read is not a year with nothing done: the calendar says it could not load.
      .catch(() => { if (active) setState({ key, months: null, failed: true }) })
    return () => { active = false }
  }, [organizationId, year, key, refreshKey])
  return state.key === key ? state : { months: null, failed: false }
}

export function useControlCalendarReport(rows, tx, language, organizationId, refreshKey) {
  const en = language === 'en'
  const { notify } = useFeedback()
  const [year, setYear] = useState(() => new Date().getFullYear())
  const reportRef = useRef(null)
  const { months: monthsByAssignment, failed } = useCalendarMonths(organizationId, year, refreshKey)
  const lines = useMemo(() => (failed ? [] : programmeCalendar(rows, year, new Date(), monthsByAssignment)), [rows, year, monthsByAssignment, failed])
  const loadFailedText = en ? 'The calendar could not be loaded. Try again.' : 'Δεν ήταν δυνατή η φόρτωση του ημερολογίου. Δοκιμάστε ξανά.'
  const months = MONTHS[en ? 'en' : 'el']
  const title = (item) => (en ? item.titleEn || item.title : item.title)

  function exportCsv() {
    if (failed) { notify(loadFailedText, 'danger'); return }
    downloadCsv(`${en ? 'control-calendar' : 'imerologio-elegxon'}-${year}.csv`,
      [en ? 'Control' : 'Έλεγχος', en ? 'Department' : 'Τμήμα', en ? 'Frequency' : 'Συχνότητα', ...months],
      lines.map((line) => [title(line.item), line.department, frequencyLabel(line.frequency || line.item.frequency, language), ...line.months.map((cell) => calendarCellText(cell, en))]))
  }
  // The year for every control (not the page on screen) on the shared document layout.
  function exportPdf(pdf) {
    if (failed) { notify(loadFailedText, 'danger'); return }
    const toneClass = { good: 'rd-good', fair: 'rd-warn', low: 'rd-bad' }
    const cellOf = (cell) => {
      if (cell.inactive) return { text: '' }
      const className = `rd-cal ${toneClass[calendarTone(cell)] || ''}`
      if (cell.frequent) {
        if (cell.when === 'future' || (!cell.expected && !cell.done)) return { text: cell.planned ? `○ ${cell.planned}` : '', className }
        return { text: `${cell.done}/${cell.expected}`, className }
      }
      return { text: [...cell.marks.map((mark) => `✓${mark.day}`), ...cell.missed.map((day) => `✕${day}`), ...cell.planned.map((day) => `○${day}`)].join(' '), className }
    }
    const yearCell = (line) => { const summary = calendarYearSummary(line.months); return { text: summary.rate == null ? (summary.planned ? `○ ${summary.planned}` : '—') : `${summary.rate}% (${summary.done}/${summary.expected})`, className: `rd-num ${summary.rate == null ? '' : summary.rate >= 90 ? 'rd-good' : summary.rate >= 75 ? 'rd-warn' : 'rd-bad'}` } }
    const rowsOut = groupCalendarLines(lines).flatMap((group) => group.lines.length === 1
      ? [[{ html: `<strong>${escapeHtml(title(group.item))}</strong><small>${escapeHtml(`${group.lines[0].department} · ${linesFrequencyLabel(group.lines, group.item, language)}`)}</small>` }, ...group.lines[0].months.map(cellOf), yearCell(group.lines[0])]]
      : [[{ html: `<strong>${escapeHtml(title(group.item))}</strong><small>${escapeHtml(`${linesFrequencyLabel(group.lines, group.item, language)} · ${en ? `${group.lines.length} departments` : `${group.lines.length} τμήματα`}`)}</small>`, colSpan: 14 }],
         ...group.lines.map((line) => [{ text: line.department, className: 'rd-sub-cell' }, ...line.months.map(cellOf), yearCell(line)])])
    const ok = printReport({
      language, orientation: 'landscape',
      kind: en ? 'Controls' : 'Έλεγχοι',
      code: String(year),
      title: en ? `Control calendar ${year}` : `Ημερολόγιο ελέγχων ${year}`,
      meta: [[en ? 'Year' : 'Έτος', String(year)], [en ? 'Controls' : 'Έλεγχοι', String(lines.length)]],
      sections: [{ title: en ? 'Executions per month' : 'Εκτελέσεις ανά μήνα', note: `✓ ${tx.legendDone} · ✕ ${tx.legendMissed} · ○ ${tx.legendPlanned} · ${tx.legendCount}: 9/10. ${tx.calendarNote}`, table: { columns: [en ? 'Control' : 'Έλεγχος', ...months, String(year)], rows: rowsOut, empty: tx.noCalendar } }],
      filename: `${en ? 'control-calendar' : 'imerologio-elegxon'}-${year}`,
    }, { pdf: pdf === true })
    if (!ok) notify(en ? 'Allow pop-ups to print.' : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'error')
  }

  return { year, setYear, lines, months, reportRef, exporting: false, exportCsv, exportPdf, tx, failed, loadFailedText }
}

function FrequentCell({ cell }) {
  if (cell.inactive) return null
  const planned = cell.planned ? <span className="control-calendar-count planned">{cell.planned}</span> : null
  if (cell.when === 'future' || (!cell.expected && !cell.done)) return planned
  // done / due with a bar that fills with the share done.
  return <span className={`control-calendar-count ${calendarTone(cell)}`}>
    <span>{cell.done}<small>/{cell.expected}</small></span>
    <i className="control-calendar-bar" aria-hidden="true"><b style={{ width: `${Math.min(100, cell.rate ?? 0)}%` }} /></i>
  </span>
}

function InfrequentCell({ cell }) {
  if (cell.inactive) return null
  return <span className="control-calendar-marks">
    {cell.marks.map((mark, index) => <span key={`d${index}`} className={`control-calendar-mark ${mark.late ? 'fair' : 'good'}`}>✓ {mark.day}</span>)}
    {cell.missed.map((day, index) => <span key={`m${index}`} className="control-calendar-mark low">✕ {day}</span>)}
    {cell.planned.map((day, index) => <span key={`p${index}`} className="control-calendar-mark planned">○ {day}</span>)}
  </span>
}

function YearSummary({ summary, tx }) {
  if (summary.rate == null) return summary.planned ? <span className="control-calendar-year-total planned">{summary.planned}<small> {tx.legendPlanned.toLowerCase()}</small></span> : <span className="control-calendar-year-total empty">—</span>
  const tone = summary.rate >= 90 ? 'good' : summary.rate >= 75 ? 'fair' : 'low'
  return <span className={`control-calendar-year-total ${tone}`}><strong>{summary.rate}%</strong><small>{summary.done}/{summary.expected}</small></span>
}

export function ControlCalendarPanel({ report, language, onOpen }) {
  const en = language === 'en'
  const { year, lines, months, reportRef, tx, failed, loadFailedText } = report
  const now = new Date()
  const title = (item) => (en ? item.titleEn || item.title : item.title)
  const groups = useMemo(() => groupCalendarLines(lines), [lines])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const totalPages = Math.max(1, Math.ceil(groups.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const shownGroups = groups.slice((safePage - 1) * pageSize, safePage * pageSize)
  const isCurrent = (month) => year === now.getFullYear() && month === now.getMonth()
  const row = (line, grouped) => {
    const summary = calendarYearSummary(line.months)
    return <tr key={`${line.item.id}-${line.department}`} className={grouped ? 'control-calendar-member' : ''} onClick={() => onOpen?.(line.item)}>
      <td className="control-calendar-name">{grouped
        ? <strong className="control-calendar-department">{line.department}</strong>
        : <><strong>{title(line.item)}</strong><small>{line.department} · {frequencyLabel(line.frequency || line.item.frequency, language)}</small></>}</td>
      {line.months.map((cell) => {
        const text = calendarCellText(cell, en)
        const tone = cell.inactive ? 'inactive' : calendarTone(cell)
        return <td key={cell.month} className={`control-calendar-cell ${cell.when} tone-${tone}${isCurrent(cell.month) ? ' current' : ''}`} title={text || undefined} aria-label={text ? `${months[cell.month]}: ${text}` : undefined}>
          {cell.frequent ? <FrequentCell cell={cell} /> : <InfrequentCell cell={cell} />}
        </td>
      })}
      <td className="control-calendar-total"><YearSummary summary={summary} tx={tx} /></td>
    </tr>
  }
  return <div className="control-calendar" ref={reportRef}>
    <div className="control-calendar-toolbar">
      <strong className="control-calendar-year-label">{en ? `Year ${year}` : `Έτος ${year}`}</strong>
      <ul className="control-calendar-legend">
        <li><span className="control-calendar-mark good">✓</span>{tx.legendDone}</li>
        <li><span className="control-calendar-mark fair">✓</span>{tx.legendLate}</li>
        <li><span className="control-calendar-mark low">✕</span>{tx.legendMissed}</li>
        <li><span className="control-calendar-mark planned">○</span>{tx.legendPlanned}</li>
      </ul>
      <span className="control-info-tip" tabIndex={0} title={`${tx.legendCount}: 9/10. ${tx.calendarNote}`} aria-label={tx.calendarNote} data-pdf-ignore=""><Info size={15} aria-hidden="true" /></span>
    </div>
    <RegistryTable sortable={false}
      className="control-calendar-table"
      columns={[{ key: 'name', label: en ? 'Control' : 'Έλεγχος', className: 'control-calendar-name' }, ...months.map((label, month) => ({ key: label, label, className: isCurrent(month) ? 'current' : undefined })), { key: 'total', label: year, className: 'control-calendar-total' }]}
      rows={shownGroups.flatMap((group) => group.lines.length === 1 ? [{ key: group.item.id, line: group.lines[0], member: false }] : [{ key: `${group.item.id}-group`, group }, ...group.lines.map((line) => ({ key: `${line.item.id}-${line.department}`, line, member: true }))])}
      rowKey={(entry) => entry.key}
      emptyTitle={failed ? loadFailedText : lines.length ? undefined : tx.noCalendar}
      emptyText={failed ? undefined : en ? 'Change the year or the search.' : 'Αλλάξτε το έτος ή την αναζήτηση.'}
      renderRow={(entry) => entry.group
        ? <tr className="control-calendar-group" onClick={() => onOpen?.(entry.group.item)}>
            <td colSpan={14} className="control-calendar-group-title"><strong>{title(entry.group.item)}</strong><small>{linesFrequencyLabel(entry.group.lines, entry.group.item, language)} · {en ? `${entry.group.lines.length} departments` : `${entry.group.lines.length} τμήματα`}</small></td>
          </tr>
        : row(entry.line, entry.member)}
    />
    {groups.length > 0 && <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={groups.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />}
  </div>
}
