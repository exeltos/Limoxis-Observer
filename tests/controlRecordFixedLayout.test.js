import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const css=fs.readFileSync('src/styles/design-system.css','utf8')
const form=fs.readFileSync('src/features/controls/ControlExecutionForm.jsx','utf8')
const record=fs.readFileSync('src/features/controls/ControlRecordPage.jsx','utf8')

describe('control record fixed workspace',()=>{
  it('shows details and guidance first, then the departments with their entry',()=>{
    const sheet=record.indexOf('<DetailList className="control-record-details"'),guidance=record.indexOf("label:en?'Instructions':'Οδηγίες'"),departments=record.indexOf('control-record-departments')
    expect(sheet).toBeGreaterThan(0)
    expect(guidance).toBeGreaterThan(sheet)
    expect(departments).toBeGreaterThan(guidance)
    // Many departments: the whole tab scrolls and the departments table keeps every row, without a frame of its own.
    expect(css).toContain('.control-record-shell .control-record-view:is(div,#lo-record-sheet){flex:1;min-height:0;overflow:auto}')
    expect(css).toContain('.control-record-shell .control-record-departments>.scroll-table:is(div,#lo-record-sheet){flex:none;min-height:0;overflow:visible;border:0')
    expect(record).not.toContain('control-details-overview')
  })

  it('confirms a corrected entry with a toggle chip in the dialog footer, not a checkbox',()=>{
    expect(form).toContain('<ChoiceChips className="control-exec-confirm"')
    expect(form).not.toContain('type="checkbox"')
    expect(form).toContain('disabled={!confirmed||!valid}')
  })
  it('opens a correction with the rows of the entry itself, even when it recorded none',()=>{
    expect(form).toContain('if(Array.isArray(initialExecution?.structuredData?.rows))return initialExecution.structuredData.rows')
  })
})
