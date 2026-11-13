import { describe, expect, it } from 'vitest'
import { collectDeviceDaySources } from '../src/features/surveillance/deviceDayIndicators'
import { calculateHaiRate } from '../src/features/lira/liraHaiMetrics'

describe('device-day indicator sources (promoted from LIRA-only to primary surveillance indicators)', () => {
  it('flattens clinicalDemoData cases into devices/haiClassifications shaped for liraHaiMetrics', () => {
    const { devices, haiClassifications } = collectDeviceDaySources()
    expect(devices.length).toBeGreaterThan(0)
    expect(haiClassifications.length).toBeGreaterThan(0)
    expect(devices.some(d => d.deviceType === 'central line')).toBe(true)
    expect(devices.some(d => d.deviceType === 'urinary catheter')).toBe(true)
    expect(devices.some(d => d.deviceType === 'ventilator')).toBe(true)
    expect(haiClassifications.some(x => x.haiType === 'clabsi')).toBe(true)
    expect(haiClassifications.some(x => x.haiType === 'cauti')).toBe(true)
    expect(haiClassifications.some(x => x.haiType === 'vap')).toBe(true)
  })

  it('produces non-zero CLABSI/CAUTI/VAP rates from the demo dataset', () => {
    const data = collectDeviceDaySources()
    for (const type of ['clabsi', 'cauti', 'vap']) {
      const result = calculateHaiRate(data, type, {})
      expect(result.deviceDays).toBeGreaterThan(0)
      expect(result.events).toBeGreaterThan(0)
    }
  })
})
