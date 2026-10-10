import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('indicator committee and training navigation refinements',()=>{
 const indicator=read('src/features/indicators/IndicatorRecordPage.jsx')
 const shell=read('src/design-system/EntityRecordShell.jsx')

 it('removes duplicate period result editing from indicator records',()=>{
  expect(indicator).not.toContain('indicator-period-result')
  expect(indicator).not.toContain('manualValue')
  expect(indicator).not.toContain('Save result')
 })

 it('restores previous and next arrows for training records from the stored training sequence',()=>{
  expect(shell).toContain("location.pathname.startsWith('/training/')?'training-programs':null")
  expect(shell).toContain('effectiveRecordNavigation')
  expect(shell).toContain("label={en?'Previous record':'Προηγούμενη εγγραφή'}")
  expect(shell).toContain("label={en?'Next record':'Επόμενη εγγραφή'}")
 })
})
