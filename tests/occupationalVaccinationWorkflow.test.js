import {describe,it,expect} from 'vitest'
import fs from 'node:fs'

const page=fs.readFileSync('src/features/prevention/StaffVaccinationsPage.jsx','utf8')
const service=fs.readFileSync('src/features/occupational-health/vaccinationService.js','utf8')
const css=fs.readFileSync('src/styles/prevention-refinements.css','utf8')

describe('staff vaccination workflow',()=>{
 it('uses the canonical registry pattern and supports individual and bulk entry',()=>{
  expect(page).toContain('registry-workspace prevention-workspace')
  expect(page).toContain('RegistryTable')
  expect(page).toContain('RegistryPagination')
  expect(page).toContain('FilterBar')
  expect(page).toContain('BackButton')
  expect(page).toContain('vaccination-entry-mode')
  expect(page).toContain("'bulk'")
  expect(page).toContain("'individual'")
  expect(page).toContain('selectedEmployeeIds')
  expect(page).toContain('createVaccinationsBulkAsync')
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
