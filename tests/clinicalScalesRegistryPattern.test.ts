import {describe,expect,it} from 'vitest'
import { readSource } from './helpers/readSource'

describe('clinical scales registry pattern',()=>{
 it('uses the canonical record registry shell and pagination',()=>{
  const source=readSource('src/features/clinical-scales/PatientClinicalScalesPanel.jsx')
  expect(source).toContain('<RecordTabPanel className="clinical-assessment-registry"')
  expect(source).toContain('<div className="scroll-table"><RegistryTable sortable={false} bare')
  expect(source).not.toContain('record-section record-secondary-registry')
  expect(source).toContain('<RegistryPagination')
  expect(source).not.toContain('training-assessment-view')
  expect(source).not.toContain('training-assessment-toolbar')
 })
})
