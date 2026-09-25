import { describe, expect, it } from 'vitest'
import { buildDemoScaleAssessments } from '../src/features/clinical-scales/clinicalScaleDemoSeed'
import { calculateClinicalScale } from '../src/features/clinical-scales/clinicalScaleEngine'
import { patientDemoData } from '../src/features/patients/patientDemoData'

describe('demo clinical scale assessments', () => {
  const rows = buildDemoScaleAssessments()
  it('gives every admitted demo patient at least two assessments', () => {
    for (const patient of patientDemoData.filter(item => item.admissionDate)) {
      expect(rows.filter(row => row.patient_id === (patient.recordId || patient.id)).length).toBeGreaterThanOrEqual(2)
    }
  })
  it('stores scores computed by the scale engine, never hand-written numbers', () => {
    for (const row of rows) expect(row.score).toBe(calculateClinicalScale(row.scale_key, row.answers).score)
  })
  it('uses paediatric tools for the neonate', () => {
    expect(rows.filter(row => row.patient_id === 'PT-260190').map(row => row.scale_key)).toEqual(expect.arrayContaining(['pediatric-gcs', 'humpty-dumpty']))
  })
})
