import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const css=fs.readFileSync('src/styles/classic-rebase.css','utf8')
const modal=fs.readFileSync('src/features/controls/ControlExecutionModal.jsx','utf8')
const record=fs.readFileSync('src/features/controls/ControlRecordPage.jsx','utf8')

describe('control record fixed workspace',()=>{
  it('keeps the department assignment list as the scrolling area',()=>{
    expect(record).toContain('control-details-overview workspace-fill')
    expect(record).toContain('control-history-workspace')
    expect(css).toContain('.control-record-shell .control-details-overview>.control-history-workspace>.scroll-table')
    expect(css).toContain('overflow-y:auto')
    expect(css).toContain('overflow-x:hidden')
  })

  it('keeps the confirmation checkbox immediately before the text',()=>{
    expect(modal).toContain('className="control-confirm-execution"')
    expect(css).toContain('.control-confirm-execution input[type="checkbox"]')
    expect(css).toContain('flex-direction:row!important')
    expect(css).toContain('.control-confirm-execution svg{display:none!important}')
  })
})
