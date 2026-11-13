import { describe, expect, it } from 'vitest'
import { ageText, formatValue } from '../src/features/registers/registerEngine'
import type { RegisterField } from '../src/features/registers/registerTypes'

const ageField = { key: 'age_on_admission', type: 'computed', computed: 'ageDays', from: 'birth_date', to: 'admission_date', unit: 'ημέρες', unitEn: 'days' } as RegisterField

describe('Age on admission of a newborn', () => {
  it('shows the hours of the entry when the baby is under 3 days old', () => {
    expect(ageText(0, 5, 'el')).toBe('5 ώρες')
    expect(ageText(1, 30, 'el')).toBe('30 ώρες')
    expect(ageText(2, 1, 'en')).toBe('1 hour')
    expect(ageText(0, 12.5, 'en')).toBe('12.5 hours')
  })
  it('reads «under 1 day» when it was admitted the day it was born and no hours are known', () => {
    expect(ageText(0, null, 'el')).toBe('κάτω από 1 ημέρα')
    expect(ageText(0, '', 'en')).toBe('under 1 day')
  })
  it('keeps days from 3 days on, even if hours are written', () => {
    expect(ageText(3, 72, 'el')).toBe('3 ημέρες')
    expect(ageText(10, null, 'en')).toBe('10 days')
    expect(ageText(1, null, 'el')).toBe('1 ημέρα')
  })
  it('formatValue applies it to the admission age and leaves other computed values alone', () => {
    expect(formatValue(ageField, 0, 'el', { admission_age_hours: 4 })).toBe('4 ώρες')
    expect(formatValue(ageField, 0, 'el')).toBe('κάτω από 1 ημέρα')
    expect(formatValue({ key: 'length_of_stay', type: 'computed', computed: 'days', unit: 'ημέρες' } as RegisterField, 0, 'el')).toBe('0 ημέρες')
  })
})
