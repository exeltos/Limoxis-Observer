import { useEffect, useMemo, useState } from 'react'
import { Lock, LockOpen, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { MonthField } from '../../design-system/MonthField'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { StatusBadge } from '../../design-system/StatusBadge'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { saveEntry, setEntryLocked } from './registerService'
import { useRegisterAccess } from './registerAccess'
import { periodLabel, periodOf, textOf } from './registerEngine'

const thisMonth = () => new Date().toISOString().slice(0, 7)
const blank = value => value === undefined || value === null || value === ''

// A sheet register: the grid of a month (rows × measures, whole numbers, an
// empty cell is «not recorded», not zero), closing the month, and the year at
// a glance underneath.
export function RegisterSheet({ register, entries, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
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
    <RecordTabPanel className="register-sheet" title={periodLabel(periodOf('month', periodStart), language)} subtitle={en ? 'An empty cell means not recorded; write 0 when there were none.' : 'Κενό κελί σημαίνει «δεν καταγράφηκε»· γράψτε 0 όταν δεν έγινε καμία.'}
      actions={<div className="register-sheet-actions">
        <MonthField value={month} onChange={value => value && setMonth(value)} years={4} />
        {access.canRecord(register) && <Button variant="secondary" onClick={() => navigate(`/registers/${register.id}/import`)}><Upload size={15} />{en ? 'Import' : 'Εισαγωγή'}</Button>}
        {entry && <StatusBadge tone={locked ? 'neutral' : 'info'}>{locked ? (en ? 'Closed' : 'Κλειστός') : (en ? 'Open' : 'Ανοιχτός')}</StatusBadge>}
        {entry && (locked ? access.canReopen(register) : access.canRecord(register)) && <Button variant="secondary" onClick={toggleLock}>{locked ? <LockOpen size={15} /> : <Lock size={15} />}{locked ? (en ? 'Reopen month' : 'Άνοιγμα μήνα') : (en ? 'Close month' : 'Κλείσιμο μήνα')}</Button>}
      </div>}
      footer={canEdit && <div className="inline-edit-footer"><SaveButton loading={saving} disabled={saving || !dirty} onClick={save}>{en ? 'Save sheet' : 'Αποθήκευση φύλλου'}</SaveButton></div>}>
      <div className="scroll-table"><table className="data-table register-sheet-table">
        <thead><tr><th>{en ? 'Row' : 'Γραμμή'}</th>{measures.map(measure => <th key={measure.key} className="register-num">{textOf(measure, language)}</th>)}{measures.length > 1 && <th className="register-num">{en ? 'Total' : 'Σύνολο'}</th>}</tr></thead>
        <tbody>{grouped.map(({ group, rows: groupRows }) => [
          group && <tr key={`g-${group.key}`} className="register-sheet-group"><th colSpan={measures.length + (measures.length > 1 ? 2 : 1)}>{textOf(group, language)}</th></tr>,
          ...groupRows.map(row => <tr key={row.key}>
            <th scope="row">{textOf(row, language)}{row.help && <small>{en ? row.helpEn || row.help : row.help}</small>}</th>
            {measures.map(measure => <td key={measure.key} className="register-num"><input aria-label={`${textOf(row, language)} · ${textOf(measure, language)}`} inputMode="numeric" disabled={!canEdit} value={values[row.key]?.[measure.key] ?? ''} onChange={event => set(row.key, measure.key, event.target.value)} /></td>)}
            {measures.length > 1 && <td className="register-num"><strong>{rowTotal(row.key) ?? '—'}</strong></td>}
          </tr>),
        ])}</tbody>
        <tfoot><tr><th>{en ? 'Total' : 'Σύνολο'}</th>{measures.map(measure => <td key={measure.key} className="register-num">{measureTotal(measure.key) ?? '—'}</td>)}{measures.length > 1 && <td className="register-num"><strong>{grand}</strong></td>}</tr></tfoot>
      </table></div>
    </RecordTabPanel>
    <SheetYear register={register} entries={entries} year={month.slice(0, 4)} selected={periodStart} onSelect={day => setMonth(day.slice(0, 7))} />
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
        return <tr key={row.key}><th scope="row">{textOf(row, language)}</th>{values.map((value, index) => <td key={months[index]} className={`register-num ${months[index] === selected ? 'is-selected' : ''}`}>{value ?? '·'}</td>)}<td className="register-num"><strong>{total.length ? total.reduce((sum, value) => sum + value, 0) : '—'}</strong></td></tr>
      })}</tbody>
    </table></div>
  </RecordTabPanel>
}
