import { describe, expect, it } from 'vitest'
import { normalizeLaboratorySample, normalizeLaboratorySamples, validateLaboratorySample } from '../src/features/laboratory/model/laboratoryModel'

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
