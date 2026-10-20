import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { KITCHEN_TAB_GROUPS, kitchenTabGroup, resolveKitchenTab } from '../src/features/kitchen/kitchenModel'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('kitchen: two levels of tabs', () => {
  it('groups the eleven tabs in four groups, each tab in one group', () => {
    expect(KITCHEN_TAB_GROUPS.map(group => group.value)).toEqual(['today', 'production', 'storage', 'safety'])
    const tabs = KITCHEN_TAB_GROUPS.flatMap(group => group.tabs)
    expect(tabs).toHaveLength(11)
    expect(new Set(tabs).size).toBe(11)
    expect(kitchenTabGroup('thermal').value).toBe('production')
    expect(kitchenTabGroup('usage').value).toBe('storage')
    expect(kitchenTabGroup('haccp').value).toBe('safety')
  })

  it('keeps old ?tab= links and opens a group by its name', () => {
    for (const tab of ['overview', 'plan', 'receipts', 'stock', 'thermal', 'defrost', 'pureeing', 'usage', 'verification', 'recall', 'haccp']) expect(resolveKitchenTab(tab)).toBe(tab)
    expect(resolveKitchenTab('storage')).toBe('receipts')
    expect(resolveKitchenTab('safety')).toBe('verification')
    expect(resolveKitchenTab('nope')).toBe('overview')
    expect(resolveKitchenTab(null)).toBe('overview')
  })

  it('draws the second level as lighter canonical tabs', () => {
    const page = read('src/features/kitchen/KitchenPage.jsx')
    expect(page).toContain('<CanonicalTabs className="canonical-subtabs"')
    expect(read('src/styles/responsive.css')).toContain('nav.canonical-tabs.canonical-subtabs')
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
