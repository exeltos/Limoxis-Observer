import {describe,it,expect} from 'vitest'
import fs from 'node:fs'

const prevention=fs.readFileSync('src/features/prevention/PreventionPage.jsx','utf8')
const editor=fs.readFileSync('src/features/prevention/StaffVaccinationEditor.jsx','utf8')
const service=fs.readFileSync('src/features/occupational-health/vaccinationService.js','utf8')
const css=fs.readFileSync('src/styles/prevention-refinements.css','utf8')

describe('staff vaccination workflow',()=>{
 it('uses the Prevention registry pattern and supports individual and bulk entry',()=>{
  expect(prevention).toContain('registry-workspace prevention-workspace')
  expect(prevention).toContain('RegistryTable')
  expect(prevention).toContain('RegistryPagination')
  expect(prevention).toContain('FilterBar')
  expect(prevention).toContain("['vaccinations','vaccinations']")
  expect(prevention).toContain('loadAllVaccinationsAsync')
  expect(prevention).toContain('createVaccinationsBulkAsync')
  expect(editor).toContain('vaccination-entry-mode')
  expect(editor).toContain("'bulk'")
  expect(editor).toContain("'individual'")
  expect(editor).toContain('selectedEmployeeIds')
 })
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
