import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Play, Timer, Trash2, Undo2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { SignalBadge } from '../../design-system/StatusBadge'
import { SectionHeader } from '../../design-system/SectionHeader'
import { RegistryTable } from '../../design-system/RegistryTable'
import { RecordDetailsGrid } from '../../design-system/RecordDetailsGrid'
import { FilterSelect } from '../../design-system/FilterBar'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { ExportMenu } from '../../design-system/ExportMenu'
import { FormGrid } from '../../design-system/FormCard'
import { Field } from '../../design-system/Field'
import { ManualDateField } from '../../design-system/ManualDateField'
import { ChoiceField } from '../../design-system/ChoiceField'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { reportExports } from '../../core/export/reportDocument'
import { KitchenList, matches, useKitchenActor, useKitchenTrace } from './KitchenShared'
import { dietLabel, fmtQty, mealLabel, options, stockRows, unitLabel, writeoffReasonLabel } from './kitchenModel'
import { BALANCE_TOLERANCE, RECALL_RESULTS, RECALL_SCENARIOS, drillFindings, drillSubject, elapsedMinutes, fmtDuration, recallProblems, recallResultLabel, recallResultTone, recallScenarioLabel, recallSummary, recallTrace, suggestedResult, withinTarget } from './kitchenRecallModel'
import { kitchenErrorMessage, loadKitchenDishNames, removeEntry, saveRecallDrill, saveWriteoff } from './kitchenService'
import { recallDrillDocument } from './kitchenReports'

const fmtDay = value => { if (!value) return '—'; const [y, m, d] = String(value).slice(0, 10).split('-'); return `${d}/${m}/${y}` }
const selectText = en => ({ emptyLabel: en ? 'No match' : 'Δεν βρέθηκε', clearLabel: en ? 'Clear' : 'Καθαρισμός' })
const clock = seconds => { const s = Math.max(0, Math.floor(seconds)); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }
const pct = (value, en) => (value == null || value === '' ? '—' : `${String(value).replace('.', en ? '.' : ',')} %`)
const qty = (value, unit, language) => `${fmtQty(value, language)}${unit && unit !== 'mixed' ? ` ${unitLabel(unit, language)}` : ''}`

// --- The list (Ανάκληση tab) ------------------------------------------------------------------

export function RecallPanel({ state, filters, setFilters, onRecall }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  const summary = recallSummary(state)
  const rows = (state.recallDrills || []).map(row => ({ ...row, subject: drillSubject(row, state, language) }))
    .filter(row => (filters.result === 'all' || (filters.result === 'draft' ? row.status !== 'completed' : row.result === filters.result)) && (filters.scenario === 'all' || row.scenario === filters.scenario) && matches(filters.query, row.code, row.subject, row.triggerText, row.conductedByName))
    .sort((a, b) => String(b.drillDate).localeCompare(String(a.drillDate)) || String(b.code).localeCompare(String(a.code)))
  const active = (filters.result !== 'all' ? 1 : 0) + (filters.scenario !== 'all' ? 1 : 0)
  return <>
    {summary.overdue && <div className="kitchen-recall-warning" role="status"><AlertTriangle size={15} />{summary.last ? (en ? `No recall drill since ${fmtDay(summary.last.drillDate)}: one is due every ${summary.months} months.` : `Καμία άσκηση ανάκλησης από ${fmtDay(summary.last.drillDate)}: προβλέπεται κάθε ${summary.months} μήνες.`) : (en ? 'No recall drill recorded: HACCP asks that the recall procedure is tested.' : 'Δεν έχει γίνει άσκηση ανάκλησης: το HACCP ζητά η διαδικασία ανάκλησης να δοκιμάζεται.')}</div>}
    <KitchenList rows={rows} query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search code, product, dish, trigger…' : 'Αναζήτηση κωδικού, προϊόντος, πιάτου, αφορμής…'} activeFilters={active}
      onClear={() => setFilters(current => ({ ...current, query: '', result: 'all', scenario: 'all' }))}
      filters={<>
        <FilterSelect label={en ? 'Result' : 'Αποτέλεσμα'} value={filters.result} onChange={value => set('result', value)}><option value="all">{en ? 'All' : 'Όλα'}</option>{RECALL_RESULTS.map(item => <option key={item.value} value={item.value}>{item.label[en ? 1 : 0]}</option>)}<option value="draft">{en ? 'In progress' : 'Σε εξέλιξη'}</option></FilterSelect>
        <FilterSelect label={en ? 'Scenario' : 'Σενάριο'} value={filters.scenario} onChange={value => set('scenario', value)}><option value="all">{en ? 'All' : 'Όλα'}</option>{RECALL_SCENARIOS.map(item => <option key={item.value} value={item.value}>{item.label[en ? 1 : 0]}</option>)}</FilterSelect>
      </>}
      columns={[{ key: 'code', label: en ? 'Drill' : 'Άσκηση' }, { key: 'subject', label: en ? 'Scenario · subject' : 'Σενάριο · αντικείμενο' }, { key: 'time', label: en ? 'Time to trace' : 'Χρόνος ιχνηλάτησης' }, { key: 'balance', label: en ? 'Mass balance' : 'Ισοζύγιο μάζας' }, { key: 'affected', label: en ? 'Affected' : 'Επηρεαζόμενα' }, { key: 'result', label: en ? 'Result' : 'Αποτέλεσμα' }]}
      empty={!rows.length} emptyTitle={en ? 'No recall drills' : 'Δεν υπάρχουν ασκήσεις ανάκλησης'} emptyText={en ? 'A drill starts from a supplier\'s lot, a product or a dish and traces where it went and where it came from, against the time target.' : 'Η άσκηση ξεκινά από παρτίδα προμηθευτή, προϊόν ή πιάτο και ιχνηλατεί πού πήγε και από πού ήρθε, με στόχο χρόνου.'}
      rowProps={row => ({ className: 'registry-row-clickable', onClick: () => onRecall(row) })}
      renderRow={row => { const minutes = row.status === 'completed' && row.elapsedMinutes !== '' ? Number(row.elapsedMinutes) : elapsedMinutes(row.startedAt, row.finishedAt); const inTime = withinTarget(minutes, row.targetMinutes); return <>
        <td className="nowrap-cell"><strong>{row.code || '—'}</strong><small>{fmtDay(row.drillDate)}</small></td>
        <td><strong>{row.subject}</strong><small>{recallScenarioLabel(row.scenario, language)}{row.triggerText ? ` · ${row.triggerText}` : ''}</small></td>
        <td className="nowrap-cell">{fmtDuration(minutes, language)}<small>{inTime == null ? '' : inTime ? (en ? 'within target' : 'εντός στόχου') : <SignalBadge tone="danger">{en ? 'over target' : 'εκτός στόχου'}</SignalBadge>}</small></td>
        <td className="nowrap-cell">{pct(row.accountedPercent, en)}</td>
        <td className="nowrap-cell">{row.affectedDays || 0} {en ? 'days' : 'ημέρες'} · {row.affectedPortions || 0} {en ? 'portions' : 'μερίδες'}</td>
        <td>{row.status === 'completed' ? <SignalBadge tone={recallResultTone(row.result)}>{recallResultLabel(row.result, language)}</SignalBadge> : <SignalBadge tone="info">{en ? 'In progress' : 'Σε εξέλιξη'}</SignalBadge>}</td>
      </> }} />
  </>
}

// --- The drill ---------------------------------------------------------------------------------

// A drill: scenario and subject, the running clock from the start, the forward and
// backward trace with the mass balance worked out at once, then whom it notified, what
// was done, the lessons and the result. A completed drill shows the trace as it was found.
export function RecallDialog({ state: loaded, organizationId, access, initial, onClose, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { confirm, notify } = useFeedback()
  const actor = useKitchenActor()
  const [draft, setDraft] = useState(() => ({ ...initial, conductedByName: initial.conductedByName || actor.name, stockCounts: initial.stockCounts || {} }))
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const readOnly = draft.status === 'completed' || !access.canRecord
  const running = !readOnly && !draft.finishedAt
  useEffect(() => { if (!running) return undefined; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [running])
  const set = next => setDraft(current => ({ ...current, ...next }))
  // The drill traces the whole history of its subject, not only the loaded window.
  const { scenario, receiptItemId, productId, productName, dishName } = draft
  const subject = useMemo(() => {
    if (draft.status === 'completed' && draft.traceSnapshot?.batches) return null
    const next = scenario === 'supplier_lot' ? { receiptItemIds: receiptItemId ? [receiptItemId] : [] } : scenario === 'product' ? { productId: productId || '', productName: productId ? '' : productName || '' } : { dishName: dishName || '' }
    return Object.values(next).some(value => (Array.isArray(value) ? value.length : value)) ? next : null
  }, [draft.status, draft.traceSnapshot, scenario, receiptItemId, productId, productName, dishName])
  const { state, ready } = useKitchenTrace(loaded, organizationId, subject)
  const [dishNames, setDishNames] = useState([])
  useEffect(() => { if (readOnly || scenario !== 'dish') return undefined; let active = true; loadKitchenDishNames(organizationId).then(names => { if (active) setDishNames(names) }).catch(() => {}); return () => { active = false } }, [readOnly, scenario, organizationId])
  const live = useMemo(() => recallTrace(state, draft), [state, draft])
  const trace = draft.status === 'completed' && draft.traceSnapshot?.batches ? draft.traceSnapshot : live
  const stock = useMemo(() => stockRows(state), [state])
  const seconds = ((draft.finishedAt ? new Date(draft.finishedAt).getTime() : now) - new Date(draft.startedAt).getTime()) / 1000
  const minutes = draft.status === 'completed' && draft.elapsedMinutes !== '' && draft.elapsedMinutes != null ? Number(draft.elapsedMinutes) : Math.max(0, Math.floor(seconds / 60))
  const target = Number(draft.targetMinutes) || 240
  const inTime = withinTarget(minutes, target)
  const suggestion = suggestedResult(trace, minutes, target)
  const blocked = () => notify(en ? 'Allow pop-ups to print.' : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'error')
  const dishes = useMemo(() => [...new Set([...(state.usage || []).map(row => row.dishName), ...dishNames].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'el')), [state.usage, dishNames])
  const lots = stock.filter(row => row.inStock || row.receiptItemId === draft.receiptItemId).sort((a, b) => String(b.receivedOn).localeCompare(String(a.receivedOn)))

  async function save(complete) {
    const problems = recallProblems(draft, language, { completing: complete })
    if (problems.length) { notify(`${en ? 'Missing' : 'Λείπει'}: ${problems.join(', ')}`, 'error'); return }
    const finishedAt = complete ? draft.finishedAt || new Date().toISOString() : draft.finishedAt
    const next = { ...draft, finishedAt, status: complete ? 'completed' : 'draft' }
    setSaving(true)
    try {
      await saveRecallDrill(organizationId, { ...next, ...drillFindings(next, live) })
      notify(complete ? (en ? 'Drill completed.' : 'Η άσκηση ολοκληρώθηκε.') : (en ? 'Saved.' : 'Αποθηκεύτηκε.'), 'success')
      await onSaved?.(); onClose()
    } catch (error) { console.error(error); notify(kitchenErrorMessage(error, language), 'error') } finally { setSaving(false) }
  }
  async function remove() {
    if (!await confirm({ title: en ? 'Delete drill' : 'Διαγραφή άσκησης', message: en ? 'The drill and its report are deleted.' : 'Η άσκηση και η αναφορά της διαγράφονται.', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })) return
    try { await removeEntry(organizationId, 'kitchen_recall_drills', draft.id); await onSaved?.(); onClose() } catch (error) { console.error(error); notify(kitchenErrorMessage(error, language), 'error') }
  }
  // A real recall, not the drill: the remaining stock of a batch is written off with reason «Ανάκληση».
  async function realRecall(batch) {
    if (!await confirm({ title: en ? 'Real recall: withdraw stock' : 'Πραγματική ανάκληση: απόσυρση αποθέματος', message: en ? `This is NOT part of the drill: ${fmtQty(batch.remaining, language)} ${unitLabel(batch.unit, language)} of ${batch.productName} (${batch.batchCode || batch.receiptCode}) leave the stock with reason «Recall».` : `Αυτό ΔΕΝ είναι μέρος της άσκησης: ${fmtQty(batch.remaining, language)} ${unitLabel(batch.unit, language)} από «${batch.productName}» (${batch.batchCode || batch.receiptCode}) φεύγουν από το απόθεμα με αιτία «Ανάκληση».`, confirmLabel: en ? 'Withdraw' : 'Απόσυρση', danger: true })) return
    try {
      await saveWriteoff(organizationId, { receiptItemId: batch.receiptItemId, writtenOffOn: new Date().toISOString().slice(0, 10), quantity: String(batch.remaining), reason: 'recall', notes: `${en ? 'Recall' : 'Ανάκληση'}${draft.code ? ` · ${draft.code}` : ''}${draft.triggerText ? ` · ${draft.triggerText}` : ''}`, recordedByName: actor.name })
      notify(en ? 'Withdrawn from stock.' : 'Αποσύρθηκε από το απόθεμα.', 'success'); await onSaved?.()
    } catch (error) { console.error(error); notify(kitchenErrorMessage(error, language), 'error') }
  }
  const scenarioChange = value => set({ scenario: value, receiptItemId: '', productId: '', productName: '', dishName: '', stockCounts: {} })
  const exportProps = reportExports(() => recallDrillDocument({ ...draft, elapsedMinutes: minutes }, trace, { language }), { onBlocked: blocked })

  return <ObserverDialog width="wide" title={draft.code ? `${en ? 'Mock recall drill' : 'Άσκηση ανάκλησης'} · ${draft.code}` : (en ? 'New mock recall drill' : 'Νέα άσκηση ανάκλησης')} subtitle={en ? 'Trace forward and backward, check the mass balance and the time against the target.' : 'Ιχνηλάτηση εμπρός και πίσω, ισοζύγιο μάζας και χρόνος έναντι στόχου.'} onClose={onClose}
    footer={<DialogActions>
      <ExportMenu {...exportProps} />
      {access.canManage && draft.id && <Button variant="secondary" onClick={remove}><Trash2 size={15} />{en ? 'Delete' : 'Διαγραφή'}</Button>}
      {!readOnly && <Button variant="secondary" disabled={saving || !ready} onClick={() => save(false)}>{en ? 'Save draft' : 'Αποθήκευση προχείρου'}</Button>}
      {!readOnly && <Button disabled={saving || !ready} onClick={() => save(true)}><CheckCircle2 size={15} />{en ? 'Complete drill' : 'Ολοκλήρωση άσκησης'}</Button>}
    </DialogActions>}>
    <div className={`kitchen-recall-clock ${inTime === false ? 'is-over' : ''}`.trim()} role="timer" aria-live="off">
      <Timer size={18} /><strong>{clock(draft.status === 'completed' ? minutes * 60 : seconds)}</strong>
      <span>{en ? 'target' : 'στόχος'} {fmtDuration(target, language)}{inTime === false ? ` · ${en ? 'over target' : 'εκτός στόχου'}` : ''}</span>
      {!readOnly && (draft.finishedAt
        ? <Button variant="secondary" onClick={() => set({ finishedAt: '' })}><Play size={15} />{en ? 'Resume clock' : 'Συνέχιση χρόνου'}</Button>
        : <Button variant="secondary" onClick={() => set({ finishedAt: new Date().toISOString() })}><CheckCircle2 size={15} />{en ? 'Trace found' : 'Τέλος ιχνηλάτησης'}</Button>)}
    </div>
    {readOnly ? <RecordDetailsGrid fields={[{ label: en ? 'Date' : 'Ημερομηνία', value: fmtDay(draft.drillDate) }, { label: en ? 'Scenario' : 'Σενάριο', value: recallScenarioLabel(draft.scenario, language) }, { label: en ? 'Subject' : 'Αντικείμενο', value: drillSubject(draft, state, language) }, { label: en ? 'Conducted by' : 'Διενήργησε', value: draft.conductedByName }, { label: en ? 'Trigger' : 'Αφορμή', value: draft.triggerText, className: 'kitchen-span-3' }]} />
      : <><FormGrid columns={3}>
        <ChoiceField label={en ? 'Scenario *' : 'Σενάριο *'} value={draft.scenario} options={options(RECALL_SCENARIOS, language)} onChange={scenarioChange} />
        {draft.scenario === 'supplier_lot' && <SearchableSelect label={en ? 'Lot *' : 'Παρτίδα *'} value={draft.receiptItemId} options={lots.map(row => ({ value: row.receiptItemId, label: `${row.productName} · ${row.batchCode || row.lotLabel || '—'}`, description: [row.supplierName, row.receiptCode, fmtDay(row.receivedOn)].filter(Boolean).join(' · ') }))}
          onChange={value => { const found = stock.find(row => row.receiptItemId === value); set({ receiptItemId: value || '', productId: found?.productId || '', productName: found?.productName || '', stockCounts: {} }) }} {...selectText(en)} />}
        {draft.scenario === 'product' && <SearchableSelect label={en ? 'Product *' : 'Προϊόν *'} value={draft.productId || draft.productName} allowCustom customLabel={value => `«${value}»`} options={(state.products || []).map(item => ({ value: item.id, label: item.name }))}
          onChange={value => { const found = (state.products || []).find(item => item.id === value); set(found ? { productId: found.id, productName: found.name, stockCounts: {} } : { productId: '', productName: value || '', stockCounts: {} }) }} {...selectText(en)} />}
        {draft.scenario === 'dish' && <SearchableSelect label={en ? 'Dish *' : 'Πιάτο *'} value={draft.dishName} allowCustom customLabel={value => `«${value}»`} options={dishes.map(dish => ({ value: dish, label: dish }))} onChange={value => set({ dishName: value || '', stockCounts: {} })} {...selectText(en)} />}
        <Field label={en ? 'Target (minutes) *' : 'Στόχος (λεπτά) *'} hint={en ? 'Usually 240 (4 hours).' : 'Συνήθως 240 (4 ώρες).'}><input inputMode="numeric" value={draft.targetMinutes ?? ''} onChange={e => set({ targetMinutes: e.target.value.replace(/\D/g, '') })} /></Field>
        <ManualDateField label={en ? 'Date' : 'Ημερομηνία'} value={draft.drillDate} onChange={value => set({ drillDate: value })} />
        <Field label={en ? 'Conducted by' : 'Διενήργησε'}><input value={draft.conductedByName || ''} onChange={e => set({ conductedByName: e.target.value })} /></Field>
      </FormGrid>
      <Field label={en ? 'Trigger' : 'Αφορμή'} hint={en ? 'e.g. Supplier notice of a contaminated lot' : 'π.χ. Ειδοποίηση προμηθευτή για μολυσμένη παρτίδα'}><textarea rows={2} value={draft.triggerText || ''} onChange={e => set({ triggerText: e.target.value })} /></Field></>}

    <SectionHeader title={en ? 'Mass balance' : 'Ισοζύγιο μάζας'} subtitle={en ? `Received = used + in stock + written off (within ± ${BALANCE_TOLERANCE} %). Enter the stock counted on the shelf.` : `Παραλήφθηκε = χρησιμοποιήθηκε + σε απόθεμα + απόσυρση (εντός ± ${BALANCE_TOLERANCE} %). Γράψτε το απόθεμα που μετρήθηκε στο ράφι.`} />
    <RecordDetailsGrid fields={[{ label: en ? 'Received' : 'Παραλήφθηκε', value: qty(trace.received, trace.unit, language) }, { label: en ? 'Used' : 'Χρησιμοποιήθηκε', value: qty(trace.used, trace.unit, language) }, { label: en ? 'In stock' : 'Σε απόθεμα', value: qty(trace.inStock, trace.unit, language) }, { label: en ? 'Written off' : 'Απόσυρση', value: qty(trace.writtenOff, trace.unit, language) },
      { label: en ? 'Accounted for' : 'Βρέθηκε', value: <SignalBadge tone={trace.percent == null ? 'neutral' : trace.balanced ? 'success' : 'danger'}>{pct(trace.percent, en)}</SignalBadge> }, { label: en ? 'Production days' : 'Ημέρες παραγωγής', value: String(trace.affectedDays) }, { label: en ? 'Meals' : 'Γεύματα', value: String(trace.affectedMeals) }, { label: en ? 'Portions' : 'Μερίδες', value: String(trace.affectedPortions), meta: trace.untraced ? (en ? `${trace.untraced} uses without a batch` : `${trace.untraced} καταναλώσεις χωρίς παρτίδα`) : '' }]} />
    <RegistryTable className="kitchen-table" rows={trace.batches} rowKey={row => row.receiptItemId} columns={[{ key: 'batch', label: en ? 'Batch' : 'Παρτίδα' }, { key: 'supplier', label: en ? 'Supplier · receipt' : 'Προμηθευτής · παραλαβή' }, { key: 'received', label: en ? 'Received' : 'Παραλήφθηκε' }, { key: 'used', label: en ? 'Used' : 'Χρησιμοποιήθηκε' }, { key: 'count', label: en ? 'Counted in stock' : 'Καταμέτρηση αποθέματος' }, { key: 'off', label: en ? 'Written off' : 'Απόσυρση' }, { key: 'pct', label: '%' }]}
      emptyTitle={en ? 'Choose the subject of the drill' : 'Επιλέξτε το αντικείμενο της άσκησης'} emptyText={en ? 'The batches are found at once from the receipts and the materials used.' : 'Οι παρτίδες βρίσκονται αμέσως από τις παραλαβές και τα υλικά σε χρήση.'}
      renderRow={row => <>
        <td><strong>{row.productName}</strong><small>{row.batchCode || '—'}{row.expiryOn ? ` · ${en ? 'exp.' : 'λήξη'} ${fmtDay(row.expiryOn)}` : ''}</small></td>
        <td>{row.supplierName || '—'}<small>{row.receiptCode} · {fmtDay(row.receivedOn)}</small></td>
        <td className="nowrap-cell">{qty(row.received, row.unit, language)}</td>
        <td className="nowrap-cell">{qty(row.used, row.unit, language)}</td>
        <td className="nowrap-cell">{readOnly ? <>{qty(row.inStock, row.unit, language)}{row.counted && <small>{en ? 'counted' : 'καταμέτρηση'}</small>}</> : <input className="kitchen-recall-count" inputMode="decimal" aria-label={en ? 'Counted in stock' : 'Καταμέτρηση αποθέματος'} placeholder={fmtQty(Math.max(0, row.remaining), language)} value={draft.stockCounts?.[row.receiptItemId] ?? ''} onChange={e => set({ stockCounts: { ...draft.stockCounts, [row.receiptItemId]: e.target.value.replace(',', '.') } })} />}</td>
        <td className="nowrap-cell">{qty(row.writtenOff, row.unit, language)}</td>
        <td className="nowrap-cell">{row.percent == null ? '—' : <SignalBadge tone={Math.abs(row.percent - 100) <= BALANCE_TOLERANCE ? 'success' : 'danger'}>{pct(row.percent, en)}</SignalBadge>}</td>
      </>} />

    <SectionHeader title={en ? 'Where it went (forward)' : 'Πού πήγε (εμπρός)'} subtitle={en ? 'Every use by day, dish and the meals that served it.' : 'Κάθε χρήση ανά ημέρα, πιάτο και τα γεύματα που το σέρβιραν.'} />
    <RegistryTable className="kitchen-table" rows={trace.uses} rowKey={row => row.id} columns={[{ key: 'day', label: en ? 'Day' : 'Ημέρα' }, { key: 'batch', label: en ? 'Batch' : 'Παρτίδα' }, { key: 'dish', label: en ? 'Dish' : 'Πιάτο' }, { key: 'qty', label: en ? 'Quantity' : 'Ποσότητα' }, { key: 'meals', label: en ? 'Meals · portions' : 'Γεύματα · μερίδες' }]}
      emptyTitle={en ? 'Not used in production' : 'Δεν χρησιμοποιήθηκε στην παραγωγή'}
      renderRow={row => <>
        <td className="nowrap-cell">{fmtDay(row.usedOn)}</td>
        <td>{row.productName}<small>{row.batchCode || '—'}</small></td>
        <td>{row.dishName || '—'}</td>
        <td className="nowrap-cell">{qty(row.quantity, row.unit, language)}</td>
        <td>{(row.meals || []).length ? (row.meals || []).map(meal => <small key={meal.id || `${meal.meal}-${meal.diet}`}>{mealLabel(meal.meal, language)} · {dietLabel(meal.diet, language)} · {meal.portions || '—'} {en ? 'portions' : 'μερίδες'}</small>) : <span className="kitchen-muted">{en ? 'No meal in the plan' : 'Χωρίς γεύμα στο πλάνο'}</span>}</td>
      </>} />

    <SectionHeader title={en ? 'Where it came from (backward)' : 'Από πού ήρθε (πίσω)'} subtitle={draft.scenario === 'dish' ? (en ? 'The batches the dish was made from, with their supplier.' : 'Οι παρτίδες από τις οποίες φτιάχτηκε το πιάτο, με τον προμηθευτή τους.') : (en ? 'The other raw materials of the same dishes on the same days.' : 'Οι άλλες πρώτες ύλες των ίδιων πιάτων τις ίδιες ημέρες.')} />
    <RegistryTable className="kitchen-table" rows={trace.backward || []} rowKey={row => row.id} columns={[{ key: 'day', label: en ? 'Day' : 'Ημέρα' }, { key: 'dish', label: en ? 'Dish' : 'Πιάτο' }, { key: 'product', label: en ? 'Raw material · batch' : 'Πρώτη ύλη · παρτίδα' }, { key: 'supplier', label: en ? 'Supplier · receipt' : 'Προμηθευτής · παραλαβή' }, { key: 'qty', label: en ? 'Quantity' : 'Ποσότητα' }]}
      emptyTitle={en ? 'No other raw material' : 'Καμία άλλη πρώτη ύλη'}
      renderRow={row => <>
        <td className="nowrap-cell">{fmtDay(row.usedOn)}</td><td>{row.dishName || '—'}</td><td>{row.productName}<small>{row.batchCode || '—'}</small></td>
        <td>{row.traced ? <>{row.supplierName || '—'}<small>{row.receiptCode}</small></> : <SignalBadge tone="warning">{en ? 'No receipt' : 'Χωρίς παραλαβή'}</SignalBadge>}</td>
        <td className="nowrap-cell">{qty(row.quantity, row.unit, language)}</td>
      </>} />

    {trace.writeoffs.length > 0 && <><SectionHeader title={en ? 'Write-offs' : 'Αποσύρσεις / απορρίψεις'} />
      <RegistryTable className="kitchen-table" rows={trace.writeoffs} rowKey={row => row.id} columns={[{ key: 'day', label: en ? 'Day' : 'Ημέρα' }, { key: 'product', label: en ? 'Product' : 'Προϊόν' }, { key: 'qty', label: en ? 'Quantity' : 'Ποσότητα' }, { key: 'reason', label: en ? 'Reason' : 'Αιτία' }]}
        renderRow={row => <><td className="nowrap-cell">{fmtDay(row.writtenOffOn)}</td><td>{row.productName}<small>{row.notes}</small></td><td className="nowrap-cell">{fmtQty(row.quantity, language)}</td><td>{writeoffReasonLabel(row.reason, language)}</td></>} /></>}

    <SectionHeader title={en ? 'Notification, actions, result' : 'Ενημέρωση, ενέργειες, αποτέλεσμα'} subtitle={readOnly ? '' : (en ? `The trace suggests: ${recallResultLabel(suggestion, language)}.` : `Η ιχνηλάτηση προτείνει: ${recallResultLabel(suggestion, language)}.`)} />
    {readOnly ? <RecordDetailsGrid fields={[{ label: en ? 'Notified' : 'Ενημερώθηκαν', value: draft.notified, className: 'kitchen-span-3' }, { label: en ? 'Actions' : 'Ενέργειες', value: draft.actions, className: 'kitchen-span-3' }, { label: en ? 'Lessons learned' : 'Συμπεράσματα και βελτιώσεις', value: draft.lessons, className: 'kitchen-span-3' }, { label: en ? 'Result' : 'Αποτέλεσμα', value: draft.result ? <SignalBadge tone={recallResultTone(draft.result)}>{recallResultLabel(draft.result, language)}</SignalBadge> : '—' }]} />
      : <>
        <Field label={en ? 'Who was notified *' : 'Ποιοι ενημερώθηκαν *'} hint={en ? 'Quality, management, infection control, supplier, wards…' : 'Ποιότητα, Διοίκηση, Πρόληψη Λοιμώξεων, προμηθευτής, τμήματα…'}><textarea rows={2} value={draft.notified || ''} onChange={e => set({ notified: e.target.value })} /></Field>
        <Field label={en ? 'Actions *' : 'Ενέργειες *'}><textarea rows={2} value={draft.actions || ''} onChange={e => set({ actions: e.target.value })} /></Field>
        <Field label={en ? 'Lessons learned' : 'Συμπεράσματα και βελτιώσεις'}><textarea rows={2} value={draft.lessons || ''} onChange={e => set({ lessons: e.target.value })} /></Field>
        <FormGrid columns={3}><ChoiceField label={en ? 'Result *' : 'Αποτέλεσμα *'} value={draft.result} placeholder={recallResultLabel(suggestion, language)} options={options(RECALL_RESULTS, language)} onChange={value => set({ result: value })} /></FormGrid>
      </>}

    {access.canRecord && live.batches.some(batch => batch.remaining > 0.0005) && <section className="kitchen-recall-real">
      <SectionHeader title={en ? 'Real recall (not the drill)' : 'Πραγματική ανάκληση (όχι άσκηση)'} subtitle={en ? 'Only when the recall is real: the remaining stock leaves the stock with reason «Recall».' : 'Μόνο όταν η ανάκληση είναι πραγματική: το υπόλοιπο φεύγει από το απόθεμα με αιτία «Ανάκληση».'} />
      <div className="kitchen-notes">{live.batches.filter(batch => batch.remaining > 0.0005).map(batch => <Button key={batch.receiptItemId} variant="secondary" onClick={() => realRecall(batch)}><Undo2 size={15} />{batch.productName} · {batch.batchCode || batch.receiptCode} · {qty(batch.remaining, batch.unit, language)}</Button>)}</div>
    </section>}
  </ObserverDialog>
}
