import { beforeEach, describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import { collectAnalysisDemoSnapshot } from '../src/features/analysis/analysisDemoSnapshot'
import { laboratorySamples } from '../src/features/laboratory/laboratoryDemoData'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'

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

beforeEach(() => {
  vi.stubGlobal('localStorage', storage())
  configureDataEnvironment({ mode: 'demo', organizationId: 'demo-hospital', demoAccountId: 'demo-user-1' })
})

// User-reported gap: platformService.js's loadMicrobiologyAnalytics already
// computed `nationalRows` — one line per distinct (organism, resistance,
// department, source) combination, i.e. exactly "which microbe, in which
// department, from which specimen" — but AnalysisPage.jsx never rendered it
// anywhere. The National tab only showed three independent one-dimensional
// breakdowns (organisms overall, resistance overall, source overall) that
// can't be cross-referenced, and the AMR tab showed an unrelated generic
// trend/department chart instead of anything resistance-specific.
describe('the National and AMR tabs render the organism/department/source line list instead of only one-dimensional summaries', () => {
  const page = fs.readFileSync('src/features/analysis/AnalysisPage.jsx', 'utf8')

  it('AnalysisPage defines a NationalRowsTable and renders it on the National tab', () => {
    expect(page).toContain('function NationalRowsTable(')
    expect(page).toContain('details?.nationalRows')
  })

  it('the AMR tab shows only the resistant (MDR/XDR/PDR) subset of the same line list, not the generic microbiology distribution', () => {
    expect(page).toContain('function AmrRegister(')
    expect(page).toContain("['MDR','XDR','PDR'].includes(resistanceClass)")
    expect(page).toContain("tab==='amr'?<AmrRegister")
  })

  it('the Laboratory tab no longer duplicates the National tab distribution chart (routes through the generic DomainView like other domain tabs)', () => {
    expect(page).not.toContain('MICROBIOLOGY_TABS')
  })
})

describe('collectAnalysisDemoSnapshot computes nationalRows (was previously hardcoded to [])', () => {
  it('produces one row per distinct organism/resistance/department/source/infection-site combination actually present in the demo fixture', () => {
    const snapshot = collectAnalysisDemoSnapshot()
    expect(snapshot.microbiology.nationalRows.length).toBeGreaterThan(0)
    const validPositive = laboratorySamples.filter(x => x.result === 'positive' && ['validated', 'amended'].includes(x.resultStatus))
    const distinctCombinations = new Set(validPositive.map(x => [x.organism?.trim() || '—', x.resistance || '—', x.department, x.source, x.type].join('|||')))
    expect(snapshot.microbiology.nationalRows).toHaveLength(distinctCombinations.size)
  })

  it('each row carries organism, resistance, department, source, a count, a last-recorded date and an infection site (sample type)', () => {
    const snapshot = collectAnalysisDemoSnapshot()
    for (const [organism, resistanceClass, department, source, count, lastDate, sampleType] of snapshot.microbiology.nationalRows) {
      expect(typeof organism).toBe('string')
      expect(typeof resistanceClass).toBe('string')
      expect(typeof department).toBe('string')
      expect(typeof source).toBe('string')
      expect(count).toBeGreaterThan(0)
      expect(lastDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(['bloodCulture', 'urineCulture', 'respiratorySample', 'woundCulture']).toContain(sampleType)
    }
  })

  it('a resistant demo isolate (Klebsiella, MDR, from the fixture) appears in the line list', () => {
    const snapshot = collectAnalysisDemoSnapshot()
    const resistantRows = snapshot.microbiology.nationalRows.filter(([, resistanceClass]) => ['MDR', 'XDR', 'PDR'].includes(resistanceClass))
    expect(resistantRows.length).toBeGreaterThan(0)
  })
})
