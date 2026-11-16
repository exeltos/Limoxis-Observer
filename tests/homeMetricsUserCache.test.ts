// @vitest-environment jsdom
// The home page shows the user's last counts at once and refreshes them (ταχύτητα, ιδιοκτήτης 16/11/2026). The stored
// counts belong to one user, hospital and scope, and are removed on sign-out.
import { beforeEach, describe, expect, it, vi } from 'vitest'

let userId = 'user-a'
const rpc = vi.fn(async (): Promise<{ data: Record<string, number>, error: null }> => ({ data: { overdueControls: 3, openIncidents: 2 }, error: null }))
vi.mock('../src/core/config/env', () => ({ hasSupabaseConfig: true }))
vi.mock('../src/core/supabase/client', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: userId ? { user: { id: userId } } : null } }) } },
}))
vi.mock('../src/core/supabase/cloudContext', () => ({ cloudClient: () => ({ rpc }) }))

const { loadDashboardMetrics, readStoredDashboardMetrics, forgetDashboardMetrics } = await import('../src/features/dashboard/dashboardCloudService')
const { clearUserCache } = await import('../src/core/data/userCache')
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

beforeEach(() => { window.localStorage.clear(); forgetDashboardMetrics(); userId = 'user-a' })

describe('home counts kept for the next visit', () => {
  it('keeps the last counts per user, hospital and scope, and forgets them on sign-out', async () => {
    expect(await readStoredDashboardMetrics('org-1')).toBeNull()
    await loadDashboardMetrics('org-1')
    await flush()
    expect(await readStoredDashboardMetrics('org-1')).toEqual({ overdueControls: 3, openIncidents: 2 })
    // Another hospital, another scope (a department role) or another user: nothing.
    expect(await readStoredDashboardMetrics('org-2')).toBeNull()
    expect(await readStoredDashboardMetrics('org-1', { departmentIds: ['d1'] })).toBeNull()
    userId = 'user-b'
    expect(await readStoredDashboardMetrics('org-1')).toBeNull()
    userId = 'user-a'
    clearUserCache()
    expect(await readStoredDashboardMetrics('org-1')).toBeNull()
  })

  it('stores nothing without a signed-in user', async () => {
    userId = ''
    await loadDashboardMetrics('org-1')
    await flush()
    expect(Object.keys(window.localStorage).filter(key => key.startsWith('limoxis.userCache'))).toEqual([])
  })

  it('does not keep counts under another user who signed in while they loaded', async () => {
    let answer
    rpc.mockImplementationOnce(() => new Promise(resolve => { answer = resolve }))
    const loading = loadDashboardMetrics('org-1')
    await flush()
    userId = 'user-b'
    answer({ data: { overdueControls: 9 }, error: null })
    await loading
    await flush()
    expect(await readStoredDashboardMetrics('org-1')).toBeNull()
    userId = 'user-a'
    expect(await readStoredDashboardMetrics('org-1')).toBeNull()
  })

  it('keeps the last counts when a refresh comes back empty', async () => {
    await loadDashboardMetrics('org-1')
    await flush()
    forgetDashboardMetrics()
    rpc.mockImplementationOnce(async () => ({ data: {}, error: null }))
    await loadDashboardMetrics('org-1')
    await flush()
    expect(await readStoredDashboardMetrics('org-1')).toEqual({ overdueControls: 3, openIncidents: 2 })
  })
})
