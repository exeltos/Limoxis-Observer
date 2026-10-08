import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const css=fs.readFileSync('src/styles/design-system.css','utf8')
const modal=fs.readFileSync('src/features/controls/ControlExecutionModal.jsx','utf8')
const record=fs.readFileSync('src/features/controls/ControlRecordPage.jsx','utf8')

describe('control record fixed workspace',()=>{
  it('puts the departments and their entry first, details and guidance below',()=>{
    const recordCss=fs.readFileSync('src/features/controls/controlRecord.css','utf8')
    const departments=record.indexOf('control-ov-departments'),facts=record.indexOf('control-ov-facts'),guidance=record.indexOf('control-ov-guidance')
    expect(departments).toBeGreaterThan(0)
    expect(facts).toBeGreaterThan(departments)
    expect(guidance).toBeGreaterThan(facts)
    // The tab scrolls as a whole: no inner scrolling list squeezed at the bottom.
    expect(recordCss).toContain('.control-overview{display:flex;flex-direction:column;gap:18px;min-height:0;overflow:auto')
    expect(record).not.toContain('control-details-overview')
  })

  it('keeps the confirmation checkbox immediately before the text',()=>{
    expect(modal).toContain('className="control-confirm-execution"')
    expect(css).toContain('.control-confirm-execution input[type="checkbox"]')
    expect(css).toContain('flex-direction:row!important')
    expect(css).toContain('.control-confirm-execution svg{display:none!important}')
  })
})
