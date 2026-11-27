// Κουζίνα › Παραγγελίες (owner, 27/11/2026, phase B1).
import { describe, expect, it } from 'vitest'
import { orderCandidates, orderProgress, orderText, receiptFromOrder } from '../src/features/kitchen/kitchenOrders'
import { kitchenDemoState } from '../src/features/kitchen/kitchenDemoData'
import { resolveKitchenLocation } from '../src/features/kitchen/kitchenModel'
import { readSource } from './helpers/readSource'

const order = { id: 'o1', code: 'PRG-0007', supplierId: 's1', supplierName: 'Μετρό', status: 'sent', items: [
  { productId: 'p1', productName: 'Γάλα', quantity: '30', unit: 'l' },
  { productId: 'p2', productName: 'Γιαούρτι', quantity: '40', unit: 'pcs' },
] }

describe('an order and its receipts', () => {
  it('is sent until a receipt comes, partly received, then received; accepted batches only', () => {
    expect(orderProgress(order, []).stage).toBe('sent')
    expect(orderProgress({ ...order, status: 'draft' }, []).stage).toBe('draft')
    const first = [{ id: 'r1', orderId: 'o1', items: [{ productId: 'p1', quantity: '30', accepted: true }, { productId: 'p2', quantity: '10', accepted: false }] }]
    const partly = orderProgress(order, first)
    expect(partly.stage).toBe('partial')
    expect(partly.lines.map(row => row.remaining)).toEqual([0, 40])
    expect(orderProgress(order, [...first, { id: 'r2', orderId: 'o1', items: [{ productId: 'p2', quantity: '40' }] }]).stage).toBe('received')
    expect(orderProgress({ ...order, status: 'cancelled' }, first).stage).toBe('cancelled')
  })
  it('opens the receipt with the supplier, the order and what is still to come', () => {
    const receipt = receiptFromOrder(order, [{ id: 'r1', orderId: 'o1', items: [{ productId: 'p1', quantity: '30' }] }], [{ id: 'p2', storage: 'chilled', unit: 'pcs' }], new Date('2026-11-27T08:00:00Z'))
    expect(receipt).toMatchObject({ supplierId: 's1', orderId: 'o1', orderReference: 'PRG-0007' })
    expect(receipt.items).toHaveLength(1)
    expect(receipt.items[0]).toMatchObject({ productId: 'p2', quantity: '40', unit: 'pcs', storage: 'chilled' })
  })
  it('lists the supplier\'s products with the stock, those under their low limit first, and writes the order\'s text', () => {
    const state = kitchenDemoState()
    const rows = orderCandidates(state, 'sup-demo-9')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every(row => row.product.supplierId === 'sup-demo-9')).toBe(true)
    const lowFirst = rows.findIndex(row => !row.isLow)
    expect(rows.slice(lowFirst < 0 ? rows.length : lowFirst).every(row => !row.isLow)).toBe(true)
    expect(orderText(order, { hospital: 'ΙΑΣΩ' })).toContain('1. Γάλα — 30 l')
  })
  it('the Demo has a received, a partly received and a draft order', () => {
    const state = kitchenDemoState()
    expect(state.orders.map(item => orderProgress(item, state.receipts).stage)).toEqual(['received', 'partial', 'draft'])
  })
})

describe('where orders live', () => {
  it('opens on «Orders & receipts» and keeps the database rules', () => {
    expect(resolveKitchenLocation('orders')).toEqual({ tab: 'receipts', view: 'orders' })
    const sql = readSource('supabase/migrations/20261231643000_kitchen_orders.sql')
    expect(sql).toContain("check (status in ('draft','sent','cancelled'))")
    expect(sql).toContain('foreign key (order_id, organization_id) references public.kitchen_orders(id, organization_id)')
    expect(sql).toContain('create policy kitchen_orders_module_gate on public.kitchen_orders as restrictive')
    expect(sql).toContain("current_user_kitchen_orgs('manage')")
  })
})
