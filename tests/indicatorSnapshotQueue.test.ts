import { describe, expect, it, vi } from 'vitest'

// The indicator snapshot (~1 s on the database server) is queued: at most two at a time, the one someone is looking
// at before the background ones (comparisons, 12 months), and an aborted one never starts (speed, owner 14/11/2026).
const calls: { from: string, resolve: (value: unknown) => void }[] = []
let running = 0, maxRunning = 0
vi.mock('../src/core/data/dataEnvironment', () => ({ isDemoDataEnvironment: () => false }))
vi.mock('../src/features/pharmacy/pharmacyCloudService', () => ({ loadAccessDddTotal: async () => 0 }))
vi.mock('../src/core/supabase/cloudContext', () => ({
  cloudClient: () => ({
    rpc: (_name: string, params: { p_from: string }) => new Promise(resolve => {
      running += 1; maxRunning = Math.max(maxRunning, running)
      calls.push({ from: params.p_from, resolve: value => { running -= 1; resolve(value) } })
    }),
  }),
}))
const { collectCloudIndicatorMetrics } = await import('../src/features/indicators/indicatorCloudService')
const flush = () => new Promise(resolve => setTimeout(resolve, 0))
const answer = async (index: number) => { calls[index].resolve({ data: { aware_access_ddd_total: 1 }, error: null }); await flush() }

describe('indicator snapshot queue', () => {
  it('runs two at a time, the foreground one first, and drops aborted ones', async () => {
    const aborter = new AbortController()
    const background = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01'].map(from => collectCloudIndicatorMetrics('org', { from, to: from, background: true, signal: from === '2026-04-01' ? aborter.signal : undefined }).catch(error => error))
    await flush()
    expect(calls.map(call => call.from)).toEqual(['2026-01-01', '2026-02-01'])
    const foreground = collectCloudIndicatorMetrics('org', { from: '2026-10-01', to: '2026-10-31' })
    aborter.abort()
    await answer(0)
    expect(calls.map(call => call.from)).toEqual(['2026-01-01', '2026-02-01', '2026-10-01'])
    await answer(1); await answer(2); await answer(3)
    expect(calls.map(call => call.from)).toEqual(['2026-01-01', '2026-02-01', '2026-10-01', '2026-03-01'])
    expect(await foreground).toEqual({ aware_access_ddd_total: 1 })
    const results = await Promise.all(background)
    expect((results[3] as Error).name).toBe('AbortError')
    expect(maxRunning).toBe(2)
  })
})
