import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('controlled document version governance',()=>{
 it('locks version editing after document creation',()=>{
  const form=read('src/features/documents/DocumentForm.jsx')
  const create=read('src/features/documents/DocumentCreatePage.jsx')
  expect(form).toContain('allowVersionEdit=false')
  expect(form).toContain('disabled={readOnly||!allowVersionEdit}')
  expect(form).toContain('Η έκδοση ελέγχεται από τον κύκλο ζωής του εγγράφου.')
  expect(create).toContain('allowVersionEdit/>')
 })

 it('keeps revision numbering in the document service',()=>{
  const service=read('src/features/documents/documentService.js')
  expect(service).toContain('const version=nextRevisionVersion(record.version)')
  expect(service).toContain("status:'draft',version")
 })
})
