import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { collectIndicatorMetrics } from '../src/features/indicators/indicatorEngine'
import { INDICATOR_METRICS, INDICATOR_RATIO_RULES } from '../src/features/indicators/indicatorDefinitionService'
import { laboratorySamples } from '../src/features/laboratory/laboratoryDemoData'

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

describe('AMR resistance-per-pathogen metrics (ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014 §2.3)', () => {
  const originalLength = laboratorySamples.length
  beforeEach(() => vi.stubGlobal('localStorage', storage()))
  afterEach(() => laboratorySamples.splice(0, laboratorySamples.length - originalLength))

  it('registers a tested/resistant metric pair for each reference pathogen', () => {
    const pathogens = ['ecoli', 'proteus', 'acinetobacter', 'klebsiella', 'enterobacter', 'pseudomonas', 'saureus', 'enterococcus']
    for (const pathogen of pathogens) {
      expect(INDICATOR_METRICS).toContain(`amr_tested_${pathogen}`)
      expect(INDICATOR_METRICS).toContain(`amr_resistant_${pathogen}`)
      expect(INDICATOR_RATIO_RULES[`amr_resistant_${pathogen}`]).toEqual({ [`amr_tested_${pathogen}`]: { multiplier: 100, unit: '%' } })
    }
  })

  it('counts the demo Klebsiella isolates as meropenem-resistant (matching their recorded AST)', () => {
    // Demo seed: twelve Klebsiella pneumoniae isolates tested against
    // meropenem; the seven KPC isolates (incl. the seeded ICU cluster used by
    // outbreakClusterService's tests) are resistant, the ESBL ones susceptible.
    const metrics = collectIndicatorMetrics()
    expect(metrics.amr_tested_klebsiella).toBe(12)
    expect(metrics.amr_resistant_klebsiella).toBe(7)
  })

  it('does not test the demo Pseudomonas isolate against meropenem (not in its recorded AST panel)', () => {
    // The seeded ICU isolate (LAB-260826-018) has no meropenem on its panel and is
    // not counted; the four other Pseudomonas isolates of the year are, two of them resistant.
    const metrics = collectIndicatorMetrics()
    expect(metrics.amr_tested_pseudomonas).toBe(4)
    expect(metrics.amr_resistant_pseudomonas).toBe(2)
  })

  it('excludes unvalidated draft results from AMR counts', () => {
    laboratorySamples.unshift({ id: 'LAB-TEST-AMR-DRAFT', organism: 'Escherichia coli', resultStatus: 'draft', ast: [{ drug: 'Ceftriaxone', sir: 'R' }] })
    const metrics = collectIndicatorMetrics()
    // Only the twelve validated E. coli isolates of the demo year are counted.
    expect(metrics.amr_tested_ecoli).toBe(12)
  })

  it('counts a susceptible reference-antibiotic result as tested but not resistant', () => {
    laboratorySamples.unshift({ id: 'LAB-TEST-AMR-SUSCEPTIBLE', organism: 'Enterococcus faecium', resultStatus: 'validated', ast: [{ drug: 'Vancomycin', sir: 'S' }] })
    const metrics = collectIndicatorMetrics()
    // Four Enterococcus isolates of the demo year (one VRE) plus this one.
    expect(metrics.amr_tested_enterococcus).toBe(5)
    expect(metrics.amr_resistant_enterococcus).toBe(1)
  })
})
