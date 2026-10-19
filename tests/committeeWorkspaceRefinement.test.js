import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('committee workspace refinement',()=>{
  const css=read('src/features/committees/committeeRefinements.css')
  const attachments=read('src/design-system/AttachmentField.jsx')

  it('uses a compact meeting layout without horizontal attendance scrolling',()=>{
    expect(css).toContain('overflow:hidden!important')
    // Each topic: the topic, then its decision / conclusion below it, full width.
    expect(css).toContain('grid-template-columns:minmax(0,1fr)')
  })

  it('uses the shared FilterBar search styling for decisions',()=>{
    expect(css).not.toContain('.committee-decisions .filter-search')
  })

  it('shows a circular loading indicator while attachment upload is running',()=>{
    expect(attachments).toContain('LoaderCircle')
    expect(attachments).toContain('attachment-upload-progress')
    expect(attachments).toContain('role="status"')
  })
})
