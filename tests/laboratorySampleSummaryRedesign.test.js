import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

// User-reported: the Sample "Summary" tab was one flat 11-field grid with
// no grouping, and duplicated the Result/Organism/AMR classification
// fields that the "Microbiology result" tab already owns in full detail.
// Split into two purposeful, non-overlapping cards (sample identity/
// origin, and timeline/priority) and dropped the duplicated clinical
// fields entirely — that data now lives exclusively on the result tab.
describe('the laboratory Summary tab no longer duplicates the Microbiology result tab', () => {
  const jsx = fs.readFileSync('src/features/laboratory/LaboratorySampleSummary.jsx', 'utf8')

  it('groups sample fields into two cards instead of one flat grid', () => {
    expect(jsx).toContain('lab-summary-card')
    expect((jsx.match(/lab-record-card lab-summary-card/g) || []).length).toBe(2)
  })

  it('no longer renders the Result/Organism/AMR classification fields (owned by the Microbiology result tab)', () => {
    expect(jsx).not.toMatch(/id:\s*'result'/)
    expect(jsx).not.toMatch(/id:\s*'organism'/)
    expect(jsx).not.toMatch(/id:\s*'resistance'/)
  })
})
