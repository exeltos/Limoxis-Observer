import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { readPatientClinicalRecordSource } from './helpers/patientClinicalRecordSource'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('pediatric/neonatal support UI wiring', () => {

  it('surfaces birth weight and gestational age on the patient profile when recorded', () => {
    const page = readPatientClinicalRecordSource()
    expect(page).toContain('patient?.birthWeightGrams')
    expect(page).toContain('patient?.gestationalAgeWeeks')
  })

  it('collects birth weight and gestational age on the patient intake form', () => {
    const form = read('src/features/patients/PatientsPage.jsx')
    expect(form).toContain('birthWeightGrams')
    expect(form).toContain('gestationalAgeWeeks')
  })

  it('plumbs birth weight/gestational age through the patients service', () => {
    const service = read('src/features/patients/patientsService.js')
    expect(service).toContain('birth_weight_grams')
    expect(service).toContain('gestational_age_weeks')
  })
})
