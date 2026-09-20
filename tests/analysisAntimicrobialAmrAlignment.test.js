import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'

const migration = fs.readFileSync('supabase/migrations/20260919320000_align_analysis_antimicrobial_and_amr_tabs.sql', 'utf8')
const page = fs.readFileSync('src/features/analysis/AnalysisPage.jsx', 'utf8')
const service = fs.readFileSync('src/features/platform/platformService.js', 'utf8')

function storage() {
  const values = new Map()
  return {
    get length() { return values.size },
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    key: index => [...values.keys()][index] ?? null,
  }
}

function builder(data) {
  const b = { select() { return b }, eq() { return b }, order() { return b }, then(resolve) { resolve({ data, error: null }) } }
  return b
}

vi.mock('../src/core/config/env', () => ({ hasSupabaseConfig: true }))

// Analysis-page audit finding (P2): the Antimicrobials tab showed a bare
// count with no visibility into the approval_status/administrations split
// added earlier this session, and the AMR/MDR-XDR tab showed a blunt total
// of every positive microbiology finding instead of the per-organism
// tested/resistant definition the real indicators already use.
describe('analysis_amr_susceptibility shares the per-organism reference-drug predicate with indicator_metric_snapshot', () => {
  it('reuses the same eight organism/reference-drug pairs, matching the indicator engine verbatim', () => {
    expect(migration).toContain("a.antimicrobial_code='ABX-CRO' or lower(coalesce(a.antimicrobial_name,'')) like '%ceftriaxone%'")
    expect(migration).toContain("a.antimicrobial_code='ABX-MEM' or lower(coalesce(a.antimicrobial_name,'')) like '%meropenem%'")
    expect(migration).toContain("a.antimicrobial_code='ABX-OXA' or lower(coalesce(a.antimicrobial_name,'')) like '%oxacillin%'")
    expect(migration).toContain("a.antimicrobial_code='ABX-VAN' or lower(coalesce(a.antimicrobial_name,'')) like '%vancomycin%'")
  })

  it('excludes drafts and superseded results, matching the indicator engine verbatim', () => {
    expect(migration).toContain("m.validation_status in ('validated', 'amended')")
    expect(migration).toContain('m2.amended_from = m.id')
  })
})

describe('platform_report_summary exposes antimicrobial approval/administration breakdown instead of a bare count', () => {
  it("splits the antimicrobial field into total/pending/administrations", () => {
    expect(migration).toContain("'total',(select count(*) from public.antimicrobial_therapies")
    expect(migration).toContain("'pending',(select count(*) from public.antimicrobial_therapies a where")
    expect(migration).toContain("and a.approval_status='pending'")
    expect(migration).toContain('from public.antimicrobial_therapy_administrations d join public.antimicrobial_therapies a on a.id=d.therapy_id')
    expect(migration).toContain("and d.status='administered'")
  })
})

describe('AnalysisPage renders the richer antimicrobial/AMR shapes', () => {
  it('shows total/pending/administrations rows when summary.antimicrobial is an object', () => {
    expect(page).toContain("antimicrobial&&typeof summary.antimicrobial==='object'")
    expect(page).toContain("tx('Σε αναμονή έγκρισης','Pending approval')")
    expect(page).toContain("tx('Χορηγήσεις','Administrations recorded')")
  })

  it('falls back to a single "—" antimicrobial row when department-scoped (summary.antimicrobial is null)', () => {
    expect(page).toContain("antimicrobial?[[tx('Αντιμικροβιακές αγωγές','Antimicrobial therapies'),antimicrobial.total??0,'—','up']")
  })

  it('renders one row per organism as resistant/tested from amrSusceptibility instead of a blunt MDR/XDR/PDR sum', () => {
    expect(page).toContain('snapshot.amrSusceptibility.map(([organism,tested,resistant])=>[organism,`${resistant}/${tested}`')
  })
})

describe('loadMicrobiologyAnalytics companion: loadAnalysisSnapshot also fetches analysis_amr_susceptibility', () => {
  it('platformService calls the new RPC', () => {
    expect(service).toContain("rpc('analysis_amr_susceptibility'")
  })

  let calls
  beforeEach(() => { vi.stubGlobal('localStorage', storage()); vi.resetModules(); calls = [] })
  afterEach(() => vi.doUnmock('../src/core/supabase/client'))

  it('maps RPC rows into [organism, tested, resistant] triples on the returned snapshot', async () => {
    vi.doMock('../src/core/supabase/client', () => ({
      supabase: {
        rpc: name => {
          calls.push(name)
          if (name === 'analysis_amr_susceptibility') return Promise.resolve({ data: [{ organism_group: 'Klebsiella spp.', tested: 10, resistant: 4 }], error: null })
          if (name === 'analysis_microbiology_findings') return Promise.resolve({ data: [], error: null })
          if (name === 'platform_report_summary') return Promise.resolve({ data: { antimicrobial: { total: 5, pending: 1, administrations: 3 } }, error: null })
          return Promise.reject(new Error(`unexpected rpc ${name}`))
        },
        from: table => {
          if (table === 'departments') return builder([])
          if (table === 'organizations') return builder([{ id: 'org-1', name: 'Demo Hospital' }])
          throw new Error(`unexpected table ${table}`)
        },
      },
    }))
    const { loadAnalysisSnapshot } = await import('../src/features/platform/platformService')
    const snapshot = await loadAnalysisSnapshot({ organizationId: 'org-1', from: '2026-01-01', to: '2026-12-31' })

    expect(calls).toContain('analysis_amr_susceptibility')
    expect(snapshot.amrSusceptibility).toEqual([['Klebsiella spp.', 10, 4]])
    expect(snapshot.summary.antimicrobial).toEqual({ total: 5, pending: 1, administrations: 3 })
  })
})
