import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('bundle deviation follow-up workflow',()=>{
 const page=read('src/features/prevention/PreventionRecordPage.jsx')
 const service=read('src/features/prevention/bundleCloudService.js')
 const dialog=read('src/features/prevention/BundleFollowUpDialog.jsx')
 const css=read('src/styles/prevention-refinements.css')

 it('offers an actionable follow-up for every bundle deviation',()=>{
  expect(page).toContain("en?'Follow-up':'Επανέλεγχος'")
  expect(page).toContain('record.followUps?.[item.id]')
  expect(page).toContain('BundleFollowUpDialog')
 })

 it('captures explicit follow-up status, date, comment and reviewer metadata',()=>{
  expect(dialog).toContain('value="resolved"')
  expect(dialog).toContain('value="open"')
  expect(dialog).toContain('value="not_applicable"')
  expect(dialog).toContain("Ημερομηνία επανελέγχου *")
  expect(dialog).toContain('reviewedBy:actor.name')
  expect(dialog).toContain('reviewedAt:new Date().toISOString()')
 })

 it('persists follow-ups separately from the original bundle answers',()=>{
  expect(service).toContain('criteria.followUps')
  expect(service).toContain('export async function saveBundleFollowUp')
  expect(service).toContain('followUps:record.followUps||{}')
 })

 it('visually distinguishes corrected, open, not-applicable and pending items',()=>{
  expect(css).toContain('.bundle-followup-status.resolved')
  expect(css).toContain('.bundle-followup-status.open')
  expect(css).toContain('.bundle-followup-status.not_applicable')
  expect(css).toContain('.bundle-followup-status.pending')
 })
})
