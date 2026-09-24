import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

// User-reported: the top-right "..." overflow menus on the Microbiology
// result and AST/AMR card headers were excessive for a single action, and
// editing the result inline (replacing the card's read-only content in
// place) got visually cramped/overlapping with the AST card below it.
// Replaced the single-action overflow menus with a plain visible button,
// and moved the result editor into a modal (matching the AMR/AST/
// communication dialogs already used elsewhere on this page) instead of
// an inline in-place edit.
describe('the Microbiology result edit opens as a modal, and single-action menus are plain buttons', () => {
  const jsx = fs.readFileSync('src/features/laboratory/LaboratorySampleRecordFunctionalView.jsx', 'utf8')

  it('renders the result edit form inside a modal-backdrop instead of replacing the card content in place', () => {
    expect(jsx).toMatch(/\{editing&&<div className="modal-backdrop"><div className="entry-card">/)
  })

  it('keeps the read-only summary grid visible behind the edit modal instead of hiding it while editing', () => {
    expect(jsx).not.toMatch(/\{editing\?<>.*:<div className="lab-result-summary-grid">/)
  })

  it('uses a plain button instead of a single-item overflow menu for the result edit/add action', () => {
    expect(jsx).toContain("canManage&&!editing&&<Button type=\"button\" variant=\"secondary\" onClick={finalized?onCorrection:()=>setEditing(true)}>")
    expect(jsx).not.toMatch(/lab-result-hero.*OverflowMenu items=\{\[\{id:'edit-result'/)
  })

  it('uses a plain button instead of a single-item overflow menu for the "new AST" action', () => {
    expect(jsx).toContain('action={!locked?<Button type="button" variant="secondary" onClick={onAdd}>')
    expect(jsx).not.toMatch(/title=\{language==='el'\?'Αντιβιόγραμμα και AMR'.*OverflowMenu items=\{\[\{id:'add-ast'/)
  })
})
