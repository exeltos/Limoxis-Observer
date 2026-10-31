// An environmental result is within / outside limits only against a known limit
// (the one saved with it, or the protocol's); without one it has no assessment.
import { describe, expect, it } from 'vitest'
import { isOutsideLimit, limitAssessment, resultLimit } from '../src/features/laboratory/environmentalLimit'
import { environmentalNeedsAction } from '../src/features/surveillance/EnvironmentalSurveillanceFlow'

describe('environmental limits', () => {
  it('uses the limit saved with the result, then the protocol', () => {
    expect(resultLimit({ cfuLimit: 5 }, { limitCfu: 10 })).toBe(5)
    expect(resultLimit({}, { limitCfu: '10' })).toBe(10)
    expect(resultLimit({}, { limitCfu: null })).toBeNull()
  })

  it('gives no assessment without a limit, whatever the record says', () => {
    expect(limitAssessment({ withinLimit: false })).toBeNull()
    expect(isOutsideLimit({ withinLimit: false })).toBe(false)
    expect(limitAssessment({ withinLimit: false, cfuLimit: 5 })).toBe(false)
    expect(limitAssessment({ withinLimit: true }, { limitCfu: 5 })).toBe(true)
  })

  it('asks for action only on a result outside a known limit', () => {
    expect(environmentalNeedsAction({ status: 'completed', microbiologyResults: [{ withinLimit: false }] })).toBe(false)
    expect(environmentalNeedsAction({ status: 'completed', microbiologyResults: [{ withinLimit: false, cfuLimit: 100 }] })).toBe(true)
    expect(environmentalNeedsAction({ status: 'cancelled', microbiologyResults: [{ withinLimit: false, cfuLimit: 100 }] })).toBe(false)
  })
})
