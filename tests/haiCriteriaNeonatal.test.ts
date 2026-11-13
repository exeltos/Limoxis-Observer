import { describe, expect, it } from 'vitest'
import { evaluateHaiCriteria, haiCriteriaSetForType } from '../src/features/surveillance/haiCriteriaDefinitions'

describe('neonatal/infant CLABSI criteria (CDC/NHSN, age ≤1 year)', () => {
  it('is a distinct criteria set from the adult CLABSI definition', () => {
    const neonatal = haiCriteriaSetForType('clabsi_neonatal')
    expect(neonatal).toBeTruthy()
    expect(neonatal.groups.find(g => g.id === 'micro').items.map(i => i.id)).toContain('commonCommensalTwiceInfant')
  })

  it('is not met by a common skin commensal alone, without a qualifying infant sign', () => {
    expect(evaluateHaiCriteria('clabsi_neonatal', ['centralLine48h'])).toBe(false)
  })

  it('is met by a recognized pathogen plus the device criterion, same as the adult definition', () => {
    expect(evaluateHaiCriteria('clabsi_neonatal', ['centralLine48h', 'recognizedPathogen'])).toBe(true)
  })

  it('is met by a common commensal from two cultures plus an infant-specific sign (apnea/bradycardia/hypothermia)', () => {
    expect(evaluateHaiCriteria('clabsi_neonatal', ['centralLine48h', 'commonCommensalTwiceInfant'])).toBe(true)
  })

  it('does not accept the adult-only rationale for the neonatal set (different criteria ids)', () => {
    expect(haiCriteriaSetForType('clabsi_neonatal').groups.find(g => g.id === 'micro').items.map(i => i.id)).not.toContain('commonCommensalTwice')
  })
})
