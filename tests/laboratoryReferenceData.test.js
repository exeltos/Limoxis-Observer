import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { demoLibrarySeed } from '../src/features/management/managementData'
import { EMPLOYEE_SCREENING_TYPES, ENVIRONMENTAL_SAMPLE_TYPES, PATIENT_SAMPLE_TYPES, patientSampleSources, patientSampleTypeOptions, sampleSourceLabel } from '../src/features/laboratory/laboratoryReferenceData'
import { laboratoryStatusTone } from '../src/features/laboratory/LaboratoryStatus'

const sampleTypes = demoLibrarySeed.sampleTypes.map(([el, en, meta]) => ({ id: meta?.id || null, value: el, code: meta?.code || null, el, en, meta: meta || {} }))
const t = key => `t:${key}`

describe('laboratory reference lists', () => {
  it('uses the Sample types library as the patient specimen list while keeping technical categories', () => {
    const options = patientSampleTypeOptions(sampleTypes, 'el', t)
    const byLabel = Object.fromEntries(options.map(option => [option.label, option]))
    expect(byLabel['Αίμα']).toMatchObject({ type: 'bloodCulture', source: '' })
    expect(byLabel['Ούρα']).toMatchObject({ type: 'urineCulture' })
    expect(byLabel.BAL).toMatchObject({ type: 'respiratorySample', source: 'bal' })
    expect(byLabel['ΕΝΥ']).toMatchObject({ type: 'specimen' })
    expect(byLabel['Κόπρανα']).toMatchObject({ type: 'specimen' })
    // Environmental specimens stay in environmental surveillance, not patient choices.
    expect(byLabel['Επιφάνεια']).toBeUndefined()
    expect(byLabel['Νερό']).toBeUndefined()
    for (const option of options) {
      expect(PATIENT_SAMPLE_TYPES.some(row => row.id === option.type)).toBe(true)
    }
    expect(patientSampleTypeOptions(sampleTypes, 'en', t).find(option => option.type === 'urineCulture').label).toBe('Urine')
  })

  it('falls back to the four legacy technical types while the library is empty', () => {
    const fallback = PATIENT_SAMPLE_TYPES.filter(type => type.id !== 'specimen').map(type => ({ value: type.id, label: `t:${type.id}`, type: type.id, source: '', specimenTypeId: null }))
    expect(patientSampleTypeOptions([], 'el', t)).toEqual(fallback)
    expect(patientSampleSources('urineCulture')).toEqual(['midstream', 'urinaryCatheter', 'nephrostomy', 'suprapubicCatheter', 'other'])
    expect(patientSampleSources('specimen')).toEqual([])
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
