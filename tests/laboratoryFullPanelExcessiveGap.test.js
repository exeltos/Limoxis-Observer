import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

// User-reported: the read-only "Result & organism" card (and every other
// .clinical-panel.full-panel card in a Laboratory record) showed a large,
// pointless empty gap below its content before the next card. Root cause:
// the shared .full-panel class (core.css) forces min-height:390px — a
// balanced-2-column-grid convention from the shared clinical record
// layout — but Laboratory's redesign stacks full-width cards that size to
// their own content, so a short card (a handful of detail fields, or an
// isolate with no AST rows yet) was stretched to a fixed 390px regardless
// of how little it actually contained.
describe('Laboratory record cards size to their content instead of a fixed 390px minimum', () => {
  it('overrides .clinical-panel.full-panel min-height back to 0 within the laboratory record shell', () => {
    const css = fs.readFileSync('src/features/laboratory/LaboratorySampleRecord.css', 'utf8')
    expect(css).toContain('.laboratory-record-shell .clinical-panel.full-panel{max-width:none;min-height:0}')
  })
})
