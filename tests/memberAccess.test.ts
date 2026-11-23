// Χρήστες οργανισμού: προσωρινός ή δικός του κωδικός, κλείδωμα (owner, 23/11/2026, όπως στο Sergi Tracker).
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { accessCounts, passwordState, passwordStateLabel, type MemberAccess } from '../src/features/platform/memberAccess'
import { readSource } from './helpers/readSource'

const read = (file: string) => readSource(path.resolve(__dirname, '..', file))
const el = (text: string) => text
const access = (patch: Partial<MemberAccess> = {}): MemberAccess => ({ mustChange: false, expiresAt: null, lockedAt: null, lastSignInAt: null, ...patch })

describe('member access', () => {
  it('reads the password state: locked before temporary, own otherwise, none for an invitation', () => {
    expect(passwordState(access({ mustChange: true, lockedAt: '2026-11-20T10:00:00Z' }))).toBe('locked')
    expect(passwordState(access({ mustChange: true }))).toBe('temporary')
    expect(passwordState(access())).toBe('own')
    expect(passwordState(access({ mustChange: true }), true)).toBeNull()
    expect(passwordState(null)).toBeNull()
  })

  it('shows the expiry of a temporary password as an Athens day', () => {
    expect(passwordStateLabel(el, 'temporary', access({ mustChange: true, expiresAt: '2026-11-30T22:30:00Z' }))).toBe('Προσωρινός κωδικός · λήγει 01/12')
    expect(passwordStateLabel(el, 'temporary', access({ mustChange: true }))).toBe('Προσωρινός κωδικός')
    expect(passwordStateLabel(el, 'own')).toBe('Δικός του κωδικός')
    expect(passwordStateLabel(el, 'locked')).toBe('Κλειδωμένος')
  })

  it('counts online and each password state, leaving invitations out', () => {
    const map = new Map([['a', access({ mustChange: true })], ['b', access()], ['c', access({ lockedAt: '2026-11-20T10:00:00Z' })], ['d', access({ mustChange: true })]])
    expect(accessCounts(['a', 'b', 'c', 'd'], map, new Set(['b']), new Set(['d']))).toEqual({ online: 1, temporary: 1, own: 1, locked: 1 })
  })

  it('reads the states through one guarded function, for the admin or the Platform Owner only', () => {
    const sql = read('supabase/migrations/20261231631000_organization_member_access.sql')
    expect(sql).toMatch(/security definer/)
    expect(sql).toMatch(/set search_path to ''/)
    expect(sql).toMatch(/current_user_is_platform_owner\(\) or public\.is_org_admin\(p_organization_id\)/)
    expect(sql).toMatch(/revoke all on function public\.organization_member_access\(uuid\) from public, anon/)
  })

  it('shows «Πρόσβαση» and the totals in both user lists', () => {
    const owner = read('src/features/platform/PlatformOrganizationUsersTab.tsx')
    const admin = read('src/features/management/ManagementUsersPanel.tsx')
    for (const source of [owner, admin]) {
      expect(source).toContain('<AccessCell')
      expect(source).toContain("tx('Πρόσβαση', 'Access')".replace(', ', admin === source ? ',' : ', '))
    }
    expect(owner).toContain("tx('Τμήμα', 'Department')")
    expect(owner).toContain("['locked', tx('κλειδωμένοι', 'locked')")
    expect(admin).toContain("totalItem('temporary'")
  })
})
