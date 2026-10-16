import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const css=fs.readFileSync('src/styles/design-system.css','utf8')
const form=fs.readFileSync('src/features/controls/ControlExecutionForm.jsx','utf8')
const record=fs.readFileSync('src/features/controls/ControlRecordPage.jsx','utf8')

describe('control record fixed workspace',()=>{
  it('shows details and guidance first, then the departments with their entry',()=>{
    const sheet=record.indexOf("title={en?'Control details':'Στοιχεία ελέγχου'}"),guidance=record.indexOf("id:'instructions'"),departments=record.indexOf('control-record-departments')
    expect(sheet).toBeGreaterThan(0)
    expect(guidance).toBeGreaterThan(sheet)
    expect(departments).toBeGreaterThan(guidance)
    // Many departments: only their table scrolls, inside the record body.
    expect(css).toContain('.control-record-shell .control-record-departments>.scroll-table:is(div,#lo-record-sheet){flex:1;min-height:0;overflow:auto')
    expect(record).not.toContain('control-details-overview')
  })

  it('confirms a corrected entry with a toggle chip in the dialog footer, not a checkbox',()=>{
    expect(form).toContain('<ChoiceChips className="control-exec-confirm"')
    expect(form).not.toContain('type="checkbox"')
    expect(form).toContain('disabled={!confirmed||!valid}')
  })
})
