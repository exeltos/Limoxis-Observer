import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const css=fs.readFileSync('src/styles/design-system.css','utf8')
const modal=fs.readFileSync('src/features/controls/ControlExecutionModal.jsx','utf8')
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

  it('keeps the confirmation checkbox immediately before the text',()=>{
    expect(modal).toContain('className="control-confirm-execution"')
    expect(css).toContain('.control-confirm-execution input[type="checkbox"]')
    expect(css).toContain('flex-direction:row!important')
    expect(css).toContain('.control-confirm-execution svg{display:none!important}')
  })
})
