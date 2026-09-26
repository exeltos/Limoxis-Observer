// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { countNeonatalCentralLineCasesMissingBirthWeight } from '../src/features/surveillance/deviceDayIndicators'
import { collectIndicatorMetrics } from '../src/features/indicators/indicatorEngine'

const centralLine = { name: 'Central venous catheter', nameEn: 'Central venous catheter', insertedAt: '2026-08-20' }

describe('neonates missing a birth weight are surfaced, not silently dropped', () => {
  it('counts infants ≤1 year with a central line and no birth weight', () => {
    const cases = [
      { dateOfBirth: '2026-08-10', startedAt: '2026-08-24', devices: [centralLine] },
      { dateOfBirth: '2026-08-10', startedAt: '2026-08-24', devices: [centralLine], birthWeightGrams: 900 },
      { dateOfBirth: '2026-08-10', startedAt: '2026-08-24', devices: [] },
      { dateOfBirth: '1960-01-01', startedAt: '2026-08-24', devices: [centralLine] },
      { startedAt: '2026-08-24', devices: [centralLine] },
    ]
    expect(countNeonatalCentralLineCasesMissingBirthWeight(cases)).toBe(1)
  })

  it('reports the count next to the birth-weight-band CLABSI variables', () => {
    const metrics = collectIndicatorMetrics()
    expect(Number.isInteger(metrics.neonatal_central_line_cases_missing_birth_weight)).toBe(true)
    expect(metrics.neonatal_central_line_cases_missing_birth_weight).toBe(countNeonatalCentralLineCasesMissingBirthWeight())
    const engine = readFileSync('src/features/indicators/indicatorEngine.js', 'utf8')
    expect(engine).toContain('neonatal_central_line_cases_missing_birth_weight:countNeonatalCentralLineCasesMissingBirthWeight()')
  })

  it('tells the user on the patient record where the value can be corrected', () => {
    const page = readFileSync('src/features/surveillance/PatientClinicalCanonicalPage.jsx', 'utf8')
    expect(page).toContain('const infantWithoutBirthWeight=ageInDays!=null&&ageInDays<=365&&!patient?.birthWeightGrams')
    expect(page).toContain("translate('copy.neonatalCopy.missingBirthWeight'")
  })
})
