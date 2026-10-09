import { afterEach, describe, expect, it, vi } from 'vitest'
import { allowedOrigin, PRIMARY_ORIGIN, serveWithCors } from '../supabase/functions/_shared/cors.ts'
import { invitationEmail, passwordResetEmail, usernameReminderEmail, demoAccessEmail } from '../supabase/functions/_shared/emailTemplates.ts'
import { committeeMinutesApprovalEmail } from '../supabase/functions/_shared/committeeApprovalEmail.ts'
import { purgeOrganization } from '../supabase/functions/_shared/organizationPurge.ts'

describe('edge functions · CORS', () => {
  afterEach(() => { delete globalThis.Deno })

  it('echoes only the app origins and Netlify previews', () => {
    for (const origin of ['https://www.limoxis.com', 'https://limoxis.com', 'https://limoxis-observer.netlify.app', 'https://deploy-preview-12--limoxis-observer.netlify.app', 'http://localhost:5173']) expect(allowedOrigin(origin)).toBe(origin)
    for (const origin of [null, '', 'https://evil.example', 'https://limoxis.com.evil.example', 'https://x--limoxis-observer.netlify.app.evil.example', 'http://www.limoxis.com']) expect(allowedOrigin(origin)).toBe(PRIMARY_ORIGIN)
  })

  it('adds the allowed origin and Vary to every response, keeping status and headers', async () => {
    let served
    globalThis.Deno = { serve: handler => { served = handler } }
    serveWithCors(() => new Response('{"ok":false}', { status: 403, headers: { 'Content-Type': 'application/json' } }))
    const res = await served(new Request('https://fn.example', { headers: { Origin: 'https://limoxis.com' } }))
    expect(res.status).toBe(403)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://limoxis.com')
    expect(res.headers.get('Vary')).toContain('Origin')
    expect(res.headers.get('Content-Type')).toBe('application/json')
    expect(await res.text()).toBe('{"ok":false}')
  })
})

describe('edge functions · emails', () => {
  const hostile = '<img src=x onerror=alert(1)>"\'&'
  it('escape every value that comes from users or records', () => {
    const html = [
      invitationEmail({ fullName: hostile, orgName: hostile, username: hostile, role: hostile, activationUrl: 'https://www.limoxis.com/activate?t=1' }),
      passwordResetEmail({ fullName: hostile, actionUrl: 'https://www.limoxis.com/reset' }),
      usernameReminderEmail({ fullName: hostile, username: hostile }),
      demoAccessEmail({ contactName: hostile, label: hostile, username: hostile, validFrom: '2026-10-01', validUntil: '2026-10-31', actionUrl: 'https://www.limoxis.com/login' }),
      committeeMinutesApprovalEmail({ committeeName: hostile, meetingTitle: hostile, actionUrl: 'https://www.limoxis.com/approve' }).html,
    ].map(item => typeof item === 'string' ? item : item.html)
    for (const body of html) {
      expect(body).not.toContain('<img src=x')
      expect(body).toContain('&lt;img src=x onerror=alert(1)&gt;')
    }
  })

  it('carry the action link and a plain-text alternative', () => {
    const email = committeeMinutesApprovalEmail({ committeeName: 'ΕΝΛ', meetingTitle: 'Τακτική', actionUrl: 'https://www.limoxis.com/approve?id=7', language: 'en' })
    expect(email.subject).toBe('Minutes approval required')
    expect(email.html).toContain('href="https://www.limoxis.com/approve?id=7"')
    expect(email.text).toContain('Review minutes: https://www.limoxis.com/approve?id=7')
  })
})

// A fake Supabase client that records every call and answers from a script.
function fakeAdmin({ ticketError = null, members = {}, owners = [], storageError = null } = {}) {
  const calls = []
  const query = (table) => {
    const state = { table, filters: {} }
    const chain = {
      insert: (row) => { calls.push(['insert', table, row]); state.insert = row; return chain },
      select: () => chain,
      eq: (column, value) => { state.filters[column] = value; return chain },
      limit: () => Promise.resolve({ data: table === 'organization_members' ? (members[state.filters.user_id] ? [{ id: 'm' }] : []) : [] }),
      maybeSingle: () => Promise.resolve({ data: { is_platform_owner: owners.includes(state.filters.id) } }),
      single: () => Promise.resolve(ticketError ? { data: null, error: { message: ticketError } } : { data: { id: 'ticket-1' }, error: null }),
      then: (resolve) => resolve({ data: null, error: null }),
    }
    return chain
  }
  return {
    calls,
    from: query,
    storage: { from: (bucket) => ({ remove: (names) => { calls.push(['remove', bucket, names.length]); return Promise.resolve(storageError ? { error: { message: storageError } } : { data: names, error: null }) } }) },
    auth: { admin: { deleteUser: (id) => { calls.push(['deleteUser', id]); return Promise.resolve({ error: null }) } } },
  }
}
const org = { id: 'org-1', code: 'DEMO-X', name: 'Demo X', is_demo: true }

describe('edge functions · organization purge', () => {
  it('stops before touching anything when the ticket cannot be issued', async () => {
    const admin = fakeAdmin({ ticketError: 'denied' }); const caller = { rpc: vi.fn() }
    expect(await purgeOrganization({ admin, caller, actorId: 'owner', org })).toEqual({ ok: false, error: 'denied' })
    expect(caller.rpc).not.toHaveBeenCalled()
  })

  it('stops before files and accounts when the database purge fails', async () => {
    const admin = fakeAdmin(); const caller = { rpc: vi.fn(async () => ({ data: null, error: { message: 'confirmation mismatch' } })) }
    expect(await purgeOrganization({ admin, caller, actorId: 'owner', org })).toEqual({ ok: false, error: 'confirmation mismatch' })
    expect(caller.rpc).toHaveBeenCalledWith('platform_purge_organization_tx', { p_organization_id: 'org-1', p_confirmation: 'DEMO-X', p_ticket: 'ticket-1' })
    expect(admin.calls.some(([kind]) => kind === 'remove' || kind === 'deleteUser')).toBe(false)
  })

  it('removes files in chunks of 100 and only accounts that belong nowhere else, then audits', async () => {
    const storageObjects = [...Array(150)].map((_, i) => ({ bucket: 'attachments', name: `org-1/f${i}` })).concat([{ bucket: 'logos', name: 'org-1/logo.png' }])
    const admin = fakeAdmin({ members: { 'u-other-org': true }, owners: ['u-owner2'] })
    const caller = { rpc: vi.fn(async () => ({ data: { records: 42, storageObjects, userIds: ['owner', 'u-other-org', 'u-owner2', 'u-only-here'] }, error: null })) }
    const result = await purgeOrganization({ admin, caller, actorId: 'owner', org })
    expect(result).toEqual({ ok: true, records: 42, storageRemoved: 151, accountsDeleted: 1, accountsKept: 3, warnings: [] })
    expect(admin.calls.filter(([kind]) => kind === 'remove').map(([, bucket, n]) => `${bucket}:${n}`)).toEqual(['attachments:100', 'attachments:50', 'logos:1'])
    expect(admin.calls.filter(([kind]) => kind === 'deleteUser')).toEqual([['deleteUser', 'u-only-here']])
    const audit = admin.calls.find(([kind, table]) => kind === 'insert' && table === 'system_audit_log')[2]
    expect(audit).toMatchObject({ actor_user_id: 'owner', entity_id: 'org-1', metadata: { files_total: 151, files_removed: 151, accounts_deleted: 1, accounts_kept: 3 } })
  })

  it('reports storage failures as warnings instead of failing the purge', async () => {
    const admin = fakeAdmin({ storageError: 'bucket offline' })
    const caller = { rpc: vi.fn(async () => ({ data: { records: 1, storageObjects: [{ bucket: 'attachments', name: 'org-1/a' }], userIds: [] }, error: null })) }
    const result = await purgeOrganization({ admin, caller, actorId: 'owner', org })
    expect(result.ok).toBe(true)
    expect(result.warnings).toEqual(['storage:attachments:bucket offline'])
    expect(result.storageRemoved).toBe(0)
  })
})
