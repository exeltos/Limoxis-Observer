import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { numericRows, SERIES_COLORS } from '../src/features/analysis/AnalysisCharts'

describe('analysis charts', () => {
  it('numericRows keeps non-negative numeric values and parses "resistant/tested" pairs', () => {
    expect(numericRows([['A', 3], ['B', '—'], ['C', '2/5'], ['D', -1]])).toEqual([['A', 3], ['C', 2]])
  })

  it('uses the validated categorical order and a single hue for magnitude bars', () => {
    expect(SERIES_COLORS.slice(0, 3)).toEqual(['#2a78d6', '#eb6834', '#1baf7a'])
    const page = fs.readFileSync('src/features/analysis/AnalysisPage.jsx', 'utf8')
    expect(page).toContain('<DonutChart')
    expect(page).toContain('<TrendChart')
    expect(page).not.toContain('const COLORS=')
  })

  it('shows Greek chrome instead of English labels', () => {
    const page = fs.readFileSync('src/features/analysis/AnalysisPage.jsx', 'utf8')
    expect(page).toContain("tx('ΑΝΑΛΥΣΗ & ΑΝΑΦΟΡΕΣ','ANALYTICS & REPORTING')")
    expect(page).not.toContain('analytics workspace.\',')
  })
})
