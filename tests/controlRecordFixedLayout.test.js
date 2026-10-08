import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const css=fs.readFileSync('src/styles/design-system.css','utf8')
const modal=fs.readFileSync('src/features/controls/ControlExecutionModal.jsx','utf8')
const record=fs.readFileSync('src/features/controls/ControlRecordPage.jsx','utf8')

describe('control record fixed workspace',()=>{
  it('shows details and guidance first, then the departments with their entry',()=>{
    const recordCss=fs.readFileSync('src/features/controls/controlRecord.css','utf8')
    const departments=record.indexOf('control-ov-departments'),facts=record.indexOf('control-ov-facts'),guidance=record.indexOf('control-ov-guidance')
    expect(facts).toBeGreaterThan(0)
    expect(guidance).toBeGreaterThan(facts)
    expect(departments).toBeGreaterThan(guidance)
    // Many departments: only their list scrolls, under a fixed header.
    expect(recordCss).toContain('.control-ov-department-scroll{flex:1 1 0;min-height:0;overflow:auto}')
    expect(recordCss).toContain('.control-ov-department-table thead th{position:sticky;top:0')
    expect(record).not.toContain('control-details-overview')
  })

  it('keeps the confirmation checkbox immediately before the text',()=>{
    expect(modal).toContain('className="control-confirm-execution"')
    expect(css).toContain('.control-confirm-execution input[type="checkbox"]')
    expect(css).toContain('flex-direction:row!important')
    expect(css).toContain('.control-confirm-execution svg{display:none!important}')
  })
})
