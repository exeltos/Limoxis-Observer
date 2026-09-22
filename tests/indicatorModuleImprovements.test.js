import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { INDICATOR_METRICS } from '../src/features/indicators/indicatorDefinitionService.js'
import { indicatorMetricLabel, metricLabels } from '../src/features/indicators/IndicatorDefinitionForm.jsx'

const coreCss = fs.readFileSync('src/styles/core.css', 'utf8')

describe('indicator metric labels: every metric has a real bilingual label', () => {
  it('covers all INDICATOR_METRICS with a distinct Greek and English label (not the raw key)', () => {
    const missing = INDICATOR_METRICS.filter((key) => !metricLabels[key])
    expect(missing).toEqual([])
  })

  it('never falls back to the raw snake_case key for either language', () => {
    const rawFallbacks = INDICATOR_METRICS.filter((key) => indicatorMetricLabel(key, 'el') === key || indicatorMetricLabel(key, 'en') === key)
    expect(rawFallbacks).toEqual([])
  })

  it('translates organism-specific metrics like bacteremia and AMR isolates', () => {
    expect(indicatorMetricLabel('bacteremia_ecoli', 'el')).toBe('Βακτηριαιμίες από E. coli')
    expect(indicatorMetricLabel('bacteremia_ecoli', 'en')).toBe('E. coli bacteremia')
    expect(indicatorMetricLabel('amr_resistant_klebsiella', 'el')).toContain('Klebsiella')
    expect(indicatorMetricLabel('mdr_isolation_saureus', 'en')).toContain('S. aureus')
  })
})

describe('indicator definition form: compact 3-column layout', () => {
  it('packs the entry-grid into 3 columns for both create and record forms', () => {
    expect(coreCss).toContain('.indicator-create-form .entry-grid,\n.indicator-record-form .entry-grid{\n  grid-template-columns:repeat(3,minmax(0,1fr))!important;')
  })

  it('keeps title, definitions and validation notes full-width', () => {
    expect(coreCss).toContain('.indicator-create-form .entry-grid .entry-span-2,\n.indicator-record-form .entry-grid .entry-span-2{\n  grid-column:1 / -1!important;\n}')
  })
})
