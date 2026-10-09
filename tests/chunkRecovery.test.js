// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isChunkLoadError, reloadForNewVersion } from '../src/core/errors/chunkRecovery.js'

describe('reload after a new version is published', () => {
  afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks() })

  it('recognises a missing page file', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/LabPage-1a2b.js'))).toBe(true)
    expect(isChunkLoadError(new Error("'text/html' is not a valid JavaScript MIME type"))).toBe(true)
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false)
  })

  it('reloads once, then shows the error if the file is still missing', () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { reload })
    expect(reloadForNewVersion()).toBe(true)
    expect(reloadForNewVersion()).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})
