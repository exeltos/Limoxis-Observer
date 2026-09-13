import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const editor=fs.readFileSync('src/features/prevention/StaffVaccinationEditor.jsx','utf8')
const css=fs.readFileSync('src/features/occupational-health/OccupationalHealthPage.css','utf8')

describe('vaccination employee picker layout',()=>{
 it('keeps checkbox and employee content in the same row',()=>{
  expect(editor).toContain('vaccination-employee-row')
  expect(editor).toContain('vaccination-employee-copy')
  expect(css).toContain('.vaccination-employee-row{display:flex;align-items:center;gap:12px')
  expect(css).toContain('.vaccination-employee-copy{display:flex!important')
 })
})
