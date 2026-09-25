import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('training participants and public access refinements',()=>{
  it('removes the participant registry search bar visually and compacts empty state',()=>{
    const css=read('src/styles/workspaces.css')
    expect(css).toContain('.training-participants-registry>.filter-system')
    expect(css).toContain('display:none!important')
    expect(css).toContain(':has(.training-participants-table tbody:empty)')
  })

  it('uploads shared attachments as soon as a cloud file is selected',()=>{
    const source=read('src/design-system/AttachmentField.jsx')
    expect(source).toContain('async function chooseFile(event)')
    expect(source).toContain('await uploadAttachment(organizationId,entityType,entityId,file')
    expect(source).toContain('stagedAttachment:added')
    expect(source).toContain('attachment-upload-progress')
  })

  it('cleans up a staged cloud upload when the attachment dialog is cancelled',()=>{
    const source=read('src/design-system/AttachmentField.jsx')
    expect(source).toContain("editor?.mode==='add'&&editor?.stagedAttachment?.id")
    expect(source).toContain('await deleteAttachment(editor.stagedAttachment.id)')
  })

  it('allows token-only training email access for anonymous recipients',()=>{
    const sql=read('supabase/migrations/202609130010_training_public_email_access_grants.sql')
    expect(sql).toContain('training_email_access(text) to anon')
    expect(sql).toContain('training_confirm_attendance(text) to anon')
    expect(sql).toContain('training_submit_evaluation(text,jsonb,jsonb,text,boolean) to anon')
  })
})
