import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { collectIndicatorMetrics } from '../src/features/indicators/indicatorEngine'
import { INDICATOR_METRICS, INDICATOR_RATIO_RULES } from '../src/features/indicators/indicatorDefinitionService'
import { antibioticDispensingRows } from '../src/features/pharmacy/pharmacyDemoData'

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

describe('antibiotic consumption (DDD) metric (ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014 §2.4)', () => {
  const originalLength = antibioticDispensingRows.length
  beforeEach(() => vi.stubGlobal('localStorage', storage()))
  afterEach(() => antibioticDispensingRows.splice(0, antibioticDispensingRows.length - originalLength))

  it('registers antibiotic_ddd_total against patient_days at ×100 (DDD per 100 patient-days)', () => {
    expect(INDICATOR_METRICS).toContain('antibiotic_ddd_total')
    expect(INDICATOR_RATIO_RULES.antibiotic_ddd_total).toEqual({ patient_days: { multiplier: 100, unit: 'DDD/100 patient-days' } })
  })

  it('sums quantity_grams / ddd_grams across all recorded dispensing periods', () => {
    const metrics = collectIndicatorMetrics()
    // Demo seed (full-year history): 760g+920g+840g meropenem (DDD 3g) +
    // 980g+830g+1200g ceftriaxone (DDD 2g) + 540g vancomycin (DDD 2g) +
    // 400g oxacillin (DDD 2g) -> 2815
    expect(metrics.antibiotic_ddd_total).toBe(2815)
  })

  it('excludes a dispensing row for an antibiotic with no DDD reference value', () => {
    antibioticDispensingRows.unshift({ id: 'ABXD-TEST', productCode: 'ABX-UNKNOWN', quantityGrams: 500 })
    const metrics = collectIndicatorMetrics()
    expect(metrics.antibiotic_ddd_total).toBe(2815)
  })
})
