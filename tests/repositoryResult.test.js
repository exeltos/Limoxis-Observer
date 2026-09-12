import { describe, expect, it } from 'vitest'
import { READINESS, isRepositoryResult, notConfiguredResult, repositoryResult } from '../src/core/data/repositoryResult'

describe('repository result contract', () => {
  it('classifies empty collections without hiding errors', () => {
    expect(repositoryResult([])).toEqual({ data: [], readiness: READINESS.EMPTY, missingConfiguration: [] })
    expect(repositoryResult([{ id: 1 }]).readiness).toBe(READINESS.READY)
  })

  it('requires configuration details for a not-configured result', () => {
    expect(notConfiguredResult([], ['departments'])).toEqual({ data: [], readiness: READINESS.NOT_CONFIGURED, missingConfiguration: ['departments'] })
    expect(() => notConfiguredResult([], [])).toThrow('MISSING_CONFIGURATION_DETAILS_REQUIRED')
  })

  it('recognizes only complete repository results', () => {
    expect(isRepositoryResult(repositoryResult([]))).toBe(true)
    expect(isRepositoryResult({ data: [], readiness: 'empty' })).toBe(false)
  })
})
