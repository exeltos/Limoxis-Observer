import {describe,expect,it} from 'vitest'
import { readSource } from './helpers/readSource'

const css=readSource('src/styles/workspaces.css')

describe('prevention record scrolling',()=>{
  it('uses one canonical scroll viewport for the record body',()=>{
    expect(css).toContain('.prevention-record-shell.record-single-pane-screen>.entity-record-body')
    expect(css).toContain('overflow-y:auto!important')
    expect(css).toContain('overflow-x:hidden!important')
    expect(css).toContain('scrollbar-gutter:stable!important')
  })

  it('keeps long-form actions reachable while scrolling',()=>{
    expect(css).toContain('.prevention-record-shell .prevention-editor-page-actions')
    expect(css).toContain('position:sticky!important')
    expect(css).toContain('bottom:0!important')
  })
})
