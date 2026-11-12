import { describe, expect, it } from 'vitest'
import { clientIp, decodeSessionId, failureWindowStart, MAX_ACCOUNT_FAILURES, MAX_IP_FAILURES, normalizeIdentifier } from '../supabase/functions/_shared/loginSecurity.ts'
import { readSource } from './helpers/readSource'

const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

describe('login security · helpers', () => {
  it('normalizes the name, reads the first forwarded IP and the session id', () => {
    expect(normalizeIdentifier('  Admin@Hospital.GR ')).toBe('admin@hospital.gr')
    expect(clientIp(new Headers({ 'x-forwarded-for': '94.64.59.134, 10.0.0.1' }))).toBe('94.64.59.134')
    expect(clientIp(new Headers({ 'cf-connecting-ip': '1.2.3.4' }))).toBe('1.2.3.4')
    expect(clientIp(new Headers())).toBeNull()
    const id = '0f8c2b0e-1d1a-4c55-9a52-3c3a1f0f9b11'
    expect(decodeSessionId(`x.${b64({ session_id: id })}.y`)).toBe(id)
    expect(decodeSessionId('garbage')).toBeNull()
    expect(decodeSessionId(`x.${b64({ session_id: "1' or 1=1" })}.y`)).toBeNull()
  })

  it('counts failures from the last 15 minutes but not from before the previous lock ended', () => {
    const now = new Date('2026-11-09T12:00:00Z')
    expect(failureWindowStart(now).toISOString()).toBe('2026-11-09T11:45:00.000Z')
    expect(failureWindowStart(now, { locked_until: '2026-11-09T11:55:00Z' }).toISOString()).toBe('2026-11-09T11:55:00.000Z')
    expect(failureWindowStart(now, { locked_until: '2026-11-09T11:58:00Z', released_at: '2026-11-09T11:50:00Z' }).toISOString()).toBe('2026-11-09T11:50:00.000Z')
    expect(failureWindowStart(now, { locked_until: '2026-11-09T10:00:00Z' }).toISOString()).toBe('2026-11-09T11:45:00.000Z')
    expect([MAX_ACCOUNT_FAILURES, MAX_IP_FAILURES]).toEqual([5, 20])
  })
})

describe('login security · wiring', () => {
  const fn = readSource('supabase/functions/username-login/index.ts')
  const sql = readSource('supabase/migrations/20261231260500_platform_login_security.sql')
  const client = readSource('src/core/auth/authService.js')
  it('every sign-in goes through the function, which checks locks first and records each attempt', () => {
    expect(client).not.toMatch(/auth\.signInWithPassword/)
    expect(client).toMatch(/LOGIN_LOCKED/)
    expect(fn.indexOf("from('platform_login_locks')")).toBeLessThan(fn.indexOf('signInWithPassword'))
    expect(fn).toMatch(/record\(true,'ok'/)
    expect(fn).toMatch(/record\(false,email\?'wrong_password':'unknown_user'\)/)
    expect(fn).toMatch(/platform_login_sessions'\)\.upsert/)
  })
  it('the tables are readable only by the Platform Owner and the trigger never blocks a sign-in', () => {
    for (const table of ['platform_login_sessions', 'platform_login_attempts', 'platform_login_locks']) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`))
      expect(sql).toMatch(new RegExp(`create policy ${table}_owner_read on public\\.${table}\\s+for select to authenticated using \\(public\\.current_user_is_platform_owner\\(\\)\\)`))
    }
    expect(sql).toMatch(/exception when others then\s+null;/)
    expect(sql).toMatch(/after insert or update or delete on auth\.sessions/)
  })
})
