import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { announcementPayload, pendingFor } from '../src/features/platform/platformAnnouncementsService'

// The platform owner's announcements to the hospital administrators (owner, 8/11/2026).
const base = { id: 'a1', status: 'active', startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-11-30T00:00:00Z', audience: [], frequency: 'once' }
const now = new Date('2026-11-08T10:00:00Z')

describe('platform announcements', () => {
  it('shows an active one of the period to every hospital, or only to the chosen ones', () => {
    expect(pendingFor([base], 'org-1', new Set(), now)).toHaveLength(1)
    expect(pendingFor([{ ...base, audience: ['org-2'] }], 'org-1', new Set(), now)).toHaveLength(0)
    expect(pendingFor([{ ...base, audience: ['org-1'] }], 'org-1', new Set(), now)).toHaveLength(1)
  })
  it('hides a stopped one, one outside its period, and a «once» one already seen; «every visit» comes back', () => {
    expect(pendingFor([{ ...base, status: 'stopped' }], 'org-1', new Set(), now)).toHaveLength(0)
    expect(pendingFor([{ ...base, startsAt: '2026-11-20T00:00:00Z' }], 'org-1', new Set(), now)).toHaveLength(0)
    expect(pendingFor([{ ...base, endsAt: '2026-11-05T00:00:00Z' }], 'org-1', new Set(), now)).toHaveLength(0)
    expect(pendingFor([base], 'org-1', new Set(['a1']), now)).toHaveLength(0)
    expect(pendingFor([{ ...base, frequency: 'every_visit' }], 'org-1', new Set(['a1']), now)).toHaveLength(1)
  })
  it('saves a trimmed row with empty optional fields as null', () => {
    const row = announcementPayload({ titleEl: ' Νέο ', bodyEl: 'Κείμενο', ctaUrl: ' ', kind: 'promotion', audience: ['org-1'] })
    expect(row).toMatchObject({ title_el: 'Νέο', body_el: 'Κείμενο', cta_url: null, kind: 'promotion', audience_org_ids: ['org-1'], frequency: 'once', status: 'active' })
  })
  it('is written only by the owner and read only by the hospital administrators it is meant for (RLS)', () => {
    const sql = readFileSync('supabase/migrations/20261231260000_platform_announcements.sql', 'utf8')
    expect(sql).toContain('using (public.current_user_is_platform_owner()) with check (public.current_user_is_platform_owner())')
    expect(sql).toContain("om.role = 'hospital_admin'")
    expect(sql).toContain('cardinality(audience_org_ids) = 0 or om.organization_id = any(audience_org_ids)')
    expect(sql).toContain('revoke all on public.platform_announcements from anon')
  })
})
