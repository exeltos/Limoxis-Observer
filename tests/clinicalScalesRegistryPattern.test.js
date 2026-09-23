import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

describe('clinical scales registry pattern',()=>{
 it('uses the canonical record registry shell and pagination',()=>{
  const source=fs.readFileSync('src/features/clinical-scales/PatientClinicalScalesPanel.jsx','utf8')
  expect(source).toContain('surface registry-workspace workspace-column workspace-fill')
  expect(source).toContain('<div className="scroll-table"><RegistryTable bare')
  expect(source).not.toContain('patient-secondary-registry')
  expect(source).toContain('<RegistryPagination')
  expect(source).toContain('<span className="eyebrow">Limoxis Observer</span>')
 })
})
