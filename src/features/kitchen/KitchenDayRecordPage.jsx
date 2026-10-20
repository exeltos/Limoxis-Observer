import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Blend, ChefHat, Droplets, Package, Pencil, Plus, Route, ShieldCheck, Snowflake, Thermometer, Trash2, Undo2, Utensils } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { RecordMetricStrip } from '../../design-system/RecordMetricStrip'
import { RegistryTable } from '../../design-system/RegistryTable'
import { StatusBadge } from '../../design-system/StatusBadge'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { ExportMenu } from '../../design-system/ExportMenu'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { FormGrid } from '../../design-system/FormCard'
import { Field } from '../../design-system/Field'
import { CheckboxField } from '../../design-system/CheckboxField'
import { SaveButton } from '../../design-system/SaveButton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { reportExports } from '../../core/export/reportDocument'
import { LimitBadge, useKitchen, useKitchenAccess } from './KitchenShared'
import { KitchenDialogHost } from './KitchenPage'
import { TraceDialog, fmtDay, fmtStamp, useSignOff } from './KitchenPanels'
import { MealDialog } from './KitchenDialogs'
import { dayOf, dayRecords, defrostMethodLabel, dietLabel, fmtQty, fmtTemp, mealLabel, newDefrost, newMeal, newPureeing, newThermal, newUsage, pureeMethodLabel, stockRows, unitLabel, weekdayLabel, weekdayOf } from './kitchenModel'
import { limitText } from './kitchenLimits'
import { dailyHaccpDocument } from './kitchenReports'
import { kitchenErrorMessage, removeEntry, saveProduction } from './kitchenService'

const temp = (value, text, language) => (value !== '' && value != null ? fmtTemp(value, language) : text ? <span className="kitchen-unparsed" title={text}>{text}</span> : '—')
const timeOf = value => { if (!value) return ''; const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

// The production day («Λεπτομέρειες Παραγωγής»), the hub of the kitchen: its menu and
// notes, the raw materials taken from stock, the heat parameters of each dish, pureeing,
// disinfection, the defrosts that ended that day and the meal plan; the daily HACCP sheet,
// the traceability of the day and its HACCP sign-off.
// Meal headings in a menu's text («Μεσημεριανό», «Βραδινό»): the subtitle lists the dishes.
const MEAL_HEADING = /^(πρωιν[οό]|μεσημεριαν[οό]|απογευματιν[οό]|βραδιν[οό]|breakfast|lunch|dinner)\s*:?$/i

export function KitchenDayRecordPage() {
  const { productionId } = useParams()
  const { goBack } = useContextualNavigation('/kitchen?tab=days')
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, confirm } = useFeedback()
  const access = useKitchenAccess()
  const { state, loading, reload, organizationId } = useKitchen({ productionId })
  const { sign, reopenRow } = useSignOff(organizationId, reload)
  const [tab, setTab] = useState('usage')
  const [dialog, setDialog] = useState(null)
  const [trace, setTrace] = useState(null)
  const [traceDay, setTraceDay] = useState(false)
  const [meal, setMeal] = useState(null)
  const [disinfection, setDisinfection] = useState(null)
  const [saving, setSaving] = useState(false)
  const production = state?.productions.find(item => item.id === productionId) || null
  const stock = useMemo(() => (state ? stockRows(state) : []), [state])
  const records = useMemo(() => (state && production ? dayRecords(state, production) : null), [state, production])
  const dishes = useMemo(() => (production ? [...new Set([...(production.meals || []).map(item => item.dish), ...(records?.thermal || []).map(item => item.dishName), ...(production.menuText || '').split('\n').map(line => line.trim()).filter(line => line && !/^(μεσημεριανό|βραδινό|πρωινό|lunch|dinner|breakfast)$/i.test(line))].filter(Boolean))] : []), [production, records])

  if (!state) return <Page fill><div className="inline-empty">{loading ? (en ? 'Loading…' : 'Φόρτωση…') : (en ? 'Not available.' : 'Δεν είναι διαθέσιμο.')}</div></Page>
  if (!production) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Production day not found' : 'Η ημέρα παραγωγής δεν βρέθηκε'}</strong></div></Page>

  const locked = Boolean(production.verifiedAt)
  const canEdit = access.canRecord && !locked
  const blocked = () => notify(en ? 'Allow pop-ups to print.' : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'error')
  const persist = async (next, message) => {
    setSaving(true)
    try { await saveProduction(organizationId, next); notify(message || (en ? 'Saved.' : 'Αποθηκεύτηκε.'), 'success'); await reload(); return true } catch (error) { console.error(error); notify(kitchenErrorMessage(error, language), 'error'); return false } finally { setSaving(false) }
  }
  const drop = async (table, row) => {
    if (!await confirm({ title: en ? 'Delete' : 'Διαγραφή', message: en ? 'The entry is deleted.' : 'Η εγγραφή διαγράφεται.', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })) return
    try { await removeEntry(organizationId, table, row.id); await reload() } catch (error) { notify(kitchenErrorMessage(error, language), 'error') }
  }
  const editActions = (type, table, row) => canEdit && <div className="row-actions">
    <IconButton size="sm" label={en ? 'Edit' : 'Επεξεργασία'} onClick={() => setDialog({ type, initial: { ...row } })}><Pencil size={14} /></IconButton>
    {(table === 'kitchen_material_usage' || access.canManage) && <IconButton size="sm" tone="danger" label={en ? 'Delete' : 'Διαγραφή'} onClick={() => drop(table, row)}><Trash2 size={14} /></IconButton>}
  </div>
  const add = (label, onClick) => canEdit && <Button onClick={onClick}><Plus size={15} />{label}</Button>
  const headerActions = <div className="row-actions">
    <ExportMenu {...reportExports(() => dailyHaccpDocument(state, production, { language }), { word: true, onBlocked: blocked })} />
    <Button variant="secondary" onClick={() => setTraceDay(true)}><Route size={15} />{en ? 'Traceability' : 'Ιχνηλάτηση'}</Button>
    {access.canManage && (locked ? <Button variant="secondary" onClick={() => reopenRow('kitchen_productions', production)}><Undo2 size={15} />{en ? 'Reopen' : 'Άνοιγμα ξανά'}</Button> : <Button onClick={() => sign('kitchen_productions', production)}><ShieldCheck size={15} />{en ? 'HACCP sign-off' : 'Επαλήθευση HACCP'}</Button>)}
    {canEdit && <IconButton tone="edit" label={en ? 'Edit day' : 'Επεξεργασία ημέρας'} onClick={() => setDialog({ type: 'production', initial: { ...production } })}><Pencil size={16} /></IconButton>}
  </div>
  const tabs = [
    { id: 'usage', label: en ? `Raw materials ${records.usage.length}` : `Α΄ ύλες ${records.usage.length}`, icon: Package },
    { id: 'thermal', label: en ? `Heat parameters ${records.thermal.length}` : `Παράμετροι ζέστης ${records.thermal.length}`, icon: Thermometer },
    { id: 'pureeing', label: en ? `Pureeing / sieving ${records.pureeing.length}` : `Πολτοποίηση / σούρωμα ${records.pureeing.length}`, icon: Blend },
    { id: 'disinfection', label: en ? 'Disinfection' : 'Απολύμανση', icon: Droplets },
    { id: 'defrost', label: en ? `Defrosting ${records.defrosting.length}` : `Αποψύξεις ${records.defrosting.length}`, icon: Snowflake },
    { id: 'menu', label: en ? 'Menu & plan' : 'Μενού & πλάνο', icon: Utensils },
  ]
  const dis = disinfection || { disinfectionVegetables: production.disinfectionVegetables, disinfectionFruit: production.disinfectionFruit, disinfectionAgent: production.disinfectionAgent || '', disinfectionConcentrationPpm: production.disinfectionConcentrationPpm || '', disinfectionMinutes: production.disinfectionMinutes || '', disinfectionNotes: production.disinfectionNotes || '' }
  const setDis = next => setDisinfection({ ...dis, ...next })
  const usedBatches = [...new Set(records.usage.map(row => row.receiptItemId).filter(Boolean))].map(id => stock.find(row => row.receiptItemId === id)).filter(Boolean)
  return <Page fill><EntityRecordShell className="kitchen-record-shell workspace-fill" avatar={<ChefHat size={19} />} eyebrow={en ? 'Production day' : 'Ημέρα παραγωγής'} title={`${weekdayLabel(weekdayOf(production.productionDate), language)} ${fmtDay(production.productionDate)}`}
    subtitle={(production.menuText || '').split('\n').map(line => line.trim()).filter(line => line && !MEAL_HEADING.test(line)).slice(0, 4).join(' · ')}
    status={<span className="kitchen-notes">{locked ? <StatusBadge tone="success"><ShieldCheck size={13} />{en ? 'Signed off' : 'Επαληθεύτηκε'} · {production.verifiedByName || '—'} · {fmtStamp(production.verifiedAt, language)}</StatusBadge> : <StatusBadge tone="warning">{en ? 'HACCP sign-off pending' : 'Εκκρεμεί επαλήθευση HACCP'}</StatusBadge>}{records.outOfLimits > 0 && <StatusBadge tone="danger">{records.outOfLimits} {en ? 'out of limits' : 'εκτός ορίων'}</StatusBadge>}</span>}
    headerActions={headerActions} tabs={tabs} activeTab={tab} onTabChange={setTab} onBack={goBack}>
    {tab === 'usage' && <RecordTabPanel title={en ? 'Raw materials' : 'Πρώτες ύλες'} subtitle={en ? 'Taken from the batches in stock (FIFO); each comes off its batch. An expired batch cannot be used.' : 'Από τις παρτίδες του αποθέματος (FIFO)· κάθε μία αφαιρείται από την παρτίδα της. Παρτίδα που έληξε δεν χρησιμοποιείται.'} actions={add(en ? 'Raw material' : 'Πρώτη ύλη', () => setDialog({ type: 'usage', initial: newUsage(production) }))}>
      <RegistryTable className="kitchen-table" rows={records.usage} rowKey={row => row.id}
        columns={[{ key: 'product', label: en ? 'Product' : 'Προϊόν' }, { key: 'batch', label: en ? 'Batch · supplier' : 'Παρτίδα · προμηθευτής' }, { key: 'qty', label: en ? 'Quantity' : 'Ποσότητα' }, { key: 'dish', label: en ? 'Dish' : 'Πιάτο' }, { key: 'notes', label: en ? 'Notes' : 'Παρατηρήσεις' }, { key: 'actions', label: '' }]}
        emptyTitle={en ? 'No raw materials yet' : 'Δεν έχουν καταγραφεί πρώτες ύλες'} emptyText={en ? 'Record each batch the production uses: it comes off the stock.' : 'Καταγράψτε κάθε παρτίδα που χρησιμοποιεί η παραγωγή: αφαιρείται από το απόθεμα.'}
        renderRow={row => { const batch = stock.find(item => item.receiptItemId === row.receiptItemId); return <>
          <td><strong>{row.productName}</strong>{row.recordedByName && <small>{row.recordedByName}</small>}</td>
          <td>{batch ? <>{batch.batchCode || row.lotLabel || batch.receiptCode}<small>{batch.supplierName} · {fmtDay(batch.receivedOn)}</small></> : <>{row.lotLabel || '—'}<small>{en ? 'No receipt batch' : 'Χωρίς παρτίδα παραλαβής'}</small></>}</td>
          <td className="nowrap-cell">{fmtQty(row.quantity, language)} {unitLabel(row.unit, language)}</td>
          <td>{row.dishName || '—'}</td><td className="kitchen-text-cell">{row.notes || '—'}</td>
          <td><div className="row-actions">{row.receiptItemId && <IconButton size="sm" label={en ? 'Traceability' : 'Ιχνηλάτηση'} onClick={() => setTrace(row.receiptItemId)}><Route size={14} /></IconButton>}{editActions('usage', 'kitchen_material_usage', row)}</div></td>
        </> }} />
    </RecordTabPanel>}
    {tab === 'thermal' && <RecordTabPanel title={en ? 'Heat parameters' : 'Παράμετροι ζέστης'} subtitle={`${en ? 'Core' : 'Πυρήνας'} ${limitText(state.limits.find(item => item.limitKey === 'cooking_core'), language)} · ${en ? 'chilling' : 'ψύξη'} ${limitText(state.limits.find(item => item.limitKey === 'chilling'), language)} · ${en ? 'reheating' : 'αναθέρμανση'} ${limitText(state.limits.find(item => item.limitKey === 'reheating'), language)}`} actions={add(en ? 'Dish' : 'Πιάτο', () => setDialog({ type: 'thermal', initial: newThermal(production) }))}>
      <RegistryTable className="kitchen-table" rows={records.thermal} rowKey={row => row.id}
        columns={[{ key: 'dish', label: en ? 'Dish' : 'Πιάτο' }, { key: 'cook', label: en ? 'Core' : 'Πυρήνας' }, { key: 'chill', label: en ? 'Chilling' : 'Ψύξη' }, { key: 'reheat', label: en ? 'Reheating' : 'Αναθέρμανση' }, { key: 'fry', label: en ? 'Frying' : 'Τηγάνισμα' }, { key: 'result', label: en ? 'Result' : 'Αποτέλεσμα' }, { key: 'actions', label: '' }]}
        emptyTitle={en ? 'No heat parameters yet' : 'Δεν έχουν καταγραφεί παράμετροι ζέστης'}
        renderRow={row => <>
          <td><strong>{row.dishName}</strong><small>{[row.processTime, row.recordedByName].filter(Boolean).join(' · ')}</small></td>
          <td className={`nowrap-cell kitchen-measure is-${row.cookingStatus || 'none'}`}>{temp(row.cookingTemp, row.cookingText, language)}</td>
          <td className={`nowrap-cell kitchen-measure is-${row.chillStatus || 'none'}`}>{row.chillTemp !== '' && row.chillTemp != null ? `${fmtTemp(row.chillTemp, language)}${row.chillMinutes ? ` · ${row.chillMinutes}′` : ''}` : temp('', row.chillText, language)}</td>
          <td className={`nowrap-cell kitchen-measure is-${row.reheatStatus || 'none'}`}>{temp(row.reheatTemp, row.reheatText, language)}</td>
          <td className={`nowrap-cell kitchen-measure is-${row.fryingStatus || 'none'}`}>{temp(row.fryingTemp, row.fryingText, language)}</td>
          <td><LimitBadge status={row.limitStatus} language={language} />{row.correctiveAction && <small className="kitchen-action-text" title={row.correctiveAction}>{row.correctiveAction}</small>}</td>
          <td>{editActions('thermal', 'kitchen_thermal_processes', row)}</td>
        </>} />
    </RecordTabPanel>}
    {tab === 'pureeing' && <RecordTabPanel title={en ? 'Pureeing / sieving' : 'Πολτοποίηση / σούρωμα'} actions={add(en ? 'Pureeing' : 'Πολτοποίηση', () => setDialog({ type: 'pureeing', initial: newPureeing(production) }))}>
      <RegistryTable className="kitchen-table" rows={records.pureeing} rowKey={row => row.id}
        columns={[{ key: 'dish', label: en ? 'Dish / product' : 'Πιάτο / προϊόν' }, { key: 'method', label: en ? 'Method' : 'Μέθοδος' }, { key: 'visual', label: en ? 'Visual check' : 'Οπτικός έλεγχος' }, { key: 'blade', label: en ? 'Blade check' : 'Έλεγχος λεπίδας' }, { key: 'result', label: en ? 'Result' : 'Αποτέλεσμα' }, { key: 'actions', label: '' }]}
        emptyTitle={en ? 'No pureeing' : 'Καμία πολτοποίηση'}
        renderRow={row => <>
          <td><strong>{row.productName}</strong></td><td>{pureeMethodLabel(row.method, language)}</td>
          <td>{row.visualCheck == null ? '—' : row.visualCheck ? (en ? 'OK' : 'Εντάξει') : (en ? 'Not OK' : 'Όχι')}</td><td>{row.bladeCheck == null ? '—' : row.bladeCheck ? (en ? 'OK' : 'Εντάξει') : (en ? 'Not OK' : 'Όχι')}</td>
          <td><LimitBadge status={row.limitStatus} language={language} /></td><td>{editActions('pureeing', 'kitchen_pureeing', row)}</td>
        </>} />
    </RecordTabPanel>}
    {tab === 'disinfection' && <RecordTabPanel title={en ? 'Disinfection of vegetables and fruit' : 'Απολύμανση λαχανικών και φρούτων'} subtitle={en ? 'Agent, concentration and contact time of the day.' : 'Απολυμαντικό, συγκέντρωση και χρόνος επαφής της ημέρας.'}
      footer={canEdit && disinfection && <div className="inline-edit-footer"><SaveButton loading={saving} disabled={saving} onClick={async () => { if (await persist({ ...production, ...dis })) setDisinfection(null) }}>{en ? 'Save' : 'Αποθήκευση'}</SaveButton></div>}>
      <div className="kitchen-pad"><FormGrid columns={3}>
        <CheckboxField label={en ? 'Vegetables disinfected' : 'Απολύμανση λαχανικών'} checked={Boolean(dis.disinfectionVegetables)} disabled={!canEdit} onChange={checked => setDis({ disinfectionVegetables: checked })} />
        <CheckboxField label={en ? 'Fruit disinfected' : 'Απολύμανση φρούτων'} checked={Boolean(dis.disinfectionFruit)} disabled={!canEdit} onChange={checked => setDis({ disinfectionFruit: checked })} />
        <span />
        <Field label={en ? 'Agent' : 'Απολυμαντικό'}><input value={dis.disinfectionAgent} disabled={!canEdit} onChange={e => setDis({ disinfectionAgent: e.target.value })} /></Field>
        <Field label={en ? 'Concentration (ppm)' : 'Συγκέντρωση (ppm)'}><input inputMode="decimal" value={dis.disinfectionConcentrationPpm} disabled={!canEdit} onChange={e => setDis({ disinfectionConcentrationPpm: e.target.value.replace(',', '.') })} /></Field>
        <Field label={en ? 'Contact time (minutes)' : 'Χρόνος επαφής (λεπτά)'}><input inputMode="numeric" value={dis.disinfectionMinutes} disabled={!canEdit} onChange={e => setDis({ disinfectionMinutes: e.target.value.replace(/\D/g, '') })} /></Field>
      </FormGrid>
      <Field label={en ? 'Notes' : 'Σημειώσεις'}><textarea rows={2} value={dis.disinfectionNotes} disabled={!canEdit} onChange={e => setDis({ disinfectionNotes: e.target.value })} /></Field></div>
    </RecordTabPanel>}
    {tab === 'defrost' && <RecordTabPanel title={en ? 'Defrosting' : 'Αποψύξεις'} subtitle={en ? 'The defrosts of this day, with their HACCP sign-off.' : 'Οι αποψύξεις της ημέρας, με την επαλήθευση HACCP.'} actions={access.canRecord && <Button onClick={() => setDialog({ type: 'defrost', initial: { ...newDefrost(), productionId: production.id } })}><Plus size={15} />{en ? 'Defrosting' : 'Απόψυξη'}</Button>}>
      <RegistryTable className="kitchen-table" rows={records.defrosting} rowKey={row => row.id}
        columns={[{ key: 'product', label: en ? 'Product' : 'Προϊόν' }, { key: 'start', label: en ? 'Start' : 'Έναρξη' }, { key: 'end', label: en ? 'End' : 'Λήξη' }, { key: 'result', label: en ? 'Result' : 'Αποτέλεσμα' }, { key: 'sign', label: en ? 'HACCP sign-off' : 'Επαλήθευση HACCP' }]}
        emptyTitle={en ? 'No defrosting this day' : 'Καμία απόψυξη την ημέρα αυτή'}
        renderRow={row => <>
          <td><strong>{row.productName}</strong><small>{fmtQty(row.quantity, language)} {unitLabel(row.unit, language)} · {defrostMethodLabel(row.method, language)}</small></td>
          <td className="nowrap-cell">{fmtDay(dayOf(row.startedAt))} {timeOf(row.startedAt)}<small>{temp(row.startTemp, row.startText, language)}</small></td>
          <td className="nowrap-cell">{row.endedAt ? <>{fmtDay(dayOf(row.endedAt))} {timeOf(row.endedAt)}<small>{temp(row.endTemp, row.endText, language)}</small></> : (en ? 'In progress' : 'Σε εξέλιξη')}</td>
          <td><LimitBadge status={row.limitStatus} language={language} /></td>
          <td>{row.verifiedAt ? <span className="kitchen-signoff"><StatusBadge tone="success"><ShieldCheck size={13} />{row.verifiedByName || '—'}</StatusBadge><small>{fmtStamp(row.verifiedAt, language)}</small></span> : access.canManage ? <Button variant="secondary" disabled={!row.endedAt} onClick={() => sign('kitchen_defrosting', row)}><ShieldCheck size={15} />{en ? 'Sign off' : 'Επαλήθευση'}</Button> : <StatusBadge tone="warning">{en ? 'Pending' : 'Εκκρεμεί'}</StatusBadge>}</td>
        </>} />
    </RecordTabPanel>}
    {tab === 'menu' && <RecordTabPanel title={en ? 'Daily menu and meal plan' : 'Μενού ημέρας και πλάνο γευμάτων'} actions={canEdit && <Button onClick={() => setMeal({ index: -1, item: newMeal() })}><Plus size={15} />{en ? 'Meal plan line' : 'Γραμμή πλάνου'}</Button>}>
      <div className="record-view-stack">
        <RecordMetricStrip items={[{ label: en ? 'Portions' : 'Μερίδες', value: (production.meals || []).reduce((sum, item) => sum + (Number(item.portions) || 0), 0), primary: true }, { label: en ? 'Special diets' : 'Ειδικές δίαιτες', value: (production.meals || []).filter(item => item.diet !== 'normal').length }, { label: en ? 'Dishes' : 'Πιάτα', value: (production.meals || []).length }]} />
        <div className="kitchen-day-menu">
          <div><span className="lo-field-label">{en ? 'Daily menu' : 'Μενού ημέρας'}</span><pre className="kitchen-menu-text">{production.menuText || '—'}</pre></div>
          <div><span className="lo-field-label">{en ? 'Production notes' : 'Σημειώσεις παραγωγής'}</span><pre className="kitchen-menu-text">{production.notes || '—'}</pre></div>
        </div>
        <RegistryTable className="kitchen-table" rows={production.meals || []} rowKey={(row, index) => row.id || index}
          columns={[{ key: 'meal', label: en ? 'Meal' : 'Γεύμα' }, { key: 'diet', label: en ? 'Diet' : 'Δίαιτα' }, { key: 'dish', label: en ? 'Dish' : 'Πιάτο' }, { key: 'portions', label: en ? 'Portions' : 'Μερίδες' }, { key: 'actions', label: '' }]}
          emptyTitle={en ? 'No meal plan' : 'Χωρίς πλάνο γευμάτων'} emptyText={en ? 'Plan the dishes per meal and diet, with the portions.' : 'Προγραμματίστε τα πιάτα ανά γεύμα και δίαιτα, με τις μερίδες.'}
          renderRow={(row, index) => <><td>{mealLabel(row.meal, language)}</td><td>{dietLabel(row.diet, language)}</td><td>{row.dish}{row.notes && <small>{row.notes}</small>}</td><td>{row.portions || '—'}</td>
            <td>{canEdit && <div className="row-actions"><IconButton size="sm" label={en ? 'Edit' : 'Επεξεργασία'} onClick={() => setMeal({ index, item: { ...row } })}><Pencil size={14} /></IconButton><IconButton size="sm" tone="danger" label={en ? 'Delete' : 'Διαγραφή'} onClick={() => persist({ ...production, meals: production.meals.filter((_, at) => at !== index) })}><Trash2 size={14} /></IconButton></div>}</td></>} />
      </div>
    </RecordTabPanel>}
    {meal && <MealDialog initial={meal.item} onClose={() => setMeal(null)} onSave={async item => { const meals = meal.index < 0 ? [...(production.meals || []), item] : production.meals.map((entry, at) => (at === meal.index ? item : entry)); if (await persist({ ...production, meals })) setMeal(null) }} />}
    <KitchenDialogHost dialog={dialog} setDialog={setDialog} state={state} stock={stock} dishes={dishes} organizationId={organizationId} reload={reload} />
    {trace && <TraceDialog state={state} organizationId={organizationId} receiptItemId={trace} onClose={() => setTrace(null)} />}
    {traceDay && <ObserverDialog width="wide" title={en ? 'Traceability of the day' : 'Ιχνηλάτηση ημέρας'} subtitle={`${fmtDay(production.productionDate)} · ${en ? 'supplier → batch → dish' : 'προμηθευτής → παρτίδα → πιάτο'}`} onClose={() => setTraceDay(false)} footer={<DialogActions />}>
      <RegistryTable className="kitchen-table" rows={usedBatches} rowKey={row => row.receiptItemId}
        columns={[{ key: 'supplier', label: en ? 'Supplier · receipt' : 'Προμηθευτής · παραλαβή' }, { key: 'batch', label: en ? 'Product · batch' : 'Προϊόν · παρτίδα' }, { key: 'dishes', label: en ? 'Dishes of the day' : 'Πιάτα της ημέρας' }, { key: 'more', label: '' }]}
        emptyTitle={en ? 'No batch used this day' : 'Καμία παρτίδα την ημέρα αυτή'}
        renderRow={row => <><td>{row.supplierName || '—'}<small>{row.receiptCode} · {fmtDay(row.receivedOn)}</small></td><td><strong>{row.productName}</strong><small>{row.batchCode || row.lotLabel || '—'}</small></td>
          <td>{[...new Set(records.usage.filter(item => item.receiptItemId === row.receiptItemId).map(item => item.dishName).filter(Boolean))].join(' · ') || '—'}</td>
          <td><IconButton size="sm" label={en ? 'Traceability' : 'Ιχνηλάτηση'} onClick={() => { setTraceDay(false); setTrace(row.receiptItemId) }}><Route size={14} /></IconButton></td></>} />
    </ObserverDialog>}
  </EntityRecordShell></Page>
}

