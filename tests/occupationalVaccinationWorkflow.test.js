// The editors and services are exercised by behavior in preventionAntisepticWasteBehavior
// and preventionVaccinationBundleBehavior; the layout (CSS) rules stay here.
import {describe,it,expect} from 'vitest'
import fs from 'node:fs'
const service=fs.readFileSync('src/features/occupational-health/vaccinationService.js','utf8')
const css=fs.readFileSync('src/styles/workspaces.css','utf8')

describe('staff vaccination workflow',()=>{
 it('uses the production employee_vaccinations table',()=>{
  expect(service).toContain("from('employee_vaccinations')")
  expect(service).toContain('loadAllVaccinationsAsync')
  expect(service).toContain('createVaccinationsBulkAsync')
 })
 it('keeps bundle follow-up controls visually separated',()=>{
  expect(css).toContain('.bundle-followup-meta')
  expect(css).toContain('gap:10px')
  expect(css).toContain('border-left:1px solid var(--lo-color-border)')
 })
})
