import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { acknowledgementLogRows, acknowledgementSummary, demoAcknowledgementMembers, demoDistributions, inAudience, professionsOf, summarizeDistributions, usersWithProfessions } from '../src/features/documents/acknowledgementLog'

const members = [
  { userId: 'u1', name: 'Άννα', role: 'department_user', departmentIds: ['icu'], profession: 'Νοσηλευτικό προσωπικό' },
  { userId: 'u2', name: 'Βασίλης', role: 'doctor_reviewer', departmentIds: ['surgery'], profession: 'Ιατρικό προσωπικό' },
  { userId: 'u3', name: 'Γιώργος', role: 'department_user', departmentIds: ['icu', 'surgery'], profession: 'Νοσηλευτικό προσωπικό' },
  { userId: 'u4', name: 'Δήμητρα', role: 'quality_manager', departmentIds: [], profession: '' },
]

describe('document read-acknowledgement log', () => {
  it('matches the audience rules of the announcement read policy', () => {
    expect(members.filter((m) => inAudience(m, { audienceType: 'all' })).length).toBe(4)
    expect(members.filter((m) => inAudience(m, { audienceType: 'department', audienceValues: ['icu'] })).map((m) => m.userId)).toEqual(['u1', 'u3'])
    expect(members.filter((m) => inAudience(m, { audienceType: 'role', audienceValues: ['quality_manager'] })).map((m) => m.userId)).toEqual(['u4'])
    expect(members.filter((m) => inAudience(m, { audienceType: 'user', audienceValues: ['u2'] })).map((m) => m.userId)).toEqual(['u2'])
  })

  it('splits the audience into acknowledged (in reading order) and pending, with a rate', () => {
    const summary = acknowledgementSummary(members, { audienceType: 'department', audienceValues: ['icu'] }, [
      { userId: 'u3', acknowledgedAt: '2026-10-02T10:00:00Z' },
    ])
    expect(summary.total).toBe(2)
    expect(summary.acknowledged.map((m) => m.userId)).toEqual(['u3'])
    expect(summary.acknowledged[0].acknowledgedAt).toBe('2026-10-02T10:00:00Z')
    expect(summary.pending.map((m) => m.userId)).toEqual(['u1'])
    expect(summary.rate).toBe(50)
  })

  it('keeps acknowledgements of people who left the audience or are unknown', () => {
    const summary = acknowledgementSummary(members, { audienceType: 'department', audienceValues: ['icu'] }, [
      { userId: 'u2', acknowledgedAt: '2026-10-01T09:00:00Z' },
      { userId: 'ghost', name: 'Παλιός χρήστης', acknowledgedAt: '2026-10-01T08:00:00Z' },
    ])
    expect(summary.acknowledged.map((m) => m.userId)).toEqual(['ghost', 'u2'])
    expect(summary.pending.map((m) => m.userId)).toEqual(['u1', 'u3'])
    expect(summary.total).toBe(4)
  })

  it('targets a professional category as a snapshot of user ids', () => {
    expect(professionsOf(members)).toEqual(['Ιατρικό προσωπικό', 'Νοσηλευτικό προσωπικό'])
    expect(usersWithProfessions(members, ['Νοσηλευτικό προσωπικό'])).toEqual(['u1', 'u3'])
  })

  it('builds one inspector row per person per distribution', () => {
    const entries = summarizeDistributions(
      [{ id: 'a1', audienceType: 'all', audienceValues: [], linkPath: '/documents/DOC-001', createdAt: '2026-10-01T08:00:00Z' }],
      members,
      [{ announcementId: 'a1', userId: 'u1', acknowledgedAt: '2026-10-01T12:00:00Z' }],
      [{ id: 'DOC-001', title: 'Υγιεινή χεριών', version: '2.0' }],
    )
    expect(entries[0].documentTitle).toBe('Υγιεινή χεριών')
    const rows = acknowledgementLogRows(entries)
    expect(rows).toHaveLength(4)
    expect(rows.filter((row) => row.status === 'acknowledged')).toHaveLength(1)
    expect(rows[0]).toMatchObject({ documentCode: 'DOC-001', version: '2.0', name: 'Άννα', status: 'acknowledged' })
  })

  it('seeds the demo with distributed published documents and mostly confirmed staff', () => {
    const staff = demoAcknowledgementMembers([{ id: 'E1', firstName: 'Α', lastName: 'Β', profession: 'Νοσηλευτικό προσωπικό' }, { id: 'E2', firstName: 'Γ', lastName: 'Δ', profession: 'Ιατρικό προσωπικό' }, { id: 'E3', firstName: 'Ε', lastName: 'Ζ' }])
    const { announcements, acks } = demoDistributions([{ id: 'DOC-1', status: 'published', title: 'Τ', publishedAt: '2026-01-01T00:00:00Z' }, { id: 'DOC-2', status: 'draft' }], staff)
    expect(announcements).toHaveLength(1)
    expect(acks.length).toBeGreaterThan(0)
    expect(acks.length).toBeLessThan(staff.length)
  })

  it('lets only distribution managers read the whole audience', () => {
    const sql = fs.readFileSync('supabase/migrations/20261008090000_document_acknowledgement_audience.sql', 'utf8')
    expect(sql).toContain('security definer')
    expect(sql).toContain("public.is_org_admin(p_organization_id)")
    expect(sql).toContain("'infection_control_lead'::public.app_role, 'quality_manager'::public.app_role")
    expect(sql).toContain('revoke all on function public.document_acknowledgement_members(uuid) from public, anon')
  })
})
