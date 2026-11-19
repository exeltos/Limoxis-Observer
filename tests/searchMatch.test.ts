import { describe, expect, it } from 'vitest'
import { foldSearch, matchesSearch } from '../src/core/i18n/searchMatch'
import { readSource } from './helpers/readSource'

describe('search that finds a row by anything it shows (owner, 19/11/2026)', () => {
  it('ignores accents and capitals and needs every word', () => {
    expect(foldSearch('ΠΑΘΟΛΟΓΙΚΉ')).toBe('παθολογικη')
    expect(matchesSearch('μενν', ['ΑΡΡΕΝ ΤΣΑΝΙ', 'ΜΕΝΝ'])).toBe(true)
    expect(matchesSearch('μενν coli', ['ΑΡΡΕΝ', 'ΜΕΝΝ', 'E.coli'])).toBe(true)
    expect(matchesSearch('μενν proteus', ['ΑΡΡΕΝ', 'ΜΕΝΝ', 'E.coli'])).toBe(false)
    expect(matchesSearch('', ['x'])).toBe(true)
  })
  it('the patients list searches the department, the date, the status and the organism', () => {
    const page = readSource('src/features/patients/PatientsPage.tsx')
    expect(page).toContain('matchesSearch(query,[p.id,p.name,p.nameEn,p.hospitalRecordNumber,p.department,p.departmentEn')
    expect(page).toContain('flags?.organism?.name')
  })
})
