import { useMemo, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { downloadCsv } from '../../core/export/csvExport'
import { exportElementAsPdf } from '../../core/export/pdfReportExport'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { frequencyLabel } from './controlScheduling'
import { ADHERENCE_PERIODS, adherenceTone, groupAdherenceLines, periodRange, programmeAdherence } from './controlAdherence'
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

// One look for a rate: a bar with the figure beside it.
function RateMeter({ rate }) {
  const tone = adherenceTone(rate)
  return <span className={`control-adherence-meter ${tone}`}>
    <i aria-hidden="true"><b style={{ width: `${rate ?? 0}%` }} /></i>
    <strong>{rate == null ? '—' : `${rate}%`}</strong>
  </span>
}

export function ControlAdherencePanel({ report, tx, language, onOpen }) {
  const en = language === 'en'
  const { period, setPeriod, lines, totals, reportRef } = report
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const title = (item) => (en ? item.titleEn || item.title : item.title)
  const pct = (value) => (value == null ? '—' : `${value}%`)
  const groups = useMemo(() => groupAdherenceLines(lines), [lines])
  const totalPages = Math.max(1, Math.ceil(groups.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const shown = groups.slice((safePage - 1) * pageSize, safePage * pageSize)
  const missed = (value) => <td className={value ? 'control-adherence-missed' : ''}>{value}</td>
  const onTimeCell = (value, late) => <td>{value}{late > 0 && <small>{en ? `${late} late` : `${late} με καθυστέρηση`}</small>}</td>
  const numbers = (row) => <>
    <td>{row.expected}</td>
    <td>{row.performed}</td>
    {onTimeCell(row.onTime, row.late)}
    {missed(row.missed)}
    <td><RateMeter rate={row.rate} /></td>
  </>
  return <div className="control-adherence" ref={reportRef}>
    <div className="control-adherence-toolbar">
      <label className="control-adherence-period"><span>{tx.period}</span><select value={period} onChange={(event) => { setPeriod(event.target.value); setPage(1) }}>{ADHERENCE_PERIODS.map((key) => <option key={key} value={key}>{tx[`p${key}`]}</option>)}</select></label>
      <div className="control-adherence-summary">
        <span><strong className={`control-adherence-total ${adherenceTone(totals.rate)}`}>{pct(totals.rate)}</strong>{tx.adherence}</span>
        <span><strong>{totals.performed} / {totals.expected}</strong>{tx.performed.toLowerCase()}</span>
        <span><strong>{pct(totals.onTimeRate)}</strong>{tx.onTime.toLowerCase()}</span>
        <span><strong className={totals.missed ? 'missed' : ''}>{totals.missed}</strong>{tx.missed.toLowerCase()}</span>
      </div>
      <span className="control-info-tip" tabIndex={0} title={tx.adherenceNote} aria-label={tx.adherenceNote} data-pdf-ignore=""><Info size={15} aria-hidden="true" /></span>
    </div>
    <div className="scroll-table">
      <table className="data-table sticky-table control-adherence-table">
        <thead><tr><th>{en ? 'Control / department' : 'Έλεγχος / τμήμα'}</th><th>{en ? 'Frequency' : 'Συχνότητα'}</th><th>{tx.expected}</th><th>{tx.performed}</th><th>{tx.onTime}</th><th>{tx.missed}</th><th>{tx.adherenceRate}</th></tr></thead>
        <tbody>{shown.map((group) => group.lines.length === 1
          ? <tr key={group.item.id} className="control-adherence-single" onClick={() => onOpen?.(group.item)}>
              <td><strong>{title(group.item)}</strong><small>{group.lines[0].department} · {group.item.category}</small></td>
              <td>{frequencyLabel(group.item.frequency, language)}</td>
              {numbers(group.lines[0])}
            </tr>
          : [
            <tr key={`${group.item.id}-group`} className="control-adherence-group" onClick={() => onOpen?.(group.item)}>
              <td><strong>{title(group.item)}</strong><small>{group.item.category} · {en ? `${group.lines.length} departments` : `${group.lines.length} τμήματα`}</small></td>
              <td>{frequencyLabel(group.item.frequency, language)}</td>
              {numbers(group.totals)}
            </tr>,
            ...group.lines.map((line) => <tr key={`${line.item.id}-${line.department}`} className="control-adherence-member" onClick={() => onOpen?.(line.item)}>
              <td className="control-adherence-department">{line.department}</td>
              <td />
              {numbers(line)}
            </tr>),
          ])}</tbody>
      </table>
      {!lines.length && <div className="inline-empty" role="status"><strong>{tx.noAdherence}</strong><span>{en ? 'Change the period or the search.' : 'Αλλάξτε την περίοδο ή την αναζήτηση.'}</span></div>}
    </div>
    {groups.length > 0 && <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={groups.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />}
  </div>
}
