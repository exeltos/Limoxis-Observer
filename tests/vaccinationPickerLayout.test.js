import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const css=fs.readFileSync('src/features/occupational-health/OccupationalHealthPage.css','utf8')

describe('vaccination employee picker layout',()=>{
 it('keeps checkbox and employee details on one compact row',()=>{
  expect(css).toContain('.vaccination-employee-list>label{display:flex!important')
  expect(css).toContain('>label>input[type="checkbox"]')
  expect(css).toContain('>label>span{display:flex!important')
 })
})
