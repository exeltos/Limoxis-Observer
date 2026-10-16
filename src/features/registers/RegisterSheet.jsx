import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CalendarDays, CalendarRange, Download, Lock, LockOpen, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { PeriodStepper } from '../../design-system/PeriodStepper'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { SaveButton } from '../../design-system/SaveButton'
import { StatusBadge } from '../../design-system/StatusBadge'
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

// What a row looked like before this month: the previous month, and whether
// today's value is far from the usual (more than half away from the average of
// the three months before; rows that usually count fewer than 5 are not judged).
export function rowContext(row, measures, valuesOf, month, current) {
  const previous = rowSum(valuesOf(monthShift(month, -1)), row, measures)
  const before = [1, 2, 3].map(back => rowSum(valuesOf(monthShift(month, -back)), row, measures)).filter(value => value != null)
  const average = before.length ? before.reduce((sum, value) => sum + value, 0) / before.length : null
  const unusual = current != null && average != null && average >= 5 && Math.abs(current - average) / average > 0.5
  return { previous, average, unusual }
}

// A sheet register: a month as one card per row (whole numbers; an empty cell
// is «not recorded», not zero), or the whole year as a table. A number far
// from the row's usual is marked with what the usual is.
export function RegisterSheet({ register, entries, onSaved, onExport }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, confirm } = useFeedback()
  const tableRef = useRef(null)
  const { tenant } = useTenant()
  const access = useRegisterAccess()
  const navigate = useNavigate()
  const [view, setView] = useState('month')
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
  const year = month.slice(0, 4)
  const isMonth = view === 'month'
  const previousTotal = rows.reduce((sum, row) => sum + (contexts.get(row.key).previous || 0), 0)
  // The month's tools that are not daily work wait in «⋯».
  const menu = [
    onExport && { id: 'export', label: en ? 'Download' : 'Λήψη', icon: Download, onClick: onExport },
    access.canRecord(register) && { id: 'import', label: en ? 'Import from file' : 'Εισαγωγή από αρχείο', icon: Upload, onClick: () => navigate(`/registers/${register.id}/import`) },
    isMonth && entry && (locked ? access.canReopen(register) : access.canRecord(register)) && { id: 'lock', label: locked ? (en ? 'Reopen month' : 'Άνοιγμα μήνα') : (en ? 'Close month' : 'Κλείσιμο μήνα'), icon: locked ? LockOpen : Lock, onClick: toggleLock, separatorBefore: true },
  ].filter(Boolean)
  const subtitle = isMonth
    ? <>{en ? `${filled} of ${rows.length} filled · total ${fmt(grand)}` : `${filled} από ${rows.length} συμπληρωμένες · σύνολο ${fmt(grand)}`}{previousTotal > 0 && <span className="register-sheet-muted">{en ? ` (previous month ${fmt(previousTotal)})` : ` (προηγ. μήνας ${fmt(previousTotal)})`}</span>}{unusualCount > 0 && <span className="register-sheet-unusual-note"><AlertTriangle size={13} />{en ? unusualCount === 1 ? '1 unusual value' : `${unusualCount} unusual values` : unusualCount === 1 ? '1 ασυνήθιστη τιμή' : `${unusualCount} ασυνήθιστες τιμές`}</span>}</>
    : (en ? 'Pick a month to open it.' : 'Πατήστε έναν μήνα για να τον ανοίξετε.')
  return <RecordTabPanel className="register-sheet" title={isMonth ? (en ? 'Entry' : 'Καταχώριση') : (en ? 'The year' : 'Ετήσια εικόνα')} subtitle={subtitle}
    actions={<div className="register-sheet-actions">
      {isMonth
        ? <PeriodStepper label={label} onPrevious={() => goToMonth(monthShift(month, -1))} onNext={() => goToMonth(monthShift(month, 1))} nextDisabled={month >= thisMonth()} />
        : <PeriodStepper label={year} onPrevious={() => goToMonth(`${Number(year) - 1}${month.slice(4)}`)} onNext={() => goToMonth(`${Number(year) + 1}${month.slice(4)}`)} nextDisabled={Number(year) >= Number(thisMonth().slice(0, 4))} />}
      {isMonth && entry && <StatusBadge tone={locked ? 'neutral' : 'info'} icon={locked ? Lock : undefined}>{locked ? (en ? 'Closed' : 'Κλειστός') : (en ? 'Open' : 'Ανοιχτός')}</StatusBadge>}
      {isMonth && canEdit && <SaveButton loading={saving} disabled={saving || !dirty} onClick={save}>{en ? 'Save' : 'Αποθήκευση'}</SaveButton>}
      <ModeSwitch ariaLabel={en ? 'View' : 'Προβολή'} value={view} onChange={setView} options={[{ value: 'month', label: en ? 'Month' : 'Μήνας', icon: CalendarDays }, { value: 'year', label: en ? 'Year' : 'Έτος', icon: CalendarRange }]} />
      {menu.length > 0 && <OverflowMenu items={menu} label={en ? 'More' : 'Περισσότερα'} />}
    </div>}>
    {isMonth ? <div ref={tableRef} className="register-sheet-body">
      {grouped.map(({ group, rows: groupRows }) => <section key={group?.key || 'rows'} className="register-sheet-group">
        {group && <h4>{textOf(group, language)}</h4>}
        <div className="register-sheet-cards">{groupRows.map(row => { const context = contexts.get(row.key); return <div key={row.key} className={`register-sheet-card ${context.unusual ? 'is-unusual' : ''}`}>
          <span className="register-sheet-card-title">{textOf(row, language)}{row.help && <small>{en ? row.helpEn || row.help : row.help}</small>}</span>
          <div className="register-sheet-card-values">{measures.map(measure => <label key={measure.key}>
            {measures.length > 1 && <small>{textOf(measure, language)}</small>}
            {canEdit ? <input aria-label={`${textOf(row, language)} · ${textOf(measure, language)}`} inputMode="numeric" value={values[row.key]?.[measure.key] ?? ''} onChange={event => set(row.key, measure.key, event.target.value)} onKeyDown={nextCell} /> : <strong>{fmt(values[row.key]?.[measure.key] ?? null)}</strong>}
          </label>)}{measures.length > 1 && <span className="register-sheet-card-total"><small>{en ? 'Total' : 'Σύνολο'}</small><strong>{fmt(rowTotal(row.key))}</strong></span>}</div>
          <span className="register-sheet-card-context">{context.unusual ? <><AlertTriangle size={12} />{en ? `usually about ${fmt(Math.round(context.average))}` : `συνήθως περίπου ${fmt(Math.round(context.average))}`}</> : context.previous != null ? (en ? `previous month ${fmt(context.previous)}` : `προηγ. μήνας ${fmt(context.previous)}`) : '\u00a0'}</span>
        </div> })}</div>
      </section>)}
      <p className="register-sheet-hint">{en ? 'An empty box means not recorded; write 0 when there were none.' : 'Κενό πεδίο σημαίνει «δεν καταγράφηκε»· γράψτε 0 όταν δεν έγινε καμία.'}</p>
    </div> : <SheetYear register={register} entries={entries} year={year} selected={periodStart} onSelect={day => { setView('month'); goToMonth(day.slice(0, 7)) }} />}
  </RecordTabPanel>
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
  return <div className="scroll-table register-sheet-year"><table className="data-table register-year-table">
      <thead><tr><th>{en ? 'Row' : 'Γραμμή'}</th>{months.map(day => <th key={day} className={`register-num ${day === selected ? 'is-selected' : ''}`}><button type="button" onClick={() => onSelect(day)}>{short(day)}{byMonth.get(day)?.locked && <Lock size={11} />}</button></th>)}<th className="register-num">{en ? 'Year' : 'Έτος'}</th></tr></thead>
      <tbody>{(register.sheet?.rows || []).map(row => {
        const values = months.map(day => cell(byMonth.get(day), row.key))
        const total = values.filter(value => value != null)
        return <tr key={row.key}><td className="register-row-label">{textOf(row, language)}</td>{values.map((value, index) => <td key={months[index]} className={`register-num ${months[index] === selected ? 'is-selected' : ''}`}>{value ?? '·'}</td>)}<td className="register-num"><strong>{total.length ? new Intl.NumberFormat(en ? 'en-GB' : 'el-GR').format(total.reduce((sum, value) => sum + value, 0)) : '—'}</strong></td></tr>
      })}</tbody>
    </table></div>
}
