import { describe, expect, it } from 'vitest'
import { brandBandHtml } from '../src/design-system/printElement'
import { readSource } from './helpers/readSource'

// A printed screen carries the hospital band of the printed reports (owner, 2/11/2026).
describe('brand band of printed screens', () => {
  const now = new Date('2026-11-02T13:37:00Z')
  it('shows the logo, the hospital, its report header line and the date printed', () => {
    const html = brandBandHtml({ name: 'ΙΑΣΩ Θεσσαλίας', logo: 'data:image/png;base64,AAA', reportHeader: 'Γραφείο Λοιμώξεων' }, { language: 'el', now })
    expect(html).toContain('<img src="data:image/png;base64,AAA"')
    expect(html).toContain('ΙΑΣΩ Θεσσαλίας')
    expect(html).toContain('Γραφείο Λοιμώξεων')
    expect(html).toContain('Εκτύπωση 02/11/2026')
    expect(html).not.toContain('DEMO')
  })
  it('marks a Demo and leaves out an empty identity', () => {
    expect(brandBandHtml({ name: 'Demo Hospital', demo: true }, { now })).toContain('DEMO · Συνθετικά δεδομένα')
    expect(brandBandHtml({ name: '', logo: '', reportHeader: '' }, { now })).toBe('')
  })
  it('is on the Analysis print and the hospital overview print', () => {
    expect(readSource('src/features/analysis/AnalysisPage.jsx')).toContain("brandBandHtml(undefined,{language:print.en?'en':'el'})+report.outerHTML")
    expect(readSource('src/features/executive/ExecutiveDashboardPage.jsx')).toContain('heading:[`${title} · ${tabTitle}`,periodLine]')
  })
})

// A list with many columns (the legislation) is dense, so it fits the page (owner, 2/11/2026).
describe('wide tables of the printed documents', () => {
  it('make a table of 11 columns or more dense, a narrower one not', async () => {
    const { reportTableHtml } = await import('../src/core/export/reportDocument')
    const row = n => Array.from({ length: n }, (_, i) => `c${i}`)
    expect(reportTableHtml({ columns: row(17), rows: [row(17)] })).toContain('class="rd-table rd-dense"')
    expect(reportTableHtml({ columns: row(10), rows: [row(10)] })).toContain('class="rd-table"')
  })
})
