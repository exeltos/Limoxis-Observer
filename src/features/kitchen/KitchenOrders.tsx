// Κουζίνα › Παραγγελίες & Παραλαβές › «Παραγγελίες» (owner, 27/11/2026, phase B1), as FileMaker's «Λεπτομέρειες Παραγγελίας»:
// an order to one supplier, chosen from that supplier's products with what is in stock beside each; it is sent by email
// or by phone, printed, and the receipt opens from it with its products. «Partly» / «fully received» follow its receipts.
import { useMemo, useState } from 'react'
import { Mail, Phone, Plus, Truck, XCircle, Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { SignalBadge } from '../../design-system/StatusBadge'
import { SectionHeader } from '../../design-system/SectionHeader'
import { FilterSelect } from '../../design-system/FilterBar'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { FormGrid } from '../../design-system/FormCard'
import { Field } from '../../design-system/Field'
import { ManualDateField } from '../../design-system/ManualDateField'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { reportExports } from '../../core/export/reportDocument'
import { ExportMenu } from '../../design-system/ExportMenu'
import { KitchenList, matches, useKitchenActor, type KitchenFilterProps, type KitchenPanelProps } from './KitchenShared'
import { fmtDay, fmtStamp } from './KitchenPanels'
import { fmtQty, unitLabel } from './kitchenModel'
import { ORDER_STAGES, SENT_VIA, newOrderItem, orderCandidates, orderProgress, orderStageLabel, orderText, receiptFromOrder, type OrderStage } from './kitchenOrders'
import { orderDocument } from './kitchenReports'
import { kitchenErrorMessage, removeEntry, saveOrder } from './kitchenService'
import type { KitchenOrder, KitchenOrderInput, KitchenOrderItem, KitchenReceipt, KitchenScreenState } from './kitchenTypes'

const selectText = (en: boolean) => ({ emptyLabel: en ? 'No match' : 'Δεν βρέθηκε', clearLabel: en ? 'Clear' : 'Καθαρισμός' })
const supplierNameOf = (state: { suppliers: { id: string, name: string }[] }, order: Partial<KitchenOrder>) => state.suppliers.find(row => row.id === order.supplierId)?.name || order.supplierName || ''

// --- List ----------------------------------------------------------------------------------

export function OrdersPanel({ state, access, filters, setFilters, onDialog, switcher = null }: Pick<KitchenPanelProps, 'state' | 'access' | 'onDialog'> & KitchenFilterProps) {
  const { language } = useLanguage()
  const en = language === 'en'
  const set = (key: string, value: string) => setFilters(current => ({ ...current, [key]: value }))
  const rows = (state.orders || []).map(order => ({ ...order, supplierName: supplierNameOf(state, order), progress: orderProgress(order, state.receipts) }))
    .filter(row => (!filters.stage || filters.stage === 'all' || (filters.stage === 'open' ? ['draft', 'sent', 'partial'].includes(row.progress.stage) : row.progress.stage === filters.stage))
      && (!filters.supplier || filters.supplier === 'all' || row.supplierId === filters.supplier)
      && matches(filters.query, row.code, row.supplierName, ...(row.items || []).map(line => line.productName)))
  const suppliers = [...new Map((state.orders || []).filter(row => row.supplierId).map(row => [row.supplierId, supplierNameOf(state, row)])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'el'))
  const active = (filters.stage && filters.stage !== 'all' ? 1 : 0) + (filters.supplier && filters.supplier !== 'all' ? 1 : 0)
  return <KitchenList rows={rows} query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search order, supplier, product…' : 'Αναζήτηση παραγγελίας, προμηθευτή, προϊόντος…'} end={switcher}
    activeFilters={active} onClear={() => setFilters(current => ({ ...current, query: '', stage: 'all', supplier: 'all' }))}
    filters={<>
      <FilterSelect label={en ? 'Status' : 'Κατάσταση'} value={filters.stage || 'all'} onChange={value => set('stage', value)}><option value="all">{en ? 'All' : 'Όλες'}</option><option value="open">{en ? 'Open (to receive)' : 'Ανοιχτές (προς παραλαβή)'}</option>{(Object.keys(ORDER_STAGES) as OrderStage[]).map(stage => <option key={stage} value={stage}>{orderStageLabel(stage, language)}</option>)}</FilterSelect>
      <FilterSelect label={en ? 'Supplier' : 'Προμηθευτής'} value={filters.supplier || 'all'} onChange={value => set('supplier', value)}><option value="all">{en ? 'All' : 'Όλοι'}</option>{suppliers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</FilterSelect>
    </>}
    columns={[{ key: 'order', label: en ? 'Order' : 'Παραγγελία' }, { key: 'supplier', label: en ? 'Supplier' : 'Προμηθευτής' }, { key: 'products', label: en ? 'Products' : 'Προϊόντα' }, { key: 'status', label: en ? 'Status' : 'Κατάσταση' }, { key: 'receipts', label: en ? 'Receipts' : 'Παραλαβές' }]}
    empty={!rows.length} emptyTitle={en ? 'No orders' : 'Δεν υπάρχουν παραγγελίες'} emptyText={en ? 'An order to a supplier, from its products with the stock beside each; the receipt opens from it.' : 'Παραγγελία σε προμηθευτή από τα προϊόντα του, με το απόθεμα δίπλα σε καθένα· η παραλαβή ανοίγει από αυτήν.'}
    rowProps={row => ({ className: 'registry-row-clickable', onClick: () => onDialog({ type: 'order', initial: row }) })}
    renderRow={row => <>
      <td className="nowrap-cell"><strong>{row.code}</strong><small>{fmtDay(row.orderedOn)}{row.expectedOn ? ` · ${en ? 'delivery' : 'παράδοση'} ${fmtDay(row.expectedOn)}` : ''}</small></td>
      <td>{row.supplierName || '—'}</td>
      <td className="kitchen-text-cell">{(row.items || []).slice(0, 2).map(line => line.productName).join(' · ') || '—'}{(row.items || []).length > 2 && <small>+{row.items.length - 2}</small>}</td>
      <td><SignalBadge tone={ORDER_STAGES[row.progress.stage].tone}>{orderStageLabel(row.progress.stage, language)}</SignalBadge>{row.sentAt && row.progress.stage !== 'draft' && <small>{SENT_VIA[row.sentVia]?.[en ? 1 : 0] || ''} {fmtStamp(row.sentAt, language)}</small>}</td>
      <td>{row.progress.receipts.map(receipt => receipt.code).join(' · ') || '—'}</td>
    </>}
    emptyAction={access.canRecord ? { label: en ? 'New order' : 'Νέα παραγγελία', icon: Plus, onClick: () => onDialog({ type: 'order', initial: null }) } : null} />
}

// --- Order ---------------------------------------------------------------------------------

interface OrderDialogProps { state: KitchenScreenState, organizationId: string | null | undefined, initial: KitchenOrderInput, onClose: () => void, onSaved?: () => unknown, onReceive: (receipt: ReturnType<typeof receiptFromOrder>) => void, canRecord: boolean, canManage: boolean }
export function OrderDialog({ state, organizationId, initial, onClose, onSaved, onReceive, canRecord, canManage }: OrderDialogProps) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, confirm } = useFeedback()
  const { tenant } = useTenant()
  const actor = useKitchenActor()
  const [draft, setDraft] = useState<KitchenOrderInput>(() => ({ ...initial, items: initial.items || [] }))
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (next: Partial<KitchenOrderInput>) => setDraft(current => ({ ...current, ...next }))
  const progress = orderProgress(draft, state.receipts)
  const stage = progress.stage
  const locked = !canRecord || stage === 'cancelled' || stage === 'received'
  const supplier = state.suppliers.find(row => row.id === draft.supplierId)
  const suppliers = [...(state.suppliers || [])].sort((a, b) => (a.category === 'kitchen' ? 0 : 1) - (b.category === 'kitchen' ? 0 : 1) || a.name.localeCompare(b.name, 'el'))
  const candidates = useMemo(() => (draft.supplierId ? orderCandidates(state, draft.supplierId) : []), [state, draft.supplierId])
  // The lines: what the order holds first, then the supplier's other products (those under their «low» threshold first).
  const lines = draft.items || []
  const quantityOf = (productId: string) => lines.find(line => line.productId === productId)?.quantity ?? ''
  const setQuantity = (productId: string, name: string, unit: string, value: string) => {
    const quantity = value.replace(',', '.')
    const others = lines.filter(line => line.productId !== productId)
    set({ items: quantity && Number(quantity) > 0 ? [...lines.map(line => (line.productId === productId ? { ...line, quantity } : line)), ...(lines.some(line => line.productId === productId) ? [] : [{ ...newOrderItem({ id: productId, name, unit }), quantity }])] : others })
  }
  const shown = candidates.filter(row => !query || matches(query, row.product.name, row.product.supplierCode))
    .sort((a, b) => Number(Boolean(quantityOf(b.product.id))) - Number(Boolean(quantityOf(a.product.id))))
  const extra = lines.filter(line => !candidates.some(row => row.product.id === line.productId))
  const ready = Boolean(draft.supplierId || draft.supplierName) && lines.length > 0

  const save = async (patch: Partial<KitchenOrderInput> = {}, message = en ? 'Order saved.' : 'Η παραγγελία αποθηκεύτηκε.') => {
    setSaving(true)
    try {
      const saved = await saveOrder(organizationId, { ...draft, supplierName: supplier?.name || draft.supplierName, ...patch })
      setDraft(current => ({ ...current, ...saved, items: current.items }))
      notify(message, 'success'); await onSaved?.()
      return saved
    } catch (error) { console.error(error); notify(kitchenErrorMessage(error, language), 'error'); return null } finally { setSaving(false) }
  }
  const document = (order: KitchenOrderInput) => orderDocument({ ...order, supplierName: supplier?.name || order.supplierName }, { language, stageLabel: orderStageLabel(stage, language), supplierContact: [supplier?.phone, supplier?.email].filter(Boolean).join(' · '), received: progress.lines })
  const exports = reportExports(() => document(draft), { onBlocked: () => notify(en ? 'Allow pop-ups to print.' : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'error') })
  // Sending: by email it opens the user's mail with the order's text (to the supplier's address), by phone it records the
  // call; both mark the order sent, with who and when.
  const send = async (via: 'email' | 'phone') => {
    const saved = await save({ status: 'sent', sentVia: via, sentAt: new Date().toISOString(), sentByName: actor.name || '' }, via === 'email' ? (en ? 'Order marked as sent by email.' : 'Η παραγγελία σημειώθηκε ως σταλμένη με email.') : (en ? 'Order marked as sent by phone.' : 'Η παραγγελία σημειώθηκε ως σταλμένη τηλεφωνικά.'))
    if (saved && via === 'email') {
      const body = orderText({ ...draft, ...saved, items: draft.items }, { hospital: tenant?.name || '', unitLabel: unit => unitLabel(unit, language), language })
      window.location.href = `mailto:${encodeURIComponent(supplier?.email || '')}?subject=${encodeURIComponent(`${en ? 'Order' : 'Παραγγελία'} ${saved.code}`)}&body=${encodeURIComponent(body)}`
    }
  }
  const remove = async () => {
    if (!draft.id) return
    if (!await confirm({ title: en ? 'Delete order' : 'Διαγραφή παραγγελίας', message: en ? 'The order and its lines are deleted.' : 'Η παραγγελία και τα προϊόντα της διαγράφονται.', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })) return
    try { await removeEntry(organizationId, 'kitchen_orders', draft.id); await onSaved?.(); onClose() } catch (error) { notify(kitchenErrorMessage(error, language), 'error') }
  }
  const menu = draft.id ? <div className="row-actions"><ExportMenu {...exports} /><OverflowMenu label={en ? 'Order actions' : 'Ενέργειες παραγγελίας'} items={[
    // Once sent, sending again (a changed quantity, a lost email) is here, not among the buttons.
    { id: 'resend', label: en ? 'Send again by email' : 'Αποστολή ξανά με email', icon: Mail, hidden: locked || stage === 'draft', onClick: () => { void send('email') } },
    { id: 'cancel', label: en ? 'Cancel order' : 'Ακύρωση παραγγελίας', icon: XCircle, hidden: !canRecord || stage === 'cancelled' || stage === 'received', onClick: () => { void save({ status: 'cancelled' }, en ? 'Order cancelled.' : 'Η παραγγελία ακυρώθηκε.') } },
    { id: 'delete', label: en ? 'Delete' : 'Διαγραφή', icon: Trash2, tone: 'danger', separatorBefore: true, hidden: !canManage || progress.receipts.length > 0, onClick: () => { void remove() } },
  ]} /></div> : null

  return <ObserverDialog width="wide" title={draft.code ? `${en ? 'Order' : 'Παραγγελία'} ${draft.code}` : (en ? 'New order' : 'Νέα παραγγελία')}
    subtitle={<span className="kitchen-notes"><SignalBadge tone={ORDER_STAGES[stage].tone}>{orderStageLabel(stage, language)}</SignalBadge>{draft.sentAt && stage !== 'draft' && <small>{SENT_VIA[draft.sentVia || '']?.[en ? 1 : 0] || ''} · {draft.sentByName || ''} · {fmtStamp(draft.sentAt, language)}</small>}</span>}
    headerActions={menu} onClose={onClose}
    footer={<DialogActions onSave={() => { void save() }} disabled={saving || locked || !ready} saveLabel={en ? 'Save' : 'Αποθήκευση'}>
      {!locked && stage === 'draft' && <>
        <Button variant="secondary" disabled={saving || !ready} onClick={() => { void send('email') }}><Mail size={15} />{en ? 'Send by email' : 'Αποστολή με email'}</Button>
        <Button variant="secondary" disabled={saving || !ready} onClick={() => { void send('phone') }}><Phone size={15} />{en ? 'Ordered by phone' : 'Τηλεφωνική παραγγελία'}</Button>
      </>}
      {canRecord && draft.id && ['sent', 'partial'].includes(stage) && <Button variant="secondary" onClick={() => onReceive(receiptFromOrder({ ...draft, supplierName: supplier?.name || draft.supplierName } as KitchenOrder, state.receipts as KitchenReceipt[], state.products))}><Truck size={15} />{en ? 'Receipt' : 'Παραλαβή'}</Button>}
    </DialogActions>}>
    <FormGrid columns={3}>
      <SearchableSelect label={en ? 'Supplier *' : 'Προμηθευτής *'} value={draft.supplierId || draft.supplierName || ''} disabled={locked || progress.receipts.length > 0}
        options={suppliers.map(item => ({ value: item.id, label: item.name, description: [item.category === 'kitchen' ? (en ? 'Kitchen' : 'Κουζίνα') : '', item.phone, item.email].filter(Boolean).join(' · ') }))}
        onChange={value => { const found = suppliers.find(item => item.id === value); set({ supplierId: found?.id || '', supplierName: found?.name || '', items: found?.id === draft.supplierId ? draft.items : [] }) }} {...selectText(en)} />
      <ManualDateField label={en ? 'Order date *' : 'Ημερομηνία παραγγελίας *'} value={draft.orderedOn || ''} onChange={value => set({ orderedOn: value })} disabled={locked} />
      <ManualDateField label={en ? 'Delivery' : 'Παράδοση'} value={draft.expectedOn || ''} onChange={value => set({ expectedOn: value })} optional disabled={locked} />
    </FormGrid>
    <SectionHeader title={en ? 'Products' : 'Προϊόντα'} subtitle={draft.supplierId
      ? (en ? 'The supplier\'s products with what is in stock now; those under their «low» limit first. Type a quantity to order.' : 'Τα προϊόντα του προμηθευτή με το τρέχον απόθεμα· πρώτα όσα είναι κάτω από το όριο «χαμηλό». Γράψτε ποσότητα για να παραγγελθεί.')
      : (en ? 'Choose the supplier first.' : 'Επιλέξτε πρώτα προμηθευτή.')}
      actions={draft.supplierId ? <input className="input kitchen-order-search" placeholder={en ? 'Search product…' : 'Αναζήτηση προϊόντος…'} aria-label={en ? 'Search product' : 'Αναζήτηση προϊόντος'} value={query} onChange={e => setQuery(e.target.value)} /> : null} />
    {draft.supplierId && <div className="kitchen-order-lines">
      <table className="kitchen-order-table">
        <thead><tr><th scope="col">{en ? 'Product' : 'Προϊόν'}</th><th scope="col">{en ? 'In stock' : 'Σε απόθεμα'}</th><th scope="col">{en ? 'Quantity' : 'Ποσότητα'}</th><th scope="col">{en ? 'Unit' : 'Μονάδα'}</th>{progress.receipts.length > 0 && <th scope="col">{en ? 'Received' : 'Παραλήφθηκαν'}</th>}</tr></thead>
        <tbody>
          {[...extra.map(line => ({ key: line.productId || line.productName, name: line.productName || '', code: '', unit: line.unit || 'kg', productId: line.productId || '', inStock: null as number | null, isLow: false, low: null as number | null })),
            ...shown.map(row => ({ key: row.product.id, name: row.product.name, code: row.product.supplierCode, unit: row.product.unit, productId: row.product.id, inStock: row.inStock as number | null, isLow: row.isLow, low: row.low }))].map(row => {
            const line = lines.find(item => (row.productId ? item.productId === row.productId : item.productName === row.name)) as Partial<KitchenOrderItem> | undefined
            const got = progress.lines.find(item => item.line === line)
            return <tr key={row.key} className={line ? 'is-ordered' : ''}>
              <td><strong>{row.name}</strong>{row.code && <small>{row.code}</small>}</td>
              <td className="nowrap-cell">{row.inStock == null ? '—' : `${fmtQty(row.inStock, language)} ${unitLabel(row.unit, language)}`}{row.isLow && <SignalBadge tone="warning">{en ? 'Low' : 'Χαμηλό'}{row.low != null ? ` < ${fmtQty(row.low, language)}` : ''}</SignalBadge>}</td>
              <td><input className="input kitchen-order-qty" inputMode="decimal" aria-label={`${en ? 'Quantity' : 'Ποσότητα'} · ${row.name}`} value={line ? String(line.quantity ?? '') : String(quantityOf(row.productId) ?? '')} disabled={locked} onChange={e => setQuantity(row.productId, row.name, row.unit, e.target.value)} /></td>
              <td>{unitLabel(row.unit, language)}</td>
              {progress.receipts.length > 0 && <td className="nowrap-cell">{got ? `${fmtQty(got.received, language)}${got.remaining > 0 ? ` · ${en ? 'remaining' : 'υπόλοιπο'} ${fmtQty(got.remaining, language)}` : ''}` : '—'}</td>}
            </tr>
          })}
        </tbody>
      </table>
      {!shown.length && !extra.length && <div className="inline-empty">{en ? 'This supplier has no products in the product list.' : 'Ο προμηθευτής δεν έχει προϊόντα στη λίστα προϊόντων.'}</div>}
    </div>}
    <Field label={en ? 'Notes' : 'Σημειώσεις'}><textarea rows={2} value={draft.notes || ''} disabled={locked} onChange={e => set({ notes: e.target.value })} /></Field>
    {lines.length > 0 && <p className="kitchen-muted">{en ? `${lines.length} products in the order.` : `${lines.length} προϊόντα στην παραγγελία.`}</p>}
  </ObserverDialog>
}
