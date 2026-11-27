import { describe, expect, it } from 'vitest'
import { KITCHEN_PRIMARY_ACTION, KITCHEN_TABS, KITCHEN_VIEWS, resolveKitchenLocation, resolveKitchenTab } from '../src/features/kitchen/kitchenModel'
import { readSource } from './helpers/readSource'

const read = path => readSource(new URL(`../${path}`, import.meta.url))

describe('kitchen: six tabs in the order of its work (owner, 27/11/2026, structure A)', () => {
  it('has Today, Receipts, Storage, Production, Verification & recall and the HACCP plan, one level of views', () => {
    expect(KITCHEN_TABS).toEqual(['today', 'receipts', 'storage', 'production', 'safety', 'haccp'])
    expect(KITCHEN_VIEWS).toEqual({ receipts: ['orders', 'receipts'], storage: ['stock', 'products'], production: ['days', 'defrosting', 'pureeing', 'menus'], safety: ['verification', 'recall'] })
  })

  it('opens every old ?tab= address on its new tab and view', () => {
    const expected = {
      overview: ['today', ''], plan: ['production', 'days'], days: ['production', 'days'], thermal: ['production', 'days'], defrost: ['production', 'defrosting'], pureeing: ['production', 'pureeing'],
      receipts: ['receipts', 'orders'], orders: ['receipts', 'orders'], stock: ['storage', 'stock'], usage: ['storage', 'stock'], products: ['storage', 'products'], menus: ['production', 'menus'],
      verification: ['safety', 'verification'], recall: ['safety', 'recall'], haccp: ['haccp', ''],
      production: ['production', 'days'], storage: ['storage', 'stock'], safety: ['safety', 'verification'], today: ['today', ''],
    }
    for (const [old, [tab, view]] of Object.entries(expected)) expect(resolveKitchenLocation(old)).toEqual({ tab, view })
    expect(resolveKitchenLocation('storage', 'receipts')).toEqual({ tab: 'receipts', view: 'receipts' })
    expect(resolveKitchenTab('recall')).toBe('safety')
    expect(resolveKitchenLocation('nope')).toEqual({ tab: 'today', view: '' })
    expect(resolveKitchenLocation(null)).toEqual({ tab: 'today', view: '' })
  })

  it('keeps a valid view of the new tabs and ignores a foreign one', () => {
    expect(resolveKitchenLocation('storage', 'products')).toEqual({ tab: 'storage', view: 'products' })
    expect(resolveKitchenLocation('production', 'pureeing')).toEqual({ tab: 'production', view: 'pureeing' })
    expect(resolveKitchenLocation('safety', 'recall')).toEqual({ tab: 'safety', view: 'recall' })
    expect(resolveKitchenLocation('storage', 'recall').view).toBe('stock')
    expect(resolveKitchenLocation('receipts', 'stock').view).toBe('orders')
    expect(resolveKitchenLocation('haccp', 'stock').view).toBe('')
  })

  it('has one primary button per tab beside Export, and none on the HACCP plan', () => {
    expect(KITCHEN_PRIMARY_ACTION).toEqual({ today: 'production', receipts: 'receipt', storage: null, production: 'day', safety: 'drill', haccp: null })
    const page = read('src/features/kitchen/KitchenPage.jsx')
    expect(page).toContain('KITCHEN_PRIMARY_ACTION[tab]')
    // The top bar is Export plus that one button; no other page-level action buttons.
    expect(page).toContain('{primaryButton}')
    expect((page.match(/<Button onClick=\{\(\) => \(?(?:summary!?\.production|setDialog|setRecall)/g) || []).length).toBe(5)
  })

  it('draws one row of tabs, the cards only on Today and the storage selector as a mode switch', () => {
    const page = read('src/features/kitchen/KitchenPage.jsx')
    expect(page).not.toContain('canonical-subtabs')
    expect(page).not.toContain('MetricCard')
    expect(page).toContain('<ModeSwitch')
    expect(read('src/features/kitchen/KitchenPanels.jsx')).toContain('kitchen-attention')
  })

  it('signs the HACCP verification only in the production day', () => {
    const panels = read('src/features/kitchen/KitchenPanels.jsx')
    const verification = panels.slice(panels.indexOf('export function VerificationPanel'), panels.indexOf('// --- HACCP plan'))
    expect(verification).not.toContain('onSign')
    expect(verification).toContain('onOpenDay(row.production.id)')
    expect(read('src/features/kitchen/KitchenDayRecordPage.jsx')).toContain("sign('kitchen_productions', production)")
  })
})

describe('pharmacy tabs', () => {
  const page = read('src/features/pharmacy/PharmacyPage.jsx')
  it('has consumption, antibiotic approvals and indicators tabs behind their capabilities', () => {
    expect(page).toContain("canApprovals && { value: 'approvals'")
    expect(page).toContain("canIndicators && { value: 'indicators'")
    expect(page).toContain('CAPABILITIES.MANAGE_ANTIMICROBIAL_THERAPY')
    expect(page).toContain('<RegistryPagination')
  })
  it('reads dispensing periods page by page (past 1000 rows)', () => {
    expect(read('src/features/pharmacy/pharmacyCloudService.js')).toContain("selectAllPages(()=>supabase.from('antibiotic_dispensing_periods')")
  })
})
