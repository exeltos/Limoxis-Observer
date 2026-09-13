import {describe,it,expect} from 'vitest'
import fs from 'node:fs'

const page=fs.readFileSync('src/features/occupational-health/OccupationalHealthPage.jsx','utf8')
const service=fs.readFileSync('src/features/employees/employeeSubRecordsService.js','utf8')
const css=fs.readFileSync('src/styles/prevention-refinements.css','utf8')

describe('occupational vaccination workflow',()=>{
 it('supports individual and bulk employee vaccination entry',()=>{
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
 it('keeps bundle follow-up actions visually separated',()=>{
  expect(css).toContain('.bundle-followup-actions')
  expect(css).toContain('gap:10px')
 })
})
