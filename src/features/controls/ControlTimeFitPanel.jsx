import { useEffect, useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { useTableSort } from '../../design-system/useTableSort'
import { ChoiceChips } from '../../design-system/ChoiceChips'
import { FilterSelect } from '../../design-system/FilterBar'
import { Button } from '../../design-system/Button'
import { downloadCsv } from '../../core/export/csvExport'
import { printReport } from '../../core/export/reportDocument'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { RateMeter, UntilNote } from './ControlAdherencePanel'
import { periodRange } from './controlAdherence'
import { TIME_FIT_DAYS, timeFitLines } from './controlTimeFit'
import { loadControlExecutionTimes, saveDepartmentTimes } from './controlCloudService'
import './controlAdherence.css'

const timesText = (times) => times.join(', ')

// The «Times» report (owner and central roles): per department, the set times
// of each daily control, when it is really recorded and the times that would
// fit; «Change» moves that department to the proposal.
export function useControlTimeFitReport(rows, organizationId, language, refreshKey, now = null) {
  const en = language === 'en'
  const { notify } = useFeedback()
  const [state, setState] = useState({ key: '', times: null, failed: false, loaded: false })
  const nowIso = now ? new Date(now).toISOString() : ''
  const key = `${organizationId || ''}|${nowIso}`
  useEffect(() => {
    if (!organizationId) return undefined
    let active = true
    loadControlExecutionTimes(organizationId, periodRange('30d', nowIso ? new Date(nowIso) : new Date()))
      .then((times) => { if (active) setState({ key, times, failed: false, loaded: true }) })
      .catch(() => { if (active) setState({ key, times: null, failed: true, loaded: true }) })
    return () => { active = false }
  }, [organizationId, key, nowIso, refreshKey])
  const current = state.key === key ? state : { times: null, failed: false, loaded: false }
  const lines = useMemo(() => (current.failed || !current.loaded ? [] : timeFitLines(rows, current.times, periodRange('30d', now || new Date()))), [rows, current.times, current.failed, current.loaded, now])
  const title = (item) => (en ? item.titleEn || item.title : item.title)
  const pct = (value) => (value == null ? '—' : `${value}%`)
  const columns = [en ? 'Department' : 'Τμήμα', en ? 'Control' : 'Έλεγχος', en ? 'Set times' : 'Ώρες τώρα', en ? 'Usually done' : 'Γίνεται συνήθως', en ? 'Proposal' : 'Πρόταση', en ? 'On time now' : 'Στην ώρα τους τώρα', en ? 'With the proposal' : 'Με την πρόταση']
  const cells = (line) => [line.department, title(line.item), timesText(line.current), line.typical.map((t) => t || '—').join(', '), line.changed ? timesText(line.proposed) : (en ? 'No change' : 'Χωρίς αλλαγή'), pct(line.rateNow), pct(line.rateProposed)]
  function exportCsv() {
    downloadCsv(en ? 'control-times.csv' : 'ores-elegxon.csv', columns, lines.map(cells))
  }
  function exportPrint() {
    const ok = printReport({
      language, orientation: 'landscape',
      kind: en ? 'Controls' : 'Έλεγχοι',
      title: en ? 'Execution times per department' : 'Ώρες εκτέλεσης ανά τμήμα',
      meta: [[en ? 'Period' : 'Περίοδος', en ? `Last ${TIME_FIT_DAYS} days` : `Τελευταίες ${TIME_FIT_DAYS} ημέρες`], [en ? 'With a proposal' : 'Με πρόταση αλλαγής', String(lines.filter((line) => line.changed).length)]],
      sections: [{ title: en ? 'Set times and practice' : 'Ώρες ελέγχων και πράξη', note: timeFitNote(language), table: { columns, rows: lines.map(cells), empty: en ? 'No daily controls with set times.' : 'Δεν υπάρχουν ημερήσιοι έλεγχοι με ώρες.' } }],
      filename: en ? 'control-times' : 'ores-elegxon',
    })
    if (!ok) notify(en ? 'Allow pop-ups to print.' : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'error')
  }
  return { lines, loading: !current.loaded, failed: current.failed, exportCsv, exportPrint, until: now }
}

export const timeFitNote = (language) => language === 'en'
  ? `For each daily control: its set times, the usual time of each entry in the last ${TIME_FIT_DAYS} days and the full hours that would catch the most entries in their window (1 hour before to 2 hours after when once a day, ±1 hour when more often). A proposal is shown only when it is clearly better. Agree it with the department before changing it.`
  : `Για κάθε ημερήσιο έλεγχο: οι ώρες του, η συνήθης ώρα κάθε καταγραφής τις τελευταίες ${TIME_FIT_DAYS} ημέρες και οι ακέραιες ώρες που θα έπιαναν τις περισσότερες καταγραφές μέσα στο περιθώριο (1 ώρα πριν έως 2 μετά όταν γίνεται μία φορά, ±1 ώρα όταν γίνεται συχνότερα). Πρόταση εμφανίζεται μόνο όταν είναι σαφώς καλύτερη. Συμφωνήστε την με το τμήμα πριν την αλλαγή.`

export function ControlTimeFitPanel({ report, organizationId, language, canChange, onChanged, onOpen }) {
  const en = language === 'en'
  const { confirm, notify, notifyError } = useFeedback()
  const { lines, loading, failed, until } = report
  const [onlyChanges, setOnlyChanges] = useState(true)
  const [department, setDepartment] = useState('all')
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(15)
  const [busy, setBusy] = useState('')
  const departments = [...new Set(lines.map((line) => line.department))]
  const scoped = department === 'all' ? lines : lines.filter((line) => line.department === department)
  const changes = scoped.filter((line) => line.changed)
  const shown = onlyChanges ? changes : scoped
  const title = (item) => (en ? item.titleEn || item.title : item.title)
  // The arrows in the headers sort the whole list; then the page is cut.
  const { sorted: sortedLines, sort, onSort } = useTableSort(shown, {
    control: (line) => title(line.item),
    current: (line) => timesText(line.current),
    typical: (line) => line.typical.map((t) => t || '').join(', '),
    proposed: (line) => (line.changed ? timesText(line.proposed) : null),
    now: (line) => line.rateNow,
    after: (line) => line.rateProposed,
  })
  useEffect(() => setPage(1), [sort])
  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize)), safePage = Math.min(page, totalPages)
  const paged = sortedLines.slice((safePage - 1) * pageSize, safePage * pageSize)
  async function change(line) {
    const ok = await confirm({
      title: en ? 'Change the times' : 'Αλλαγή ωρών',
      message: en ? `${title(line.item)} in ${line.department}: ${timesText(line.current)} → ${timesText(line.proposed)}. The adherence of the past is counted again with the new times.` : `«${title(line.item)}» στο τμήμα ${line.department}: ${timesText(line.current)} → ${timesText(line.proposed)}. Η τήρηση και των προηγούμενων ημερών θα μετρηθεί με τις νέες ώρες.`,
      confirmLabel: en ? 'Change' : 'Αλλαγή',
    })
    if (!ok) return
    const id = `${line.item.id}|${line.department}`
    setBusy(id)
    try {
      await saveDepartmentTimes(organizationId, line.item, line.department, line.proposed)
      notify(en ? 'The times changed.' : 'Οι ώρες άλλαξαν.', 'success')
      onChanged?.()
    } catch (error) { notifyError(error, 'save', { operation: 'control_department_times' }) }
    finally { setBusy('') }
  }
  return <div className="control-adherence control-time-fit">
    <div className="control-adherence-toolbar">
      {departments.length > 1 && <FilterSelect label={en ? 'Department' : 'Τμήμα'} value={department} onChange={(value) => { setDepartment(value); setPage(1) }}><option value="all">{en ? 'All departments' : 'Όλα τα τμήματα'}</option>{departments.map((dep) => <option key={dep} value={dep}>{dep}</option>)}</FilterSelect>}
      <ChoiceChips className="control-time-fit-filter" label="" options={[{ value: 'changes', label: `${en ? 'Only proposals' : 'Μόνο με πρόταση'} (${changes.length})` }]} selected={onlyChanges ? ['changes'] : []} onToggle={() => { setOnlyChanges(!onlyChanges); setPage(1) }} />
      {until && <UntilNote until={until} language={language} />}
      <span className="control-info-tip" tabIndex={0} title={timeFitNote(language)} aria-label={timeFitNote(language)}><Info size={15} aria-hidden="true" /></span>
    </div>
    <RegistryTable sort={sort} onSort={onSort}
      className="control-adherence-table control-time-fit-table"
      columns={[{ key: 'control', label: en ? 'Control / department' : 'Έλεγχος / τμήμα', sortable: true }, { key: 'current', label: en ? 'Set times' : 'Ώρες τώρα', sortable: true }, { key: 'typical', label: en ? 'Usually done' : 'Γίνεται συνήθως', sortable: true }, { key: 'proposed', label: en ? 'Proposal' : 'Πρόταση', sortable: true }, { key: 'now', label: en ? 'On time now' : 'Στην ώρα τους τώρα', sortable: true }, { key: 'after', label: en ? 'With the proposal' : 'Με την πρόταση', sortable: true }, ...(canChange ? [{ key: 'action', label: '', ariaLabel: en ? 'Change' : 'Αλλαγή' }] : [])]}
      rows={paged}
      loading={loading}
      rowKey={(line) => `${line.item.id}|${line.department}`}
      emptyTitle={failed ? (en ? 'The times could not be loaded. Try again.' : 'Δεν ήταν δυνατή η φόρτωση των ωρών. Δοκιμάστε ξανά.') : loading ? undefined : onlyChanges && scoped.length ? (en ? 'No proposal: the times fit the practice.' : 'Καμία πρόταση: οι ώρες ταιριάζουν με την πράξη.') : (en ? 'No daily controls with set times.' : 'Δεν υπάρχουν ημερήσιοι έλεγχοι με ώρες.')}
      emptyText={failed ? undefined : onlyChanges && scoped.length ? (en ? 'Press «Only proposals» to see every control.' : 'Πατήστε «Μόνο με πρόταση» για να δείτε όλους τους ελέγχους.') : undefined}
      renderRow={(line) => <tr className={line.changed ? 'control-time-fit-change' : ''}>
        <td><button type="button" className="control-expiry-control-link" onClick={() => onOpen?.(line.item)}>{title(line.item)}</button><small>{line.department} · {en ? `${line.entries} entries` : `${line.entries} καταγραφές`}</small></td>
        <td>{timesText(line.current)}</td>
        <td>{line.typical.map((t) => t || '—').join(', ')}</td>
        <td>{line.changed ? <strong>{timesText(line.proposed)}</strong> : <span className="control-time-fit-same">{en ? 'No change' : 'Χωρίς αλλαγή'}</span>}</td>
        <td><RateMeter rate={line.rateNow} /></td>
        <td><RateMeter rate={line.rateProposed} /></td>
        {canChange && <td className="controls-record-cell">{line.changed && <Button variant="secondary" className="controls-record-now" disabled={Boolean(busy)} onClick={() => change(line)}>{en ? 'Change' : 'Αλλαγή'}</Button>}</td>}
      </tr>}
    />
    {shown.length > 0 && <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={shown.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />}
  </div>
}
