import { demoSurveillanceList } from '../src/features/surveillance/clinicalDemoData'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { collectAnalysisDemoSnapshot } from '../src/features/analysis/analysisDemoSnapshot'
import { collectIndicatorMetrics } from '../src/features/indicators/indicatorEngine'
import { surveillanceDemoData } from '../src/features/surveillance/surveillanceDemoData'
import { clinicalCases } from '../src/features/surveillance/clinicalDemoData'
import { laboratorySamples } from '../src/features/laboratory/laboratoryDemoData'
import { preventionDepartments } from '../src/features/prevention/preventionDemoData'
import { loadHandHygieneLocal, loadWasteLocal, loadBundlesLocal, loadAntisepticLocal, saveHandHygieneLocal } from '../src/features/prevention/preventionStore'
import { loadQualityLocal } from '../src/features/quality/qualityStore'
import { loadControlExecutionsLocal, loadControlAssignmentsLocal } from '../src/features/controls/controlStore'
import { loadOccupationalVisits } from '../src/features/employees/employeeRecordsService'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'
import { readAnalysisPageSource } from './helpers/analysisPageSource'

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
    expect(snapshot.summary.surveillance).toBe(demoSurveillanceList().length)
    expect(snapshot.summary.surveillance).toBeGreaterThanOrEqual(surveillanceDemoData.length)
    expect(snapshot.summary.laboratory).toBe(laboratorySamples.length)
    expect(snapshot.summary.handHygiene).toBe(loadHandHygieneLocal().length)
    expect(snapshot.summary.waste).toBe(loadWasteLocal().length)
    expect(snapshot.summary.prevention).toBe(loadHandHygieneLocal().length + loadWasteLocal().length + loadBundlesLocal().length + loadAntisepticLocal().length)
    expect(snapshot.summary.controls).toBe(loadControlExecutionsLocal().length + loadControlAssignmentsLocal().length)
    expect(snapshot.summary.quality).toBe(loadQualityLocal('incidents').length + loadQualityLocal('findings').length + loadQualityLocal('capas').length)
    expect(snapshot.summary.occupationalHealth).toBe(loadOccupationalVisits().length)
  })

  // Regression flagged by an automated PR review: Prevention/Controls/
  // Quality/Employees persist user edits through preventionStore/
  // controlStore/qualityStore/employeeRecordsService (localStorage-backed
  // loadSnapshot wrappers around the seed), not by mutating the imported
  // seed arrays in place. Reading the raw seed exports directly would keep
  // reporting the original fixture length forever, even after a save.
  it('reflects a persisted edit made through the same store the Prevention screen saves through', () => {
    const before = collectAnalysisDemoSnapshot().summary.handHygiene
    const rows = loadHandHygieneLocal()
    saveHandHygieneLocal([...rows, { ...rows[0], id: 'HH-EXTRA-TEST-ROW' }])
    expect(collectAnalysisDemoSnapshot().summary.handHygiene).toBe(before + 1)
  })

  it('lists the full department catalogue for the scope filter, independent of which departments have a positive culture', () => {
    const snapshot = collectAnalysisDemoSnapshot()
    expect(snapshot.microbiology.departments).toHaveLength(preventionDepartments.length)
    expect(snapshot.microbiology.departments.map(d => d.name)).toEqual(preventionDepartments.map(d => d.el))
  })

  it('derives the antimicrobial total from the same live clinicalCases record store the Surveillance UI mutates in place, counting both approvalStatus (new therapies) and the legacy approved flag (seed therapies) for pending', () => {
    const therapies = Object.values(clinicalCases).flatMap(record => record.therapy || [])
    const snapshot = collectAnalysisDemoSnapshot()
    expect(snapshot.summary.antimicrobial.total).toBe(therapies.length)
    expect(snapshot.summary.antimicrobial.pending).toBe(therapies.filter(x => x.approvalStatus === 'pending' || x.approved === false).length)
    expect(snapshot.summary.antimicrobial.administrations).toBe(therapies.flatMap(x => x.administrations || []).filter(a => a.status === 'administered').length)
  })

  // Regression: a therapy added at runtime (clinicalRepository.js's
  // addTherapy) uses `approvalStatus`, not the seed's legacy `approved`
  // boolean; a therapy administration is appended into that same therapy's
  // `administrations` array with a `status`. Both must be picked up.
  it('counts a pending therapy added through the live record store and an administration recorded against it', () => {
    const caseId = Object.keys(clinicalCases)[0]
    const before = collectAnalysisDemoSnapshot().summary.antimicrobial
    try {
      clinicalCases[caseId].therapy.unshift({ id: 'TX-TEST-PENDING', antimicrobial: 'Test drug', approvalStatus: 'pending', administrations: [] })
      const afterPending = collectAnalysisDemoSnapshot().summary.antimicrobial
      expect(afterPending.total).toBe(before.total + 1)
      expect(afterPending.pending).toBe(before.pending + 1)
      clinicalCases[caseId].therapy[0].administrations.push({ id: 'ADM-TEST', status: 'administered' })
      expect(collectAnalysisDemoSnapshot().summary.antimicrobial.administrations).toBe(before.administrations + 1)
    } finally {
      clinicalCases[caseId].therapy = clinicalCases[caseId].therapy.filter(x => x.id !== 'TX-TEST-PENDING')
    }
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

// Regression flagged by an automated PR review: with no second demo period
// to compare against, a still-interactive "Compare year" control would let a
// demo user pick a year and see nothing happen (yearRows is always empty in
// demo — see the previousDemoRows removal). Hiding the whole comparison
// filter group in demo mode is the honest alternative to a no-op control.
describe('the year/hospital comparison filter group is hidden in demo mode', () => {
  it('wraps the comparison filter section content in a !isDemo check', () => {
    const page = readAnalysisPageSource()
    expect(page).toContain('className={`analysis-filter-group analysis-filter-compare${isDemo?\' analysis-filter-group-placeholder\':\'\'}`}>{!isDemo&&<>')
  })
})
