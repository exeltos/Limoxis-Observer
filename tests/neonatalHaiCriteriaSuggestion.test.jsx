// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { criteriaAgeWarning, orderCriteriaForAge, withCriteriaKeys } from '../src/features/surveillance/PatientClinicalCanonicalPage'

const options = [
  ['CLABSI – ενήλικες', 'CLABSI – adult', { id: 'clabsi' }],
  ['CAUTI', 'CAUTI', { id: 'cauti' }],
  ['CLABSI (νεογνική/βρεφική)', 'CLABSI (neonatal/infant)', { id: 'clabsi_neonatal' }],
]

describe('neonatal/infant HAI criteria for patients ≤1 year', () => {
  it('lists the infant definition first for infants and keeps the order otherwise', () => {
    expect(orderCriteriaForAge(options, 20).map(row => row[2].id)).toEqual(['clabsi_neonatal', 'clabsi', 'cauti'])
    expect(orderCriteriaForAge(options, 365)[0][2].id).toBe('clabsi_neonatal')
    expect(orderCriteriaForAge(options, 4000)).toBe(options)
    expect(orderCriteriaForAge(options, null)).toBe(options)
  })

  it('flags an age/definition mismatch in both directions', () => {
    expect(criteriaAgeWarning('clabsi', 30)).toBe('useInfantDefinition')
    expect(criteriaAgeWarning('clabsi_neonatal', 800)).toBe('infantDefinitionOverOneYear')
    expect(criteriaAgeWarning('clabsi_neonatal', 30)).toBe(null)
    expect(criteriaAgeWarning('clabsi', 5000)).toBe(null)
    expect(criteriaAgeWarning('clabsi', null)).toBe(null)
  })

  it('links surveillance-definition library rows to their criteria sets and adds the missing infant set', () => {
    const library = [
      ['CLABSI – Λοίμωξη αιματικής ροής', 'CLABSI – Central line-associated bloodstream infection', { id: 'uuid-1', source: 'ECDC' }],
      ['SSI – Λοίμωξη χειρουργικού πεδίου', 'SSI – Surgical site infection', { id: 'uuid-2' }],
      ['Τοπικός ορισμός', 'Local definition', { id: 'uuid-3', source: 'Hospital' }],
    ]
    const criteria = [
      ['CLABSI', 'CLABSI', { id: 'clabsi' }],
      ['SSI', 'SSI', { id: 'ssi' }],
      ['CLABSI (νεογνική)', 'CLABSI (neonatal/infant)', { id: 'clabsi_neonatal' }],
    ]
    const merged = withCriteriaKeys(library, criteria)
    expect(merged.map(row => row[2].criteriaKey || row[2].id)).toEqual(['clabsi', 'ssi', 'uuid-3', 'clabsi_neonatal'])
    expect(merged[0][2].id).toBe('uuid-1')
    expect(orderCriteriaForAge(merged, 36)[0][2].id).toBe('clabsi_neonatal')
    expect(withCriteriaKeys([], criteria)).toEqual(criteria)
  })
})
