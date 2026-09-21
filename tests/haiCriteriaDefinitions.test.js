import { describe, expect, it } from 'vitest'
import { HAI_CRITERIA_SETS, evaluateHaiCriteria, haiCriteriaSetForType } from '../src/features/surveillance/haiCriteriaDefinitions'

describe('HAI criteria checklists (simplified CDC/NHSN-style, decision-support only)', () => {
  it('ships a checklist for each infection type already offered in the HAI dialog', () => {
    for (const key of ['clabsi', 'cauti', 'vap', 'ssi']) {
      expect(haiCriteriaSetForType(key)).toBeTruthy()
      expect(HAI_CRITERIA_SETS[key].groups.length).toBeGreaterThan(0)
    }
  })

  it('returns null for a type outside the fixed checklist library (custom/local definitions)', () => {
    expect(haiCriteriaSetForType('local-custom-definition')).toBeNull()
    expect(evaluateHaiCriteria('local-custom-definition', ['anything'])).toBeNull()
  })

  it('requires the device criterion AND a microbiology criterion for CLABSI', () => {
    expect(evaluateHaiCriteria('clabsi', [])).toBe(false)
    expect(evaluateHaiCriteria('clabsi', ['centralLine48h'])).toBe(false)
    expect(evaluateHaiCriteria('clabsi', ['recognizedPathogen'])).toBe(false)
    expect(evaluateHaiCriteria('clabsi', ['centralLine48h', 'recognizedPathogen'])).toBe(true)
    expect(evaluateHaiCriteria('clabsi', ['centralLine48h', 'commonCommensalTwice'])).toBe(true)
  })

  it('requires the device group, at least two clinical signs, and a microbiology finding for VAP', () => {
    expect(evaluateHaiCriteria('vap', ['ventilator48h', 'newInfiltrate', 'temperatureAbnormal', 'respiratoryCulturePositive'])).toBe(false)
    expect(evaluateHaiCriteria('vap', ['ventilator48h', 'newInfiltrate', 'temperatureAbnormal', 'wbcAbnormal', 'respiratoryCulturePositive'])).toBe(true)
  })

  it('requires the timing criterion plus at least one depth-specific finding for SSI', () => {
    expect(evaluateHaiCriteria('ssi', ['superficialPurulent'])).toBe(false)
    expect(evaluateHaiCriteria('ssi', ['withinWindow', 'superficialPurulent'])).toBe(true)
  })
})
