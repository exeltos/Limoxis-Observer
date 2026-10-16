import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Lock, LockOpen, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { PeriodStepper } from '../../design-system/PeriodStepper'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { StatusBadge } from '../../design-system/StatusBadge'
import { Sparkline } from '../../design-system/MiniCharts'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { saveEntry, setEntryLocked } from './registerService'
import { useRegisterAccess } from './registerAccess'
import { periodLabel, periodOf, shiftPeriod, textOf } from './registerEngine'

const thisMonth = () => new Date().toISOString().slice(0, 7)
const blank = value => value === undefined || value === null || value === ''
const monthShift = (month, by) => shiftPeriod(periodOf('month', `${month}-01`), by).from.slice(0, 7)
// The sum of a row's measures in one month's values (null: nothing recorded).
const rowSum = (values, row, measures) => { const cells = measures.map(measure => values?.[row]?.[measure.key]).filter(cell => !blank(cell)); return cells.length ? cells.reduce((sum, cell) => sum + Number(cell), 0) : null }

// What a row looked like before this month: the previous month, the same month
// last year, the last twelve months, and whether today's value is far from the
// usual (more than half away from the average of the three months before).
export function rowContext(row, measures, valuesOf, month, current) {
  const months = Array.from({ length: 12 }, (_, index) => monthShift(month, index - 11))
  const trend = months.map(item => (item === month ? current : rowSum(valuesOf(item), row, measures)))
  const previous = rowSum(valuesOf(monthShift(month, -1)), row, measures)
  const lastYear = rowSum(valuesOf(monthShift(month, -12)), row, measures)
  const before = [1, 2, 3].map(back => rowSum(valuesOf(monthShift(month, -back)), row, measures)).filter(value => value != null)
  const average = before.length ? before.reduce((sum, value) => sum + value, 0) / before.length : null
  const unusual = current != null && average != null && average >= 5 && Math.abs(current - average) / average > 0.5
  return { trend, previous, lastYear, average, unusual }
}

// A sheet register: the grid of a month (rows × measures, whole numbers, an
// empty cell is «not recorded», not zero), closing the month, and the year at
// a glance underneath.
export function RegisterSheet({ register, entries, onSaved, onExport }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, confirm } = useFeedback()
  const tableRef = useRef(null)
  const { tenant } = useTenant()
  const access = useRegisterAccess()
  const navigate = useNavigate()
  const [month, setMonth] = useState(() => [...entries].map(entry => String(entry.periodStart).slice(0, 7)).sort().pop() || thisMonth())
  const periodStart = `${month}-01`
  const entry = entries.find(item => item.periodStart === periodStart) || null
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)
  useEffect(() => setValues(structuredClone(entry?.values || {})), [entry?.id, periodStart]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = register.sheet?.rows || []
  const measures = register.sheet?.measures || []
  const groups = register.sheet?.groups || []
  const locked = Boolean(entry?.locked)
  const canEdit = access.canRecord(register) && !locked
  const set = (row, measure, text) => setValues(current => {
    const next = { ...current, [row]: { ...(current[row] || {}) } }
    const clean = String(text).replace(/[^0-9]/g, '')
    if (clean === '') delete next[row][measure]; else next[row][measure] = Number(clean)
    return next
  })
  const rowTotal = row => { const cells = measures.map(measure => values[row]?.[measure.key]).filter(cell => !blank(cell)); return cells.length ? cells.reduce((sum, cell) => sum + Number(cell), 0) : null }
  const measureTotal = measure => { const cells = rows.map(row => values[row.key]?.[measure]).filter(cell => !blank(cell)); return cells.length ? cells.reduce((sum, cell) => sum + Number(cell), 0) : null }
  const grand = rows.reduce((sum, row) => sum + (rowTotal(row.key) || 0), 0)
  const dirty = JSON.stringify(values) !== JSON.stringify(entry?.values || {})
  const valuesByMonth = useMemo(() => new Map(entries.map(item => [String(item.periodStart).slice(0, 7), item.values || {}])), [entries])
  const filled = rows.filter(row => rowSum(values, row.key, measures) != null).length
  const contexts = new Map(rows.map(row => [row.key, rowContext(row.key, measures, item => valuesByMonth.get(item), month, rowSum(values, row.key, measures))]))
  const unusualCount = [...contexts.values()].filter(context => context.unusual).length
  const fmt = value => (value == null ? '—' : new Intl.NumberFormat(en ? 'en-GB' : 'el-GR').format(value))
  const label = periodLabel(periodOf('month', periodStart), language)
  // Another month: unsaved numbers are not dropped without asking.
  async function goToMonth(next) {
    if (next === month) return
    if (dirty && canEdit && !(await confirm({ title: en ? 'Unsaved changes' : 'Μη αποθηκευμένες αλλαγές', message: en ? `The changes to ${label} are not saved. Leave them?` : `Οι αλλαγές του φύλλου «${label}» δεν έχουν αποθηκευτεί. Να χαθούν;`, confirmLabel: en ? 'Leave without saving' : 'Αλλαγή μήνα χωρίς αποθήκευση', danger: true }))) return
    setMonth(next)
  }
  // Enter moves to the next cell, as in a spreadsheet.
  function nextCell(event) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const inputs = [...(tableRef.current?.querySelectorAll('input:not(:disabled)') || [])]
    inputs[inputs.indexOf(event.target) + 1]?.focus()
  }

  async function save() {
    if (!canEdit || saving) return
    setSaving(true)
    try {
      await saveEntry(tenant?.id, register, { ...(entry || {}), periodStart, values })
      notify(en ? 'Sheet saved.' : 'Το φύλλο αποθηκεύτηκε.', 'success')
      await onSaved?.()
    } catch (error) {
      console.error(error)
      notify(en ? 'The sheet could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση του φύλλου.', 'error')
    } finally { setSaving(false) }
  }
  async function toggleLock() {
    if (!entry) return
    try {
      await setEntryLocked(tenant?.id, register, entry.id, !locked)
      notify(locked ? (en ? 'Month reopened.' : 'Ο μήνας άνοιξε ξανά.') : (en ? 'Month closed.' : 'Ο μήνας έκλεισε.'), 'success')
      await onSaved?.()
    } catch (error) { console.error(error); notify(en ? 'Not allowed.' : 'Δεν επιτρέπεται.', 'error') }
  }

  const grouped = groups.length ? [...groups.map(group => ({ group, rows: rows.filter(row => row.group === group.key) })), { group: null, rows: rows.filter(row => !groups.some(group => group.key === row.group)) }].filter(item => item.rows.length) : [{ group: null, rows }]
  return <div className="register-sheet-layout">
    <RecordTabPanel className="register-sheet" title={en ? 'Month sheet' : 'Καταχώριση μήνα'} subtitle={<>{en ? `${filled} of ${rows.length} rows filled` : `${filled} από ${rows.length} γραμμές συμπληρωμένες`}{unusualCount > 0 && <span className="register-sheet-unusual-note"><AlertTriangle size={13} />{en ? unusualCount === 1 ? '1 unusual value: check it' : `${unusualCount} unusual values: check them` : unusualCount === 1 ? '1 ασυνήθιστη τιμή: ελέγξτε την' : `${unusualCount} ασυνήθιστες τιμές: ελέγξτε τες`}</span>}</>}
      actions={<div className="register-sheet-actions">
        <PeriodStepper label={label} onPrevious={() => goToMonth(monthShift(month, -1))} onNext={() => goToMonth(monthShift(month, 1))} nextDisabled={month >= thisMonth()} />
        {onExport && <PrintExportActions showPrint={false} onExport={onExport} />}
        {access.canRecord(register) && <Button variant="secondary" onClick={() => navigate(`/registers/${register.id}/import`)}><Upload size={15} />{en ? 'Import' : 'Εισαγωγή'}</Button>}
        {entry && <StatusBadge tone={locked ? 'neutral' : 'info'}>{locked ? (en ? 'Closed' : 'Κλειστός') : (en ? 'Open' : 'Ανοιχτός')}</StatusBadge>}
        {entry && (locked ? access.canReopen(register) : access.canRecord(register)) && <Button variant="secondary" onClick={toggleLock}>{locked ? <LockOpen size={15} /> : <Lock size={15} />}{locked ? (en ? 'Reopen month' : 'Άνοιγμα μήνα') : (en ? 'Close month' : 'Κλείσιμο μήνα')}</Button>}
      </div>}
      footer={canEdit && <div className="inline-edit-footer"><SaveButton loading={saving} disabled={saving || !dirty} onClick={save}>{en ? 'Save sheet' : 'Αποθήκευση φύλλου'}</SaveButton></div>}>
      <div className="scroll-table"><table ref={tableRef} className="data-table register-sheet-table">
        <thead><tr><th>{en ? 'Row' : 'Γραμμή'}</th>{measures.map(measure => <th key={measure.key} className="register-num">{textOf(measure, language)}</th>)}{measures.length > 1 && <th className="register-num">{en ? 'Total' : 'Σύνολο'}</th>}<th className="register-num register-sheet-context">{en ? 'Previous month' : 'Προηγ. μήνας'}</th><th className="register-num register-sheet-context">{en ? 'Last year' : 'Πέρσι'}</th><th className="register-sheet-context">{en ? '12 months' : '12 μήνες'}</th></tr></thead>
        <tbody>{grouped.map(({ group, rows: groupRows }) => [
          group && <tr key={`g-${group.key}`} className="register-sheet-group"><th colSpan={measures.length + (measures.length > 1 ? 2 : 1) + 3}>{textOf(group, language)}</th></tr>,
          ...groupRows.map(row => { const context = contexts.get(row.key); return <tr key={row.key} className={context.unusual ? 'is-unusual' : ''}>
            <td className="register-row-label">{textOf(row, language)}{row.help && <small>{en ? row.helpEn || row.help : row.help}</small>}</td>
            {measures.map(measure => <td key={measure.key} className="register-num">{canEdit ? <input aria-label={`${textOf(row, language)} · ${textOf(measure, language)}`} inputMode="numeric" value={values[row.key]?.[measure.key] ?? ''} onChange={event => set(row.key, measure.key, event.target.value)} onKeyDown={nextCell} /> : <span className="register-sheet-value">{fmt(values[row.key]?.[measure.key] ?? null)}</span>}</td>)}
            {measures.length > 1 && <td className="register-num"><strong>{fmt(rowTotal(row.key))}</strong></td>}
            <td className="register-num register-sheet-context">{fmt(context.previous)}{context.unusual && <small title={en ? 'Average of the three months before' : 'Μέσος όρος των τριών προηγούμενων μηνών'}><AlertTriangle size={12} />{en ? 'avg' : 'μ.ό.'} {fmt(Math.round(context.average))}</small>}</td>
            <td className="register-num register-sheet-context">{fmt(context.lastYear)}</td>
            <td className="register-sheet-context"><Sparkline width={96} height={26} points={context.trend} label={en ? `${textOf(row, language)}: the last 12 months` : `${textOf(row, language)}: οι τελευταίοι 12 μήνες`} /></td>
          </tr> }),
        ])}</tbody>
        <tfoot><tr><th>{en ? 'Total' : 'Σύνολο'}</th>{measures.map(measure => <td key={measure.key} className="register-num">{fmt(measureTotal(measure.key))}</td>)}{measures.length > 1 && <td className="register-num"><strong>{fmt(grand)}</strong></td>}<td className="register-num register-sheet-context">{fmt(rows.reduce((sum, row) => sum + (contexts.get(row.key).previous || 0), 0) || null)}</td><td className="register-num register-sheet-context">{fmt(rows.reduce((sum, row) => sum + (contexts.get(row.key).lastYear || 0), 0) || null)}</td><td /></tr></tfoot>
      </table></div>
      <p className="register-sheet-hint">{en ? 'An empty cell means not recorded; write 0 when there were none.' : 'Κενό κελί σημαίνει «δεν καταγράφηκε»· γράψτε 0 όταν δεν έγινε καμία.'}</p>
    </RecordTabPanel>
    <SheetYear register={register} entries={entries} year={month.slice(0, 4)} selected={periodStart} onSelect={day => goToMonth(day.slice(0, 7))} />
  </div>
}

// The year: one column per month, one row per sheet row (sum of measures).
function SheetYear({ register, entries, year, selected, onSelect }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}-01`), [year])
  const byMonth = new Map(entries.map(entry => [entry.periodStart, entry]))
  const cell = (entry, row) => {
    if (!entry) return null
    const cells = (register.sheet?.measures || []).map(measure => entry.values?.[row]?.[measure.key]).filter(value => !blank(value))
    return cells.length ? cells.reduce((sum, value) => sum + Number(value), 0) : null
  }
  const short = day => new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
  return <RecordTabPanel className="register-sheet-year" title={en ? `Year ${year}` : `Έτος ${year}`} subtitle={en ? 'Pick a month to open its sheet.' : 'Επιλέξτε μήνα για να ανοίξει το φύλλο του.'}>
    <div className="scroll-table"><table className="data-table register-year-table">
      <thead><tr><th>{en ? 'Row' : 'Γραμμή'}</th>{months.map(day => <th key={day} className={`register-num ${day === selected ? 'is-selected' : ''}`}><button type="button" onClick={() => onSelect(day)}>{short(day)}{byMonth.get(day)?.locked && <Lock size={11} />}</button></th>)}<th className="register-num">{en ? 'Year' : 'Έτος'}</th></tr></thead>
      <tbody>{(register.sheet?.rows || []).map(row => {
        const values = months.map(day => cell(byMonth.get(day), row.key))
        const total = values.filter(value => value != null)
        return <tr key={row.key}><td className="register-row-label">{textOf(row, language)}</td>{values.map((value, index) => <td key={months[index]} className={`register-num ${months[index] === selected ? 'is-selected' : ''}`}>{value ?? '·'}</td>)}<td className="register-num"><strong>{total.length ? total.reduce((sum, value) => sum + value, 0) : '—'}</strong></td></tr>
      })}</tbody>
    </table></div>
  </RecordTabPanel>
}
