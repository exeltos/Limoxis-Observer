// Owner, 19/11/2026: the search clears with its own ×, the NICU late-onset indicator shows «Πιθανές» beside the
// confirmed ones, the patients list shows every patient's latest organism, and the laboratory report counts the
// positive patients per 1,000 patient days of the library.
import { describe, expect, it } from 'vitest'
import { infectionDocument } from '../src/features/surveillance/infectionReport'
import { buildReportHtml } from '../src/core/export/reportDocument'
import { demoLateInfectionCandidates } from '../src/features/registers/registerService'
import { infectionFlagsFromCases } from '../src/features/patients/patientInfectionFlagsService'
import { readSource } from './helpers/readSource'
import type { InfectionItem } from '../src/features/surveillance/infectionReport'
import type { RegisterEntry } from '../src/features/registers/registerTypes'

describe('search clear ×', () => {
  it('the shared search shows an × while it has text, and the × clears and refocuses it', () => {
    const bar = readSource('src/design-system/FilterBar.tsx')
    expect(bar).toContain("{query&&<button type=\"button\" className=\"filter-search-clear\" aria-label={t('clearSearch')}")
    expect(bar).toContain("onQueryChange('');searchRef.current?.focus()")
    expect(readSource('src/core/i18n/stringsEl.ts')).toContain("clearSearch:'Καθαρισμός αναζήτησης'")
    expect(readSource('src/core/i18n/stringsEn.ts')).toContain("clearSearch:'Clear search'")
  })
})

describe('NICU late-onset infections: «Πιθανές» and «Επιβεβαιωμένες»', () => {
  const entry = (id: string, values: Record<string, unknown>): RegisterEntry => ({ id, registerId: 'r', entryDate: '2026-10-01', values } as unknown as RegisterEntry)
  it('the demo has confirmed and waiting blood cultures', () => {
    const entries = Array.from({ length: 14 }, (_, k) => entry(`e${k}`, { central_line_days: 5, late_infection: k === 0 }))
    const rows = demoLateInfectionCandidates(entries)
    expect(rows.find(row => row.entryId === 'e0')?.decision).toBe('confirmed')
    expect(rows.filter(row => row.decision === null).length).toBeGreaterThan(0)
  })
  it('the page passes the not rejected candidates and the indicators show them as «Πιθανές»', () => {
    const page = readSource('src/features/registers/RegisterRecordPage.tsx')
    expect(page).toContain("setLatePossible(new Set(rows.filter(row => row.decision !== 'rejected').map(row => row.entryId)))")
    const indicators = readSource('src/features/registers/RegisterIndicators.tsx')
    expect(indicators).toContain("ids.has(entry.id) ? { ...entry, values: { ...entry.values, late_infection: true } } : entry")
    expect(indicators).toContain("${en ? 'Possible' : 'Πιθανές'}")
  })
})

describe('patients list: the latest organism', () => {
  it('shows a non-resistant organism too', () => {
    const flags = infectionFlagsFromCases([{ status: 'active', patientId: 'P1', organism: 'Escherichia coli', startedAt: '2026-10-01' }])
    expect(flags.P1.organism?.name).toBe('Escherichia coli')
    expect(flags.P1.resistance).toBeNull()
  })
  it('reads every patient’s latest organism with its own invoker function', () => {
    const sql = readSource('supabase/migrations/20261231598000_patient_infection_flags_latest_organism.sql')
    expect(sql).toContain('create or replace function public.patient_latest_organisms(p_organization_id uuid)')
    expect(sql).toContain('security invoker')
    expect(sql).not.toContain('security definer')
    expect(sql).toContain('revoke all on function public.patient_latest_organisms(uuid) from public, anon;')
    expect(sql).toContain('where s.organization_id = p_organization_id')
    expect(readSource('src/features/patients/patientInfectionFlagsService.ts')).toContain("rpc('patient_latest_organisms'")
  })
})

describe('laboratory report: positive patients per 1,000 patient days', () => {
  const item = (id: string, patientKey: string): InfectionItem => ({ id, code: id, date: '2026-10-05', department: 'ΜΕΝΝ', organism: 'Klebsiella pneumoniae', group: 'Αίμα', patientKey, positives: 1 })
  it('counts each positive patient once, on the library patient days', () => {
    const items = [item('1', 'a'), item('2', 'a'), item('3', 'b')]
    const html = buildReportHtml(infectionDocument({ source: 'laboratory', items, period: { from: '2026-10-01', to: '2026-10-31' }, patientDays: [{ from: '2026-10-01', to: '2026-10-31', value: 1000 }] }))
    expect(html).toContain('Θετικοί ασθενείς ανά 1.000 κλινοημέρες')
    // Two patients over 1,000 days: 2 per 1,000.
    expect(html).toMatch(/Θετικοί ασθενείς ανά 1\.000 κλινοημέρες[\s\S]{0,400}>2</)
    const partial = buildReportHtml(infectionDocument({ source: 'laboratory', items, period: { from: '2026-10-01', to: '2026-11-30' }, patientDays: [{ from: '2026-10-01', to: '2026-10-31', value: 1000 }] }))
    expect(partial).not.toContain('Θετικοί ασθενείς ανά 1.000 κλινοημέρες')
  })
})
