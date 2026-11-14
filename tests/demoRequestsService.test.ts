// @vitest-environment jsdom
// Ο μετρητής νέων αιτημάτων παρουσίασης στο μενού της κονσόλας και η ενημέρωσή του μετά από αλλαγή κατάστασης.
import { afterEach, describe, expect, it, vi } from 'vitest'

const from = vi.hoisted(() => vi.fn())
vi.mock('../src/core/supabase/client', () => ({ supabase: { from } }))
vi.mock('../src/core/config/env', async importOriginal => ({ ...(await importOriginal<object>()), hasSupabaseConfig: true }))
const { countNewDemoRequests, updateDemoRequestStatus, DEMO_REQUESTS_CHANGED } = await import('../src/features/platform/demoRequestsService')

afterEach(() => vi.clearAllMocks())

describe('demoRequestsService', () => {
  it('counts only the new requests, without loading them', async () => {
    const eq = vi.fn().mockResolvedValue({ count: 4, error: null })
    const select = vi.fn(() => ({ eq }))
    from.mockReturnValue({ select })
    expect(await countNewDemoRequests()).toBe(4)
    expect(from).toHaveBeenCalledWith('demo_requests')
    expect(select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    expect(eq).toHaveBeenCalledWith('status', 'new')
    eq.mockResolvedValueOnce({ count: null, error: { message: 'denied' } })
    expect(await countNewDemoRequests()).toBe(0)
  })

  it('tells the menu counter when a status changes', async () => {
    const row = { id: 'r1', created_at: '2026-11-13T10:00:00Z', full_name: 'Α Β', organization_name: 'Οργ', role_title: 'Ιατρός', email: 'a@b.org', phone: null, message: null, language: 'el', status: 'contacted', handled_at: '2026-11-14T08:00:00Z' }
    const single = vi.fn().mockResolvedValue({ data: row, error: null })
    from.mockReturnValue({ update: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single })) })) })) })
    const heard = vi.fn()
    window.addEventListener(DEMO_REQUESTS_CHANGED, heard)
    expect((await updateDemoRequestStatus('r1', 'contacted')).status).toBe('contacted')
    expect(heard).toHaveBeenCalledTimes(1)
    window.removeEventListener(DEMO_REQUESTS_CHANGED, heard)
  })
})
