import { describe, it, expect } from 'vitest'
import { normalizeWhoMoments, observationWeight, sessionHandHygieneStats, whoStatsFromObservations } from '../src/features/prevention/whoHandHygieneStats'

describe('WHO hand hygiene statistics', () => {
  it('each professional observed together is a separate opportunity', () => {
    expect([undefined, 0, '3', 2].map(count => observationWeight({ professionalsCount: count }))).toEqual([1, 1, 3, 2])
  })

  it('compliance is hand rub or hand wash over all opportunities, to one decimal', () => {
    const stats = whoStatsFromObservations([
      { action: 'HR', professionalsCount: 2 },
      { action: 'HW' },
      { action: 'MISSED', professionalsCount: 3 },
    ])
    expect(stats).toEqual({ opportunities: 6, handRub: 2, handWash: 1, missed: 3, professionals: 6, compliant: 3, compliance: 50 })
    expect(whoStatsFromObservations([{ action: 'HR' }, { action: 'HR' }, { action: 'MISSED' }]).compliance).toBe(66.7)
  })

  it('no observations means no opportunities and 0% (not a division by zero)', () => {
    expect(whoStatsFromObservations([])).toMatchObject({ opportunities: 0, compliance: 0 })
  })

  it('reads the WHO moments without duplicates, or the single legacy moment', () => {
    expect(normalizeWhoMoments({ moments: ['moment1', '', 'moment1', 'moment4'] })).toEqual(['moment1', 'moment4'])
    expect(normalizeWhoMoments({ moments: [], moment: 'moment2' })).toEqual(['moment2'])
    expect(normalizeWhoMoments(null)).toEqual([])
  })
})

describe('sessionHandHygieneStats', () => {
  it('uses the stored statistics when present', () => {
    const whoStats = { compliance: 80 }
    expect(sessionHandHygieneStats({ whoStats, whoObservations: [{ action: 'MISSED' }] })).toBe(whoStats)
  })

  it('computes them from the observations otherwise', () => {
    expect(sessionHandHygieneStats({ whoObservations: [{ action: 'HR' }, { action: 'MISSED' }], observations: 10, compliant: 9 })).toMatchObject({ opportunities: 2, compliant: 1, compliance: 50 })
  })

  it('a session without observations falls back to its stored totals and rate', () => {
    expect(sessionHandHygieneStats({ observations: 20, compliant: 15 })).toMatchObject({ opportunities: 20, compliant: 15, compliance: 75 })
    expect(sessionHandHygieneStats({ rate: 42 })).toMatchObject({ opportunities: 0, compliance: 42 })
  })
})
