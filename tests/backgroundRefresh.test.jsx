// @vitest-environment jsdom
// Background reads: the bell and the home tiles read their counts on entry and
// every few minutes while the page is in view (not every minute, not while the
// tab is hidden), and the home page and the bell share one read of the counts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

let countQueries = 0
function builder() {
  const chain = new Proxy({}, {
    get(_, name) {
      if (name === 'then') return resolve => { countQueries += 1; resolve({ count: 2, error: null }) }
      return () => chain
    },
  })
  return chain
}
vi.mock('../src/core/config/env', () => ({ hasSupabaseConfig: true }))
vi.mock('../src/core/supabase/client', () => ({ supabase: { from: () => builder() } }))

const { DATA_REFRESH_MS, useDataRefreshTick } = await import('../src/core/notifications/useDataRefreshTick')
const { forgetDashboardMetrics, loadDashboardMetrics } = await import('../src/features/dashboard/dashboardCloudService')

let visibility = 'visible'
beforeEach(() => {
  vi.useFakeTimers()
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
  countQueries = 0
  forgetDashboardMetrics()
})
afterEach(() => vi.useRealTimers())

describe('data refresh tick', () => {
  it('moves every five minutes while the page is in view, not every minute', () => {
    expect(DATA_REFRESH_MS).toBe(5 * 60 * 1000)
    const { result } = renderHook(() => useDataRefreshTick())
    act(() => { vi.advanceTimersByTime(60 * 1000) })
    expect(result.current).toBe(0)
    act(() => { vi.advanceTimersByTime(DATA_REFRESH_MS) })
    expect(result.current).toBe(1)
  })

  it('reads nothing while hidden and catches up when the page comes back', () => {
    const { result } = renderHook(() => useDataRefreshTick())
    visibility = 'hidden'
    act(() => { vi.advanceTimersByTime(3 * DATA_REFRESH_MS) })
    expect(result.current).toBe(0)
    visibility = 'visible'
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(result.current).toBe(1)
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(result.current).toBe(1)
  })
})

describe('dashboard counts', () => {
  it('serves the home page and the bell from one read', async () => {
    const [first, second] = await Promise.all([loadDashboardMetrics('org-1'), loadDashboardMetrics('org-1')])
    expect(first).toEqual(second)
    const perRead = countQueries
    expect(perRead).toBeGreaterThan(10)
    // A department's home also counts its controls due today and its self-assessments to complete: two more counts.
    await loadDashboardMetrics('org-1', { departmentIds: ['dep-1'] })
    expect(countQueries).toBe(perRead * 2 + 2)
    vi.advanceTimersByTime(31 * 1000)
    await loadDashboardMetrics('org-1')
    expect(countQueries).toBe(perRead * 3 + 2)
  })
})
