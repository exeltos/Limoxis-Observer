import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('shared UI safety patterns',()=>{
  it('keeps destructive record actions behind confirmation',()=>{
    const source=read('src/design-system/RecordActions.jsx')
    expect(source).toContain("if(action===UI_ACTIONS.DELETE)")
    expect(source).toContain('await confirm(')
  })

  it('keeps the unified shared attachment delete path behind confirmation',()=>{
    const field=read('src/design-system/AttachmentField.jsx')
    const panel=read('src/design-system/EntityAttachmentsPanel.jsx')
    expect(field).toContain('await confirm(')
    expect(panel).toContain("import { AttachmentField } from './AttachmentField'")
    expect(panel).toContain('<AttachmentField')
  })

  it('shows upload progress through the unified shared attachment field',()=>{
    const field=read('src/design-system/AttachmentField.jsx')
    const panel=read('src/design-system/EntityAttachmentsPanel.jsx')
    expect(field).toContain('LoaderCircle')
    expect(field).toContain('attachment-upload-progress')
    expect(panel).toContain('<AttachmentField')
  })
})
