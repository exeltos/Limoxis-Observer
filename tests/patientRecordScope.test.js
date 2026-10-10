import { describe, it, expect } from 'vitest'
import { episodesForAdmission, sampleTone, samplesForAdmission, samplesForEpisode, stayDays } from '../src/features/surveillance/patientRecordScope'

const admission = { id: 'ADM-1', admissionDate: '2026-09-01', dischargeDate: '2026-09-10', departmentId: 'ICU' }

describe('episodesForAdmission', () => {
  const episodes = [
    { id: 'E1', admissionId: 'ADM-1', startedAt: '2026-01-01' },
    { id: 'E2', admissionId: 'ADM-2', startedAt: '2026-09-05' },
    { id: 'E3', startedAt: '2026-09-10T22:00:00', departmentId: 'ICU' },
    { id: 'E4', startedAt: '2026-09-11', departmentId: 'ICU' },
    { id: 'E5', startedAt: '2026-09-05', departmentId: 'SURGERY' },
    { id: 'E6', startedAt: '2026-09-05' },
    { id: 'E7', startedAt: '' },
    { id: 'E8', admissionId: 'ADM-1', status: 'cancelled' },
  ]

  it('without an admission, shows every episode that is not cancelled', () => {
    expect(episodesForAdmission(episodes).map(e => e.id)).toEqual(['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7'])
  })

  it('keeps linked episodes of this admission, and unlinked ones started within its dates and department', () => {
    // E1: linked, whatever its date. E3: discharge day counts. E6: no department is not excluded.
    expect(episodesForAdmission(episodes, admission).map(e => e.id)).toEqual(['E1', 'E3', 'E6'])
  })

  it('keeps unlinked episodes of an open admission without an end date', () => {
    const open = { id: 'ADM-3', admissionDate: '2026-09-01' }
    expect(episodesForAdmission([{ id: 'E', startedAt: '2027-01-01' }], open)).toHaveLength(1)
  })
})

describe('samplesForAdmission', () => {
  const patient = { id: 'P1', recordId: 'REC-1' }
  it('keeps the patient\'s samples of the admission, including samples without a date', () => {
    const samples = [
      { id: 'S1', patientRecordId: 'REC-1', collectedAt: '2026-09-02', departmentId: 'ICU' },
      { id: 'S2', patientRecordId: 'REC-2', collectedAt: '2026-09-02' },
      { id: 'S3', patientRecordId: 'REC-1', requestedAt: '2026-09-12' },
      { id: 'S4', patientRecordId: 'REC-1' },
      { id: 'S5', patientRecordId: 'REC-1', collectedAt: '2026-09-03', departmentId: 'WARD' },
      { id: 'S6', patientId: 'P1', collectedAt: '2026-09-04' },
    ]
    // S6 has no record id, so it is matched by the patient id.
    expect(samplesForAdmission(samples, patient, admission).map(s => s.id)).toEqual(['S1', 'S4', 'S6'])
  })

  it('is empty without a patient or an admission', () => {
    expect(samplesForAdmission([{ id: 'S' }], null, admission)).toEqual([])
    expect(samplesForAdmission([{ id: 'S' }], patient, null)).toEqual([])
  })
})

describe('samplesForEpisode', () => {
  it('adds laboratory rows linked to the episode and follow-ups of its samples, once', () => {
    const episode = { id: 'SURV-1', samples: [{ id: 'LAB-1' }] }
    const rows = [
      { id: 'LAB-1' },
      { id: 'LAB-1-R1' },
      { id: 'LAB-10-R1' },
      { id: 'LAB-2', surveillanceCaseId: 'SURV-1' },
      { id: 'LAB-3', surveillanceCase: 'SURV-9' },
    ]
    const result = samplesForEpisode(episode, rows)
    expect(result.map(s => s.id)).toEqual(['LAB-1', 'LAB-1-R1', 'LAB-2'])
    expect(result[1].surveillanceCase).toBe('SURV-1')
  })

  it('is empty without an episode', () => {
    expect(samplesForEpisode(null, [{ id: 'LAB-1' }])).toEqual([])
  })
})

describe('stayDays', () => {
  it('counts the admission day as day 1', () => {
    expect(stayDays('2026-09-01', '2026-09-01')).toBe(1)
    expect(stayDays('2026-09-01T23:00:00', '2026-09-10')).toBe(10)
  })

  it('counts until today while still admitted', () => {
    expect(stayDays('2026-09-01', null, new Date('2026-09-03T08:00:00'))).toBe(3)
  })

  it('is null for missing or reversed dates', () => {
    expect(stayDays(null, '2026-09-01')).toBeNull()
    expect(stayDays('2026-09-10', '2026-09-01')).toBeNull()
    expect(stayDays('not a date', '2026-09-01')).toBeNull()
  })
})

describe('sampleTone', () => {
  it('reads the result regardless of case, pending otherwise', () => {
    expect(sampleTone({ result: 'Positive' })).toBe('positive')
    expect(sampleTone({ result: 'negative' })).toBe('negative')
    expect(sampleTone({})).toBe('pending')
  })
})
