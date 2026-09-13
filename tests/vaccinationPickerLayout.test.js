import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const editor=fs.readFileSync('src/features/prevention/StaffVaccinationEditor.jsx','utf8')
const css=fs.readFileSync('src/features/occupational-health/OccupationalHealthPage.css','utf8')

describe('vaccination employee picker layout',()=>{
 it('keeps each employee in one compact row with the checkbox first',()=>{
  expect(editor).toContain('className={`vaccination-employee-row${selected?\' selected\':\'\'}`}')
  expect(editor).toContain('<input type="checkbox"')
  expect(editor).toContain('<div className="vaccination-employee-copy"><strong>')
  expect(editor).not.toContain('className="vaccination-employee-copy"><label')
  expect(css).toContain('.vaccination-employee-picker{align-content:start}')
  expect(css).toContain('.vaccination-employee-list{display:flex;flex-direction:column;align-self:start')
  expect(css).toContain('.vaccination-employee-row{display:flex;align-items:center;gap:12px;flex:0 0 auto')
  expect(css).toContain('.vaccination-employee-copy{display:flex;align-items:baseline')
 })
})
