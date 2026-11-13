import { describe, it, expect } from 'vitest'
import { organismsOf, resultDraftChecks, resultToSave, sampleProgress, workflowStates } from '../src/features/laboratory/laboratorySampleProgress'

const positive = (extra = {}) => ({ result: 'positive', organism: 'E. coli, K. pneumoniae', resultStatus: 'validated', ast: [], communications: [], ...extra })

describe('sampleProgress', () => {
  it('a new sample is not received and cannot be finalized', () => {
    expect(sampleProgress({ status: 'requested' })).toMatchObject({ received: false, resultValidated: false, readyToFinalize: false, locked: false })
  })

  it('a sample counts as received once processing started, even without a receipt time', () => {
    expect(sampleProgress({ status: 'processing' }).received).toBe(true)
    expect(sampleProgress({ status: 'requested', receivedAt: '2026-10-01T08:00:00Z' }).received).toBe(true)
  })

  it('every organism of a positive result needs its own susceptibility test', () => {
    const sample = { status: 'processing', microbiologyResults: [positive({ ast: [{ organism: 'E. coli' }] })] }
    expect(sampleProgress(sample)).toMatchObject({ organisms: ['E. coli', 'K. pneumoniae'], astRequired: true, astComplete: false, astDone: 1, firstMissingAst: 'K. pneumoniae' })
  })

  it('a negative result needs no susceptibility test', () => {
    const sample = { microbiologyResults: [{ result: 'negative', resultStatus: 'validated' }] }
    expect(sampleProgress(sample)).toMatchObject({ astRequired: false, astComplete: true })
  })

  it('a critical result must be communicated before it can be finalized', () => {
    const base = positive({ critical: true, ast: [{ organism: 'E. coli' }, { organism: 'K. pneumoniae' }] })
    const sample = { status: 'processing', documentsReviewedAt: '2026-10-02', microbiologyResults: [base] }
    expect(sampleProgress(sample)).toMatchObject({ communicationRequired: true, communicationComplete: false, readyToFinalize: false })
    sample.microbiologyResults = [{ ...base, communications: [{ at: '2026-10-02' }] }]
    expect(sampleProgress(sample).readyToFinalize).toBe(true)
  })

  it('finalizing also needs a validated (or amended) result and reviewed documents', () => {
    const done = { ...positive({ ast: [{ organism: 'E. coli' }, { organism: 'K. pneumoniae' }] }) }
    expect(sampleProgress({ microbiologyResults: [done] }).readyToFinalize).toBe(false)
    expect(sampleProgress({ documentsReviewedAt: 'x', microbiologyResults: [{ ...done, resultStatus: 'draft' }] }).readyToFinalize).toBe(false)
    expect(sampleProgress({ documentsReviewedAt: 'x', microbiologyResults: [{ ...done, resultStatus: 'amended' }] }).readyToFinalize).toBe(true)
  })

  it('a finalized or rejected sample is locked', () => {
    expect(sampleProgress({ finalizedAt: '2026-10-03' })).toMatchObject({ finalized: true, locked: true })
    expect(sampleProgress({ status: 'rejected' })).toMatchObject({ rejected: true, locked: true })
  })
})

describe('workflowStates', () => {
  it('marks the first open required step as next, the rest as todo', () => {
    const states = workflowStates([{ id: 'a', done: true }, { id: 'b', na: true }, { id: 'c' }, { id: 'd' }, { id: 'e', done: true }])
    expect(states.map(step => step.state)).toEqual(['done', 'na', 'next', 'todo', 'done'])
  })
})

describe('microbiology result', () => {
  it('reads the organisms of a result', () => {
    expect(organismsOf({ organism: ' E. coli ,, MRSA ' })).toEqual(['E. coli', 'MRSA'])
    expect(organismsOf(null)).toEqual([])
  })

  it('an environmental positive needs a CFU count before saving', () => {
    expect(resultDraftChecks({ result: 'positive', organisms: [], cfuCount: '' }, true).complete).toBe(false)
    expect(resultDraftChecks({ result: 'negative', organisms: [], cfuCount: '' }, true).complete).toBe(true)
    expect(resultDraftChecks({ result: '', organisms: [], cfuCount: '' }, false).complete).toBe(false)
  })

  it('compares an environmental count with the standard\'s limit', () => {
    const standard = { limitCfu: '5' }
    const draft = { result: 'positive', organisms: ['Aspergillus'], cfuCount: '5' }
    expect(resultToSave(draft, 'validated', { isEnvironmental: true, standard })).toMatchObject({ organism: 'Aspergillus', cfuCount: 5, cfuLimit: 5, withinLimit: true, validationStatus: 'validated' })
    expect(resultToSave({ ...draft, cfuCount: '6' }, 'draft', { isEnvironmental: true, standard }).withinLimit).toBe(false)
    expect(resultToSave({ ...draft, result: 'negative' }, 'draft', { isEnvironmental: true, standard })).toMatchObject({ cfuCount: 0, withinLimit: true })
  })

  it('without a configured limit, or for a clinical sample, there is no limit check', () => {
    const draft = { result: 'positive', organisms: ['E. coli'], cfuCount: '7' }
    expect(resultToSave(draft, 'draft', { isEnvironmental: true, standard: { limitCfu: '' } })).toMatchObject({ cfuCount: 7, cfuLimit: null, withinLimit: null })
    expect(resultToSave(draft, 'draft')).toMatchObject({ cfuCount: null, cfuLimit: null, withinLimit: null, organism: 'E. coli' })
  })
})
