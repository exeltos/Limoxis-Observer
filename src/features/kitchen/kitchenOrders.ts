// Κουζίνα › Παραγγελίες (owner, 27/11/2026, phase B1): what an order asked, what its receipts brought, and the receipt that
// opens from it. Pure.
import { newReceipt, newReceiptItem, stockRows, todayKey } from './kitchenModel'
import type { KitchenOrder, KitchenOrderInput, KitchenOrderItem, KitchenProduct, KitchenReceipt, KitchenReceiptItem, KitchenStateInput } from './kitchenTypes'

// A receipt as the orders read it: its order and the products it brought.
export type OrderReceipt = Partial<Omit<KitchenReceipt, 'items'>> & { items?: Partial<KitchenReceiptItem>[] }

type Label = readonly [string, string]
// Draft → sent → partly received → received; or cancelled. «Partly» and «received» come from the order's receipts.
export type OrderStage = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled'
export const ORDER_STAGES: Record<OrderStage, { label: Label, tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }> = {
  draft: { label: ['Σε σύνταξη', 'Draft'], tone: 'neutral' },
  sent: { label: ['Στάλθηκε', 'Sent'], tone: 'info' },
  partial: { label: ['Μερική παραλαβή', 'Partly received'], tone: 'warning' },
  received: { label: ['Ολοκληρωμένη παραλαβή', 'Received'], tone: 'success' },
  cancelled: { label: ['Ακυρώθηκε', 'Cancelled'], tone: 'danger' },
}
export const orderStageLabel = (stage: OrderStage, language: string) => ORDER_STAGES[stage].label[language === 'en' ? 1 : 0]
export const SENT_VIA: Record<string, Label> = { email: ['Email', 'Email'], phone: ['Τηλεφωνικά', 'By phone'] }

export const newOrder = (now = new Date()): KitchenOrderInput => ({ id: '', code: '', orderedOn: todayKey(now), supplierId: '', supplierName: '', status: 'draft', sentVia: '', sentAt: '', sentByName: '', expectedOn: '', notes: '', source: 'app', items: [] })
export const newOrderItem = (productItem?: Partial<KitchenProduct> | null): Partial<KitchenOrderItem> => ({ id: '', productId: productItem?.id || '', productName: productItem?.name || '', quantity: '', unit: productItem?.unit || 'kg', notes: '' })

const num = (value: unknown) => { const n = Number(String(value ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
const keyOf = (line: { productId?: string, productName?: string }) => line.productId || `name:${String(line.productName || '').trim().toLocaleLowerCase('el')}`

// Each line of the order with what its receipts brought (accepted batches only) and what is still to come.
export interface OrderLineProgress { line: Partial<KitchenOrderItem>, ordered: number, received: number, remaining: number }
export function orderProgress(order: KitchenOrderInput, receipts: OrderReceipt[] = []) {
  const own = receipts.filter(receipt => receipt.orderId && receipt.orderId === order.id)
  const received = new Map<string, number>()
  for (const receipt of own) for (const item of receipt.items || []) {
    if (item.accepted === false) continue
    received.set(keyOf(item), (received.get(keyOf(item)) || 0) + num(item.quantity))
  }
  const lines: OrderLineProgress[] = (order.items || []).map(line => {
    const ordered = num(line.quantity), got = received.get(keyOf(line)) || 0
    return { line, ordered, received: got, remaining: Math.max(0, ordered - got) }
  })
  const anyReceived = lines.some(row => row.received > 0) || own.length > 0
  const allReceived = lines.length > 0 && lines.every(row => row.remaining <= 0.0005)
  const stage: OrderStage = order.status === 'cancelled' ? 'cancelled' : allReceived && anyReceived ? 'received' : anyReceived ? 'partial' : order.status === 'sent' ? 'sent' : 'draft'
  return { stage, lines, receipts: own }
}

// The products a supplier delivers (the catalogue's, active), each with what is in stock now and its «low» threshold: the
// order form lists them, those under the threshold first.
export interface OrderCandidate { product: KitchenProduct, inStock: number, low: number | null, isLow: boolean }
export function orderCandidates(state: KitchenStateInput & { products?: KitchenProduct[] }, supplierId: string, today = todayKey()): OrderCandidate[] {
  const stock = stockRows(state, today)
  const inStock = new Map<string, number>()
  for (const row of stock) if (row.productId && row.inStock && !row.expired) inStock.set(row.productId, (inStock.get(row.productId) || 0) + Math.max(0, Number(row.remaining) || 0))
  return (state.products || [])
    .filter(item => item.active !== false && (!supplierId || item.supplierId === supplierId))
    .map(item => {
      const low = item.lowStockQuantity === '' || item.lowStockQuantity == null ? null : num(item.lowStockQuantity)
      const have = inStock.get(item.id) || 0
      return { product: item, inStock: have, low, isLow: low != null && have < low }
    })
    .sort((a, b) => Number(b.isLow) - Number(a.isLow) || a.product.name.localeCompare(b.product.name, 'el'))
}

// The receipt that opens from an order: its supplier and code, and a line for each product still to come with that quantity.
export function receiptFromOrder(order: KitchenOrder | KitchenOrderInput, receipts: OrderReceipt[] = [], products: Partial<KitchenProduct>[] = [], now = new Date()) {
  const { lines } = orderProgress(order, receipts)
  const byId = new Map(products.map(item => [item.id, item]))
  const base = newReceipt(now)
  return {
    ...base, supplierId: order.supplierId || '', supplierName: order.supplierName || '', orderReference: order.code || '', orderId: order.id || '',
    items: lines.filter(row => row.remaining > 0).map(row => {
      const p = row.line.productId ? byId.get(row.line.productId) : null
      return { ...newReceiptItem(), productId: row.line.productId || '', productName: row.line.productName || '', quantity: String(Math.round(row.remaining * 1000) / 1000), unit: row.line.unit || p?.unit || 'kg', storage: p?.storage || 'chilled' }
    }),
  }
}

// The text of an order for an email or the phone: the products and quantities, one per line.
export function orderText(order: KitchenOrderInput, { hospital = '', unitLabel = (unit: string) => unit, language = 'el' }: { hospital?: string, unitLabel?: (unit: string) => string, language?: string } = {}) {
  const en = language === 'en'
  const lines = (order.items || []).map((line, index) => `${index + 1}. ${line.productName} — ${line.quantity} ${unitLabel(String(line.unit || ''))}`)
  return [
    en ? `Order ${order.code || ''}` : `Παραγγελία ${order.code || ''}`,
    hospital,
    order.expectedOn ? (en ? `Delivery: ${order.expectedOn}` : `Παράδοση: ${order.expectedOn.split('-').reverse().join('/')}`) : '',
    '',
    ...lines,
    order.notes ? `\n${order.notes}` : '',
  ].filter((part, index) => part !== '' || index === 3).join('\n').trim()
}
