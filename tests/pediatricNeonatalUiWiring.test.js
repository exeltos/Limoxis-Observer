import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('pediatric/neonatal support UI wiring', () => {
  it('offers a neonatal/infant CLABSI definition alongside the adult one in the HAI dialog', () => {
    const page = read('src/features/surveillance/PatientClinicalCanonicalPage.jsx')
    expect(page).toContain("id:'clabsi_neonatal'")
    expect(page).toContain('CLABSI (neonatal/infant ≤1 year)')
  })

  it('shows age in days rather than years for patients under one year old', () => {
    const page = read('src/features/surveillance/PatientClinicalCanonicalPage.jsx')
    expect(page).toContain('ageInDays<366')
  })

  it('surfaces birth weight and gestational age on the patient profile when recorded', () => {
    const page = read('src/features/surveillance/PatientClinicalCanonicalPage.jsx')
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
