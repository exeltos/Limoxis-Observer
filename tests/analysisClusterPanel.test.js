import { describe, expect, it, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import { collectAnalysisDemoSnapshot } from '../src/features/analysis/analysisDemoSnapshot'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'

function storage() {
  const values = new Map()
  return {
    get length() { return values.size },
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    key: index => [...values.keys()][index] ?? null,
    values,
  }
}

describe('Analysis page cluster panel', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage())
    configureDataEnvironment({ mode: 'demo', organizationId: 'demo-hospital', demoAccountId: 'demo-user-1' })
  })

  it('includes the seeded ICU Klebsiella cluster in the demo analysis snapshot', () => {
    const snapshot = collectAnalysisDemoSnapshot()
    expect(Array.isArray(snapshot.clusters)).toBe(true)
    expect(snapshot.clusters.some(c => c.department === 'ΜΕΘ' && c.organism.includes('Klebsiella'))).toBe(true)
  })

  it('renders a ClusterAlerts panel on the National surveillance tab', () => {
    const page = fs.readFileSync(new URL('../src/features/analysis/AnalysisPage.jsx', import.meta.url), 'utf8')
    expect(page).toContain('function ClusterAlerts(')
    expect(page).toContain('<ClusterAlerts clusters={clusters} tx={tx}/>')
    expect(page).toContain('<NationalSurveillance details={micro} clusters={clusters} tx={tx}/>')
  })

  it('plumbs clusters through the production analysis snapshot service', () => {
    const service = fs.readFileSync(new URL('../src/features/platform/platformService.js', import.meta.url), 'utf8')
    expect(service).toContain('loadActiveClustersAsync')
    expect(service).toContain('clusters')
  })
})
