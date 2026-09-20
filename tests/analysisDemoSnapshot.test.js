import { beforeEach, describe, it, expect, vi } from 'vitest'
import { collectAnalysisDemoSnapshot } from '../src/features/analysis/analysisDemoSnapshot'
import { collectIndicatorMetrics } from '../src/features/indicators/indicatorEngine'
import { surveillanceDemoData } from '../src/features/surveillance/surveillanceDemoData'
import { clinicalCases } from '../src/features/surveillance/clinicalDemoData'
import { laboratorySamples } from '../src/features/laboratory/laboratoryDemoData'
import { handHygieneRows, bundleRows, wasteRows } from '../src/features/prevention/preventionDemoData'
import { qualityIncidents, qualityFindings, qualityCapas } from '../src/features/quality/qualityDemoData'
import { controlExecutionRows } from '../src/features/controls/controlDemoData'
import { occupationalVisits } from '../src/features/employees/employeeDemoData'
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

// Analysis-page audit finding (P2): the Analysis page's demo mode used to
// render entirely hardcoded DEMO_KPI/DEMO_TRENDS/DEMO_MICROBIOLOGY
// constants, disconnected from every other demo-mode screen in the app.
// collectAnalysisDemoSnapshot() must instead compute its numbers from the
// same fixtures those other screens (and the Indicators page's own demo
// mode, collectIndicatorMetrics()) already read.
describe('collectAnalysisDemoSnapshot computes from the same demo fixtures every other demo screen uses', () => {
  it('sums summary fields from their real demo fixtures instead of hardcoding a number', () => {
    const snapshot = collectAnalysisDemoSnapshot()
    expect(snapshot.summary.surveillance).toBe(surveillanceDemoData.length)
    expect(snapshot.summary.laboratory).toBe(laboratorySamples.length)
    expect(snapshot.summary.handHygiene).toBe(handHygieneRows.length)
    expect(snapshot.summary.waste).toBe(wasteRows.length)
    expect(snapshot.summary.prevention).toBe(handHygieneRows.length + wasteRows.length + bundleRows.length)
    expect(snapshot.summary.controls).toBe(controlExecutionRows.length)
    expect(snapshot.summary.quality).toBe(qualityIncidents.length + qualityFindings.length + qualityCapas.length)
    expect(snapshot.summary.occupationalHealth).toBe(occupationalVisits.length)
  })

  it('derives the antimicrobial total/pending breakdown from the same therapy plans Surveillance renders, with administrations honestly 0 (no demo fixture models per-dose administration)', () => {
    const therapies = Object.values(clinicalCases).flatMap(record => record.therapy || [])
    const snapshot = collectAnalysisDemoSnapshot()
    expect(snapshot.summary.antimicrobial.total).toBe(therapies.length)
    expect(snapshot.summary.antimicrobial.pending).toBe(therapies.filter(x => x.approved === false).length)
    expect(snapshot.summary.antimicrobial.administrations).toBe(0)
  })

  it('excludes draft results from the microbiology totals, same as analysis_microbiology_findings', () => {
    const snapshot = collectAnalysisDemoSnapshot()
    const draftPositive = laboratorySamples.some(x => x.result === 'positive' && x.resultStatus === 'draft')
    // The fixture includes at least one draft/processing sample; assert the
    // computed total only ever counts validated/amended positives.
    const expectedPositive = laboratorySamples.filter(x => x.result === 'positive' && ['validated', 'amended'].includes(x.resultStatus)).length
    expect(snapshot.microbiology.totalPositive).toBe(expectedPositive)
    if (draftPositive) expect(snapshot.microbiology.totalPositive).toBeLessThan(laboratorySamples.filter(x => x.result === 'positive').length)
  })

  it('agrees with the Indicators page demo engine on AMR tested/resistant counts for every pathogen it reports', () => {
    const analysisAmr = Object.fromEntries(collectAnalysisDemoSnapshot().amrSusceptibility.map(([organism, tested, resistant]) => [organism, { tested, resistant }]))
    const indicatorMetrics = collectIndicatorMetrics()
    const pathogenKeyToLabel = {
      ecoli: 'Escherichia coli', proteus: 'Proteus spp.', acinetobacter: 'Acinetobacter spp.', klebsiella: 'Klebsiella spp.',
      enterobacter: 'Enterobacter spp.', pseudomonas: 'Pseudomonas aeruginosa', saureus: 'Staphylococcus aureus', enterococcus: 'Enterococcus spp.',
    }
    for (const [key, label] of Object.entries(pathogenKeyToLabel)) {
      const tested = indicatorMetrics[`amr_tested_${key}`] || 0
      if (tested === 0) { expect(analysisAmr[label]).toBeUndefined(); continue }
      expect(analysisAmr[label]).toEqual({ tested, resistant: indicatorMetrics[`amr_resistant_${key}`] || 0 })
    }
  })

  it('only reports an organism row when at least one isolate was tested against its reference drug', () => {
    const snapshot = collectAnalysisDemoSnapshot()
    for (const [, tested] of snapshot.amrSusceptibility) expect(tested).toBeGreaterThan(0)
  })
})
