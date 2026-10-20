import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { KITCHEN_PRIMARY_ACTION, KITCHEN_TABS, KITCHEN_VIEWS, resolveKitchenLocation, resolveKitchenTab } from '../src/features/kitchen/kitchenModel'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('kitchen: five tabs in one row', () => {
  it('has Today, Production days, Storage, Verification & recall and the HACCP plan', () => {
    expect(KITCHEN_TABS).toEqual(['today', 'days', 'storage', 'safety', 'haccp'])
    expect(KITCHEN_VIEWS).toEqual({ storage: ['receipts', 'stock', 'products'], safety: ['verification', 'recall'] })
  })

  it('opens every old ?tab= address on its new tab and view', () => {
    const expected = {
      overview: ['today', ''], plan: ['days', ''], thermal: ['days', ''], defrost: ['days', ''], pureeing: ['days', ''],
      receipts: ['storage', 'receipts'], stock: ['storage', 'stock'], usage: ['storage', 'stock'],
      verification: ['safety', 'verification'], recall: ['safety', 'recall'], haccp: ['haccp', ''],
      production: ['days', ''], storage: ['storage', 'receipts'], safety: ['safety', 'verification'], today: ['today', ''],
    }
    for (const [old, [tab, view]] of Object.entries(expected)) expect(resolveKitchenLocation(old)).toEqual({ tab, view })
    expect(resolveKitchenTab('recall')).toBe('safety')
    expect(resolveKitchenLocation('nope')).toEqual({ tab: 'today', view: '' })
    expect(resolveKitchenLocation(null)).toEqual({ tab: 'today', view: '' })
  })

  it('keeps a valid view of the new tabs and ignores a foreign one', () => {
    expect(resolveKitchenLocation('storage', 'products')).toEqual({ tab: 'storage', view: 'products' })
    expect(resolveKitchenLocation('safety', 'recall')).toEqual({ tab: 'safety', view: 'recall' })
    expect(resolveKitchenLocation('storage', 'recall').view).toBe('receipts')
    expect(resolveKitchenLocation('days', 'stock').view).toBe('')
  })

  it('has one primary button per tab beside Export, and none on the HACCP plan', () => {
    expect(KITCHEN_PRIMARY_ACTION).toEqual({ today: 'production', days: 'day', storage: 'receipt', safety: 'drill', haccp: null })
    const page = read('src/features/kitchen/KitchenPage.jsx')
    expect(page).toContain('KITCHEN_PRIMARY_ACTION[tab]')
    // The top bar is Export plus that one button; no other page-level action buttons.
    expect(page).toContain('{primaryButton}')
    expect((page.match(/<Button onClick=\{\(\) => \(?(?:summary\.production|setDialog|setRecall)/g) || []).length).toBe(4)
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
