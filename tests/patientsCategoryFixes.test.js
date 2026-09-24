import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { normalizeLaboratorySample } from '../src/features/laboratory/model/laboratoryModel'
import { demoClinicalScaleDefinitions } from '../src/features/clinical-scales/clinicalScaleDemoDefinitions'
import { buildClinicalScaleContext } from '../src/features/clinical-scales/clinicalScaleContext'

// User-reported review of the Patients category.
const canonical = fs.readFileSync('src/features/surveillance/PatientClinicalCanonicalPage.jsx', 'utf8')
const scales = fs.readFileSync('src/features/clinical-scales/PatientClinicalScalesPanel.jsx', 'utf8')

describe('Patients category fixes', () => {
  it('demo offers clinical assessment tools, so "New assessment" is available', () => {
    expect(scales).toContain('isDemo?Promise.resolve(demoClinicalScaleDefinitions)')
    expect(scales).toContain('const patientKey=patient?.recordId||(isDemo?patient?.id:null)')
    const icuAdult = buildClinicalScaleContext(demoClinicalScaleDefinitions, [], { age: 68, admission: { department_name: 'ΜΕΘ' } })
    expect(icuAdult.map(x => x.scale_key)).toEqual(expect.arrayContaining(['sofa', 'braden', 'gcs']))
  })

  it('explains why there is no "New assessment" button instead of asking the user to create one', () => {
    expect(scales).toContain('Κέντρο Διαχείρισης → Κλινικές κλίμακες')
  })

  it('translates clinical terms through the app dictionary instead of showing raw keys', () => {
    expect(canonical).toContain("value={clinicalTerm(assessment?.classification,language,t)}")
    expect(canonical).toContain("value={clinicalTerm(lastReview?.status,language,t)}")
    expect(canonical).toContain("if(typeof translated==='string'&&translated!==String(value).trim())return translated")
  })

  it('labels a surveillance episode with its HAI type', () => {
    expect(canonical).toContain('{episodeTypeLabel(ep,t)}')
  })

  it('keeps the patient code of demo laboratory samples so they link to the patient', () => {
    expect(normalizeLaboratorySample({ id: 'LAB-1', patientId: 'PT-260184' }).patientId).toBe('PT-260184')
    expect(normalizeLaboratorySample({ id: 'LAB-2', patientId: '0b1c2d3e-1111-4222-8333-444455556666', patient_code: 'PT-9' }).patientId).toBe('PT-9')
    expect(normalizeLaboratorySample({ id: 'LAB-3', patientId: '0b1c2d3e-1111-4222-8333-444455556666' }).patientId).toBe('')
  })

  it('shows surname and first name as separate fields', () => {
    expect(canonical).not.toContain("'Ονοματεπώνυμο':'Full name'")
    expect(canonical).toContain("[language==='el'?'Επώνυμο':'Last name'")
  })
})
