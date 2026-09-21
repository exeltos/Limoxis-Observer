import { describe, expect, it, vi, beforeEach } from 'vitest'
import { birthWeightBandId, collectNeonatalDeviceDaySourcesByBand } from '../src/features/surveillance/deviceDayIndicators'
import { collectIndicatorMetrics } from '../src/features/indicators/indicatorEngine'
import { INDICATOR_METRICS, INDICATOR_RATIO_RULES } from '../src/features/indicators/indicatorDefinitionService'
import { indicatorDefinitionRows } from '../src/features/indicators/indicatorDemoData'

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

describe('birthWeightBandId', () => {
  it('classifies grams into the five NHSN birth-weight categories', () => {
    expect(birthWeightBandId(500)).toBe('le750')
    expect(birthWeightBandId(750)).toBe('le750')
    expect(birthWeightBandId(900)).toBe('bw751_1000')
    expect(birthWeightBandId(1200)).toBe('bw1001_1500')
    expect(birthWeightBandId(2000)).toBe('bw1501_2500')
    expect(birthWeightBandId(3200)).toBe('gt2500')
  })

  it('returns null for missing or invalid weight', () => {
    expect(birthWeightBandId(null)).toBeNull()
    expect(birthWeightBandId(0)).toBeNull()
    expect(birthWeightBandId(undefined)).toBeNull()
  })
})

describe('NICU birth-weight-stratified CLABSI sources', () => {
  it('places the seeded 980g NICU CLABSI case in the 751-1000g band, not pooled with the rest of the hospital', () => {
    const byBand = collectNeonatalDeviceDaySourcesByBand()
    expect(byBand.bw751_1000.devices.length).toBeGreaterThan(0)
    expect(byBand.bw751_1000.haiClassifications.some(h => h.haiType === 'clabsi' && h.criteriaMet)).toBe(true)
    expect(byBand.le750.devices).toHaveLength(0)
    expect(byBand.gt2500.devices).toHaveLength(0)
  })
})

describe('birth-weight-stratified CLABSI indicator metrics', () => {
  beforeEach(() => vi.stubGlobal('localStorage', storage()))

  it('registers a metric pair and ratio rule for each birth-weight band', () => {
    for (const band of ['le750', 'bw751_1000', 'bw1001_1500', 'bw1501_2500', 'gt2500']) {
      expect(INDICATOR_METRICS).toContain(`clabsi_events_${band}`)
      expect(INDICATOR_METRICS).toContain(`central_line_days_${band}`)
      expect(INDICATOR_RATIO_RULES[`clabsi_events_${band}`]).toEqual({ [`central_line_days_${band}`]: expect.objectContaining({ multiplier: 1000 }) })
    }
  })

  it('computes a non-zero rate for the demo 751-1000g band from the seeded NICU case', () => {
    const metrics = collectIndicatorMetrics()
    expect(metrics.clabsi_events_bw751_1000).toBeGreaterThan(0)
    expect(metrics.central_line_days_bw751_1000).toBeGreaterThan(0)
  })

  it('leaves other birth-weight bands at zero since no demo case falls in them', () => {
    const metrics = collectIndicatorMetrics()
    expect(metrics.clabsi_events_le750).toBe(0)
    expect(metrics.clabsi_events_gt2500).toBe(0)
  })

  it('ships a system indicator definition for each birth-weight band', () => {
    const keys = indicatorDefinitionRows.filter(r => r.indicator_key.startsWith('clabsi-rate-')).map(r => r.indicator_key)
    expect(keys).toEqual(expect.arrayContaining(['clabsi-rate-le750', 'clabsi-rate-bw751-1000', 'clabsi-rate-bw1001-1500', 'clabsi-rate-bw1501-2500', 'clabsi-rate-gt2500']))
  })
})
