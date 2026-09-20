import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collectIndicatorMetrics } from '../src/features/indicators/indicatorEngine'
import { INDICATOR_METRICS } from '../src/features/indicators/indicatorDefinitionService'
import { surveillanceDemoData } from '../src/features/surveillance/surveillanceDemoData'

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

describe('MDR/XDR/PDR isolation event metrics (ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014 §2.6)', () => {
  beforeEach(() => vi.stubGlobal('localStorage', storage()))

  it('registers a raw count metric for the total and each reference pathogen', () => {
    const pathogens = ['ecoli', 'proteus', 'acinetobacter', 'klebsiella', 'enterobacter', 'pseudomonas', 'saureus', 'enterococcus']
    expect(INDICATOR_METRICS).toContain('mdr_isolation_total')
    for (const pathogen of pathogens) expect(INDICATOR_METRICS).toContain(`mdr_isolation_${pathogen}`)
  })

  it('counts cases under active isolation with an MDR/XDR/PDR classification', () => {
    const expectedTotal = surveillanceDemoData.filter(x => x.isolation && ['MDR', 'XDR', 'PDR'].includes(x.resistance)).length
    const metrics = collectIndicatorMetrics()
    expect(metrics.mdr_isolation_total).toBe(expectedTotal)
    expect(metrics.mdr_isolation_total).toBeGreaterThan(0)
  })

  it('attributes the demo Klebsiella and Acinetobacter MDR/XDR isolations to their own pathogen counters', () => {
    const metrics = collectIndicatorMetrics()
    expect(metrics.mdr_isolation_klebsiella).toBe(1)
    // Demo seed's full-year history has two Acinetobacter XDR isolation cases.
    expect(metrics.mdr_isolation_acinetobacter).toBe(2)
    expect(metrics.mdr_isolation_ecoli).toBe(0)
  })
})
