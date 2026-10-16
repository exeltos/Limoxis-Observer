import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { demoLibrarySeed } from '../src/features/management/managementData'
import { EMPLOYEE_SCREENING_TYPES, ENVIRONMENTAL_SAMPLE_TYPES, PATIENT_SAMPLE_TYPES, patientSampleSources, patientSampleTypeOptions, sampleSourceLabel } from '../src/features/laboratory/laboratoryReferenceData'
import { laboratoryStatusTone } from '../src/features/laboratory/LaboratoryStatus'

const sampleTypes = demoLibrarySeed.sampleTypes.map(([el, en]) => ({ value: el, el, en }))
const t = key => `t:${key}`

// The new laboratory sample takes its lists from the central libraries and
// shared constants; what a sample stores stays the same codes as before.
describe('laboratory reference lists', () => {
  it('maps the Sample types library onto the stored patient sample types', () => {
    const options = patientSampleTypeOptions(sampleTypes, 'el', t)
    const byName = Object.fromEntries(options.map(option => [option.value, option]))
    expect(byName['Αίμα']).toMatchObject({ type: 'bloodCulture', source: '' })
    expect(byName['Ούρα']).toMatchObject({ type: 'urineCulture' })
    expect(byName.BAL).toMatchObject({ type: 'respiratorySample', source: 'bal' })
    expect(byName['Βαθύς ιστός']).toMatchObject({ type: 'woundCulture', source: 'deepTissue' })
    // Environmental and unmapped library names are not patient sample types.
    expect(byName['Επιφάνεια']).toBeUndefined()
    expect(byName['ΕΝΥ']).toBeUndefined()
    for (const option of options) {
      const type = PATIENT_SAMPLE_TYPES.find(row => row.id === option.type)
      expect(type).toBeTruthy()
      if (option.source) expect(type.sources).toContain(option.source)
    }
    expect(patientSampleTypeOptions(sampleTypes, 'en', t).find(option => option.type === 'urineCulture').label).toBe('Urine')
  })

  it('falls back to the four stored types while the library is empty', () => {
    expect(patientSampleTypeOptions([], 'el', t)).toEqual(PATIENT_SAMPLE_TYPES.map(type => ({ value: type.id, label: `t:${type.id}`, type: type.id, source: '' })))
    expect(patientSampleSources('urineCulture')).toEqual(['midstream', 'urinaryCatheter', 'nephrostomy', 'suprapubicCatheter', 'other'])
    expect(patientSampleSources('')).toEqual([])
  })

  it('keeps every employee screening type, including other employee screening, and labels stored codes', () => {
    expect(EMPLOYEE_SCREENING_TYPES.map(item => item.id)).toEqual(['handSwab', 'nasalSwab', 'throatSwab', 'otherEmployeeScreening'])
    expect(ENVIRONMENTAL_SAMPLE_TYPES.map(item => item.id)).toEqual(['surface', 'room', 'equipment', 'water', 'air', 'other'])
    expect(sampleSourceLabel('nasalSwab, otherEmployeeScreening', 'en')).toBe('Nasal swab, Other employee screening')
    expect(sampleSourceLabel('equipment', 'el')).toBe('Εξοπλισμός')
    expect(sampleSourceLabel('other', 'el')).toBe('Άλλο')
  })

  it('has one status component on the shared StatusBadge', () => {
    expect(laboratoryStatusTone('completed')).toBe('success')
    expect(laboratoryStatusTone('processing')).toBe('info')
    expect(laboratoryStatusTone('positive')).toBe('danger')
    expect(laboratoryStatusTone('rejected')).toBe('danger')
    expect(laboratoryStatusTone('cancelled')).toBe('neutral')
    const sources = ['LaboratoryWorkspace.jsx', 'LaboratorySampleRecordFunctionalView.jsx', 'LaboratorySampleViews.jsx', 'LaboratorySampleDialogs.jsx'].map(file => fs.readFileSync(`src/features/laboratory/${file}`, 'utf8')).join('\n')
    expect(sources).not.toMatch(/className=\{?[`'"]status-badge/)
    expect(sources).not.toContain('<select')
    expect(sources).not.toContain('record-table')
  })
})
