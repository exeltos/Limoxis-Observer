import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
const i18n=fs.readFileSync('src/core/i18n/LanguageContext.jsx','utf8')+fs.readFileSync('src/core/i18n/stringsEn.js','utf8')

const page = fs.readFileSync('src/features/surveillance/PatientClinicalCanonicalPage.jsx', 'utf8')

describe('patient sample follow-up hierarchy', () => {
  it('supports recursive sample follow-ups with visible nesting', () => {
    expect(page).toContain("translate('copy.clinicalRecordCopy.sampleFollowUp'")
    expect(i18n).toContain("sampleFollowUp:'Επανέλεγχος δείγματος'")
    expect(page).toContain('function SampleTree({samples=[]')
    expect(page).toContain('sampleParentCode')
    expect(page).toContain('sv-sample-children')
    expect(page).toContain("translate('copy.clinicalRecordCopy.followUp',language==='el'?'el':'en')} ${depth}")
  })

  it('persists follow-up lineage in the sample code and keeps surveillance linkage', () => {
    expect(page).toContain('sampleCode:`${parent.id}-R${siblings+1}`')
    expect(page).toContain('surveillanceCaseId:parent.surveillanceCase||null')
    expect(i18n).toContain("followUp:'Follow-up'")
  })
})
