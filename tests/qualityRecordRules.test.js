import { describe, it, expect } from 'vitest'
import { isFinalizedQualityRecord, openStepsBlockingCapa, recordOwners, statusOptions, withIncidentClass, withOwnerAdded, withOwnerRemoved } from '../src/features/quality/qualityRecordRules'

describe('quality record statuses', () => {
  it('each record type has its own statuses; audits are the default', () => {
    expect(statusOptions('incidents')).toEqual(['reported', 'underReview', 'closed'])
    expect(statusOptions('capas')).toEqual(['open', 'inProgress', 'verification', 'closed'])
    expect(statusOptions('audits')).toEqual(['planned', 'inProgress', 'completed', 'cancelled'])
  })

  it('closed, completed and cancelled records are finalized', () => {
    expect(['closed', 'completed', 'cancelled'].map(status => isFinalizedQualityRecord({ status }))).toEqual([true, true, true])
    expect(isFinalizedQualityRecord({ status: 'verification' })).toBe(false)
    expect(isFinalizedQualityRecord(null)).toBe(false)
  })
})

describe('responsible people', () => {
  it('reads the owners list, or the single legacy owner', () => {
    expect(recordOwners({ owners: ['A', 'B'], owner: 'C' })).toEqual(['A', 'B'])
    expect(recordOwners({ owners: [], owner: 'C' })).toEqual(['C'])
    expect(recordOwners({})).toEqual([])
  })

  it('adds a trimmed name once, moving a legacy owner into the list', () => {
    expect(withOwnerAdded({ owner: 'C' }, '  A ')).toMatchObject({ owner: '', owners: ['C', 'A'] })
    expect(withOwnerAdded({ owners: ['A'] }, 'A').owners).toEqual(['A'])
    const unchanged = { owners: ['A'] }
    expect(withOwnerAdded(unchanged, '   ')).toBe(unchanged)
  })

  it('removes a name', () => {
    expect(withOwnerRemoved({ owners: ['A', 'B'] }, 'A')).toMatchObject({ owners: ['B'], owner: '' })
    expect(withOwnerRemoved({ owner: 'C' }, 'C').owners).toEqual([])
  })
})

describe('openStepsBlockingCapa', () => {
  const steps = [{ done: true }, { done: false }, {}]
  it('counts open steps when a CAPA moves to verification or closes', () => {
    expect(openStepsBlockingCapa('capas', { status: 'closed', subActions: steps }, { status: 'inProgress' })).toBe(2)
    expect(openStepsBlockingCapa('capas', { status: 'verification', subActions: steps }, { status: 'open' })).toBe(2)
    expect(openStepsBlockingCapa('capas', { status: 'closed', subActions: [{ done: true }] }, { status: 'open' })).toBe(0)
  })

  it('does not block other moves, a CAPA already there, or other record types', () => {
    expect(openStepsBlockingCapa('capas', { status: 'inProgress', subActions: steps }, { status: 'open' })).toBe(0)
    expect(openStepsBlockingCapa('capas', { status: 'closed', subActions: steps }, { status: 'verification' })).toBe(0)
    expect(openStepsBlockingCapa('findings', { status: 'closed', subActions: steps }, { status: 'open' })).toBe(0)
  })
})

describe('withIncidentClass', () => {
  it('a near miss did not reach the patient and has no impact', () => {
    expect(withIncidentClass({ impact: 'major' }, 'nearMiss')).toMatchObject({ incidentClass: 'nearMiss', reachedPatient: false, harmOccurred: false, impact: 'none' })
  })

  it('a harmful incident reached the patient and keeps an impact, at least minor', () => {
    expect(withIncidentClass({ impact: 'none' }, 'harmful')).toMatchObject({ reachedPatient: true, harmOccurred: true, impact: 'minor' })
    expect(withIncidentClass({ impact: 'major' }, 'harmful').impact).toBe('major')
  })

  it('an incident without harm reached the patient, with no impact', () => {
    expect(withIncidentClass({ impact: 'minor' }, 'noHarm')).toMatchObject({ reachedPatient: true, harmOccurred: false, impact: 'none' })
  })
})
