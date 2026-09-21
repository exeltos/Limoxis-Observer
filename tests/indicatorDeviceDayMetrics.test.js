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

describe('device-day indicators (CLABSI/CAUTI/VAP promoted from LIRA-only to primary surveillance indicators)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage())
    configureDataEnvironment({ mode: 'demo', organizationId: 'demo-hospital', demoAccountId: 'demo-user-1' })
  })

  it('registers device-day event and denominator metrics', () => {
    for (const metric of ['clabsi_events', 'central_line_days', 'cauti_events', 'urinary_catheter_days', 'vap_events', 'ventilator_days']) {
      expect(INDICATOR_METRICS).toContain(metric)
    }
  })

  it('defines the three device-day ratios per 1,000 device-days', () => {
    expect(INDICATOR_RATIO_RULES.clabsi_events.central_line_days).toEqual({ multiplier: 1000, unit: '/1.000 ημέρες κεντρικού καθετήρα' })
    expect(INDICATOR_RATIO_RULES.cauti_events.urinary_catheter_days).toEqual({ multiplier: 1000, unit: '/1.000 ημέρες ουροκαθετήρα' })
    expect(INDICATOR_RATIO_RULES.vap_events.ventilator_days).toEqual({ multiplier: 1000, unit: '/1.000 ημέρες αναπνευστήρα' })
  })

  it('computes non-zero device-day metrics from the demo dataset', () => {
    const metrics = collectIndicatorMetrics()
    expect(metrics.central_line_days).toBeGreaterThan(0)
    expect(metrics.clabsi_events).toBeGreaterThan(0)
    expect(metrics.urinary_catheter_days).toBeGreaterThan(0)
    expect(metrics.cauti_events).toBeGreaterThan(0)
    expect(metrics.ventilator_days).toBeGreaterThan(0)
    expect(metrics.vap_events).toBeGreaterThan(0)
  })

  it('ships the three system indicator definitions wired to the auto-calculated metrics', () => {
    const clabsi = indicatorDefinitionRows.find(row => row.indicator_key === 'clabsi-rate')
    const cauti = indicatorDefinitionRows.find(row => row.indicator_key === 'cauti-rate')
    const vap = indicatorDefinitionRows.find(row => row.indicator_key === 'vap-rate')
    expect(clabsi).toMatchObject({ calculation_type: 'auto', numerator_metric: 'clabsi_events', denominator_metric: 'central_line_days' })
    expect(cauti).toMatchObject({ calculation_type: 'auto', numerator_metric: 'cauti_events', denominator_metric: 'urinary_catheter_days' })
    expect(vap).toMatchObject({ calculation_type: 'auto', numerator_metric: 'vap_events', denominator_metric: 'ventilator_days' })
  })
})
