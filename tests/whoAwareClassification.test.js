import { describe, expect, it } from 'vitest'
import { awareCategoryFor, awareCategoryLabel } from '../src/features/pharmacy/whoAwareClassification'

describe('WHO AWaRe (Access/Watch/Reserve) antimicrobial classification', () => {
  it('classifies representative antibiotics from each category', () => {
    expect(awareCategoryFor('Amoxicillin')).toBe('access')
    expect(awareCategoryFor('Oxacillin')).toBe('access')
    expect(awareCategoryFor('Ceftriaxone')).toBe('watch')
    expect(awareCategoryFor('Meropenem')).toBe('watch')
    expect(awareCategoryFor('Vancomycin')).toBe('watch')
    expect(awareCategoryFor('Colistin')).toBe('reserve')
    expect(awareCategoryFor('Linezolid')).toBe('reserve')
  })

  it('is case-insensitive and returns null for unknown antibiotics', () => {
    expect(awareCategoryFor('meropenem')).toBe('watch')
    expect(awareCategoryFor('  Meropenem  ')).toBe('watch')
    expect(awareCategoryFor('Not A Real Drug')).toBeNull()
    expect(awareCategoryFor(null)).toBeNull()
  })

  it('labels each category', () => {
    expect(awareCategoryLabel('access')).toBe('Access')
    expect(awareCategoryLabel('watch')).toBe('Watch')
    expect(awareCategoryLabel('reserve')).toBe('Reserve')
  })
})
