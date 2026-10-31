import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowDownRight, ArrowLeft, ArrowUpRight, CalendarDays, CalendarX2, Gauge, Pencil, Sigma, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { PeriodStepper } from '../../design-system/PeriodStepper'
import { RecordMetricStrip } from '../../design-system/RecordMetricStrip'
import { FilterDate, FilterSelect } from '../../design-system/FilterBar'
import { KpiFigures } from '../../design-system/KpiCard'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { saveEntry } from './registerService'
import { exportRegistry } from '../../core/export/registryExports'
import { exportElementAsPdf } from '../../core/export/pdfReportExport'
import { formatDay } from '../../core/i18n/formatDay'
import { useRegisterAccess } from './registerAccess'
import { DAILY_SHEETS_FROM, periodLabel, periodOf, shiftPeriod, textOf } from './registerEngine'
import { registerThemeKey } from './registerThemes'

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

// A sheet register, recorded day by day: a day as one card per row (whole numbers; an empty cell is
// «not recorded», not zero), the month as the sum of its days, or the whole year as a table. Months
// recorded before the daily sheets (one total for the month, on its first day) stay as they were.
const today = () => new Date().toISOString().slice(0, 10)
// The day the entry opens on: today, or the last working day before it (a Saturday opens on the Friday).
const lastWorkingDay = day => { let current = day; for (let step = 0; step < 3; step += 1) { const weekday = new Date(`${current}T00:00:00Z`).getUTCDay(); if (weekday !== 0 && weekday !== 6) return current; current = dayShift(current, -1) } return day }
const dayShift = (day, by) => { const date = new Date(`${day}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + by); return date.toISOString().slice(0, 10) }
const daysOf = month => { const [y, m] = month.split('-').map(Number); return Array.from({ length: new Date(Date.UTC(y, m, 0)).getUTCDate() }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`) }
// The values of several entries added together, row by row and measure by measure.
const sumValues = list => list.reduce((total, values) => { for (const [row, cells] of Object.entries(values || {})) { total[row] = total[row] || {}; for (const [measure, cell] of Object.entries(cells || {})) if (!blank(cell)) total[row][measure] = (total[row][measure] || 0) + Number(cell) } return total }, {})
// Sheets are recorded day by day from November 2026; the months before keep their one monthly total.
export { DAILY_SHEETS_FROM }
export const dailyFromOf = register => register.sheet?.dailyFrom || DAILY_SHEETS_FROM

// newDayTick: «New day» in the record's header (each press opens today's entry).
export function RegisterSheet({ register, entries, onSaved, newDayTick = 0, onExportApi = null }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, confirm } = useFeedback()
  const tableRef = useRef(null)
  const { tenant } = useTenant()
  const access = useRegisterAccess()
  const navigate = useNavigate()
  const dailyFrom = dailyFromOf(register)
  // The tab opens on the list of everything recorded; a row opens that day (or month), read-only until «Edit».
  const [view, setView] = useState('list')
  const [editing, setEditing] = useState(false)
  // A shift at a time (or the day's total) when the sheet has several shifts; the first shift opens.
  const [shift, setShift] = useState(() => register.sheet?.measures?.[0]?.key || '')
  const [day, setDay] = useState(() => (thisMonth() >= dailyFrom ? lastWorkingDay(today()) : `${[...entries].map(entry => String(entry.periodStart).slice(0, 7)).sort().pop() || thisMonth()}-01`))
  const month = day.slice(0, 7)
  const legacy = month < dailyFrom
  const periodStart = legacy ? `${month}-01` : day
  const monthEntries = useMemo(() => entries.filter(item => String(item.periodStart).startsWith(month)), [entries, month])
  const entry = entries.find(item => item.periodStart === periodStart) || null
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)
  useEffect(() => setValues(structuredClone(entry?.values || {})), [entry?.id, periodStart]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = register.sheet?.rows || []
  const measures = register.sheet?.measures || []
  const groups = register.sheet?.groups || []
  const isMonth = view === 'month'
  const isDay = view === 'day'
  const canRecordDay = isDay && access.canRecord(register) && periodStart <= today()
  // A saved day opens as it is; «Edit» in «⋯» unlocks it. A day nobody recorded yet is open for typing.
  const canEdit = canRecordDay && (!entry || editing)
  const shown = isMonth && !legacy ? sumValues(monthEntries.map(item => item.values)) : values
  const set = (row, measure, text) => setValues(current => {
    const next = { ...current, [row]: { ...(current[row] || {}) } }
    const clean = String(text).replace(/[^0-9]/g, '')
    if (clean === '') delete next[row][measure]; else next[row][measure] = Number(clean)
    return next
  })
  const rowTotal = row => { const cells = measures.map(measure => shown[row]?.[measure.key]).filter(cell => !blank(cell)); return cells.length ? cells.reduce((sum, cell) => sum + Number(cell), 0) : null }
  const grand = rows.reduce((sum, row) => sum + (rowTotal(row.key) || 0), 0)
  const dirty = JSON.stringify(values) !== JSON.stringify(entry?.values || {})
  // What a row usually is: by month for the month and the earlier monthly totals, by day for a day.
  const valuesByMonth = useMemo(() => { const byMonth = new Map(); for (const item of entries) { const key = String(item.periodStart).slice(0, 7); byMonth.set(key, [...(byMonth.get(key) || []), item.values || {}]) } return new Map([...byMonth].map(([key, list]) => [key, sumValues(list)])) }, [entries])
  const valuesByDay = useMemo(() => new Map(entries.map(item => [String(item.periodStart), item.values || {}])), [entries])
  const dayContext = (row, current) => {
    const previous = rowSum(valuesByDay.get(dayShift(day, -1)), row, measures)
    const before = Array.from({ length: 7 }, (_, index) => rowSum(valuesByDay.get(dayShift(day, -(index + 1))), row, measures)).filter(value => value != null)
    const average = before.length ? before.reduce((sum, value) => sum + value, 0) / before.length : null
    return { previous, average, unusual: current != null && average != null && average >= 5 && Math.abs(current - average) / average > 0.5 }
  }
  const filled = rows.filter(row => rowSum(shown, row.key, measures) != null).length
  const byDay = isDay && !legacy
  const contexts = new Map(rows.map(row => [row.key, byDay ? dayContext(row.key, rowSum(shown, row.key, measures)) : rowContext(row.key, measures, item => valuesByMonth.get(item), month, rowSum(shown, row.key, measures))]))
  const unusualCount = [...contexts.values()].filter(context => context.unusual).length
  const fmt = value => (value == null ? '—' : new Intl.NumberFormat(en ? 'en-GB' : 'el-GR').format(value))
  const monthLabel = periodLabel(periodOf('month', `${month}-01`), language)
  const dayLabel = new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
  const label = isDay && !legacy ? dayLabel : monthLabel
  // Another day or month: unsaved numbers are not dropped without asking.
  async function goTo(next) {
    if (next === day) return
    if (dirty && canEdit && !(await confirm({ title: en ? 'Unsaved changes' : 'Μη αποθηκευμένες αλλαγές', message: en ? `The changes to ${label} are not saved. Leave them?` : `Οι αλλαγές του φύλλου «${label}» δεν έχουν αποθηκευτεί. Να χαθούν;`, confirmLabel: en ? 'Leave without saving' : 'Αλλαγή χωρίς αποθήκευση', danger: true }))) return
    setEditing(false)
    setDay(next)
  }
  const goToMonth = next => goTo(next >= dailyFrom ? (next === thisMonth() ? today() : `${next}-01`) : `${next}-01`)
  const openDay = next => { setView('day'); goTo(next) }
  useEffect(() => { if (newDayTick > 0 && thisMonth() >= dailyFrom) openDay(today()) }, [newDayTick]) // eslint-disable-line react-hooks/exhaustive-deps
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
      setEditing(false)
      await onSaved?.()
    } catch (error) {
      console.error(error)
      notify(en ? 'The sheet could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση του φύλλου.', 'error')
    } finally { setSaving(false) }
  }
  // «Export ▾» in the record's header exports what is on screen: the day, the month, the year or the list.
  const [exporting, setExporting] = useState(false)
  function exportExcel() {
    const name = `${register.code}_${view === 'year' ? year : view === 'list' ? (en ? 'all' : 'ola') : periodStart}`
    const rowLabel = en ? 'Row' : 'Γραμμή'
    if (view === 'list') {
      exportRegistry({ name, headers: [en ? 'Date' : 'Ημερομηνία', ...rows.flatMap(row => measures.map(measure => `${textOf(row, language)}${measures.length > 1 ? ` · ${textOf(measure, language)}` : ''}`))], rows: [...entries].sort((a, b) => String(a.periodStart).localeCompare(String(b.periodStart))).map(item => [String(item.periodStart).slice(0, 7) < dailyFrom ? String(item.periodStart).slice(0, 7) : String(item.periodStart), ...rows.flatMap(row => measures.map(measure => item.values?.[row.key]?.[measure.key] ?? ''))]) })
      return
    }
    if (view === 'year') {
      const keys = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`)
      const short = key => new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { month: 'short', timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`))
      exportRegistry({ name, headers: [rowLabel, ...keys.map(short), en ? 'Year' : 'Έτος'], rows: rows.map(row => { const cells = keys.map(key => rowSum(valuesByMonth.get(key), row.key, measures)); return [textOf(row, language), ...cells.map(cell => cell ?? ''), cells.some(cell => cell != null) ? cells.reduce((sum, cell) => sum + (cell || 0), 0) : ''] }) })
      return
    }
    exportRegistry({ name, headers: [rowLabel, ...(measures.length > 1 ? measures.map(measure => textOf(measure, language)) : []), en ? 'Total' : 'Σύνολο'], rows: [...rows.map(row => [textOf(row, language), ...(measures.length > 1 ? measures.map(measure => shown[row.key]?.[measure.key] ?? '') : []), rowTotal(row.key) ?? '']), [en ? 'Total' : 'Σύνολο', ...(measures.length > 1 ? measures.map(measure => rows.reduce((sum, row) => sum + Number(shown[row.key]?.[measure.key] || 0), 0)) : []), grand]] })
  }
  async function exportPdf() {
    if (!tableRef.current) return
    setExporting(true)
    try { await exportElementAsPdf({ element: tableRef.current, filename: `${register.code}_${view === 'year' ? year : view === 'list' ? (en ? 'all' : 'ola') : periodStart}` }) } catch (error) { console.error(error); notify(en ? 'The PDF could not be made.' : 'Δεν ήταν δυνατή η δημιουργία του PDF.', 'error') } finally { setExporting(false) }
  }
  useEffect(() => { onExportApi?.({ excel: exportExcel, pdf: exportPdf, busy: exporting, disabled: !entries.length }); return () => onExportApi?.(null) }, [view, periodStart, entries, values, exporting]) // eslint-disable-line react-hooks/exhaustive-deps
  const grouped = groups.length ? [...groups.map(group => ({ group, rows: rows.filter(row => row.group === group.key) })), { group: null, rows: rows.filter(row => !groups.some(group => group.key === row.group)) }].filter(item => item.rows.length) : [{ group: null, rows }]
  const year = month.slice(0, 4)
  const previousTotal = rows.reduce((sum, row) => sum + (contexts.get(row.key).previous || 0), 0)
  // The month's tools that are not daily work wait in «⋯».
  const menu = [
    canRecordDay && entry && !editing && { id: 'edit', label: en ? 'Edit' : 'Επεξεργασία', icon: Pencil, onClick: () => setEditing(true) },
    access.canRecord(register) && { id: 'import', label: en ? 'Import from file' : 'Εισαγωγή από αρχείο', icon: Upload, onClick: () => navigate(`/registers/${register.id}/import`) },
  ].filter(Boolean)
  // Under the fields: the total of what is on screen, the one before it, the month so far and how much is filled.
  const entryTotal = item => rows.reduce((sum, row) => sum + (rowSum(item, row.key, measures) || 0), 0)
  const monthSoFar = monthEntries.reduce((sum, item) => sum + (item.periodStart === periodStart ? 0 : entryTotal(item.values)), 0) + (isDay ? grand : 0)
  const previousLabel = byDay ? (en ? 'previous day' : 'προηγ. ημέρα') : (en ? 'previous month' : 'προηγ. μήνας')
  const subtitle = view === 'list'
    ? (en ? `${entries.length} entries · pick one to open it.` : `${entries.length} καταχωρίσεις · πατήστε μία για να την ανοίξετε.`)
    : view !== 'year'
    ? <>{legacy && <span className="register-sheet-muted">{en ? 'Month total (before the daily sheets) · ' : 'Σύνολο μήνα (πριν τα ημερήσια φύλλα) · '}</span>}{isMonth && !legacy && <span className="register-sheet-muted">{en ? `${monthEntries.length} days recorded · ` : `${monthEntries.length} ημέρες καταχωρισμένες · `}</span>}{en ? `${filled} of ${rows.length} filled · total ${fmt(grand)}` : `${filled} από ${rows.length} συμπληρωμένες · σύνολο ${fmt(grand)}`}{previousTotal > 0 && <span className="register-sheet-muted">{` (${previousLabel} ${fmt(previousTotal)})`}</span>}{unusualCount > 0 && <span className="register-sheet-unusual-note"><AlertTriangle size={13} />{en ? unusualCount === 1 ? '1 unusual value' : `${unusualCount} unusual values` : unusualCount === 1 ? '1 ασυνήθιστη τιμή' : `${unusualCount} ασυνήθιστες τιμές`}</span>}</>
    : (en ? 'Pick a month to open it.' : 'Πατήστε έναν μήνα για να τον ανοίξετε.')
  const recorded = new Set(monthEntries.map(item => String(item.periodStart)))
  return <RecordTabPanel className={`register-sheet${registerThemeKey(register) ? ` is-theme-${registerThemeKey(register)}` : ''}`} title={isDay ? (en ? 'Entry' : 'Καταχώριση') : isMonth ? (en ? 'The month' : 'Ο μήνας') : view === 'list' ? (en ? 'Days' : 'Ημέρες') : (en ? 'The year' : 'Ετήσια εικόνα')} subtitle={subtitle}
    footer={canEdit && <div className="inline-edit-footer">{dirty && <span className="register-form-errors">{en ? 'Unsaved changes' : 'Μη αποθηκευμένες αλλαγές'}</span>}{entry && <Button variant="secondary" onClick={() => { setValues(structuredClone(entry.values || {})); setEditing(false) }}>{en ? 'Cancel' : 'Ακύρωση'}</Button>}<SaveButton loading={saving} disabled={saving || !dirty} onClick={save}>{en ? 'Save' : 'Αποθήκευση'}</SaveButton></div>}
    actions={<div className="register-sheet-actions">
      {isDay ? <button type="button" className="register-indicator-back" onClick={() => setView('list')}><ArrowLeft size={14} />{en ? 'Days' : 'Ημέρες'}</button> : <SearchableSelect hideLabel className="register-period-select" label={en ? 'View' : 'Προβολή'} value={view} onChange={next => next && setView(next)} options={[{ value: 'list', label: en ? 'Days' : 'Ημέρες' }, { value: 'month', label: en ? 'Month' : 'Μήνας' }, { value: 'year', label: en ? 'Year' : 'Έτος' }]} />}
      {byDay && <PeriodStepper label={label} onPrevious={() => goTo(dayShift(day, -1))} onNext={() => goTo(dayShift(day, 1))} nextDisabled={day >= today()} />}
      {!byDay && (isMonth || isDay) && <PeriodStepper label={label} onPrevious={() => goToMonth(monthShift(month, -1))} onNext={() => goToMonth(monthShift(month, 1))} nextDisabled={month >= thisMonth()} />}
      {view === 'year' && <PeriodStepper label={year} onPrevious={() => goToMonth(`${Number(year) - 1}${month.slice(4)}`)} onNext={() => goToMonth(`${Number(year) + 1}${month.slice(4)}`)} nextDisabled={Number(year) >= Number(thisMonth().slice(0, 4))} />}
      {menu.length > 0 && <OverflowMenu items={menu} label={en ? 'More' : 'Περισσότερα'} />}
    </div>}>
    {view === 'list' ? <SheetDays innerRef={tableRef} register={register} entries={entries} dailyFrom={dailyFrom} language={language} onOpen={openDay} /> : view !== 'year' ? <div ref={tableRef} className="register-sheet-body">
      {byDay && <nav className="register-sheet-days" aria-label={en ? 'Days of the month' : 'Ημέρες του μήνα'}>{daysOf(month).map(item => <button key={item} type="button" className={`${item === day ? 'is-selected' : ''} ${recorded.has(item) ? 'is-recorded' : ''}`.trim()} disabled={item > today()} aria-pressed={item === day} onClick={() => goTo(item)}>{Number(item.slice(8))}</button>)}</nav>}
      {measures.length > 1 && <div className="register-sheet-shifts"><CanonicalTabs className="lo-subtabs" items={[...measures.map(measure => ({ value: measure.key, label: textOf(measure, language) })), { value: 'total', label: en ? 'Day total' : 'Σύνολο ημέρας' }]} value={shift} onChange={setShift} ariaLabel={en ? 'Shift' : 'Βάρδια'} /></div>}
      {grouped.map(({ group, rows: groupRows }) => <section key={group?.key || 'rows'} className="register-ledger">
        <header className="register-ledger-head"><strong>{group ? textOf(group, language) : (en ? 'Totals of the day' : 'Σύνολα ημέρας')}</strong><span>{en ? 'Number' : 'Αριθμός'}</span></header>
        <div className="register-ledger-lines">
          {groupRows.map(row => { const context = contexts.get(row.key); const only = measures.length > 1 && shift !== 'total' ? measures.find(measure => measure.key === shift) : null; const total = rowTotal(row.key); return <div key={row.key} className={`register-ledger-line${context.unusual ? ' is-unusual' : ''}`} onClick={event => { if (event.target.tagName !== 'INPUT') event.currentTarget.querySelector('input')?.focus() }}>
            <span className="register-ledger-name">{textOf(row, language)}</span>
            {only || measures.length === 1 ? (canEdit ? <input className="register-sheet-input" aria-label={`${textOf(row, language)} · ${textOf(only || measures[0], language)}`} inputMode="numeric" value={values[row.key]?.[(only || measures[0]).key] ?? ''} onChange={event => set(row.key, (only || measures[0]).key, event.target.value)} onKeyDown={nextCell} /> : <strong className="register-sheet-value">{fmt(shown[row.key]?.[(only || measures[0]).key] ?? null)}</strong>) : <strong className="register-sheet-value">{fmt(total)}</strong>}
            <small className="register-sheet-field-note register-ledger-note">{context.unusual ? <><AlertTriangle size={12} />{en ? `usually about ${fmt(Math.round(context.average))}` : `συνήθως περίπου ${fmt(Math.round(context.average))}`}</> : context.previous != null ? `${previousLabel} ${fmt(context.previous)}` : '\u00a0'}</small>
          </div> })}
        </div>
      </section>)}
      <RecordMetricStrip className="register-sheet-totals" items={[
        { label: isMonth || legacy ? (en ? 'Month total' : 'Σύνολο μήνα') : (en ? 'Day total' : 'Σύνολο ημέρας'), value: fmt(grand), primary: true },
        ...(measures.length > 1 ? measures.map(measure => ({ id: measure.key, label: textOf(measure, language), value: fmt(rows.reduce((sum, row) => sum + (Number(shown[row.key]?.[measure.key]) || 0), 0)) })) : [{ label: byDay ? (en ? 'Previous day' : 'Προηγούμενη ημέρα') : (en ? 'Previous month' : 'Προηγούμενος μήνας'), value: previousTotal ? fmt(previousTotal) : '—', hidden: !isDay && !isMonth }]),
        { label: en ? 'Month so far' : 'Μήνας μέχρι τώρα', value: fmt(monthSoFar), note: en ? `${monthEntries.length || (isDay ? 1 : 0)} days recorded` : `${monthEntries.length || (isDay ? 1 : 0)} ημέρες καταχωρισμένες`, hidden: !byDay },
        { label: en ? 'Filled' : 'Συμπληρωμένα', value: `${filled}/${rows.length}`, meter: rows.length ? (filled / rows.length) * 100 : null, tone: filled === rows.length ? 'success' : undefined },
      ]} />
      {canEdit && <p className="register-sheet-hint">{en ? 'An empty box means not recorded; write 0 when there were none.' : 'Κενό πεδίο σημαίνει «δεν καταγράφηκε»· γράψτε 0 όταν δεν έγινε καμία.'}</p>}
    </div> : <SheetYear innerRef={tableRef} register={register} entries={entries} year={year} selected={`${month}-01`} onSelect={first => { setView(first.slice(0, 7) >= dailyFrom ? 'list' : 'day'); goToMonth(first.slice(0, 7)) }} />}
  </RecordTabPanel>
}

// All the entries as a list, like the cases of a register: the day (or, before the daily
// sheets, the month's total), the total and the rows filled. Newest first.
function SheetDays({ innerRef, register, entries, dailyFrom, language, onOpen }) {
  const en = language === 'en'
  const rows = register.sheet?.rows || []
  const measures = register.sheet?.measures || []
  const fmt = value => new Intl.NumberFormat(en ? 'en-GB' : 'el-GR').format(value)
  // Everything recorded, newest first; the filters narrow it to a year and a month.
  const [year, setYear] = useState('all')
  const [month, setMonth] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const years = [...new Set(entries.map(item => String(item.periodStart).slice(0, 4)))].sort().reverse()
  const monthName = number => new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, number - 1, 1)))
  const totalOf = item => rows.reduce((sum, row) => sum + (rowSum(item.values, row.key, measures) || 0), 0)
  // Each entry against the one recorded before it.
  const olderTotal = new Map(); { const ascending = [...entries].sort((a, b) => String(a.periodStart).localeCompare(String(b.periodStart))); ascending.forEach((item, index) => { if (index > 0) olderTotal.set(String(item.periodStart), totalOf(ascending[index - 1])) }) }
  const sorted = [...entries]
    .filter(item => (year === 'all' || String(item.periodStart).startsWith(year)) && (month === 'all' || String(item.periodStart).slice(5, 7) === month) && (!from || String(item.periodStart) >= from) && (!to || String(item.periodStart) <= to))
    .sort((a, b) => String(b.periodStart).localeCompare(String(a.periodStart)))
  // What the list shows, at a glance: how many, the total, the mean per day, the working days nobody recorded.
  const dailyItems = sorted.filter(item => String(item.periodStart).slice(0, 7) >= dailyFrom)
  const sumAll = sorted.reduce((sum, item) => sum + totalOf(item), 0)
  const recordedDays = new Set(dailyItems.map(item => String(item.periodStart)))
  let missingDays = null
  if (dailyItems.length) {
    const ordered = [...recordedDays].sort()
    missingDays = 0
    for (let day = ordered[0]; day <= ordered[ordered.length - 1]; day = dayShift(day, 1)) { const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); if (weekday !== 0 && weekday !== 6 && !recordedDays.has(day)) missingDays += 1 }
  }
  // The bars compare days with days and months with months.
  const maxOf = daily => Math.max(1, ...sorted.filter(item => (String(item.periodStart).slice(0, 7) >= dailyFrom) === daily).map(totalOf))
  const maxDaily = maxOf(true), maxMonthly = maxOf(false)
  const figures = [
    { key: 'entries', icon: CalendarDays, value: sorted.length, label: en ? 'Entries' : 'Καταχωρίσεις' },
    { key: 'total', icon: Sigma, value: fmt(sumAll), label: en ? 'Total of the choice' : 'Σύνολο της επιλογής' },
    { key: 'mean', icon: Gauge, value: dailyItems.length ? fmt(Math.round(dailyItems.reduce((sum, item) => sum + totalOf(item), 0) / dailyItems.length)) : null, label: en ? 'Mean per day' : 'Μέσο ανά ημέρα', hint: dailyItems.length ? null : (en ? 'from the daily sheets' : 'από τα ημερήσια φύλλα') },
    { key: 'missing', icon: CalendarX2, value: missingDays, label: en ? 'Working days not recorded' : 'Εργάσιμες χωρίς καταχώριση', tone: 'warning' },
  ]
  const dayText = day => new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
  const monthText = day => periodLabel(periodOf('month', day), language)
  if (!entries.length) return <div className="register-sheet-body"><div className="inline-empty">{en ? 'No day recorded yet. Start with «New day».' : 'Καμία ημέρα ακόμη. Ξεκινήστε με «Νέα ημέρα».'}</div></div>
  const narrowed = year !== 'all' || month !== 'all' || from || to
  const filters = <div className="register-sheet-filter-row">
    <FilterSelect label={en ? 'Year' : 'Έτος'} value={year} onChange={setYear}><option value="all">{en ? 'All years' : 'Όλα τα έτη'}</option>{years.map(item => <option key={item} value={item}>{item}</option>)}</FilterSelect>
    <FilterSelect label={en ? 'Month' : 'Μήνας'} value={month} onChange={setMonth}><option value="all">{en ? 'All months' : 'Όλοι οι μήνες'}</option>{Array.from({ length: 12 }, (_, index) => <option key={index} value={String(index + 1).padStart(2, '0')}>{monthName(index + 1)}</option>)}</FilterSelect>
    <FilterDate label={en ? 'From' : 'Από'} value={from} onChange={setFrom} />
    <FilterDate label={en ? 'To' : 'Έως'} value={to} onChange={setTo} />
    {narrowed && <button type="button" className="register-indicator-back" onClick={() => { setYear('all'); setMonth('all'); setFrom(''); setTo('') }}>{en ? 'Clear filters' : 'Καθαρισμός φίλτρων'}</button>}
  </div>
  return <><div className="register-sheet-days-filters"><KpiFigures label={en ? 'The days at a glance' : 'Οι ημέρες με μια ματιά'} figures={figures} />{filters}</div>{!sorted.length ? <div className="register-sheet-body"><div className="inline-empty">{en ? 'Nothing recorded for this choice.' : 'Δεν υπάρχει καταχώριση για αυτή την επιλογή.'}</div></div> : <div ref={innerRef} className="scroll-table register-sheet-days-list"><table className="data-table">
    <thead><tr><th>{en ? 'Date' : 'Ημερομηνία'}</th><th>{en ? 'Total' : 'Σύνολο'}</th>{measures.length > 1 && measures.map(measure => <th key={measure.key} className="register-num">{textOf(measure, language)}</th>)}<th>{en ? 'Recorded' : 'Καταχωρίστηκε'}</th></tr></thead>
    <tbody>{sorted.map(item => {
      const total = totalOf(item)
      const before = olderTotal.get(String(item.periodStart))
      const change = before == null ? null : total - before
      const day = String(item.periodStart)
      return <tr key={item.id || day} className="registry-row-clickable" tabIndex={0} onClick={() => onOpen(day)} onKeyDown={event => { if (event.key === 'Enter') onOpen(day) }}>
        <td><strong>{day.slice(0, 7) < dailyFrom ? monthText(day) : dayText(day)}</strong>{day.slice(0, 7) < dailyFrom && <span className="register-sheet-muted"> · {en ? 'month total' : 'σύνολο μήνα'}</span>}</td>
        <td><span className="register-list-total"><strong>{fmt(total)}</strong>{change != null && change !== 0 && <span className={`register-list-change ${change > 0 ? 'is-up' : 'is-down'}`}>{change > 0 ? <ArrowUpRight size={12} aria-hidden="true" /> : <ArrowDownRight size={12} aria-hidden="true" />}{fmt(Math.abs(change))}</span>}</span><span className="register-list-bar" aria-hidden="true"><i style={{ width: `${Math.round((total / (day.slice(0, 7) >= dailyFrom ? maxDaily : maxMonthly)) * 100)}%` }} /></span></td>
        {measures.length > 1 && measures.map(measure => <td key={measure.key} className="register-num">{fmt(rows.reduce((sum, row) => sum + (Number(item.values?.[row.key]?.[measure.key]) || 0), 0))}</td>)}
        <td>{item.createdAt ? formatDay(String(item.createdAt).slice(0, 10), language) : <span className="register-muted">—</span>}{item.updatedAt && String(item.updatedAt).slice(0, 10) !== String(item.createdAt || '').slice(0, 10) && <span className="register-list-change">{en ? 'edited' : 'διορθώθηκε'} {formatDay(String(item.updatedAt).slice(0, 10), language)}</span>}</td>
      </tr>
    })}</tbody>
  </table></div>}</>
}

// The year: one column per month, one row per sheet row (sum of measures).
function SheetYear({ innerRef, register, entries, year, selected, onSelect }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}-01`), [year])
  // A month's column adds up its days (or holds its earlier monthly total).
  const byMonth = new Map(months.map(first => { const list = entries.filter(entry => String(entry.periodStart).startsWith(first.slice(0, 7))); return [first, list.length ? { values: sumValues(list.map(entry => entry.values)) } : null] }))
  const cell = (entry, row) => {
    if (!entry) return null
    const cells = (register.sheet?.measures || []).map(measure => entry.values?.[row]?.[measure.key]).filter(value => !blank(value))
    return cells.length ? cells.reduce((sum, value) => sum + Number(value), 0) : null
  }
  const short = day => new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
  return <div ref={innerRef} className="scroll-table register-sheet-year"><table className="data-table register-year-table">
      <thead><tr><th>{en ? 'Row' : 'Γραμμή'}</th>{months.map(day => <th key={day} className={`register-num ${day === selected ? 'is-selected' : ''}`}><button type="button" onClick={() => onSelect(day)}>{short(day)}</button></th>)}<th className="register-num">{en ? 'Year' : 'Έτος'}</th></tr></thead>
      <tbody>{(register.sheet?.rows || []).map(row => {
        const values = months.map(day => cell(byMonth.get(day), row.key))
        const total = values.filter(value => value != null)
        return <tr key={row.key}><td className="register-row-label">{textOf(row, language)}</td>{values.map((value, index) => <td key={months[index]} className={`register-num ${months[index] === selected ? 'is-selected' : ''}`}>{value ?? '·'}</td>)}<td className="register-num"><strong>{total.length ? new Intl.NumberFormat(en ? 'en-GB' : 'el-GR').format(total.reduce((sum, value) => sum + value, 0)) : '—'}</strong></td></tr>
      })}</tbody>
    </table></div>
}
