import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSectionModel } from '../src/features/analysis/analysisDomains'

vi.mock('../src/core/config/env', async importOriginal => ({ ...(await importOriginal()), hasSupabaseConfig: true }))
const client = vi.hoisted(() => ({ rpc: null, from: null }))
vi.mock('../src/core/supabase/client', () => ({ supabase: { rpc: (...args) => client.rpc(...args), from: (...args) => client.from(...args) } }))

// A query that ignores its filters and resolves to the given rows.
const rows = data => { const result = Promise.resolve({ data, error: null }); const chain = new Proxy(result, { get: (target, key) => key in target ? target[key].bind(target) : () => chain }); return chain }

// Per hospital: surveillance total, confirmed HAI, positive findings.
const HOSPITALS = { 'org-a': [6, 1, 2], 'org-b': [10, 3, 4] }

describe('Platform analysis over "all hospitals"', () => {
  let calls
  beforeEach(() => {
    calls = []
    Object.assign(client, {
        rpc: (name, payload) => {
          calls.push([name, payload.p_organization_id])
          const [total, hai, positives] = HOSPITALS[payload.p_organization_id] || [0, 0, 0]
          if (name === 'analysis_microbiology_findings') return Promise.resolve({ data: Array.from({ length: positives }, (_, i) => ({ organization_id: payload.p_organization_id, organism: 'E. coli', resistance_class: i ? null : 'MDR', department_name: 'ΜΕΘ', event_date: '2026-03-01' })), error: null })
          if (name === 'analysis_crosstab_metrics') return Promise.resolve({ data: { surveillance: { haiByDepartment: [['ΜΕΘ', 'CLABSI', hai]] }, antimicrobial: { byAgentDepartment: [['Meropenem', 'ΜΕΘ', 1]] } }, error: null })
          if (name === 'analysis_domain_metrics') return Promise.resolve({ data: { surveillance: { total, haiConfirmed: hai }, handHygiene: { observations: 10, compliant: 8 } }, error: null })
          return Promise.resolve({ data: name === 'analysis_amr_susceptibility' ? [] : {}, error: null })
        },
        from: () => rows([]),
    })
  })

  it('reads each production hospital on its own (never the whole platform, Demo included) and compares them by hospital', async () => {
    const { loadAnalysisSnapshot } = await import('../src/features/platform/platformService')
    const snapshot = await loadAnalysisSnapshot({ organizationIds: ['org-a', 'org-b'], organizationNames: { 'org-a': 'Γ.Ν. Α', 'org-b': 'Γ.Ν. Β' }, from: '2026-01-01', to: '2026-12-31' })
    expect(calls.some(([, org]) => org == null)).toBe(false)
    expect(snapshot.domains.surveillance.total).toBe(16)
    expect(snapshot.microbiology.totalPositive).toBe(6)
    // The cross-tabulations of each hospital are kept as cells (the matrix adds them up);
    // a section the domain metrics left out (antimicrobials here) is not created.
    expect(snapshot.domains.surveillance.haiByDepartment).toEqual([['ΜΕΘ', 'CLABSI', 1], ['ΜΕΘ', 'CLABSI', 3]])
    expect(snapshot.domains.antimicrobial).toBeUndefined()
    expect(snapshot.hospitals.map(row => [row.name, row.episodes, row.hai, row.positives, row.mdro, row.hand])).toEqual([['Γ.Ν. Α', 6, 1, 2, 1, 80], ['Γ.Ν. Β', 10, 3, 4, 1, 80]])
    const tx = el => el
    const board = buildSectionModel('overview', snapshot, tx).charts[0]
    expect(board.title).toBe('Σύγκριση νοσοκομείων')
    expect(board.rowLabel).toBe('Νοσοκομείο')
    expect(board.rows.map(row => row.name)).toEqual(['Γ.Ν. Β', 'Γ.Ν. Α'])
  })

  it('shows nothing rather than the whole platform when there is no production hospital', async () => {
    const { loadAnalysisSnapshot } = await import('../src/features/platform/platformService')
    const snapshot = await loadAnalysisSnapshot({ organizationIds: [], from: '2026-01-01', to: '2026-12-31' })
    expect(calls).toEqual([])
    expect(snapshot.domains).toBeNull()
  })
})
