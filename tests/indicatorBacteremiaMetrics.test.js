import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collectIndicatorMetrics } from '../src/features/indicators/indicatorEngine'
import { INDICATOR_METRICS, INDICATOR_RATIO_RULES } from '../src/features/indicators/indicatorDefinitionService'

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

describe('bacteremia incidence metrics (ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014)', () => {
  beforeEach(() => vi.stubGlobal('localStorage', storage()))

  it('registers total and per-reference-pathogen metrics against patient_days', () => {
    const keys = ['bacteremia_total', 'bacteremia_ecoli', 'bacteremia_proteus', 'bacteremia_acinetobacter', 'bacteremia_klebsiella', 'bacteremia_enterobacter', 'bacteremia_pseudomonas', 'bacteremia_saureus', 'bacteremia_enterococcus']
    for (const key of keys) {
      expect(INDICATOR_METRICS).toContain(key)
      expect(INDICATOR_RATIO_RULES[key]).toEqual({ patient_days: { multiplier: 1000, unit: '/1.000 patient-days' } })
    }
  })

  it('counts only positive blood cultures with a recorded organism', () => {
    const metrics = collectIndicatorMetrics()
    expect(metrics.bacteremia_total).toBe(1)
  })

  it('attributes the single demo bacteremia to Klebsiella and no other reference pathogen', () => {
    const metrics = collectIndicatorMetrics()
    expect(metrics.bacteremia_klebsiella).toBe(1)
    expect(metrics.bacteremia_ecoli).toBe(0)
    expect(metrics.bacteremia_proteus).toBe(0)
    expect(metrics.bacteremia_acinetobacter).toBe(0)
    expect(metrics.bacteremia_enterobacter).toBe(0)
    expect(metrics.bacteremia_pseudomonas).toBe(0)
    expect(metrics.bacteremia_saureus).toBe(0)
    expect(metrics.bacteremia_enterococcus).toBe(0)
  })
})
