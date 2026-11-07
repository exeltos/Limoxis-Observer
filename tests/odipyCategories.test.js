import { describe, expect, it } from 'vitest'
import { ODIPY_GROUPS, odipyGroupOf, odipyItem, odipyLabel, odipyItemOptions } from '../src/features/quality/odipyCategories'
import { categoryKind, incidentCategoryLabel } from '../src/features/quality/qualityVocabulary'

describe('ΟΔΙΠΥ incident categories', () => {
  it('has the six groups of the form and a separate group for clinical outcomes', () => {
    expect(ODIPY_GROUPS.map(group => group.key)).toEqual(['care', 'safety', 'equipment', 'security', 'staff', 'process', 'outcome'])
    expect(ODIPY_GROUPS.find(group => group.key === 'outcome').outsideForm).toBe(true)
    for (const group of ODIPY_GROUPS) expect(group.items.at(-1).key).toMatch(/-other$/)
  })
  it('reads a category as «group · item» and earlier categories as the nearest item', () => {
    expect(odipyLabel('odipy-fall', 'el')).toBe('Ασφάλεια ασθενούς · Πτώση')
    expect(incidentCategoryLabel('odipy-sharps', [], 'el')).toBe('Προσωπικό · Τρύπημα από αιχμηρό αντικείμενο')
    expect(odipyItem('fall').key).toBe('odipy-fall')
    expect(odipyGroupOf('medication').key).toBe('care')
    expect(odipyItemOptions('staff', 'el').length).toBe(7)
  })
  it('keeps patient care, safety and outcomes clinical, the rest non-clinical', () => {
    expect(categoryKind('odipy-fall')).toBe('clinical')
    expect(categoryKind('odipy-death')).toBe('clinical')
    expect(categoryKind('odipy-sharps')).toBe('nonClinical')
    expect(categoryKind('fall')).toBe('clinical')
  })
})
