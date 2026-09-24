import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

// User-reported: the Laboratory record did not follow the rest of the app.
// Prevention, Quality and Controls put each card's actions behind a ⋯ menu
// in the card header, while Laboratory mixed loose buttons, single-item
// menus and six sparse tabs. The record is now four tabs (Sample, Result,
// Attachments, History), each card carries its own ⋯ menu, and a workflow
// card on the Sample tab walks the user through the next required step.
// Earlier requirements that still hold are kept here: no duplicated result
// fields in the sample card, modal editing, full-width organism / AMR
// fields, the read-back checkbox beside its label, and cards that size to
// their content.
const jsx = fs.readFileSync('src/features/laboratory/LaboratorySampleRecordFunctionalView.jsx', 'utf8')
const summary = fs.readFileSync('src/features/laboratory/LaboratorySampleSummary.jsx', 'utf8')
const css = fs.readFileSync('src/features/laboratory/LaboratorySampleRecord.css', 'utf8')

describe('laboratory record follows the app-wide card + ⋯ menu pattern', () => {
  it('uses four tabs instead of six', () => {
    expect(jsx).toMatch(/const tabs=useMemo\(\(\)=>\[\{id:'sample'.*\{id:'result'.*\{id:'attachments'.*\{id:'history'/)
    const tabs = jsx.match(/const tabs=useMemo\(\(\)=>\[(.*?)\],\[/)[1]
    expect(tabs.match(/\{id:'/g)).toHaveLength(4)
  })

  it('puts sample, result, isolate and communication actions behind ⋯ menus', () => {
    expect(jsx).toContain('menu={<OverflowMenu items={sampleMenu}/>}')
    expect(jsx).toMatch(/<ResultCard[^>]*menu=\{<OverflowMenu items=\{\[/)
    expect(jsx).toContain("{canManageActive&&<OverflowMenu items={[{id:'add-ast'")
    expect(jsx).toContain("<OverflowMenu items={[{id:'add-communication'")
  })

  it('moves print / export into the sample menu, since the record shell drops non edit/delete header actions', () => {
    expect(jsx).toContain("{id:'print',label:tx('print')")
    expect(jsx).toContain("{id:'export',label:tx('export')")
    expect(jsx).not.toContain('headerActions=')
  })

  it('shows a guided workflow with the next step as the primary action', () => {
    expect(summary).toContain('export function LaboratoryWorkflow')
    expect(summary).toContain('lab-workflow-next')
    for (const id of ['receive', 'result', 'ast', 'communication', 'documents', 'finalize']) expect(jsx).toContain(`{id:'${id}',label:tx('step`)
  })

  it('keeps the sample card free of result/organism/AMR fields', () => {
    expect(summary).not.toMatch(/id:\s*'result'/)
    expect(summary).not.toMatch(/id:\s*'organism'/)
    expect(summary).not.toMatch(/id:\s*'resistance'/)
  })

  it('edits results, AST, AMR and communications in the shared ObserverDialog', () => {
    for (const name of ['ResultDialog', 'AstDialog', 'AmrDialog', 'CommunicationDialog']) {
      expect(jsx).toMatch(new RegExp(`function ${name}\\([^)]*\\)\\{[\\s\\S]*?<ObserverDialog`))
    }
    expect(jsx).not.toContain('function SimpleDialog')
  })

  it('never shows a real AMR classification with the green success tone', () => {
    expect(jsx).toContain('{current&&<span className="status-badge danger">{current.classification}</span>}')
  })

  it('lays out dialogs with full-width organism / AMR / notes rows and an inline read-back checkbox', () => {
    expect(jsx).toContain('{draft.result===\'positive\'&&<div className="lab-dialog-span">')
    expect(jsx).toContain('<label className="lab-dialog-span"><span>{tx(\'classification\')} *</span>')
    expect(jsx).toContain('<label className="lab-dialog-span"><span>{tx(\'notes\')}</span><input value={draft.notes}')
    expect(css).toMatch(/\.lab-dialog-form>label\.lab-dialog-check\{[^}]*flex-direction:row!important/)
  })

  it('does not reintroduce the fixed-height clinical-panel/full-panel cards', () => {
    expect(jsx).not.toContain('full-panel')
    expect(summary).not.toContain('full-panel')
  })

  it('requires an organism before a positive result can be validated', () => {
    expect(jsx).toContain("const needsOrganism=!isEnvironmental&&draft.result==='positive'&&!draft.organisms.length")
    expect(jsx).toContain('disabled={!complete||needsOrganism}')
  })
})
