import { useMemo, useRef, useState } from 'react'
import { downloadCsv } from '../../core/export/csvExport'
import { exportElementAsPdf } from '../../core/export/pdfReportExport'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { frequencyLabel } from './controlScheduling'
import { ADHERENCE_PERIODS, adherenceTone, periodRange, programmeAdherence } from './controlAdherence'
import './controlAdherence.css'

// Programme adherence: due vs done vs on time per control and department.
// The page owns the report (period + downloads) so its Download button sits
// in the page header like every other list.
export function useControlAdherenceReport(rows, tx, language) {
  const en = language === 'en'
  const { notify } = useFeedback()
  const [period, setPeriod] = useState('30d')
  const [exporting, setExporting] = useState(false)
  const reportRef = useRef(null)
  const { lines, totals } = useMemo(() => programmeAdherence(rows, periodRange(period)), [rows, period])
  const title = (item) => (en ? item.titleEn || item.title : item.title)
  const pct = (value) => (value == null ? '—' : `${value}%`)

  function exportCsv() {
    downloadCsv(`${en ? 'control-programme-adherence' : 'tirisi-programmatos-elegxon'}-${period}.csv`,
      [en ? 'Control' : 'Έλεγχος', en ? 'Department' : 'Τμήμα', en ? 'Frequency' : 'Συχνότητα', tx.expected, tx.performed, tx.onTime, tx.missed, tx.adherenceRate],
      [...lines.map((line) => [title(line.item), line.department, frequencyLabel(line.item.frequency, language), line.expected, line.performed, line.onTime, line.missed, pct(line.rate)]),
        [tx.total, '', '', totals.expected, totals.performed, totals.onTime, totals.missed, pct(totals.rate)]])
  }
  async function exportPdf() {
    if (exporting || !reportRef.current) return
    setExporting(true)
    try { await exportElementAsPdf({ element: reportRef.current, filename: en ? 'control-programme-adherence' : 'tirisi-programmatos-elegxon', orientation: 'landscape' }) }
    catch (error) { notify(error?.message || (en ? 'Could not export the PDF.' : 'Δεν ήταν δυνατή η εξαγωγή του PDF.'), 'danger') }
    finally { setExporting(false) }
  }

  return { period, setPeriod, lines, totals, reportRef, exporting, exportCsv, exportPdf }
}

export function ControlAdherencePanel({ report, tx, language }) {
  const en = language === 'en'
  const { period, setPeriod, lines, totals, reportRef } = report
  const title = (item) => (en ? item.titleEn || item.title : item.title)
  const pct = (value) => (value == null ? '—' : `${value}%`)
  return <div className="control-adherence" ref={reportRef}>
    <div className="control-adherence-toolbar">
      <label className="control-adherence-period"><span>{tx.period}</span><select value={period} onChange={(event) => setPeriod(event.target.value)}>{ADHERENCE_PERIODS.map((key) => <option key={key} value={key}>{tx[`p${key}`]}</option>)}</select></label>
      <div className="control-adherence-summary">
        <span><strong className={`control-adherence-rate ${adherenceTone(totals.rate)}`}>{pct(totals.rate)}</strong>{tx.adherence}</span>
        <span><strong>{totals.performed} / {totals.expected}</strong>{tx.performed.toLowerCase()}</span>
        <span><strong>{pct(totals.onTimeRate)}</strong>{tx.onTime.toLowerCase()}</span>
        <span><strong className={totals.missed ? 'missed' : ''}>{totals.missed}</strong>{tx.missed.toLowerCase()}</span>
      </div>
    </div>
    <div className="scroll-table">
      <table className="data-table sticky-table control-adherence-table">
        <thead><tr><th>{en ? 'Control' : 'Έλεγχος'}</th><th>{en ? 'Department' : 'Τμήμα'}</th><th>{en ? 'Frequency' : 'Συχνότητα'}</th><th>{tx.expected}</th><th>{tx.performed}</th><th>{tx.onTime}</th><th>{tx.missed}</th><th>{tx.adherenceRate}</th></tr></thead>
        <tbody>{lines.map((line) => <tr key={`${line.item.id}-${line.department}`}>
          <td><strong>{title(line.item)}</strong><small>{line.item.category}</small></td>
          <td>{line.department}</td>
          <td>{frequencyLabel(line.item.frequency, language)}</td>
          <td>{line.expected}</td>
          <td>{line.performed}</td>
          <td>{line.onTime}{line.late > 0 && <small>{en ? `${line.late} late` : `${line.late} με καθυστέρηση`}</small>}</td>
          <td className={line.missed ? 'control-adherence-missed' : ''}>{line.missed}</td>
          <td><span className={`control-adherence-rate ${adherenceTone(line.rate)}`}>{pct(line.rate)}</span><span className="control-adherence-bar"><span style={{ width: `${line.rate ?? 0}%` }} /></span></td>
        </tr>)}</tbody>
      </table>
      {!lines.length && <div className="registry-empty-state"><strong>{tx.noAdherence}</strong></div>}
    </div>
    <p className="control-adherence-note">{tx.adherenceNote}</p>
  </div>
}
