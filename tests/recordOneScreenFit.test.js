import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
// Only the declarations matter here, not whether they carry !important.
const withoutImportant = css => css.replaceAll('!important', '')


// User-reported: the Laboratory sample tab and the Quality incident record
// needed a scrollbar on a normal laptop window (~1500×815) although their
// content is short. Both are compacted to fit one screen, while the record
// body keeps overflow:auto so longer records still scroll (never clip).
const lab = fs.readFileSync('src/features/laboratory/LaboratorySampleRecord.css', 'utf8')
const modules = fs.readFileSync('src/styles/features.css', 'utf8')

describe('Laboratory and Quality records fit one laptop screen', () => {
  it('lays the 12 incident fields out as 4 columns (3 rows) instead of the shared 3-column sheet', () => {
    expect(modules).toMatch(/\.canonical-detail-screen\.record-general-tab-active\.quality-record-shell \.quality-detail-grid[^{]*\{\s*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/)
  })

  it('uses shorter info rows in both records', () => {
    expect(withoutImportant(modules)).toContain('min-height:54px')
    expect(withoutImportant(lab)).toMatch(/laboratory-summary-grid[^{]*>\.detail-item\{min-height:52px/)
  })

  it('keeps the record bodies scrollable as a fallback', () => {
    expect(lab).toMatch(/\.laboratory-record-shell\.workspace-fill>\.entity-record-body\{[^}]*overflow:auto/)
    expect(modules).toMatch(/\.quality-record-shell\.workspace-fill>\.entity-record-body\{[^}]*overflow:auto/)
  })
})
