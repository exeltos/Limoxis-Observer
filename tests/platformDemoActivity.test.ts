import { describe, expect, it, vi } from 'vitest'

const tables = {
  account_invitations: [{ id: 'inv-1', user_id: 'u1', organization_id: 'org-d', accepted_at: '2026-10-12T08:00:00Z', delivery_email: 'd@x.gr', organization: { name: 'ΤΕΣΤ ΒΕΡΓΑΣ', is_demo: true } },
    { id: 'inv-2', user_id: 'u2', organization_id: 'org-h', accepted_at: '2026-10-12T07:00:00Z', organization: { name: 'Γ.Ν. Λάρισας', is_demo: false } }],
  demo_evaluation_progress: [{ demo_organization_id: 'org-d', user_id: 'u1', rating: 5, rated_at: '2026-10-12T09:00:00Z', organization: { name: 'ΤΕΣΤ ΒΕΡΓΑΣ' } }],
  profiles: [{ id: 'u1', full_name: 'Δημήτρης Βεργάς' }],
  platform_demo_entitlements: [{ id: 'demo-7', organization_id: 'org-d' }],
}
// A query that ignores its filters and resolves to the table's rows.
const query = table => { const result = Promise.resolve({ data: tables[table], error: null }); const chain = new Proxy(result, { get: (target, key) => key in target ? target[key].bind(target) : () => chain }); return chain }
vi.mock('../src/core/supabase/client', () => ({ supabase: { from: table => query(table) } }))
vi.mock('../src/core/config/env', () => ({ hasSupabaseConfig: true }))

describe('Platform Owner notifications about Demo activity', () => {
  it('reports a finished sign-up in a Demo and a completed evaluation, linked to the Demo, for the pop-up', async () => {
    const { loadDemoActivityItems } = await import('../src/features/platform/platformAttentionService')
    const items = await loadDemoActivityItems(false)
    expect(items.map(item => item.title)).toEqual(['Δημήτρης Βεργάς: ολοκλήρωσε την αξιολόγηση (5/5)', 'Δημήτρης Βεργάς: ολοκλήρωσε την εγγραφή'])
    expect(items.every(item => item.popup && item.to === '/platform#demo?demo=demo-7' && item.message === 'Demo ΤΕΣΤ ΒΕΡΓΑΣ')).toBe(true)
  })
})
