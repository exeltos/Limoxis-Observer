import { describe, expect, it } from 'vitest'
import { infectionFlagsFromCases, loadPatientInfectionFlags } from '../src/features/patients/patientInfectionFlagsService'

// User-requested: show MDR / isolation in the patient registry "Flags" column.
describe('patient infection flags', () => {
  it('uses the most recent resistance, keeps it after the episode closes, and flags only active isolation', () => {
    const flags = infectionFlagsFromCases([
      { patientRecordId: 'p1', status: 'completed', startedAt: '2026-01-01', resistance: 'ESBL', isolation: { status: 'ended' } },
      { patientRecordId: 'p1', status: 'active', startedAt: '2026-08-01', resistance: 'MDR', organism: 'K. pneumoniae', isolation: { status: 'active', startedAt: '2026-08-02' } },
      { patientRecordId: 'p2', status: 'completed', startedAt: '2026-05-01', resistance: 'MRSA', isolation: { status: 'ended' } },
      { patientRecordId: 'p3', status: 'cancelled', startedAt: '2026-05-01', resistance: 'XDR', isolation: { status: 'active' } },
    ])
    expect(flags.p1.resistance).toMatchObject({ classification: 'MDR', organism: 'K. pneumoniae' })
    expect(flags.p1.isolation).toMatchObject({ since: '2026-08-02' })
    expect(flags.p2).toEqual({ resistance: expect.objectContaining({ classification: 'MRSA' }), isolation: null })
    expect(flags.p3).toBeUndefined()
  })

  it('falls back to a sample resistance and keys demo cases by patient code', async () => {
    expect(infectionFlagsFromCases([{ patientId: 'PT-1', status: 'active', samples: [{ resistance: 'VRE', organism: 'E. faecium' }] }])['PT-1'].resistance.classification).toBe('VRE')
    const demo = await loadPatientInfectionFlags(null, { isDemo: true })
    expect(demo['PT-260184'].resistance.classification).toBe('MDR')
    expect(demo['PT-260184'].isolation).not.toBeNull()
  })
})
