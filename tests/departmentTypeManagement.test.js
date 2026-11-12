import { describe, expect, it } from 'vitest'
import { DEPARTMENT_TYPES, departmentTypeValue } from '../src/features/management/managementCloudService'
import { buildClinicalScaleContext } from '../src/features/clinical-scales/clinicalScaleContext'
import { readSource } from './helpers/readSource'

const migration = readSource(new URL('../supabase/migrations/20260921150000_pediatric_neonatal_support.sql', import.meta.url))
const panel = readSource(new URL('../src/features/management/LibrariesPanel.jsx', import.meta.url))
const patients = readSource(new URL('../src/features/patients/patientsService.js', import.meta.url))

describe('department type (general / ICU / NICU / PICU)', () => {
  it('matches the database check constraint and falls back to general', () => {
    for (const type of DEPARTMENT_TYPES) expect(migration).toContain(`'${type}'`)
    expect(departmentTypeValue('nicu')).toBe('nicu')
    expect(departmentTypeValue('unknown')).toBe('general')
    expect(departmentTypeValue(undefined)).toBe('general')
  })

  it('is editable for departments in the Libraries editor and shown in the list', () => {
    expect(panel).toContain("active==='departments'&&<label className=\"field\"><span>{t('librariesPanel.departmentTypeLabel')}")
    expect(panel).toContain('department-type-badge')
    expect(panel).toContain('departmentType})')
  })

  it('reaches clinical-scale recommendations through the admission', () => {
    expect(patients).toContain("select('id,name,department_type')")
    const nicuScale = { id: 'n1', scale_key: 'nicu-scale', status: 'approved', populations: ['neonatal'], settings: ['nicu'] }
    const [row] = buildClinicalScaleContext([nicuScale], [], { age: 0.01, admission: { department: 'Νεογνολογική', department_type: 'nicu' } })
    expect(row?.recommended).toBe(true)
  })
})
