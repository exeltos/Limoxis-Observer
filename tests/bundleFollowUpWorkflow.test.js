// The editors and services are exercised by behavior in preventionAntisepticWasteBehavior
// and preventionVaccinationBundleBehavior; the layout (CSS) rules stay here.
import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('bundle deviation follow-up workflow',()=>{
 const css=read('src/styles/workspaces.css')

 it('visually distinguishes corrected, open, not-applicable and pending items',()=>{
  expect(css).toContain('.bundle-followup-status.resolved')
  expect(css).toContain('.bundle-followup-status.open')
  expect(css).toContain('.bundle-followup-status.not_applicable')
  expect(css).toContain('.bundle-followup-status.pending')
 })
})
