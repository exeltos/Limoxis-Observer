// The editors and services are exercised by behavior in preventionAntisepticWasteBehavior
// and preventionVaccinationBundleBehavior; the layout (CSS) rules stay here.
import {describe,expect,it} from 'vitest'
import { readSource } from './helpers/readSource'

const css=readSource('src/features/occupational-health/OccupationalHealthPage.css')
const editor=readSource('src/features/prevention/StaffVaccinationEditor.jsx')

describe('vaccination employee picker layout',()=>{
 it('picks bulk employees through the shared MultiSelect instead of a checkbox list',()=>{
  expect(css).toContain('.vaccination-employee-picker{align-content:start}')
  expect(editor).toContain("import { MultiSelect } from '../../design-system/MultiSelect'")
  expect(editor).toContain('selected={selectedEmployeeIds}')
  expect(editor).not.toContain('type="checkbox"')
  expect(css).not.toContain('.vaccination-employee-row')
 })
})
