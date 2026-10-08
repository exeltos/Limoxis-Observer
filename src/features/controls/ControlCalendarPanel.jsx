import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { downloadCsv } from '../../core/export/csvExport'
import { exportElementAsPdf } from '../../core/export/pdfReportExport'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { frequencyLabel } from './controlScheduling'
import { calendarTone, programmeCalendar } from './controlCalendar'
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

export function useControlCalendarReport(rows, tx, language) {
  const en = language === 'en'
  const { notify } = useFeedback()
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [exporting, setExporting] = useState(false)
  const reportRef = useRef(null)
  const lines = useMemo(() => programmeCalendar(rows, year), [rows, year])
  const months = MONTHS[en ? 'en' : 'el']
  const title = (item) => (en ? item.titleEn || item.title : item.title)

  function exportCsv() {
    downloadCsv(`${en ? 'control-calendar' : 'imerologio-elegxon'}-${year}.csv`,
      [en ? 'Control' : 'Έλεγχος', en ? 'Department' : 'Τμήμα', en ? 'Frequency' : 'Συχνότητα', ...months],
      lines.map((line) => [title(line.item), line.department, frequencyLabel(line.item.frequency, language), ...line.months.map((cell) => calendarCellText(cell, en))]))
  }
  async function exportPdf() {
    if (exporting || !reportRef.current) return
    setExporting(true)
    try { await exportElementAsPdf({ element: reportRef.current, filename: `${en ? 'control-calendar' : 'imerologio-elegxon'}-${year}`, orientation: 'landscape' }) }
    catch (error) { notify(error?.message || (en ? 'Could not export the PDF.' : 'Δεν ήταν δυνατή η εξαγωγή του PDF.'), 'danger') }
    finally { setExporting(false) }
  }

  return { year, setYear, lines, months, reportRef, exporting, exportCsv, exportPdf, tx }
}

function FrequentCell({ cell }) {
  if (cell.inactive) return null
  if (cell.when === 'future') return cell.planned ? <span className="control-calendar-count planned">{cell.planned}</span> : null
  if (!cell.expected && !cell.done) return cell.planned ? <span className="control-calendar-count planned">{cell.planned}</span> : null
  return <span className={`control-calendar-count ${calendarTone(cell)}`}>{cell.done}<small>/{cell.expected}</small></span>
}

function InfrequentCell({ cell }) {
  if (cell.inactive) return null
  return <span className="control-calendar-marks">
    {cell.marks.map((mark, index) => <span key={`d${index}`} className={`control-calendar-mark ${mark.late ? 'fair' : 'good'}`}>✓ {mark.day}</span>)}
    {cell.missed.map((day, index) => <span key={`m${index}`} className="control-calendar-mark low">✕ {day}</span>)}
    {cell.planned.map((day, index) => <span key={`p${index}`} className="control-calendar-mark planned">○ {day}</span>)}
  </span>
}

export function ControlCalendarPanel({ report, language, onOpen }) {
  const en = language === 'en'
  const { year, setYear, lines, months, reportRef, tx } = report
  const now = new Date()
  const title = (item) => (en ? item.titleEn || item.title : item.title)
  return <div className="control-calendar" ref={reportRef}>
    <div className="control-calendar-toolbar">
      <div className="control-calendar-year" role="group" aria-label={tx.calendarYear}>
        <button type="button" data-pdf-ignore="" onClick={() => setYear(year - 1)} aria-label={tx.previousYear}><ChevronLeft size={16} aria-hidden="true" /></button>
        <strong>{year}</strong>
        <button type="button" data-pdf-ignore="" onClick={() => setYear(year + 1)} aria-label={tx.nextYear}><ChevronRight size={16} aria-hidden="true" /></button>
      </div>
      <ul className="control-calendar-legend">
        <li><span className="control-calendar-mark good">✓</span>{tx.legendDone}</li>
        <li><span className="control-calendar-mark fair">✓</span>{tx.legendLate}</li>
        <li><span className="control-calendar-mark low">✕</span>{tx.legendMissed}</li>
        <li><span className="control-calendar-mark planned">○</span>{tx.legendPlanned}</li>
        <li><span className="control-calendar-count good">9<small>/10</small></span>{tx.legendCount}</li>
      </ul>
    </div>
    <div className="scroll-table">
      <table className="data-table sticky-table control-calendar-table">
        <thead><tr>
          <th className="control-calendar-name">{en ? 'Control' : 'Έλεγχος'}</th>
          {months.map((label, month) => <th key={label} className={year === now.getFullYear() && month === now.getMonth() ? 'current' : ''}>{label}</th>)}
        </tr></thead>
        <tbody>{lines.map((line) => <tr key={`${line.item.id}-${line.department}`} onClick={() => onOpen?.(line.item)}>
          <td className="control-calendar-name"><strong>{title(line.item)}</strong><small>{line.department} · {frequencyLabel(line.item.frequency, language)}</small></td>
          {line.months.map((cell) => {
            const text = calendarCellText(cell, en)
            return <td key={cell.month} className={`control-calendar-cell ${cell.when}${year === now.getFullYear() && cell.month === now.getMonth() ? ' current' : ''}`} title={text || undefined} aria-label={text ? `${months[cell.month]}: ${text}` : undefined}>
              {cell.frequent ? <FrequentCell cell={cell} /> : <InfrequentCell cell={cell} />}
            </td>
          })}
        </tr>)}</tbody>
      </table>
      {!lines.length && <div className="registry-empty-state"><strong>{tx.noCalendar}</strong></div>}
    </div>
    <p className="control-adherence-note">{tx.calendarNote}</p>
  </div>
}
