import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'

const migration = fs.readFileSync('supabase/migrations/20260919310000_share_microbiology_finding_definition_with_analysis.sql', 'utf8')

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
  const b = {
    select() { return b },
    eq() { return b },
    order() { return b },
    then(resolve) { resolve({ data, error: null }) },
  }
  return b
}

vi.mock('../src/core/config/env', () => ({ hasSupabaseConfig: true }))

// Regression for the Analysis-page audit's P1 architecture finding: the
// page had a fully independent calculation pipeline from the indicator
// engine and so reproduced bugs already fixed there (draft/superseded
// microbiology results counted, amr_classifications overrides ignored).
// Fix: a single shared function, analysis_microbiology_findings, now backs
// loadMicrobiologyAnalytics instead of an ad-hoc client-side query.
describe('analysis_microbiology_findings shares its predicate with indicator_metric_snapshot', () => {
  it('excludes drafts and superseded results, matching the indicator engine verbatim', () => {
    expect(migration).toContain("m.validation_status in ('validated', 'amended')")
    expect(migration).toContain('m2.amended_from = m.id')
  })

  it('resolves the effective resistance classification via amr_classifications, matching the indicator engine verbatim', () => {
    expect(migration).toContain("a.status <> 'rejected'")
    expect(migration).toContain("upper(coalesce(a.classification, '')) in ('MDR', 'XDR', 'PDR')")
  })

  it('is not security definer — access control stays entirely in RLS, unlike platform_report_summary', () => {
    const sql = migration.split('\n').filter(line => !line.trim().startsWith('--')).join('\n')
    expect(sql).not.toContain('security definer')
  })
})

describe('loadMicrobiologyAnalytics (via loadAnalysisSnapshot)', () => {
  let calls
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage())
    vi.resetModules()
    calls = []
  })
  afterEach(() => vi.doUnmock('../src/core/supabase/client'))

  it('calls analysis_microbiology_findings (never a raw microbiology_results select) and aggregates its rows', async () => {
    const findings = [
      { organization_id: 'org-1', microbiology_result_id: 'm1', organism: 'Klebsiella pneumoniae', resistance_class: 'MDR', is_critical: true, department_id: 'd1', department_name: 'ΜΕΘ', source: 'Αίμα', sample_type: 'blood', event_date: '2026-03-15' },
      { organization_id: 'org-1', microbiology_result_id: 'm2', organism: 'Escherichia coli', resistance_class: null, is_critical: false, department_id: 'd1', department_name: 'ΜΕΘ', source: 'Ούρα', sample_type: 'urine', event_date: '2026-04-02' },
    ]
    vi.doMock('../src/core/supabase/client', () => ({
      supabase: {
        rpc: (name, payload) => {
          calls.push([name, payload])
          if (name === 'analysis_microbiology_findings') return Promise.resolve({ data: findings, error: null })
          if (name === 'platform_report_summary') return Promise.resolve({ data: {}, error: null })
          return Promise.reject(new Error(`unexpected rpc ${name}`))
        },
        from: table => {
          if (table === 'departments') return builder([{ id: 'd1', organization_id: 'org-1', name: 'ΜΕΘ' }])
          if (table === 'organizations') return builder([{ id: 'org-1', name: 'Demo Hospital' }])
          throw new Error(`unexpected table ${table}`)
        },
      },
    }))
    const { loadAnalysisSnapshot } = await import('../src/features/platform/platformService')
    const snapshot = await loadAnalysisSnapshot({ organizationId: 'org-1', from: '2026-01-01', to: '2026-12-31' })

    expect(calls.some(([name]) => name === 'analysis_microbiology_findings')).toBe(true)
    expect(snapshot.microbiology.totalPositive).toBe(2)
    expect(snapshot.microbiology.totalCritical).toBe(1)
    expect(snapshot.microbiology.resistance).toEqual([['MDR', 1]])
    // Regression: the merged row shape renamed the event-date field from
    // `resulted_at` to `eventDate`; grouping by the old name would silently
    // drop every finding from the monthly trend instead of erroring.
    expect(snapshot.microbiology.monthly).toEqual([['2026-03', 1], ['2026-04', 1]])
  })
})
