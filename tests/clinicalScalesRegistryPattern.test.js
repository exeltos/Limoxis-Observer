import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

describe('clinical scales registry pattern',()=>{
 it('uses the canonical record registry shell and pagination',()=>{
  const source=fs.readFileSync('src/features/clinical-scales/PatientClinicalScalesPanel.jsx','utf8')
  expect(source).toContain('<RecordTabPanel className="clinical-assessment-registry"')
  expect(source).toContain('<div className="scroll-table"><RegistryTable bare')
  expect(source).not.toContain('record-section record-secondary-registry')
  expect(source).toContain('<RegistryPagination')
  expect(source).not.toContain('training-assessment-view')
  expect(source).not.toContain('training-assessment-toolbar')
 })
})
