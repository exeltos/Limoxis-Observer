import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

// User-reported: the AMR classification and AST susceptibility dialogs had
// an awkward "orphan" field left alone on its own row next to empty space
// (Definition version alone in the AMR dialog; MIC alone in the AST
// dialog), and the read-back confirmation checkbox rendered stacked above
// its label instead of beside it.
describe('the laboratory AMR/AST/critical-communication dialogs have a cleaner field flow', () => {
  const jsx = fs.readFileSync('src/features/laboratory/LaboratorySampleRecordFunctionalView.jsx', 'utf8')
  const css = fs.readFileSync('src/features/laboratory/LaboratorySampleRecord.css', 'utf8')

  it('gives the AMR classification field its own full-width row instead of pairing it arbitrarily with Definition source', () => {
    expect(jsx).toContain('<label className="entry-span-2"><span>{language===\'el\'?\'Κατηγορία\':\'Classification\'}</span>')
  })

  it('exposes the AST notes field (captured in draft state but previously never rendered) so it pairs with MIC instead of leaving it alone on its row', () => {
    expect(jsx).toContain("<label><span>MIC</span><input value={draft.mic} onChange={e=>setDraft(d=>({...d,mic:e.target.value}))}/></label><label><span>{language==='el'?'Σημειώσεις':'Notes'}</span><input value={draft.notes}")
  })

  it('lays the read-back confirmation checkbox out in a row beside its label, overriding the shared column-stacking field rule', () => {
    expect(css).toContain('.entry-grid label.clinical-choice{')
    expect(css).toMatch(/\.entry-grid label\.clinical-choice\{[^}]*flex-direction:row!important/)
  })
})
