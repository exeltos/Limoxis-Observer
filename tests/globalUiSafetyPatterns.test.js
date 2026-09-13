import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('shared UI safety patterns',()=>{
  it('keeps destructive record actions behind confirmation',()=>{
    const source=read('src/design-system/RecordActions.jsx')
    expect(source).toContain("if(action===UI_ACTIONS.DELETE)")
    expect(source).toContain('await confirm(')
  })

  it('keeps both shared attachment delete paths behind confirmation',()=>{
    const field=read('src/design-system/AttachmentField.jsx')
    const panel=read('src/design-system/EntityAttachmentsPanel.jsx')
    expect(field).toContain('await confirm(')
    expect(panel).toContain('ConfirmDialog')
    expect(panel).toContain('setPendingDelete(row)')
  })

  it('shows a spinner in both shared attachment upload surfaces',()=>{
    const field=read('src/design-system/AttachmentField.jsx')
    const panel=read('src/design-system/EntityAttachmentsPanel.jsx')
    expect(field).toContain('LoaderCircle')
    expect(field).toContain('attachment-upload-progress')
    expect(panel).toContain('LoaderCircle')
    expect(panel).toContain('attachment-upload-progress-inline')
  })
})
