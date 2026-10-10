import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { resultDraftChecks } from '../src/features/laboratory/laboratorySampleProgress'
import { readLaboratorySampleRecordSource } from './helpers/laboratorySampleRecordSource'

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
const jsx = readLaboratorySampleRecordSource()
const summary = fs.readFileSync('src/features/laboratory/LaboratorySampleSummary.jsx', 'utf8')
const css = fs.readFileSync('src/features/laboratory/LaboratorySampleRecord.css', 'utf8')

describe('laboratory record follows the app-wide card + ⋯ menu pattern', () => {
  it('shows a guided workflow with the next step as the primary action', () => {
    expect(summary).toContain('export function LaboratoryWorkflow')
    expect(summary).toContain('lab-workflow-next')
  })

  it('keeps the sample card free of result/organism/AMR fields', () => {
    expect(summary).not.toMatch(/id:\s*'result'/)
    expect(summary).not.toMatch(/id:\s*'organism'/)
    expect(summary).not.toMatch(/id:\s*'resistance'/)
  })

  it('lays out dialogs with full-width organism / AMR / notes rows and an inline read-back checkbox', () => {
    expect(css).toMatch(/\.lab-dialog-form>label\.lab-dialog-check\{[^}]*flex-direction:row!important/)
  })

  it('does not reintroduce the fixed-height clinical-panel/full-panel cards', () => {
    expect(jsx).not.toContain('full-panel')
    expect(summary).not.toContain('full-panel')
  })

  it('requires an organism before a positive result can be validated', () => {
    expect(resultDraftChecks({ result: 'positive', organisms: [], cfuCount: '' }, false)).toEqual({ complete: true, needsOrganism: true })
    expect(resultDraftChecks({ result: 'positive', organisms: ['E. coli'], cfuCount: '' }, false).needsOrganism).toBe(false)
    expect(resultDraftChecks({ result: 'positive', organisms: [], cfuCount: '' }, true).needsOrganism).toBe(false)
  })
})
