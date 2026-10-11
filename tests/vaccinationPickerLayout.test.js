// The editors and services are exercised by behavior in preventionAntisepticWasteBehavior
// and preventionVaccinationBundleBehavior; the layout (CSS) rules stay here.
import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const css=fs.readFileSync('src/features/occupational-health/OccupationalHealthPage.css','utf8')

describe('vaccination employee picker layout',()=>{
 it('keeps each employee in one compact row with the checkbox first',()=>{
  expect(css).toContain('.vaccination-employee-picker{align-content:start}')
  expect(css).toContain('.vaccination-employee-list{display:flex;flex-direction:column;align-self:start')
  expect(css).toContain('.vaccination-employee-row{display:flex;align-items:center;gap:12px;flex:0 0 auto')
  expect(css).toContain('.vaccination-employee-copy{display:flex;align-items:baseline')
 })
})
