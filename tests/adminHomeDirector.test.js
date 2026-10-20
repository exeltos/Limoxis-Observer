import { describe, expect, it } from 'vitest'
import { analysisPeriodOf, periodTag, sharedPeriodOfAnalysis } from '../src/features/analysis/sharedPeriod'
import { decisionItems, moduleStatusRows } from '../src/features/dashboard/adminHomeModel'
import { roleLabel, roleLabelForKey } from '../src/core/permissions/roleLabels'

const today = new Date(2026, 9, 20)

describe('one period for Executive and Analysis', () => {
  it('maps the shared period both ways, the current year by default', () => {
    expect(analysisPeriodOf({ period: 'year' }, today)).toEqual({ year: '2026', periodType: 'year', periodSlot: '1' })
    expect(analysisPeriodOf({ period: '3m' }, today)).toEqual({ year: '2026', periodType: 'year', periodSlot: '1' })
    expect(analysisPeriodOf({ period: 'custom', from: '2026-04-01', to: '2026-06-30' }, today)).toEqual({ year: '2026', periodType: 'quarter', periodSlot: '2' })
    expect(sharedPeriodOfAnalysis('2026', 'year', '1', today)).toEqual({ period: 'year', from: '', to: '' })
    expect(sharedPeriodOfAnalysis('2025', 'year', '1', today)).toEqual({ period: 'custom', from: '2025-01-01', to: '2025-12-31' })
  })
  it('names the period next to each measure', () => {
    expect(periodTag({ from: '2026-01-01', to: '2026-10-20' }, false, 'year')).toBe('2026 · έτος')
    expect(periodTag({ from: '2026-01-01', to: '2026-12-31' })).toBe('2026 · έτος')
    expect(periodTag({ from: '2026-07-01', to: '2026-09-30' }, true)).toBe('Q3 2026 · quarter')
    expect(periodTag({}, false, '3m')).toBe('Τελευταίοι 3 μήνες')
  })
})

describe("the administrator's home", () => {
  const metrics = { expiredCertificates: 3, overdueControls: 0, overdueCapa: 2, kitchenUnverifiedDays: 4, openCandidates: 5 }
  it('lists only what is pending, severe first, and leaves locked modules out', () => {
    const items = decisionItems(metrics, { moduleEnabled: module => module !== 'kitchen' })
    expect(items.map(item => item.key)).toEqual(['expiredCertificates', 'overdueCapa'])
  })
  it('shows one row per open module the user can reach', () => {
    const rows = moduleStatusRows(metrics, { moduleEnabled: module => module !== 'pharmacy', canOpen: to => to !== '/committees' })
    expect(rows.map(row => row.module)).toEqual(['surveillance', 'laboratory', 'controls', 'quality', 'suppliers', 'kitchen', 'interviews'])
    expect(rows.find(row => row.module === 'suppliers').status).toBe('danger')
  })
})

describe('one source for role names', () => {
  it('names the director and the owner as decided', () => {
    expect(roleLabel('hospital_director')).toBe('Διοικητής / Γενικός Διευθυντής')
    expect(roleLabel('hospital_director', 'en')).toBe('Hospital Director (CEO)')
    expect(roleLabel('platform_owner')).toBe('Ιδιοκτήτης πλατφόρμας')
    expect(roleLabelForKey('doctorReviewerRole')).toBe('Ιατρός Αξιολογητής')
  })
})
