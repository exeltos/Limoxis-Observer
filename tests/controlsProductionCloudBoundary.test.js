import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(path,'utf8')

describe('controls production cloud boundary',()=>{
 it('keeps active control screens off demo/local stores',()=>{
  const files=[
   'src/features/controls/ControlsPage.jsx',
   'src/features/controls/ControlRecordPage.jsx',
   'src/features/controls/ControlExecutionModal.jsx',
  ]
  for(const file of files){
   const source=read(file)
   expect(source).not.toContain("from './controlsDemoData'")
   expect(source).not.toContain("from './controlDrafts'")
  }
 })

 it('uses the Supabase control persistence tables',()=>{
  const source=read('src/features/controls/controlCloudService.js')
  for(const table of ['control_definitions','control_assignments','control_executions','control_execution_revisions','control_drafts']){
   expect(source).toContain(`'${table}'`)
  }
  expect(source).toContain("from '../../core/supabase/client'")
 })

 it('keeps scheduling as a pure production utility',()=>{
  const source=read('src/features/controls/controlScheduling.js')
  expect(source).toContain('calculateNextDue')
  expect(source).not.toContain('Demo')
  expect(source).not.toContain('loadSnapshot')
 })
})
