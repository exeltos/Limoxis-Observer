import { describe, expect, it, vi } from 'vitest'
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
    // The latest organism too (owner, 19/11/2026): none recorded for p2.
    expect(flags.p2).toEqual({ resistance: expect.objectContaining({ classification: 'MRSA' }), isolation: null, organism: null })
    expect(flags.p1.organism).toMatchObject({ name: 'K. pneumoniae' })
    expect(flags.p3).toBeUndefined()
  })

  it('falls back to a sample resistance and keys demo cases by patient code', async () => {
    expect(infectionFlagsFromCases([{ patientId: 'PT-1', status: 'active', samples: [{ resistance: 'VRE', organism: 'E. faecium' }] }])['PT-1'].resistance.classification).toBe('VRE')
    const demo = await loadPatientInfectionFlags(null, { isDemo: true })
    expect(demo['PT-260184'].resistance.classification).toBe('MDR')
    expect(demo['PT-260184'].isolation).not.toBeNull()
  })
})

describe('latest organisms past the 1,000-row limit (owner, 19/11/2026)', () => {
  it('reads every page of patient_latest_organisms', async () => {
    vi.resetModules()
    const all = Array.from({ length: 1195 }, (_, k) => ({ patient_id: `p${k}`, organism: 'E.coli', resistance: null, resulted_at: null }))
    const ranges: number[][] = []
    vi.doMock('../src/core/supabase/client', () => ({ supabase: { rpc: (name: string) => {
      const rows = name === 'patient_latest_organisms' ? all : []
      const result = (from = 0, to = 999) => Promise.resolve({ data: rows.slice(from, to + 1), error: null })
      const query = { range: (from: number, to: number) => { ranges.push([from, to]); return result(from, to) }, then: (ok: (value: unknown) => unknown, ko: (reason: unknown) => unknown) => result().then(ok, ko) }
      return query
    } } }))
    const { loadPatientInfectionFlags } = await import('../src/features/patients/patientInfectionFlagsService')
    const flags = await loadPatientInfectionFlags('org-1')
    expect(Object.keys(flags)).toHaveLength(1195)
    expect(flags.p1194.organism?.name).toBe('E.coli')
    expect(ranges).toEqual([[0, 999], [1000, 1999]])
    vi.doUnmock('../src/core/supabase/client')
  })
})
