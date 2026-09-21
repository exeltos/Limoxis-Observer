import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collectDemoOrganismClusters, loadActiveClustersAsync } from '../src/features/surveillance/outbreakClusterService'
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

describe('outbreak/cluster detection demo data', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage())
    configureDataEnvironment({ mode: 'demo', organizationId: 'demo-hospital', demoAccountId: 'demo-user-1' })
  })

  it('detects the seeded ICU Klebsiella pneumoniae MDR cluster from demo laboratory data', () => {
    const clusters = collectDemoOrganismClusters()
    const icuKlebsiella = clusters.find(c => c.department === 'ΜΕΘ' && c.organism.includes('Klebsiella'))
    expect(icuKlebsiella).toBeTruthy()
    expect(icuKlebsiella.count).toBeGreaterThanOrEqual(3)
    expect(icuKlebsiella.resistanceLabels).toContain('MDR')
  })

  it('routes through the same demo path via loadActiveClustersAsync', async () => {
    const clusters = await loadActiveClustersAsync('demo-hospital')
    expect(clusters.some(c => c.department === 'ΜΕΘ' && c.organism.includes('Klebsiella'))).toBe(true)
  })
})
