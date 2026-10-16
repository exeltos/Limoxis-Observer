// The editors and services are exercised by behavior in preventionAntisepticWasteBehavior
// and preventionVaccinationBundleBehavior; the layout (CSS) rules stay here.
import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import { bundleFollowUpTone } from '../src/features/prevention/PreventionRecordPage'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('bundle deviation follow-up workflow',()=>{
 const css=read('src/styles/workspaces.css')

 it('visually distinguishes corrected, open, not-applicable and pending items',()=>{
  // The follow-up status is a shared StatusBadge, one tone per state.
  const tones=['resolved','open','not_applicable',undefined].map(bundleFollowUpTone)
  expect(tones).toEqual(['success','danger','neutral','warning'])
  expect(new Set(tones).size).toBe(4)
  // The finding's left border follows the same states.
  expect(css).toContain('.bundle-record-finding.bundle-followup-resolved')
  expect(css).toContain('.bundle-record-finding.bundle-followup-open')
  expect(css).toContain('.bundle-record-finding.bundle-followup-not_applicable')
  expect(css).toContain('.bundle-followup-pending')
 })
})
