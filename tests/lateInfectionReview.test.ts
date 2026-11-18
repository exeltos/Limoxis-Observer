import { describe, expect, it } from 'vitest'
import { groupLateInfectionRows } from '../src/features/registers/registerService'
import { readSource } from './helpers/readSource'

// ΜΕΝΝ Ν6 (ιδιοκτήτης 17/11/2026): positive blood cultures ≥ 72 h after admission, for the NICU to confirm.
describe('late-onset infection candidates', () => {
  it('shows one line per sample, with every organism it grew', () => {
    const rows = groupLateInfectionRows([
      { entry_id: 'e1', sample_id: 's1', collected_at: '2026-03-18T10:00:00Z', organism: 'Klebsiella pneumoniae', hours_after: 150, decision: null },
      { entry_id: 'e1', sample_id: 's1', collected_at: '2026-03-18T10:00:00Z', organism: 'Candida albicans', hours_after: 150, decision: null },
      { entry_id: 'e2', sample_id: 's2', collected_at: '2026-04-02T10:00:00Z', organism: 'CoNS', hours_after: 80, decision: 'rejected' },
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0].organism).toBe('Klebsiella pneumoniae, Candida albicans')
    expect(rows[1].decision).toBe('rejected')
  })
  it('matches inside the database and returns no name; only for readers of the register', () => {
    const sql = readSource('supabase/migrations/20261231593000_nicu_late_infection_candidates.sql')
    expect(sql).toContain('private.register_can_read(p_register_id)')
    expect(sql).toContain("interval '72 hours'")
    expect(sql).toContain('revoke execute on function public.register_late_infection_candidates(uuid) from public, anon;')
    expect(sql).not.toMatch(/returns table \([^)]*patient_name/)
  })
})

describe('Ν6β: the decision is taken in Surveillance › «Προς έλεγχο» (ιδιοκτήτης 17/11/2026)', () => {
  it('tags the NICU late-onset samples in the worklist, and an opened episode records the infection in the register', async () => {
    const { lateOnsetDay } = await import('../src/features/surveillance/lateOnsetFlags')
    expect(lateOnsetDay(72)).toBe(4)
    expect(lateOnsetDay(240)).toBe(11)
    const worklist = readSource('src/features/surveillance/SampleReviewWorklist.tsx')
    expect(worklist).toContain('Πιθανή όψιμη λοίμωξη · ΜΕΝΝ')
    const sql = readSource('supabase/migrations/20261231594000_nicu_late_onset_surveillance.sql')
    expect(sql).toContain('after update of surveillance_case_id on public.laboratory_samples')
    expect(sql).toContain('set late_infection = true')
    expect(sql).toContain('revoke execute on function public.nicu_late_onset_flags(uuid) from public, anon;')
    // The register no longer shows its own review panel.
    expect(readSource('src/features/registers/RegisterRecordPage.tsx')).not.toContain('LateInfectionReview')
  })
})
