import { afterEach, describe, expect, it, vi } from 'vitest'
import { readSessionJson, readSessionValue, writeSessionJson, writeSessionValue } from '../src/core/storage/browserStorage'
import { registryStorageKey } from '../src/core/navigation/useRegistryMemory'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('browser storage safeguards', () => {
  it('uses one canonical key format for registry state', () => {
    expect(registryStorageKey('prevention-waste', 'view')).toBe('limoxis.registry.prevention-waste.view')
  })

  it('uses fallbacks when rendered outside a browser', () => {
    expect(readSessionValue('missing', 'fallback')).toBe('fallback')
    expect(readSessionJson('missing', { safe: true })).toEqual({ safe: true })
    expect(writeSessionValue('key', 'value')).toBe(false)
  })

  it('round-trips values when session storage is available', () => {
    const values = new Map()
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
      },
    })

    expect(writeSessionValue('plain', 42)).toBe(true)
    expect(readSessionValue('plain')).toBe('42')
    expect(writeSessionJson('json', { enabled: true })).toBe(true)
    expect(readSessionJson('json')).toEqual({ enabled: true })
  })

  it('does not crash when storage is blocked or contains invalid JSON', () => {
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (key) => {
          if (key === 'blocked') throw new Error('SecurityError')
          return '{invalid'
        },
        setItem: () => { throw new Error('QuotaExceededError') },
      },
    })

    expect(readSessionValue('blocked', 'safe')).toBe('safe')
    expect(readSessionJson('invalid', [])).toEqual([])
    expect(writeSessionValue('blocked', 'value')).toBe(false)
    expect(writeSessionJson('blocked', { value: true })).toBe(false)
  })
})
