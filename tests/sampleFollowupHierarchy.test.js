import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const page = fs.readFileSync('src/features/surveillance/PatientClinicalCanonicalPage.jsx', 'utf8')

describe('patient sample follow-up hierarchy', () => {
  it('supports recursive sample follow-ups with visible nesting', () => {
    expect(page).toContain("'Επανέλεγχος δείγματος'")
    expect(page).toContain('function SampleTree({samples=[]')
    expect(page).toContain('sampleParentCode')
    expect(page).toContain('linked?32:depth*28')
  })

  it('persists follow-up lineage in the sample code and keeps surveillance linkage', () => {
    expect(page).toContain('sampleCode:`${parent.id}-R${siblings+1}`')
    expect(page).toContain('surveillanceCaseId:parent.surveillanceCase||null')
    expect(page).toContain("'Επανέλεγχος':'Follow-up'")
  })
})
