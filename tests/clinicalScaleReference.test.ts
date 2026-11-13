import { describe, expect, it } from 'vitest'
import { CLINICAL_SCALE_FIELDS, CLINICAL_SCALE_REFERENCE, buildScaleReportRows, clinicalScaleOptions, isChoiceScale, scoreBand, valueStatus } from '../src/features/clinical-scales/clinicalScaleForms'
import { calculateClinicalScale } from '../src/features/clinical-scales/clinicalScaleEngine'

describe('clinical scale reference values', () => {
  it('every scale field has a reference value and every scale has score bands', () => {
    for (const [scale, fields] of Object.entries(CLINICAL_SCALE_FIELDS)) {
      const ref = CLINICAL_SCALE_REFERENCE[scale]
      expect(ref, scale).toBeTruthy()
      expect(ref.bands.length, scale).toBeGreaterThan(1)
      for (const [key] of fields) expect(ref.fields[key], `${scale}.${key}`).toBeTruthy()
    }
  })

  it('choice scales offer a labelled option for every field', () => {
    for (const scale of ['morse', 'braden', 'gcs', 'pediatric-gcs', 'humpty-dumpty']) {
      expect(isChoiceScale(scale)).toBe(true)
      for (const [key] of CLINICAL_SCALE_FIELDS[scale]) expect(clinicalScaleOptions(scale, key, false).length, `${scale}.${key}`).toBeGreaterThan(1)
    }
  })

  it('bands match the engine risk thresholds', () => {
    expect(scoreBand('news2', 0)[3]).toBe('good')
    expect(scoreBand('news2', 5)[3]).toBe('warning')
    expect(scoreBand('news2', 7)[3]).toBe('danger')
    expect(scoreBand('morse', 45)[3]).toBe('warning')
    expect(scoreBand('morse', 46)[3]).toBe('danger')
    expect(scoreBand('humpty-dumpty', 12)[3]).toBe('danger')
    expect(scoreBand('gcs', 8)[3]).toBe('danger')
    expect(scoreBand('braden', 19)[3]).toBe('good')
    expect(scoreBand('news2', null)).toBeNull()
  })

  it('flags values outside the normal range', () => {
    expect(valueStatus('news2', 'respiratoryRate', 26)).toBe('high')
    expect(valueStatus('news2', 'spo2', 91)).toBe('low')
    expect(valueStatus('news2', 'pulse', 72)).toBe('normal')
    expect(valueStatus('braden', 'moisture', 2)).toBeNull()
  })

  it('builds a report with translated parameters, points and references (no raw keys)', () => {
    const answers = { respiratoryRate: 26, spo2: 91, supplementalOxygen: true, systolicBp: 96, pulse: 118, temperature: 38.9, newConfusion: false }
    const result = calculateClinicalScale('news2', answers)
    const { rows, components } = buildScaleReportRows('news2', answers, result.parts, false)
    expect(components).toEqual([])
    expect(rows.map(r => r.label)).not.toContain('respiratoryRate')
    expect(rows.find(r => r.key === 'respiratoryRate')).toMatchObject({ points: 3, status: 'high', reference: '12–20 /λεπτό' })
    expect(rows.reduce((n, r) => n + (r.points || 0), 0)).toBe(result.score)
    const braden = buildScaleReportRows('braden', { sensoryPerception: 2, moisture: 2, activity: 1, mobility: 2, nutrition: 2, frictionShear: 1 }, { sensoryPerception: 2 }, false)
    expect(braden.rows[0].value).toBe('Πολύ περιορισμένη')
    const sofa = buildScaleReportRows('sofa', { pao2Fio2: 250 }, { respiratory: 2, renal: 1 }, false)
    expect(sofa.components.map(c => c.label)).toEqual(['Αναπνευστικό', 'Νεφρικό'])
  })
})
