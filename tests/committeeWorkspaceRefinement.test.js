import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('committee workspace refinement',()=>{
  const page=read('src/features/committees/CommitteeRecordPage.jsx')
  const css=read('src/features/committees/committeeRefinements.css')
  const attachments=read('src/design-system/AttachmentField.jsx')

  it('keeps close on the dialog header and removes the duplicate footer close action',()=>{
    expect(page).toContain('className="committee-meeting-dialog"')
    expect(page).not.toContain("{en?'Close':'Κλείσιμο'}</Button>")
  })

  it('allows accidentally added agenda topics to be removed',()=>{
    expect(page).toContain('const removeTopic=id=>')
    expect(page).toContain("label={en?'Delete topic':'Διαγραφή θέματος'}")
  })

  it('uses a compact meeting layout without horizontal attendance scrolling',()=>{
    expect(page).toContain('committee-attendance-wrap')
    expect(page).toContain('committee-topic-card-compact')
    expect(css).toContain('overflow:hidden!important')
    expect(css).toContain('grid-template-columns:minmax(220px,.85fr) minmax(320px,1.65fr)')
  })

  it('removes the nested decisions search input chrome',()=>{
    expect(page).toContain('record-section committee-decisions')
    expect(css).toContain('.committee-decisions .filter-search input')
    expect(css).toContain('border:0!important')
  })

  it('shows a circular loading indicator while attachment upload is running',()=>{
    expect(attachments).toContain('LoaderCircle')
    expect(attachments).toContain('attachment-upload-progress')
    expect(attachments).toContain('role="status"')
  })
})
