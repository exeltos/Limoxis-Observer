import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { brandBandHtml } from '../src/design-system/printElement.js'

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
    expect(fs.readFileSync('src/features/analysis/AnalysisPage.jsx', 'utf8')).toContain("brandBandHtml(undefined,{language:print.en?'en':'el'})+report.outerHTML")
    expect(fs.readFileSync('src/features/executive/ExecutiveDashboardPage.jsx', 'utf8')).toContain('heading:[`${title} · ${tabTitle}`,periodLine]')
  })
})
