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

describe('Point prevalence survey (PPS) indicator metrics (ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014 §2.2)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage())
    configureDataEnvironment({ mode: 'demo', organizationId: 'demo-hospital', demoAccountId: 'demo-user-1' })
  })

  it('registers raw count metrics for total patients, HAI cases and antibiotic use', () => {
    expect(INDICATOR_METRICS).toContain('pps_patients_total')
    expect(INDICATOR_METRICS).toContain('pps_patients_with_hai')
    expect(INDICATOR_METRICS).toContain('pps_patients_on_antibiotics')
  })

  it('defines the two prevalence ratios against total patients surveyed', () => {
    expect(INDICATOR_RATIO_RULES.pps_patients_with_hai.pps_patients_total).toEqual({ multiplier: 100, unit: '%' })
    expect(INDICATOR_RATIO_RULES.pps_patients_on_antibiotics.pps_patients_total).toEqual({ multiplier: 100, unit: '%' })
  })

  it('sums the demo survey rows for each metric', () => {
    const metrics = collectIndicatorMetrics()
    expect(metrics.pps_patients_total).toBe(180)
    expect(metrics.pps_patients_with_hai).toBe(9)
    expect(metrics.pps_patients_on_antibiotics).toBe(46)
  })

  it('ships the two system indicator definitions wired to the auto-calculated metrics', () => {
    const hai = indicatorDefinitionRows.find(row => row.indicator_key === 'hai-prevalence-pps')
    const abx = indicatorDefinitionRows.find(row => row.indicator_key === 'antibiotic-use-prevalence-pps')
    expect(hai.calculation_type).toBe('auto')
    expect(hai.numerator_metric).toBe('pps_patients_with_hai')
    expect(hai.denominator_metric).toBe('pps_patients_total')
    expect(abx.calculation_type).toBe('auto')
    expect(abx.numerator_metric).toBe('pps_patients_on_antibiotics')
    expect(abx.denominator_metric).toBe('pps_patients_total')
  })
})
