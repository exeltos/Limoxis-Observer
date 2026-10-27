import { useEffect, useMemo, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { downloadCsv } from '../../core/export/csvExport'
import { escapeHtml, printReport } from '../../core/export/reportDocument'
import { formatDay } from '../../core/i18n/formatDay'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { frequencyLabel, linesFrequencyLabel } from './controlScheduling'
import { adherenceTone, groupAdherenceLines, periodAdherence, periodRange } from './controlAdherence'
import { loadControlAdherenceCounts } from './controlCloudService'
import './controlAdherence.css'

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

// Programme adherence: due vs done vs on time per control and department.
// The page owns the report (period + downloads) so its Download button sits
// in the page header like every other list; the period is the page's.
export function useControlAdherenceReport(rows, tx, language, organizationId, refreshKey, now = null, period = '30d') {
  const en = language === 'en'
  const { notify } = useFeedback()
  const reportRef = useRef(null)
  const { counts, failed } = useAdherenceCounts(organizationId, period, refreshKey, now)
  const { lines, totals } = useMemo(() => (failed ? periodAdherence([], period, new Map(), now || new Date()) : periodAdherence(rows, period, counts, now || new Date())), [rows, period, counts, failed, now])
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
    const numbers = (row) => [{ text: String(row.expected), className: 'rd-num' }, { text: String(row.performed), className: 'rd-num' }, { text: `${row.onTime}${row.late ? ` (${en ? `${row.late} late` : `${row.late} με καθυστέρηση`})` : ''}`, className: 'rd-num' }, { text: String(row.missed), className: row.missed ? 'rd-num rd-bad' : 'rd-num' }, { text: pct(row.rate), className: `rd-num ${{ good: 'rd-good', fair: 'rd-warn', low: 'rd-bad' }[adherenceTone(row.rate)] || ''}` }]
    const tableRows = groupAdherenceLines(lines).flatMap((group) => group.lines.length === 1
      ? [[{ html: `<strong>${escapeHtml(title(group.item))}</strong><small>${escapeHtml(`${group.lines[0].department} · ${group.item.category || ''}`)}</small>` }, linesFrequencyLabel(group.lines, group.item, language), ...numbers(group.lines[0])]]
      : [[{ html: `<strong>${escapeHtml(title(group.item))}</strong><small>${escapeHtml(`${group.item.category || ''} · ${en ? `${group.lines.length} departments` : `${group.lines.length} τμήματα`}`)}</small>` }, linesFrequencyLabel(group.lines, group.item, language), ...numbers(group.totals)],
         ...group.lines.map((line) => [{ text: line.department, className: 'rd-sub-cell' }, '', ...numbers(line)])])
    const ok = printReport({
      language, orientation: 'landscape',
      kind: en ? 'Controls' : 'Έλεγχοι',
      code: tx[`p${period}`],
      title: en ? 'Control programme adherence' : 'Τήρηση προγράμματος ελέγχων',
      meta: [[tx.period, `${tx[`p${period}`]} (${formatDay(dayKey(from), language)} – ${formatDay(dayKey(to), language)})`], [tx.adherence, pct(totals.rate)], [tx.performed, `${totals.performed} / ${totals.expected}`], [tx.onTime, pct(totals.onTimeRate)], [tx.missed, String(totals.missed)], [en ? 'Controls' : 'Έλεγχοι', String(lines.length)]],
      sections: [{ title: en ? 'Adherence per control and department' : 'Τήρηση ανά έλεγχο και τμήμα', note: tx.adherenceNote, table: { columns: [en ? 'Control / department' : 'Έλεγχος / τμήμα', en ? 'Frequency' : 'Συχνότητα', tx.expected, tx.performed, tx.onTime, tx.missed, tx.adherenceRate], rows: tableRows, foot: [tx.total, '', ...numbers(totals)], empty: tx.noAdherence } }],
      signatures: [en ? 'Prepared by' : 'Συντάχθηκε', en ? 'Reviewed by' : 'Ελέγχθηκε'],
      filename: en ? 'control-programme-adherence' : 'tirisi-programmatos-elegxon',
    }, { pdf: pdf === true })
    if (!ok) notify(en ? 'Allow pop-ups to print.' : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'error')
  }

  return { period, lines, totals, reportRef, exporting: false, exportCsv, exportPdf, failed, loadFailedText, until: now }
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

export function ControlAdherencePanel({ report, tx, language, onOpen }) {
  const en = language === 'en'
  const { lines, totals, reportRef, failed, loadFailedText, until } = report
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
      <div className="control-adherence-summary">
        <span><strong className={`control-adherence-total ${adherenceTone(totals.rate)}`}>{pct(totals.rate)}</strong>{tx.adherence}</span>
        <span><strong>{totals.performed} / {totals.expected}</strong>{tx.performed.toLowerCase()}</span>
        <span><strong>{pct(totals.onTimeRate)}</strong>{tx.onTime.toLowerCase()}</span>
        <span><strong className={totals.missed ? 'missed' : ''}>{totals.missed}</strong>{tx.missed.toLowerCase()}</span>
      </div>
      {until && <UntilNote until={until} language={language} />}
      <span className="control-info-tip" tabIndex={0} title={tx.adherenceNote} aria-label={tx.adherenceNote} data-pdf-ignore=""><Info size={15} aria-hidden="true" /></span>
    </div>
    <RegistryTable
      className="control-adherence-table"
      columns={[{ key: 'control', label: en ? 'Control / department' : 'Έλεγχος / τμήμα' }, { key: 'frequency', label: en ? 'Frequency' : 'Συχνότητα' }, { key: 'expected', label: tx.expected }, { key: 'performed', label: tx.performed }, { key: 'onTime', label: tx.onTime }, { key: 'missed', label: tx.missed }, { key: 'rate', label: tx.adherenceRate }]}
      rows={shown.flatMap((group) => group.lines.length === 1 ? [{ key: group.item.id, kind: 'single', group }] : [{ key: `${group.item.id}-group`, kind: 'group', group }, ...group.lines.map((line) => ({ key: `${line.item.id}-${line.department}`, kind: 'member', line }))])}
      rowKey={(entry) => entry.key}
      emptyTitle={failed ? loadFailedText : lines.length ? undefined : tx.noAdherence}
      emptyText={failed ? undefined : en ? 'Change the period or the search.' : 'Αλλάξτε την περίοδο ή την αναζήτηση.'}
      renderRow={(entry) => entry.kind === 'single'
        ? <tr className="control-adherence-single" onClick={() => onOpen?.(entry.group.item)}>
            <td><strong>{title(entry.group.item)}</strong><small>{entry.group.lines[0].department} · {entry.group.item.category}</small></td>
            <td>{linesFrequencyLabel(entry.group.lines, entry.group.item, language)}</td>
            {numbers(entry.group.lines[0])}
          </tr>
        : entry.kind === 'group'
        ? <tr className="control-adherence-group" onClick={() => onOpen?.(entry.group.item)}>
            <td><strong>{title(entry.group.item)}</strong><small>{entry.group.item.category} · {en ? `${entry.group.lines.length} departments` : `${entry.group.lines.length} τμήματα`}</small></td>
            <td>{linesFrequencyLabel(entry.group.lines, entry.group.item, language)}</td>
            {numbers(entry.group.totals)}
          </tr>
        : <tr className="control-adherence-member" onClick={() => onOpen?.(entry.line.item)}>
            <td className="control-adherence-department">{entry.line.department}</td>
            <td />
            {numbers(entry.line)}
          </tr>}
    />
    {groups.length > 0 && <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={groups.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />}
  </div>
}
