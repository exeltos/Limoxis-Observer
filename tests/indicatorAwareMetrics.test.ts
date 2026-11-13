import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collectIndicatorMetrics } from '../src/features/indicators/indicatorEngine'
import { INDICATOR_METRICS, INDICATOR_RATIO_RULES } from '../src/features/indicators/indicatorDefinitionService'
import { indicatorDefinitionRows } from '../src/features/indicators/indicatorDemoData'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'

function storage() {
  const values = new Map()
  return {
    get length() { return values.size },
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    key: index => [...values.keys()][index] ?? null,
    values,
  }
}

describe('WHO AWaRe Access-share indicator', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage())
    configureDataEnvironment({ mode: 'demo', organizationId: 'demo-hospital', demoAccountId: 'demo-user-1' })
  })

  it('registers the aware_access_ddd_total metric and its ratio against total DDD', () => {
    expect(INDICATOR_METRICS).toContain('aware_access_ddd_total')
    expect(INDICATOR_RATIO_RULES.aware_access_ddd_total.antibiotic_ddd_total).toEqual({ multiplier: 100, unit: '%' })
  })

  it('computes the Access-category DDD share from demo dispensing records', () => {
    const metrics = collectIndicatorMetrics()
    expect(metrics.antibiotic_ddd_total).toBeGreaterThan(0)
    // The demo dispensing library (Ceftriaxone, Meropenem, Vancomycin, Oxacillin)
    // only has Oxacillin in the Access category.
    expect(metrics.aware_access_ddd_total).toBeGreaterThan(0)
    expect(metrics.aware_access_ddd_total).toBeLessThanOrEqual(metrics.antibiotic_ddd_total)
  })

  it('ships the system indicator definition wired to the auto-calculated metrics', () => {
    const row = indicatorDefinitionRows.find(r => r.indicator_key === 'who-aware-access-share')
    expect(row).toMatchObject({ calculation_type: 'auto', numerator_metric: 'aware_access_ddd_total', denominator_metric: 'antibiotic_ddd_total', direction: 'higher' })
  })
})
