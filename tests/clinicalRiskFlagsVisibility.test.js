import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { clinicalRiskFlags } from '../src/features/clinical-scales/ClinicalRiskFlags'
import { createPatientScaleAssessment, loadPatientScaleAssessments } from '../src/features/clinical-scales/patientClinicalScalesService'
import { loadLatestPatientRiskFlags } from '../src/features/clinical-scales/patientRiskFlagsService'

// User-reported: clinical-scale risk flags were not visible anywhere.
describe('clinical-scale risk flags are visible and correctly toned', () => {
  it('colours Braden by its cut-offs and never shows tools without a risk level as green', () => {
    const byKind = rows => Object.fromEntries(clinicalRiskFlags(rows).map(f => [f.kind, f.tone]))
    expect(byKind([{ scale_key: 'braden', score: 6 }]).pressure).toBe('danger')
    expect(byKind([{ scale_key: 'braden', score: 16 }]).pressure).toBe('warning')
    expect(byKind([{ scale_key: 'braden', score: 21 }]).pressure).toBe('active')
    expect(byKind([{ scale_key: 'apache-ii', score: 26 }]).severity).toBe('')
    expect(byKind([{ scale_key: 'gcs', score: 13, interpretation: 'mild_or_normal_range' }]).neuro).toBe('active')
    expect(byKind([{ scale_key: 'morse', score: 40, interpretation: 'medium' }]).fall).toBe('warning')
  })

  it('keeps demo assessments for the session and feeds them to the registry flags', async () => {
    const definition = { id: 'd', scale_key: 'morse', version: 'MFS', name_el: 'Morse', name_en: 'Morse' }
    await createPatientScaleAssessment(null, 'PT-TEST', 'ADM-1', definition, { score: 50, risk: 'high', parts: {} }, {}, { isDemo: true })
    expect((await loadPatientScaleAssessments(null, 'PT-TEST', 'ADM-1', { isDemo: true }))[0].score).toBe(50)
    expect((await loadLatestPatientRiskFlags(null, { isDemo: true }))['PT-TEST'][0].scale_key).toBe('morse')
  })

  it('counts amended (edited) assessments, shows flags in the record header, and avoids the global button.danger rule', () => {
    expect(fs.readFileSync('src/features/clinical-scales/patientRiskFlagsService.js', 'utf8')).toContain("const CURRENT_STATUSES=['final','amended']")
    expect(fs.readFileSync('src/features/surveillance/PatientClinicalCanonicalPage.jsx', 'utf8')).toContain('<ClinicalRiskFlags rows={riskFlagRows[patient.recordId]||riskFlagRows[patient.id]||[]}')
    expect(fs.readFileSync('src/features/clinical-scales/ClinicalRiskFlags.jsx', 'utf8')).toContain('risk-tone-')
  })
})
