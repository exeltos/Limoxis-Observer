import { describe, expect, it, vi } from 'vitest'
import { createLaboratoryRepositorySelector, defineLaboratoryRepository } from '../src/features/laboratory/repositories/laboratoryRepository'

const repository = name => ({ name, list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn() })

describe('laboratory repository boundary', () => {
  it('selects data behavior without selecting a different page', () => {
    const demo = repository('demo')
    const production = repository('production')
    const select = createLaboratoryRepositorySelector({ demo, production })
    expect(select({ isDemo: true }).name).toBe('demo')
    expect(select({ isDemo: false }).name).toBe('production')
  })

  it('rejects incomplete repository implementations', () => {
    expect(() => defineLaboratoryRepository({ list() {} })).toThrow('LABORATORY_REPOSITORY_METHOD_REQUIRED:get')
  })
})
