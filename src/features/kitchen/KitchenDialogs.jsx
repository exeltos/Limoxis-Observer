import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { FormGrid } from '../../design-system/FormCard'
import { Field } from '../../design-system/Field'
import { ManualDateField } from '../../design-system/ManualDateField'
import { TimeField } from '../../design-system/TimeField'
import { ChoiceField } from '../../design-system/ChoiceField'
import { ChoiceChips } from '../../design-system/ChoiceChips'
import { CheckboxField } from '../../design-system/CheckboxField'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { SectionHeader } from '../../design-system/SectionHeader'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { SignalBadge } from '../../design-system/StatusBadge'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { LimitBadge, LiveLimit, useKitchenActor } from './KitchenShared'
import { defrostStatus, fryingStatus, itemStatus, limitText, needsCorrectiveAction, pureeingStatus, receiptStatus, thermalStatuses } from './kitchenLimits'
import { receiptTitle, DEFROST_METHODS, DIETS, MEALS, PRODUCT_CATEGORIES, PUREE_METHODS, RECEIPT_CHECK_FIELDS, CHECK_RESULTS, STORAGES, TEMPERATURE_CLASSES, UNITS, WEEKDAYS, WRITEOFF_REASONS, availableBatches, batchProblem, fifoAdvice, fmtQty, menuForDay, newReceiptItem, options, receiptProblems, receiptResultLabel, receiptResultTone, unitLabel } from './kitchenModel'
import { defrostEntry, kitchenErrorMessage, saveEntry, saveProduction, saveReceipt, saveSimple, saveWriteoff, saveLimits } from './kitchenService'

const selectText = en => ({ emptyLabel: en ? 'No match' : 'Δεν βρέθηκε', clearLabel: en ? 'Clear' : 'Καθαρισμός' })
const day = value => { if (!value) return '—'; const [y, m, d] = String(value).slice(0, 10).split('-'); return `${d}/${m}/${y}` }

// Saves with the house feedback; the dialog closes only when the save went through.
function useSave(onSaved) {
  const { language } = useLanguage()
  const { notify } = useFeedback()
  const [saving, setSaving] = useState(false)
  const run = async (work, message) => {
    setSaving(true)
    try { await work(); notify(message || (language === 'en' ? 'Saved.' : 'Αποθηκεύτηκε.'), 'success'); await onSaved?.() } catch (error) { console.error(error); notify(kitchenErrorMessage(error, language), 'error') } finally { setSaving(false) }
  }
  return [saving, run]
}

function CorrectiveAction({ status, value, onChange, language }) {
  const en = language === 'en'
  if (status !== 'out' && !value) return null
  return <Field label={en ? 'Corrective action *' : 'Διορθωτική ενέργεια *'} hint={status === 'out' ? (en ? 'Out of limits: what was done (cooked longer, discarded, returned…).' : 'Εκτός ορίων: τι έγινε (συνέχιση μαγειρέματος, απόρριψη, επιστροφή…).') : ''}>
    <textarea rows={2} value={value || ''} onChange={e => onChange(e.target.value)} />
  </Field>
}

const productOptions = (products, en) => products.filter(item => item.active !== false).map(item => ({ value: item.id, label: item.name, description: [item.supplierCode, item.unit && unitLabel(item.unit, en ? 'en' : 'el')].filter(Boolean).join(' · ') }))

// --- Receipt -------------------------------------------------------------------------------

// A delivery: supplier, time, the five checks, its temperature and each product (batch,
// expiry, quantity, temperature, accepted or rejected with the reason). Checked live.
export function ReceiptDialog({ state, organizationId, initial, onClose, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const actor = useKitchenActor()
  const [draft, setDraft] = useState(() => ({ ...initial, receiverName: initial.receiverName || actor.name, items: initial.items?.length ? initial.items : [newReceiptItem()] }))
  const [saving, run] = useSave(onSaved)
  const set = next => setDraft(current => ({ ...current, ...next }))
  const setItem = (index, next) => setDraft(current => ({ ...current, items: current.items.map((item, at) => (at === index ? { ...item, ...next } : item)) }))
  const live = receiptStatus(state.limits, draft, draft.items.filter(item => item.productName))
  const problems = receiptProblems(draft, language, live.status)
  const suppliers = [...(state.suppliers || [])].sort((a, b) => (a.category === 'kitchen' ? 0 : 1) - (b.category === 'kitchen' ? 0 : 1) || a.name.localeCompare(b.name, 'el'))
  const classKey = { chilled: 'receipt_chilled', frozen: 'receipt_frozen', hot: 'receipt_hot' }[draft.temperatureClass]
  const save = () => run(async () => { await saveReceipt(organizationId, { ...draft, items: draft.items.filter(item => String(item.productName || '').trim()) }); onClose() }, en ? 'Receipt saved.' : 'Η παραλαβή αποθηκεύτηκε.')
  return <ObserverDialog width="wide" title={initial.id ? receiptTitle(initial, language) : (en ? 'New receipt' : 'Νέα παραλαβή')} subtitle={en ? 'Receipt checks, temperature and the products received. Checked against the limits as you type.' : 'Έλεγχοι παραλαβής, θερμοκρασία και τα προϊόντα. Ελέγχονται με τα όρια καθώς γράφετε.'} onClose={onClose}
    footer={<DialogActions onSave={save} disabled={saving || problems.length > 0} saveLabel={initial.id ? (en ? 'Save' : 'Αποθήκευση') : (en ? 'Register receipt' : 'Καταχώριση παραλαβής')}>
      <span className="kitchen-dialog-result"><SignalBadge tone={receiptResultTone(live.result)}>{receiptResultLabel(live.result, language)}</SignalBadge>{problems.length > 0 && <small>{en ? 'Missing' : 'Λείπει'}: {problems.join(' · ')}</small>}</span>
    </DialogActions>}>
    <FormGrid columns={3}>
      <SearchableSelect label={en ? 'Supplier *' : 'Προμηθευτής *'} value={draft.supplierId || draft.supplierName} allowCustom customLabel={value => `«${value}»`}
        options={suppliers.map(item => ({ value: item.id, label: item.name, description: item.category === 'kitchen' ? (en ? 'Kitchen' : 'Κουζίνα') : '' }))}
        onChange={value => { const found = suppliers.find(item => item.id === value); set(found ? { supplierId: found.id, supplierName: found.name } : { supplierId: '', supplierName: value || '' }) }} {...selectText(en)} />
      <ManualDateField label={en ? 'Date *' : 'Ημερομηνία *'} value={draft.receivedOn} onChange={value => set({ receivedOn: value })} />
      <TimeField label={en ? 'Time' : 'Ώρα'} value={draft.receivedTime} onChange={value => set({ receivedTime: value })} />
      <Field label={en ? 'Order number (reference)' : 'Αριθμός παραγγελίας (αναφορά)'}><input value={draft.orderReference || ''} onChange={e => set({ orderReference: e.target.value })} /></Field>
      <Field label={en ? 'Received by' : 'Παρέλαβε'}><input value={draft.receiverName || ''} onChange={e => set({ receiverName: e.target.value })} /></Field>
      <ChoiceField label={en ? 'Status' : 'Κατάσταση'} value={draft.status} options={[{ value: 'completed', label: en ? 'Receipt completed' : 'Ολοκλήρωση παραλαβής' }, { value: 'in_progress', label: en ? 'In progress' : 'Σε εξέλιξη' }]} onChange={value => set({ status: value })} />
    </FormGrid>
    <SectionHeader title={en ? 'Receipt checks' : 'Έλεγχοι παραλαβής'} subtitle={en ? 'A nonconformity needs a note or a corrective action.' : 'Μια μη συμμόρφωση χρειάζεται παρατήρηση ή διορθωτική ενέργεια.'} />
    <FormGrid columns={3}>
      <ChoiceField label={en ? 'Goods' : 'Είδος φορτίου'} value={draft.temperatureClass} options={options(TEMPERATURE_CLASSES, language)} onChange={value => set({ temperatureClass: value })} />
      <Field label={en ? 'Measured temperature (°C)' : 'Μετρημένη θερμοκρασία (°C)'}><input inputMode="decimal" value={draft.measuredTemperature ?? ''} disabled={!classKey} onChange={e => set({ measuredTemperature: e.target.value.replace(',', '.') })} /></Field>
      <div className="kitchen-live-slot">{classKey ? <LiveLimit status={live.temperature} limits={state.limits} limitKey={classKey} language={language} /> : <span className="kitchen-muted">{en ? 'No temperature limit for ambient goods.' : 'Χωρίς όριο θερμοκρασίας για τα είδη περιβάλλοντος.'}</span>}</div>
      {RECEIPT_CHECK_FIELDS.map(item => <ChoiceField key={item.field} label={item.label[en ? 1 : 0]} value={draft[item.field] || ''} options={options(CHECK_RESULTS, language)} onChange={value => set({ [item.field]: value })} />)}
      <CheckboxField label={en ? 'Receipt accepted' : 'Παραλαβή αποδεκτή'} checked={draft.accepted !== false} onChange={checked => set({ accepted: checked })} hint={draft.accepted === false ? (en ? 'A rejected receipt adds no stock.' : 'Παραλαβή που απορρίπτεται δεν προσθέτει απόθεμα.') : ''} />
    </FormGrid>
    <SectionHeader title={en ? 'Products' : 'Προϊόντα'} subtitle={en ? 'Each product is a batch in stock: batch, expiry, quantity and its temperature.' : 'Κάθε προϊόν είναι μια παρτίδα στο απόθεμα: παρτίδα, λήξη, ποσότητα και θερμοκρασία.'}
      actions={<Button variant="secondary" onClick={() => set({ items: [...draft.items, newReceiptItem()] })}><Plus size={15} />{en ? 'Product' : 'Προϊόν'}</Button>} />
    <div className="kitchen-item-list">
      {draft.items.map((item, index) => { const status = itemStatus(state.limits, item); return <div key={item.id || `new-${index}`} className={`kitchen-item-row ${item.accepted === false ? 'is-rejected' : ''}`}>
        <FormGrid columns={3}>
          <SearchableSelect label={`${index + 1}. ${en ? 'Product *' : 'Προϊόν *'}`} value={item.productId || item.productName} allowCustom customLabel={value => `«${value}»`} options={productOptions(state.products || [], en)}
            onChange={value => { const found = (state.products || []).find(p => p.id === value); setItem(index, found ? { productId: found.id, productName: found.name, unit: found.unit, storage: found.storage } : { productId: '', productName: value || '' }) }} {...selectText(en)} />
          <Field label={en ? 'Batch / lot' : 'Παρτίδα / κωδικοποίηση'}><input value={item.batchCode || ''} onChange={e => setItem(index, { batchCode: e.target.value })} /></Field>
          <ManualDateField label={en ? 'Expiry' : 'Λήξη'} value={item.expiryOn} onChange={value => setItem(index, { expiryOn: value })} optional />
          <Field label={en ? 'Quantity' : 'Ποσότητα'}><input inputMode="decimal" value={item.quantity ?? ''} onChange={e => setItem(index, { quantity: e.target.value.replace(',', '.') })} /></Field>
          <ChoiceField label={en ? 'Unit' : 'Μονάδα'} value={item.unit} options={options(UNITS, language)} onChange={value => setItem(index, { unit: value })} />
          <ChoiceField label={en ? 'Storage' : 'Αποθήκευση'} value={item.storage || 'chilled'} options={options(STORAGES, language)} onChange={value => setItem(index, { storage: value })} />
          <Field label={en ? 'Temperature (°C)' : 'Θερμοκρασία (°C)'}><input inputMode="decimal" value={item.temperature ?? ''} disabled={item.storage === 'ambient'} onChange={e => setItem(index, { temperature: e.target.value.replace(',', '.') })} /></Field>
          <div className="kitchen-live-slot">{item.storage !== 'ambient' && <LiveLimit status={status} limits={state.limits} limitKey={item.storage === 'frozen' ? 'receipt_frozen' : 'receipt_chilled'} language={language} />}</div>
          <div className="kitchen-item-accept">
            <CheckboxField label={en ? 'Product accepted' : 'Προϊόν αποδεκτό'} checked={item.accepted !== false} onChange={checked => setItem(index, { accepted: checked, rejectionReason: checked ? '' : item.rejectionReason || (status === 'out' ? (en ? 'Temperature out of limits' : 'Θερμοκρασία εκτός ορίων') : '') })} />
            {draft.items.length > 1 && <IconButton size="sm" tone="danger" label={en ? 'Remove product' : 'Αφαίρεση προϊόντος'} onClick={() => set({ items: draft.items.filter((_, at) => at !== index) })}><Trash2 size={14} /></IconButton>}
          </div>
        </FormGrid>
        {item.accepted === false && <Field label={en ? 'Reason of rejection *' : 'Αιτία απόρριψης *'}><input value={item.rejectionReason || ''} onChange={e => setItem(index, { rejectionReason: e.target.value })} /></Field>}
      </div> })}
    </div>
    <Field label={en ? 'Quality control remarks' : 'Παρατηρήσεις ποιοτικού ελέγχου'}><textarea rows={2} value={draft.qualityNotes || ''} onChange={e => set({ qualityNotes: e.target.value })} /></Field>
    <CorrectiveAction status={live.status} value={draft.correctiveAction} onChange={value => set({ correctiveAction: value })} language={language} />
  </ObserverDialog>
}

// --- Heat parameters ------------------------------------------------------------------------

export function ThermalDialog({ state, organizationId, initial, dishes = [], onClose, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const actor = useKitchenActor()
  const [draft, setDraft] = useState(() => ({ recordedByName: actor.name, ...initial }))
  const [saving, run] = useSave(onSaved)
  const set = next => setDraft(current => ({ ...current, ...next }))
  const s = thermalStatuses(state.limits, draft)
  const missing = !String(draft.dishName || '').trim() || !draft.processDate || needsCorrectiveAction(s.overall, draft.correctiveAction)
  const num = value => value.replace(',', '.')
  const save = () => run(async () => { await saveEntry(organizationId, 'kitchen_thermal_processes', draft); onClose() })
  return <ObserverDialog width="wide" title={en ? 'Heat parameters' : 'Παράμετροι ζέστης'} subtitle={en ? 'Cooking core, chilling, reheating and frying of a dish, against the critical limits.' : 'Πυρήνας μαγειρέματος, ψύξη, αναθέρμανση και τηγάνισμα ενός πιάτου, με τα κρίσιμα όρια.'} onClose={onClose}
    footer={<DialogActions onSave={save} disabled={saving || missing}><span className="kitchen-dialog-result"><LimitBadge status={s.overall} language={language} live /></span></DialogActions>}>
    <FormGrid columns={3}>
      <SearchableSelect label={en ? 'Dish *' : 'Πιάτο *'} value={draft.dishName} allowCustom customLabel={value => `«${value}»`} options={dishes.map(dish => ({ value: dish, label: dish }))} onChange={value => set({ dishName: value || '' })} {...selectText(en)} />
      <ManualDateField label={en ? 'Date *' : 'Ημερομηνία *'} value={draft.processDate} onChange={value => set({ processDate: value })} />
      <TimeField label={en ? 'Time' : 'Ώρα'} value={draft.processTime} onChange={value => set({ processTime: value })} />
      <Field label={en ? 'Cooking core (°C)' : 'Πυρήνας μαγειρέματος (°C)'}><input inputMode="decimal" value={draft.cookingTemp ?? ''} onChange={e => set({ cookingTemp: num(e.target.value) })} /></Field>
      <div className="kitchen-live-slot kitchen-span-2"><LiveLimit status={s.cooking} limits={state.limits} limitKey="cooking_core" language={language} /></div>
      <Field label={en ? 'After the chiller (°C)' : 'Μετά τον ψύκτη (°C)'}><input inputMode="decimal" value={draft.chillTemp ?? ''} onChange={e => set({ chillTemp: num(e.target.value) })} /></Field>
      <Field label={en ? 'Chilling time (minutes)' : 'Χρόνος ψύξης (λεπτά)'}><input inputMode="numeric" value={draft.chillMinutes ?? ''} onChange={e => set({ chillMinutes: e.target.value.replace(/\D/g, '') })} /></Field>
      <div className="kitchen-live-slot"><LiveLimit status={s.chill} limits={state.limits} limitKey="chilling" language={language} /></div>
      <Field label={en ? 'Reheating (°C)' : 'Αναθέρμανση (°C)'}><input inputMode="decimal" value={draft.reheatTemp ?? ''} onChange={e => set({ reheatTemp: num(e.target.value) })} /></Field>
      <div className="kitchen-live-slot kitchen-span-2"><LiveLimit status={s.reheat} limits={state.limits} limitKey="reheating" language={language} /></div>
      <Field label={en ? 'Frying (°C)' : 'Τηγάνισμα (°C)'}><input inputMode="decimal" value={draft.fryingTemp ?? ''} onChange={e => set({ fryingTemp: num(e.target.value) })} /></Field>
      <div className="kitchen-live-slot kitchen-span-2"><LiveLimit status={fryingStatus(state.limits, draft.fryingTemp)} limits={state.limits} language={language} text={en ? `Core ${limitText(state.limits.find(item => item.limitKey === 'cooking_core'), language)} (up to 120 °C) · oil ${limitText(state.limits.find(item => item.limitKey === 'frying_oil'), language)}` : `Πυρήνας ${limitText(state.limits.find(item => item.limitKey === 'cooking_core'), language)} (έως 120 °C) · λάδι ${limitText(state.limits.find(item => item.limitKey === 'frying_oil'), language)}`} /></div>
    </FormGrid>
    <CorrectiveAction status={s.overall} value={draft.correctiveAction} onChange={value => set({ correctiveAction: value })} language={language} />
    <Field label={en ? 'Notes' : 'Σημειώσεις'}><textarea rows={2} value={draft.notes || ''} onChange={e => set({ notes: e.target.value })} /></Field>
  </ObserverDialog>
}

// --- Defrosting -----------------------------------------------------------------------------

export function DefrostDialog({ state, organizationId, initial, stock = [], onClose, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const actor = useKitchenActor()
  const [draft, setDraft] = useState(() => ({ recordedByName: actor.name, ...initial }))
  const [saving, run] = useSave(onSaved)
  const set = next => setDraft(current => ({ ...current, ...next }))
  const entry = defrostEntry(draft)
  const status = defrostStatus(state.limits, entry)
  const products = [...(state.products || [])].filter(item => item.active !== false).sort((a, b) => (a.storage === 'frozen' ? 0 : 1) - (b.storage === 'frozen' ? 0 : 1) || a.name.localeCompare(b.name, 'el'))
  const batches = stock.filter(row => row.inStock && row.remaining > 0 && (!draft.productId || row.productId === draft.productId))
  const endBeforeStart = entry.endedAt && entry.startedAt && entry.endedAt < entry.startedAt
  const missing = !String(draft.productName || '').trim() || !draft.startDay || endBeforeStart || needsCorrectiveAction(status, draft.correctiveAction)
  const hours = entry.endedAt && entry.startedAt ? Math.round((new Date(entry.endedAt) - new Date(entry.startedAt)) / 360000) / 10 : null
  const save = () => run(async () => { await saveEntry(organizationId, 'kitchen_defrosting', entry); onClose() })
  return <ObserverDialog width="wide" title={initial.id ? (en ? 'Defrosting' : 'Απόψυξη') : (en ? 'New defrosting' : 'Νέα απόψυξη')} subtitle={en ? 'Start and end of the defrosting: date, time and temperature.' : 'Έναρξη και λήξη της απόψυξης: ημερομηνία, ώρα και θερμοκρασία.'} onClose={onClose}
    footer={<DialogActions onSave={save} disabled={saving || missing}><span className="kitchen-dialog-result"><LimitBadge status={status} language={language} live />{endBeforeStart && <small>{en ? 'The end is before the start.' : 'Η λήξη είναι πριν την έναρξη.'}</small>}</span></DialogActions>}>
    <FormGrid columns={3}>
      <SearchableSelect label={en ? 'Product *' : 'Προϊόν *'} value={draft.productId || draft.productName} allowCustom customLabel={value => `«${value}»`} options={productOptions(products, en)}
        onChange={value => { const found = products.find(item => item.id === value); set(found ? { productId: found.id, productName: found.name, unit: found.unit, receiptItemId: '' } : { productId: '', productName: value || '', receiptItemId: '' }) }} {...selectText(en)} />
      <SearchableSelect label={en ? 'Batch' : 'Παρτίδα'} value={draft.receiptItemId} options={batches.map(row => ({ value: row.receiptItemId, label: `${row.productName} · ${day(row.receivedOn)}`, description: [row.batchCode, `${fmtQty(row.remaining, language)} ${unitLabel(row.unit, language)}`].filter(Boolean).join(' · ') }))} onChange={value => set({ receiptItemId: value || '' })} {...selectText(en)} />
      <ChoiceField label={en ? 'Method' : 'Μέθοδος'} value={draft.method} options={options(DEFROST_METHODS, language)} onChange={value => set({ method: value })} />
      <Field label={en ? 'Quantity' : 'Ποσότητα'}><input inputMode="decimal" value={draft.quantity ?? ''} onChange={e => set({ quantity: e.target.value.replace(',', '.') })} /></Field>
      <ChoiceField label={en ? 'Unit' : 'Μονάδα'} value={draft.unit} options={options(UNITS, language)} onChange={value => set({ unit: value })} />
      <span />
      <ManualDateField label={en ? 'Start date *' : 'Ημερομηνία έναρξης *'} value={draft.startDay} onChange={value => set({ startDay: value })} />
      <TimeField label={en ? 'Start time' : 'Ώρα έναρξης'} value={draft.startTime} onChange={value => set({ startTime: value })} />
      <Field label={en ? 'Start temperature (°C)' : 'Θερμοκρασία έναρξης (°C)'}><input inputMode="decimal" value={draft.startTemp ?? ''} onChange={e => set({ startTemp: e.target.value.replace(',', '.') })} /></Field>
      <ManualDateField label={en ? 'End date' : 'Ημερομηνία λήξης'} value={draft.endDay} onChange={value => set({ endDay: value })} optional />
      <TimeField label={en ? 'End time' : 'Ώρα λήξης'} value={draft.endTime} onChange={value => set({ endTime: value })} />
      <Field label={en ? 'End temperature (°C)' : 'Θερμοκρασία λήξης (°C)'}><input inputMode="decimal" value={draft.endTemp ?? ''} onChange={e => set({ endTemp: e.target.value.replace(',', '.') })} /></Field>
    </FormGrid>
    <LiveLimit status={status} limits={state.limits} limitKey="defrost" language={language} text={`${en ? 'Limit' : 'Όριο'} ${limitText(state.limits.find(item => item.limitKey === 'defrost'), language)}${hours != null ? ` · ${en ? 'duration' : 'διάρκεια'} ${String(hours).replace('.', en ? '.' : ',')} ${en ? 'h' : 'ώρες'}` : ''}`} />
    <CorrectiveAction status={status} value={draft.correctiveAction} onChange={value => set({ correctiveAction: value })} language={language} />
    <Field label={en ? 'Notes' : 'Σημειώσεις'}><textarea rows={2} value={draft.notes || ''} onChange={e => set({ notes: e.target.value })} /></Field>
  </ObserverDialog>
}

// --- Pureeing ----------------------------------------------------------------------------

export function PureeingDialog({ organizationId, initial, dishes = [], onClose, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const actor = useKitchenActor()
  const [draft, setDraft] = useState(() => ({ recordedByName: actor.name, ...initial }))
  const [saving, run] = useSave(onSaved)
  const set = next => setDraft(current => ({ ...current, ...next }))
  const status = pureeingStatus(draft)
  const missing = !String(draft.productName || '').trim() || !draft.pureedOn || needsCorrectiveAction(status, draft.correctiveAction)
  const save = () => run(async () => { await saveEntry(organizationId, 'kitchen_pureeing', draft); onClose() })
  return <ObserverDialog title={en ? 'Pureeing / sieving' : 'Πολτοποίηση / σούρωμα'} subtitle={en ? 'Visual check of the purée and check of the blade before and after.' : 'Οπτικός έλεγχος του πολτού και έλεγχος της λεπίδας πριν και μετά.'} onClose={onClose}
    footer={<DialogActions onSave={save} disabled={saving || missing}><span className="kitchen-dialog-result"><LimitBadge status={status} language={language} live /></span></DialogActions>}>
    <FormGrid columns={3}>
      <SearchableSelect label={en ? 'Dish / product *' : 'Πιάτο / προϊόν *'} value={draft.productName} allowCustom customLabel={value => `«${value}»`} options={dishes.map(dish => ({ value: dish, label: dish }))} onChange={value => set({ productName: value || '' })} {...selectText(en)} />
      <ManualDateField label={en ? 'Date *' : 'Ημερομηνία *'} value={draft.pureedOn} onChange={value => set({ pureedOn: value })} />
      <ChoiceField label={en ? 'Method' : 'Μέθοδος'} value={draft.method} options={options(PUREE_METHODS, language)} onChange={value => set({ method: value })} />
      <CheckboxField label={en ? 'Visual check OK' : 'Οπτικός έλεγχος εντάξει'} checked={draft.visualCheck !== false} onChange={checked => set({ visualCheck: checked })} />
      <CheckboxField label={en ? 'Blade check OK' : 'Έλεγχος λεπίδας εντάξει'} checked={draft.bladeCheck !== false} onChange={checked => set({ bladeCheck: checked })} />
      <div className="kitchen-live-slot"><LimitBadge status={status} language={language} live /></div>
    </FormGrid>
    <CorrectiveAction status={status} value={draft.correctiveAction} onChange={value => set({ correctiveAction: value })} language={language} />
    <Field label={en ? 'Notes' : 'Σημειώσεις'}><textarea rows={2} value={draft.notes || ''} onChange={e => set({ notes: e.target.value })} /></Field>
  </ObserverDialog>
}

// --- Raw material used in a production ----------------------------------------------------

// A batch picked from stock (FIFO first, expired ones blocked) into a day's production.
export function UsageDialog({ organizationId, initial, stock, dishes = [], onClose, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const actor = useKitchenActor()
  const [draft, setDraft] = useState(() => ({ recordedByName: actor.name, ...initial }))
  const [saving, run] = useSave(onSaved)
  const set = next => setDraft(current => ({ ...current, ...next }))
  // The batch being edited counts its own quantity back.
  const own = useMemo(() => (initial.id ? stock.map(row => (row.receiptItemId === initial.receiptItemId ? { ...row, remaining: row.remaining + (Number(initial.quantity) || 0) } : row)) : stock), [stock, initial.id, initial.receiptItemId, initial.quantity])
  const batches = availableBatches(own, draft.usedOn)
  const chosen = own.find(row => row.receiptItemId === draft.receiptItemId) || null
  const problem = batchProblem(chosen, draft.usedOn, draft.quantity, language)
  const older = fifoAdvice(own, chosen, draft.usedOn)
  const missing = !chosen || !(Number(draft.quantity) > 0) || Boolean(problem)
  const save = () => run(async () => { await saveEntry(organizationId, 'kitchen_material_usage', { ...draft, productId: chosen.productId, productName: chosen.productName, unit: chosen.unit, lotLabel: draft.lotLabel || chosen.batchCode || chosen.lotLabel }); onClose() })
  return <ObserverDialog width="wide" title={en ? 'Raw material used' : 'Πρώτη ύλη σε χρήση'} subtitle={en ? 'Pick the batch from stock: the oldest first; an expired batch cannot be used.' : 'Επιλέξτε την παρτίδα από το απόθεμα: πρώτα η παλαιότερη παρτίδα· παρτίδα που έληξε δεν χρησιμοποιείται.'} onClose={onClose}
    footer={<DialogActions onSave={save} disabled={saving || missing} />}>
    <FormGrid columns={3}>
      <SearchableSelect className="kitchen-span-2" label={en ? 'Batch in stock *' : 'Παρτίδα από το απόθεμα *'} value={draft.receiptItemId}
        options={batches.map(row => ({ value: row.receiptItemId, label: `${row.productName} · ${en ? 'received' : 'παραλαβή'} ${day(row.receivedOn)}`, description: [row.batchCode || row.lotLabel, `${en ? 'left' : 'υπόλοιπο'} ${fmtQty(row.remaining, language)} ${unitLabel(row.unit, language)}`, row.expiryOn && `${en ? 'expires' : 'λήξη'} ${day(row.expiryOn)}`, row.supplierName].filter(Boolean).join(' · '), keywords: [row.supplierName, row.receiptCode].join(' ') }))}
        onChange={value => set({ receiptItemId: value || '' })} {...selectText(en)} />
      <ManualDateField label={en ? 'Day *' : 'Ημέρα *'} value={draft.usedOn} onChange={value => set({ usedOn: value })} />
      <Field label={`${en ? 'Quantity' : 'Ποσότητα'}${chosen ? ` (${unitLabel(chosen.unit, language)})` : ''} *`}><input inputMode="decimal" value={draft.quantity ?? ''} onChange={e => set({ quantity: e.target.value.replace(',', '.') })} /></Field>
      <SearchableSelect className="kitchen-span-2" label={en ? 'Dish' : 'Πιάτο'} value={draft.dishName} allowCustom customLabel={value => `«${value}»`} options={dishes.map(dish => ({ value: dish, label: dish }))} onChange={value => set({ dishName: value || '' })} {...selectText(en)} />
    </FormGrid>
    {chosen && <div className="kitchen-batch-note">
      {chosen.expiring && <SignalBadge tone="warning">{en ? `Expires ${day(chosen.expiryOn)}` : `Λήγει ${day(chosen.expiryOn)}`}</SignalBadge>}
      {older && <SignalBadge tone="info">{en ? `An older batch of ${older.productName} (received ${day(older.receivedOn)}) is in stock: use it first` : `Υπάρχει παλαιότερη παρτίδα ${older.productName} (παραλαβή ${day(older.receivedOn)})· χρησιμοποιήστε πρώτα εκείνη`}</SignalBadge>}
      {problem && <SignalBadge tone="danger">{problem}</SignalBadge>}
    </div>}
    <Field label={en ? 'Notes' : 'Σημειώσεις'}><textarea rows={2} value={draft.notes || ''} onChange={e => set({ notes: e.target.value })} /></Field>
  </ObserverDialog>
}

// --- Withdraw / discard a batch ----------------------------------------------------------

export function WriteoffDialog({ organizationId, batch, onClose, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const actor = useKitchenActor()
  const [draft, setDraft] = useState(() => ({ receiptItemId: batch.receiptItemId, writtenOffOn: new Date().toISOString().slice(0, 10), quantity: batch.remaining > 0 ? String(batch.remaining) : '', reason: batch.expired ? 'expired' : 'spoiled', notes: '', recordedByName: actor.name }))
  const [saving, run] = useSave(onSaved)
  const set = next => setDraft(current => ({ ...current, ...next }))
  const missing = !(Number(draft.quantity) > 0) || !draft.reason
  const save = () => run(async () => { await saveWriteoff(organizationId, draft); onClose() }, en ? 'Withdrawn from stock.' : 'Αποσύρθηκε από το απόθεμα.')
  return <ObserverDialog title={en ? 'Withdraw / discard' : 'Απόσυρση / απόρριψη'} subtitle={`${batch.productName} · ${batch.receiptCode} · ${en ? 'left' : 'υπόλοιπο'} ${fmtQty(batch.remaining, language)} ${unitLabel(batch.unit, language)}`} onClose={onClose}
    footer={<DialogActions onSave={save} disabled={saving || missing} saveLabel={en ? 'Withdraw' : 'Απόσυρση'} />}>
    <FormGrid columns={3}>
      <Field label={en ? 'Quantity *' : 'Ποσότητα *'}><input inputMode="decimal" value={draft.quantity} onChange={e => set({ quantity: e.target.value.replace(',', '.') })} /></Field>
      <ChoiceField label={en ? 'Reason *' : 'Αιτία *'} value={draft.reason} options={options(WRITEOFF_REASONS, language)} onChange={value => set({ reason: value })} />
      <ManualDateField label={en ? 'Date' : 'Ημερομηνία'} value={draft.writtenOffOn} onChange={value => set({ writtenOffOn: value })} />
    </FormGrid>
    <Field label={en ? 'Notes' : 'Σημειώσεις'}><textarea rows={2} value={draft.notes} onChange={e => set({ notes: e.target.value })} /></Field>
  </ObserverDialog>
}

// --- Catalogue, menus, production day ----------------------------------------------------

export function ProductDialog({ state, organizationId, initial, onClose, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const [draft, setDraft] = useState(initial)
  const [saving, run] = useSave(onSaved)
  const set = next => setDraft(current => ({ ...current, ...next }))
  const save = () => run(async () => { await saveSimple(organizationId, 'kitchen_products', draft); onClose() })
  return <ObserverDialog title={initial.id ? (en ? 'Product' : 'Προϊόν') : (en ? 'New product' : 'Νέο προϊόν')} onClose={onClose} footer={<DialogActions onSave={save} disabled={saving || String(draft.name || '').trim().length < 2} />}>
    <FormGrid columns={3}>
      <Field label={en ? 'Name *' : 'Ονομασία *'}><input value={draft.name} onChange={e => set({ name: e.target.value })} /></Field>
      <ChoiceField label={en ? 'Category' : 'Κατηγορία'} value={draft.category} options={options(PRODUCT_CATEGORIES, language)} onChange={value => set({ category: value })} />
      <ChoiceField label={en ? 'Storage' : 'Αποθήκευση'} value={draft.storage} options={options(STORAGES, language)} onChange={value => set({ storage: value })} />
      <ChoiceField label={en ? 'Unit' : 'Μονάδα'} value={draft.unit} options={options(UNITS, language)} onChange={value => set({ unit: value })} />
      <SearchableSelect label={en ? 'Supplier' : 'Προμηθευτής'} value={draft.supplierId} options={(state.suppliers || []).map(item => ({ value: item.id, label: item.name }))} onChange={value => set({ supplierId: value || '' })} {...selectText(en)} />
      <Field label={en ? 'Supplier code' : 'Κωδικός προμηθευτή'}><input value={draft.supplierCode || ''} onChange={e => set({ supplierCode: e.target.value })} /></Field>
      <Field label={en ? 'Low stock at' : 'Χαμηλό απόθεμα κάτω από'}><input inputMode="decimal" value={draft.lowStockQuantity ?? ''} onChange={e => set({ lowStockQuantity: e.target.value.replace(',', '.') })} /></Field>
      <CheckboxField label={en ? 'Active' : 'Ενεργό'} checked={draft.active !== false} onChange={checked => set({ active: checked })} />
    </FormGrid>
    <Field label={en ? 'Notes' : 'Σημειώσεις'}><textarea rows={2} value={draft.notes || ''} onChange={e => set({ notes: e.target.value })} /></Field>
  </ObserverDialog>
}

export function MenuDialog({ organizationId, initial, onClose, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const [draft, setDraft] = useState(initial)
  const [saving, run] = useSave(onSaved)
  const set = next => setDraft(current => ({ ...current, ...next }))
  const save = () => run(async () => { await saveSimple(organizationId, 'kitchen_menus', draft); onClose() })
  return <ObserverDialog width="wide" title={initial.id ? (en ? 'Standard menu' : 'Τυπικό μενού') : (en ? 'New standard menu' : 'Νέο τυπικό μενού')} onClose={onClose} footer={<DialogActions onSave={save} disabled={saving || !String(draft.name || '').trim()} />}>
    <FormGrid columns={3}>
      <Field label={en ? 'Name *' : 'Ονομασία *'}><input value={draft.name} onChange={e => set({ name: e.target.value })} /></Field>
      <ChoiceField label={en ? 'Day of the week' : 'Ημέρα της εβδομάδας'} value={String(draft.weekday || '')} options={[{ value: '', label: en ? 'Any day' : 'Οποιαδήποτε ημέρα' }, ...WEEKDAYS.map((name, index) => ({ value: String(index + 1), label: name }))]} onChange={value => set({ weekday: value })} />
      <CheckboxField label={en ? 'Active' : 'Ενεργό'} checked={draft.active !== false} onChange={checked => set({ active: checked })} />
    </FormGrid>
    <Field label={en ? 'Menu (lunch, dinner)' : 'Μενού (μεσημεριανό, βραδινό)'}><textarea rows={8} value={draft.menuText || ''} onChange={e => set({ menuText: e.target.value })} /></Field>
  </ObserverDialog>
}

// A production day: from the plan or the weekday's standard menu.
export function ProductionDialog({ state, organizationId, initial, onClose, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const [draft, setDraft] = useState(() => { const menu = initial.id ? null : menuForDay(state, initial.productionDate); return menu ? { ...initial, menuId: menu.id, menuText: menu.menuText } : initial })
  const [saving, run] = useSave()
  const set = next => setDraft(current => ({ ...current, ...next }))
  const exists = !initial.id && (state.productions || []).some(item => item.productionDate === draft.productionDate)
  const save = () => run(async () => { const id = await saveProduction(organizationId, draft); await onSaved?.(id) })
  return <ObserverDialog width="wide" title={initial.id ? (en ? 'Production day' : 'Ημέρα παραγωγής') : (en ? 'Open production day' : 'Άνοιγμα ημέρας παραγωγής')} subtitle={en ? 'The day\'s menu starts from the standard menu of its weekday.' : 'Το μενού της ημέρας ξεκινά από το τυπικό μενού της ημέρας της εβδομάδας.'} onClose={onClose}
    footer={<DialogActions onSave={save} disabled={saving || !draft.productionDate} saveLabel={initial.id ? (en ? 'Save' : 'Αποθήκευση') : (en ? 'Open the day' : 'Άνοιγμα ημέρας')}>{exists && <span className="kitchen-dialog-result"><small>{en ? 'A production of this date exists already.' : 'Υπάρχει ήδη παραγωγή αυτής της ημερομηνίας.'}</small></span>}</DialogActions>}>
    <FormGrid columns={3}>
      <ManualDateField label={en ? 'Date *' : 'Ημερομηνία *'} value={draft.productionDate} onChange={value => { const menu = menuForDay(state, value); set({ productionDate: value, ...(menu && !initial.id ? { menuId: menu.id, menuText: menu.menuText } : {}) }) }} />
      <ChoiceField label={en ? 'Standard menu' : 'Τυπικό μενού'} value={draft.menuId || ''} options={[{ value: '', label: en ? 'None' : 'Χωρίς' }, ...(state.menus || []).map(menu => ({ value: menu.id, label: menu.name }))]} onChange={value => { const menu = (state.menus || []).find(item => item.id === value); set({ menuId: value, ...(menu ? { menuText: menu.menuText } : {}) }) }} />
    </FormGrid>
    <FormGrid columns={2}>
      <Field label={en ? 'Daily menu' : 'Μενού ημέρας'}><textarea rows={8} value={draft.menuText || ''} onChange={e => set({ menuText: e.target.value })} /></Field>
      <Field label={en ? 'Production notes' : 'Σημειώσεις παραγωγής'}><textarea rows={8} value={draft.notes || ''} onChange={e => set({ notes: e.target.value })} /></Field>
    </FormGrid>
  </ObserverDialog>
}

export function MealDialog({ initial, onClose, onSave }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const [draft, setDraft] = useState(initial)
  const set = next => setDraft(current => ({ ...current, ...next }))
  return <ObserverDialog title={en ? 'Meal plan line' : 'Γραμμή πλάνου γευμάτων'} onClose={onClose} footer={<DialogActions onSave={() => onSave(draft)} disabled={!String(draft.dish || '').trim()} />}>
    <FormGrid columns={3}>
      <ChoiceField label={en ? 'Meal' : 'Γεύμα'} value={draft.meal} options={options(MEALS, language)} onChange={value => set({ meal: value })} />
      <ChoiceField label={en ? 'Diet' : 'Δίαιτα'} value={draft.diet} options={options(DIETS, language)} onChange={value => set({ diet: value })} />
      <Field label={en ? 'Portions' : 'Μερίδες'}><input inputMode="numeric" value={draft.portions ?? ''} onChange={e => set({ portions: e.target.value.replace(/\D/g, '') })} /></Field>
    </FormGrid>
    <Field label={en ? 'Dish *' : 'Πιάτο *'}><input value={draft.dish || ''} onChange={e => set({ dish: e.target.value })} /></Field>
    <Field label={en ? 'Notes' : 'Σημειώσεις'}><textarea rows={2} value={draft.notes || ''} onChange={e => set({ notes: e.target.value })} /></Field>
  </ObserverDialog>
}

// --- Critical limits and the HACCP plan --------------------------------------------------

export function LimitsDialog({ state, organizationId, onClose, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const [rows, setRows] = useState(() => state.limits.map(item => ({ ...item, minValue: item.minValue ?? '', maxValue: item.maxValue ?? '', withinMinutes: item.withinMinutes ?? '' })))
  const [saving, run] = useSave(onSaved)
  const set = (key, next) => setRows(current => current.map(item => (item.limitKey === key ? { ...item, ...next } : item)))
  const invalid = rows.some(item => item.minValue === '' && item.maxValue === '')
  const save = () => run(async () => { await saveLimits(organizationId, rows.map(item => ({ ...item, minValue: item.minValue === '' ? null : Number(item.minValue), maxValue: item.maxValue === '' ? null : Number(item.maxValue), withinMinutes: item.withinMinutes === '' ? null : Number(item.withinMinutes) }))); onClose() }, en ? 'Limits saved.' : 'Τα όρια αποθηκεύτηκαν.')
  return <ObserverDialog width="wide" title={en ? 'Critical limits' : 'Κρίσιμα όρια'} subtitle={en ? 'Every measurement is marked within / out of limits by these values.' : 'Κάθε μέτρηση χαρακτηρίζεται εντός / εκτός ορίων με αυτές τις τιμές.'} onClose={onClose} footer={<DialogActions onSave={save} disabled={saving || invalid} />}>
    <div className="kitchen-item-list">{rows.map(item => <div key={item.limitKey} className="kitchen-item-row">
      <FormGrid columns={3}>
        <Field label={item.label[en ? 1 : 0]}><input value={limitText({ ...item, minValue: item.minValue === '' ? null : Number(item.minValue), maxValue: item.maxValue === '' ? null : Number(item.maxValue), withinMinutes: item.withinMinutes === '' ? null : Number(item.withinMinutes) }, language)} disabled /></Field>
        <Field label={en ? 'At least (°C)' : 'Τουλάχιστον (°C)'}><input inputMode="decimal" value={item.minValue} onChange={e => set(item.limitKey, { minValue: e.target.value.replace(',', '.') })} /></Field>
        <Field label={en ? 'At most (°C)' : 'Το πολύ (°C)'}><input inputMode="decimal" value={item.maxValue} onChange={e => set(item.limitKey, { maxValue: e.target.value.replace(',', '.') })} /></Field>
        {(item.limitKey === 'chilling' || item.limitKey === 'defrost') && <Field label={en ? 'Within (minutes)' : 'Μέσα σε (λεπτά)'}><input inputMode="numeric" value={item.withinMinutes} onChange={e => set(item.limitKey, { withinMinutes: e.target.value.replace(/\D/g, '') })} /></Field>}
        <CheckboxField label={en ? 'Checked' : 'Ελέγχεται'} checked={item.active !== false} onChange={checked => set(item.limitKey, { active: checked })} />
      </FormGrid>
    </div>)}</div>
  </ObserverDialog>
}

const HAZARDS = [['hazardBiological', 'Βιολογικός', 'Biological'], ['hazardChemical', 'Χημικός', 'Chemical'], ['hazardPhysical', 'Φυσικός', 'Physical'], ['hazardAllergen', 'Αλλεργιογόνα', 'Allergens']]
export function StepDialog({ state, organizationId, initial, onClose, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const [draft, setDraft] = useState(initial)
  const [saving, run] = useSave(onSaved)
  const set = next => setDraft(current => ({ ...current, ...next }))
  const save = () => run(async () => { await saveSimple(organizationId, 'kitchen_haccp_steps', draft); onClose() })
  const text = (field, label, rows = 2) => <Field label={label}><textarea rows={rows} value={draft[field] || ''} onChange={e => set({ [field]: e.target.value })} /></Field>
  return <ObserverDialog width="wide" title={initial.id ? draft.name : (en ? 'New process step' : 'Νέο στάδιο διεργασίας')} subtitle={en ? 'Hazard analysis, the critical control point and its limit, monitoring, corrective action and verification.' : 'Ανάλυση κινδύνων, κρίσιμο σημείο ελέγχου και όριο, παρακολούθηση, διορθωτική ενέργεια και επαλήθευση.'} onClose={onClose}
    footer={<DialogActions onSave={save} disabled={saving || String(draft.name || '').trim().length < 2} />}>
    <FormGrid columns={3}>
      <Field label={en ? 'Step *' : 'Στάδιο *'}><input value={draft.name || ''} onChange={e => set({ name: e.target.value })} /></Field>
      <ChoiceField label={en ? 'Critical limit' : 'Κρίσιμο όριο'} value={draft.limitKey || ''} options={[{ value: '', label: en ? 'None' : 'Χωρίς' }, ...state.limits.map(item => ({ value: item.limitKey, label: `${item.label[en ? 1 : 0]} (${limitText(item, language)})` }))]} onChange={value => set({ limitKey: value })} />
      <CheckboxField label={en ? 'Critical control point (CCP)' : 'Κρίσιμο σημείο ελέγχου (CCP)'} checked={Boolean(draft.isCcp)} onChange={checked => set({ isCcp: checked })} />
    </FormGrid>
    <ChoiceChips label={en ? 'Hazards' : 'Κίνδυνοι'} options={HAZARDS.map(([value, el, enLabel]) => ({ value, label: en ? enLabel : el }))} selected={HAZARDS.map(([value]) => value).filter(value => draft[value])} onToggle={value => set({ [value]: !draft[value] })} />
    {text('hazards', en ? 'Hazard analysis' : 'Ανάλυση κινδύνων')}
    {text('controlMeasure', en ? 'Control measure' : 'Μέτρο ελέγχου')}
    <FormGrid columns={2}>{text('monitoring', en ? 'Monitoring (what, how)' : 'Παρακολούθηση (τι, πώς)')}{text('frequency', en ? 'Frequency' : 'Συχνότητα')}</FormGrid>
    {text('correctiveAction', en ? 'Corrective action' : 'Διορθωτική ενέργεια')}
    <FormGrid columns={3}>{text('verification', en ? 'Verification' : 'Επαλήθευση')}{text('records', en ? 'Records' : 'Αρχεία')}{text('responsible', en ? 'Responsible' : 'Υπεύθυνος')}</FormGrid>
  </ObserverDialog>
}

