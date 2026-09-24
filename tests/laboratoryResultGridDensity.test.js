import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

// User-reported: the microbiology result editor (Result/Organisms/Method/
// Critical) looked sparse compared to the rest of the app — it used a
// 2-column grid for 3-4 short select fields, unlike the read-only view of
// the same data (.patient-detail-grid, 4 columns) or the compact edit
// grids used elsewhere (Quality, Indicators). Widened to 3 columns and
// made the organisms field (which holds its own isolate picker/list, not
// a plain select) span the full row instead of being squeezed into one
// third of it.
describe('the laboratory result editor grid is as dense as the rest of the app', () => {
  const css = fs.readFileSync('src/features/laboratory/LaboratorySampleRecord.css', 'utf8')

  it('uses a 3-column grid instead of the sparse 2-column one', () => {
    expect(css).toContain('.laboratory-record-shell .laboratory-result-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:0 24px}')
  })

  it('the organisms field (with the isolate picker) spans the full row instead of one column', () => {
    expect(css).toContain('.laboratory-record-shell .laboratory-result-grid>.detail-item:has(.laboratory-library-picker){grid-column:1/-1}')
  })
})
