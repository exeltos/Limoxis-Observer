import { describe, expect, it } from 'vitest'
import { computeTurnaroundHours, formatTurnaround, normalizeLaboratorySample, normalizeLaboratorySamples, validateLaboratorySample } from '../src/features/laboratory/model/laboratoryModel'

describe('canonical laboratory model', () => {
  it('normalizes Supabase-shaped and Demo-shaped rows to the same model', () => {
    const production = normalizeLaboratorySample({ id: 'LAB-1', record_id: 'uuid-1', organization_id: 'org-1', subject_type: 'patient', subject_name: 'Patient A', sample_type: 'bloodCulture', collected_at: '2026-09-12T08:00:00Z', is_critical: true })
    const demo = normalizeLaboratorySample({ id: 'LAB-1', recordId: 'uuid-1', organizationId: 'org-1', subjectType: 'patient', subjectName: 'Patient A', type: 'bloodCulture', collectedAt: '2026-09-12T08:00:00Z', critical: true })
    expect(production).toEqual(demo)
    expect(validateLaboratorySample(production)).toEqual({ valid: true, errors: [] })
  })

  it('does not accept a non-collection as a registry response', () => {
    expect(() => normalizeLaboratorySamples(null)).toThrow('INVALID_LABORATORY_SAMPLE_COLLECTION')
  })
})

describe('turnaround-time tracking', () => {
  it('computes hours from request to result, preferring requestedAt over collectedAt', () => {
    expect(computeTurnaroundHours({ requestedAt: '2026-09-12T08:00:00Z', collectedAt: '2026-09-12T09:00:00Z', resultedAt: '2026-09-12T20:00:00Z' })).toBe(12)
    expect(computeTurnaroundHours({ collectedAt: '2026-09-12T08:00:00Z', resultedAt: '2026-09-13T08:00:00Z' })).toBe(24)
  })

  it('returns null when there is not yet a result, a start time, or the timestamps are inconsistent', () => {
    expect(computeTurnaroundHours({ collectedAt: '2026-09-12T08:00:00Z', resultedAt: null })).toBeNull()
    expect(computeTurnaroundHours({ collectedAt: null, resultedAt: '2026-09-12T08:00:00Z' })).toBeNull()
    expect(computeTurnaroundHours({ collectedAt: '2026-09-12T08:00:00Z', resultedAt: '2026-09-12T00:00:00Z' })).toBeNull()
  })

  it('formats short durations in hours and long ones in days+hours', () => {
    expect(formatTurnaround(5.4, 'el')).toBe('5ω')
    expect(formatTurnaround(5.4, 'en')).toBe('5h')
    expect(formatTurnaround(50, 'el')).toBe('2η 2ω')
    expect(formatTurnaround(50, 'en')).toBe('2d 2h')
    expect(formatTurnaround(null, 'en')).toBe('—')
  })
})
