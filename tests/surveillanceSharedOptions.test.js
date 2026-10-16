import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EMPLOYEE_SCREENING_TYPES, PATIENT_SAMPLE_TYPES, SAMPLE_PRIORITIES, employeeScreeningLabel, patientSampleTypeOptions, specimenCode, statusTone } from '../src/features/surveillance/surveillanceOptions'
import { employeeScreeningCatalog } from '../src/features/surveillance/employeeSurveillanceData'
import { ENVIRONMENTAL_TYPES, isEnvironmentalSample } from '../src/features/surveillance/environmentalSurveillanceData'
import { demoLibrarySeed } from '../src/features/management/managementData'

const read = file => fs.readFileSync(file, 'utf8')
const item = ([el, en, meta = {}]) => ({ value: el, el, en, code: meta.code || null, meta })

// Surveillance and patient screens read their option lists from one module and
// the central libraries; the stored codes stay the ones indicators and analysis read.
describe('shared surveillance option lists', () => {
  it('keeps one employee screening list for the new screening, the request correction and the laboratory catalogue', () => {
    expect(EMPLOYEE_SCREENING_TYPES.map(row => row.id)).toEqual(['handSwab', 'nasalSwab', 'throatSwab'])
    expect(employeeScreeningCatalog.map(row => row.id)).toEqual(['handSwab', 'nasalSwab', 'throatSwab', 'otherEmployeeScreening'])
    expect(employeeScreeningCatalog.find(row => row.id === 'nasalSwab')).toMatchObject({ sampleType: 'employeeScreening', sourceEl: 'Ρινικό επίχρισμα', sourceEn: 'Nasal swab' })
    expect(employeeScreeningLabel('throatSwab', 'en')).toBe('Throat swab')
    expect(employeeScreeningLabel('mrsa', 'el')).toBe('mrsa')
    for (const file of ['src/features/surveillance/EmployeeSurveillanceCanonicalFlow.jsx', 'src/features/surveillance/EmployeeSurveillanceRecordDialog.jsx', 'src/features/surveillance/employeeSurveillanceData.js'])
      expect(read(file)).not.toContain("el: 'Επίχρισμα χεριών'")
  })

  it('offers the patient sample types as the stored codes, with the library specimens under each', () => {
    const options = patientSampleTypeOptions(demoLibrarySeed.sampleTypes.map(item), 'el', key => key)
    expect(options.map(option => option.value)).toEqual(PATIENT_SAMPLE_TYPES)
    expect(options.find(option => option.value === 'respiratorySample').keywords).toMatch(/BAL/)
    expect(options.find(option => option.value === 'bloodCulture').description).toBe('Αίμα')
    // Environmental specimens are not patient samples.
    expect(options.map(option => option.keywords).join(' ')).not.toMatch(/Επιφάνεια|Water/)
    expect(specimenCode({ el: 'Ούρα', en: 'Urine' })).toBe('urineCulture')
    expect(specimenCode({ el: 'ΕΝΥ', en: 'CSF' })).toBe('other')
    // An empty library still offers the five codes.
    expect(patientSampleTypeOptions([], 'en', key => key).map(option => option.value)).toEqual(PATIENT_SAMPLE_TYPES)
  })

  it('keeps one priority list and one status-tone map', () => {
    expect(SAMPLE_PRIORITIES.map(row => row.value)).toEqual(['routine', 'urgent', 'critical'])
    expect(statusTone('active')).toBe('success')
    expect(statusTone('positive')).toBe('danger')
    expect(statusTone('pending')).toBe('warning')
    expect(statusTone('completed')).toBe('neutral')
    expect(read('src/features/surveillance/ClinicalJourney.jsx')).not.toContain('const STATUS_TONES')
    expect(read('src/features/surveillance/SurveillanceCanonicalPage.jsx')).not.toContain('EMPLOYEE_STATE_TONES')
  })

  it('keeps surface / room / air / water as the canonical environmental types', () => {
    expect(ENVIRONMENTAL_TYPES).toEqual(['surface', 'room', 'air', 'water'])
    expect(isEnvironmentalSample({ type: 'water' })).toBe(true)
    expect(isEnvironmentalSample({ type: 'Νερό δικτύου' })).toBe(true)
    expect(isEnvironmentalSample({ subjectType: 'environment', type: 'other' })).toBe(true)
    expect(isEnvironmentalSample({ type: 'bloodCulture' })).toBe(false)
  })

  it('reads the departments through useDepartments in every surveillance and patient screen', () => {
    for (const file of ['src/features/surveillance/NewSurveillanceFlow.jsx', 'src/features/surveillance/SurveillanceCanonicalPage.jsx', 'src/features/surveillance/PatientClinicalCanonicalPage.jsx', 'src/features/patients/PatientCreatePage.jsx']) {
      const source = read(file)
      expect(source).toContain('useDepartments()')
      expect(source).not.toContain('loadDepartments(')
      expect(source).not.toContain('demoLibrarySeed.departments')
    }
  })

  it('uses the shared field controls instead of raw selects, checkboxes and per-screen field titles', () => {
    const dialogs = read('src/features/surveillance/ClinicalRecordDialogs.jsx')
    expect(dialogs).not.toMatch(/<select\b/)
    expect(dialogs).not.toContain('type="checkbox"')
    expect(dialogs).not.toMatch(/<label[^>]*>\s*<span>/)
    expect(dialogs).toContain('<MultiSelect')
    expect(dialogs).not.toContain('clinical-library-menu')
    expect(read('src/features/surveillance/ClinicalRecordViews.jsx')).toContain('<RegistryTable')
  })
})
