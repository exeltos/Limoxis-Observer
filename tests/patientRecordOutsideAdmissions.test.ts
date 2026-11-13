import { describe, it, expect } from 'vitest'
import {
  admissionWindowEnd,
  episodesForAdmission,
  episodesOutsideAdmissions,
  hospitalDay,
  samplesForAdmission,
  samplesOutsideAdmissions,
} from '../src/features/surveillance/patientRecordScope'

// FileMaker-imported stays: discharged without a discharge date.
const first = { id: 'A1', admissionDate: '2025-01-30', status: 'discharged', departmentId: 'ICU' }
const second = { id: 'A2', admissionDate: '2025-03-05', status: 'discharged', departmentId: 'ICU' }
const admissions = [second, first]
const patient = { id: 'FMP-00539', recordId: 'P1' }

describe('hospitalDay', () => {
  it('reads a UTC timestamp as the calendar day in Greece', () => {
    // 00:00 in Athens is 22:00 UTC of the day before in winter, 21:00 in summer.
    expect(hospitalDay('2025-01-29T22:00:00+00:00')).toBe('2025-01-30')
    expect(hospitalDay('2025-06-29T21:00:00Z')).toBe('2025-06-30')
  })

  it('keeps plain dates and local timestamps as written', () => {
    expect(hospitalDay('2025-01-29')).toBe('2025-01-29')
    expect(hospitalDay('2026-09-10T22:00:00')).toBe('2026-09-10')
    expect(hospitalDay('2026-08-27T00:35:00+03:00')).toBe('2026-08-27')
    expect(hospitalDay(null)).toBe('')
  })
})

describe('admissionWindowEnd', () => {
  it('ends a discharged stay without a discharge date the day before the next admission', () => {
    expect(admissionWindowEnd(first, admissions)).toBe('2025-03-04')
  })

  it('keeps the latest or an active stay open, and uses the discharge date when there is one', () => {
    expect(admissionWindowEnd(second, admissions)).toBe('')
    expect(admissionWindowEnd({ ...first, status: 'active' }, admissions)).toBe('')
    expect(admissionWindowEnd({ ...first, dischargeDate: '2025-02-10' }, admissions)).toBe('2025-02-10')
  })
})

describe('samples of an imported admission', () => {
  const samples = [
    // Taken at 00:00 Athens time on the admission day (stored in UTC).
    { id: 'S1', patientRecordId: 'P1', collectedAt: '2025-01-29T22:00:00+00:00', departmentId: 'ICU' },
    // Between the two stays: belongs to the first, which ends before the second.
    { id: 'S2', patientRecordId: 'P1', collectedAt: '2025-02-20T22:00:00+00:00', departmentId: 'ICU' },
    // Before every admission.
    { id: 'S3', patientRecordId: 'P1', collectedAt: '2024-12-01T22:00:00+00:00', departmentId: 'ICU' },
    // Another department during the first stay.
    { id: 'S4', patientRecordId: 'P1', collectedAt: '2025-02-01T22:00:00+00:00', departmentId: 'WARD' },
    // Dated before the second stay, but its episode is linked to the second.
    { id: 'S5', patientRecordId: 'P1', collectedAt: '2025-02-25T22:00:00+00:00', departmentId: 'ICU', surveillanceCase: 'E2' },
    // Another patient.
    { id: 'S6', patientRecordId: 'P2', collectedAt: '2025-01-29T22:00:00+00:00' },
  ]
  const episodes = [{ id: 'E2', admissionId: 'A2', startedAt: '2025-03-05T09:00:00+00:00' }]

  it('a sample taken on the admission day in Greece belongs to the admission', () => {
    expect(samplesForAdmission(samples, patient, first, { admissions, episodes }).map(s => s.id)).toEqual(['S1', 'S2'])
  })

  it('a sample of an episode linked to an admission belongs to that admission, whatever its date', () => {
    expect(samplesForAdmission(samples, patient, second, { admissions, episodes }).map(s => s.id)).toEqual(['S5'])
  })

  it('samples of no admission are listed apart, never hidden', () => {
    expect(samplesOutsideAdmissions(samples, patient, admissions, { episodes }).map(s => s.id)).toEqual(['S3', 'S4'])
  })

  it('without admissions every sample of the patient is outside', () => {
    expect(samplesOutsideAdmissions(samples, patient, []).map(s => s.id)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5'])
    expect(samplesOutsideAdmissions(samples, null, admissions)).toEqual([])
  })
})

describe('episodes outside admissions', () => {
  const episodes = [
    { id: 'E1', startedAt: '2025-01-29T22:00:00+00:00', departmentId: 'ICU' },
    { id: 'E2', admissionId: 'A2', startedAt: '2025-01-01' },
    { id: 'E3', startedAt: '2024-11-01', departmentId: 'ICU' },
    { id: 'E4', startedAt: '2024-11-01', status: 'cancelled' },
    { id: 'E5', admissionId: 'A9', startedAt: '2025-02-01' },
  ]

  it('an unlinked episode belongs to the stay it started in, up to the next admission', () => {
    expect(episodesForAdmission(episodes, first, { admissions }).map(e => e.id)).toEqual(['E1'])
  })

  it('lists the episodes of no admission (not cancelled), including ones linked to an unknown admission', () => {
    expect(episodesOutsideAdmissions(episodes, admissions).map(e => e.id)).toEqual(['E3', 'E5'])
  })
})
