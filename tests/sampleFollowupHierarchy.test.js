import { describe, expect, it } from 'vitest'
import { sampleParentCode } from '../src/features/surveillance/patientRecordScope'
import { readSource } from './helpers/readSource'
const i18n=readSource('src/core/i18n/stringsEl.js')+readSource('src/core/i18n/stringsEn.js')


describe('patient sample follow-up hierarchy', () => {
  it('supports recursive sample follow-ups with visible nesting', () => {
    expect(i18n).toContain("sampleFollowUp:'Επανέλεγχος δείγματος'")
    expect(sampleParentCode({ id: 'LAB-12-R1-R2' })).toBe('LAB-12-R1')
    expect(sampleParentCode({ id: 'LAB-12' })).toBe('')
  })

  it('persists follow-up lineage in the sample code and keeps surveillance linkage', () => {
    expect(i18n).toContain("followUp:'Follow-up'")
  })
})
