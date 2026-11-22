// @vitest-environment jsdom
// The home page's reads kept for a short while (src/core/data/readCache): returning to the home page shows them at once;
// another hospital, the Demo, a sign-out and a save never see the kept answers.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'
import { READ_CACHE_MS, cachedRead, forgetCachedReads, peekCachedRead } from '../src/core/data/readCache'
import { readSource } from './helpers/readSource'

beforeEach(() => {
  vi.useFakeTimers()
  configureDataEnvironment({ mode: 'production', organizationId: 'org-1' })
  forgetCachedReads()
})
afterEach(() => vi.useRealTimers())

describe('read cache', () => {
  it('serves the same arguments from one read for two minutes, then reads again', async () => {
    const read = vi.fn(async () => ({ n: 1 }))
    expect(READ_CACHE_MS).toBe(2 * 60 * 1000)
    await cachedRead('rpc', { a: 1 }, read)
    expect(peekCachedRead('rpc', { a: 1 })).toEqual({ n: 1 })
    await cachedRead('rpc', { a: 1 }, read)
    expect(read).toHaveBeenCalledTimes(1)
    await cachedRead('rpc', { a: 2 }, read)
    expect(read).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(READ_CACHE_MS + 1)
    expect(peekCachedRead('rpc', { a: 1 })).toBeUndefined()
    await cachedRead('rpc', { a: 1 }, read)
    expect(read).toHaveBeenCalledTimes(3)
  })

  it('keeps no failed read', async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue('ok')
    await expect(cachedRead('rpc', {}, read)).rejects.toThrow('down')
    expect(peekCachedRead('rpc', {})).toBeUndefined()
    await expect(cachedRead('rpc', {}, read)).resolves.toBe('ok')
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('keeps no answer that keep() rejects, e.g. empty counts standing for a failed read', async () => {
    const read = vi.fn().mockResolvedValueOnce({}).mockResolvedValue({ n: 2 })
    const keep = (value: Record<string, number>) => Boolean(Object.keys(value).length)
    await expect(cachedRead('rpc', {}, read, { keep })).resolves.toEqual({})
    expect(peekCachedRead('rpc', {})).toBeUndefined()
    await expect(cachedRead('rpc', {}, read, { keep })).resolves.toEqual({ n: 2 })
    expect(peekCachedRead('rpc', {})).toEqual({ n: 2 })
    expect(read).toHaveBeenCalledTimes(2)
    expect(readSource('src/features/dashboard/dashboardCloudService.ts')).toContain('},{keep:metrics=>Boolean(Object.keys(metrics).length)})')
  })

  it('never shares an answer between hospitals or between the Demo and production', async () => {
    await cachedRead('rpc', {}, async () => 'hospital one')
    configureDataEnvironment({ mode: 'demo', organizationId: 'org-1', demoAccountId: 'acc' })
    expect(peekCachedRead('rpc', {})).toBeUndefined()
    await expect(cachedRead('rpc', {}, async () => 'demo')).resolves.toBe('demo')
    configureDataEnvironment({ mode: 'production', organizationId: 'org-2' })
    expect(peekCachedRead('rpc', {})).toBeUndefined()
    configureDataEnvironment({ mode: 'production', organizationId: 'org-1' })
    // A change of hospital empties it: back in the first hospital it reads again.
    expect(peekCachedRead('rpc', {})).toBeUndefined()
  })

  it('is emptied by a save and on sign-out', async () => {
    await cachedRead('rpc', {}, async () => 'kept')
    window.dispatchEvent(new Event('limoxis:saved'))
    expect(peekCachedRead('rpc', {})).toBeUndefined()
    const auth = readSource('src/core/auth/AuthContext.tsx')
    expect(auth.match(/forgetCachedReads\(\)/g)?.length).toBeGreaterThanOrEqual(3)
  })
})
