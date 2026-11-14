import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'

// Τα στοιχεία επικοινωνίας της δημόσιας «Σελίδας παρουσίασης»: 4 στήλες στο platform_settings και μια συνάρτηση
// που επιστρέφει μόνο αυτές, ανοιχτή στον επισκέπτη χωρίς σύνδεση.
const migration = readSource('supabase/migrations/20261231510000_public_contact.sql')
const sql = migration.replace(/^--.*$/gm, '').toLowerCase()
const manifest = JSON.parse(readSource('supabase/security-definer-manifest.json'))

describe('public_contact migration', () => {
  it('adds the four public columns with their starting values', () => {
    for (const column of ['public_name', 'public_email', 'public_phone', 'public_website']) expect(sql).toContain(`add column if not exists ${column} text`)
    for (const value of ["'Exeltos'", "'info@exeltos.com'", "'694 247 1022'", "'https://exeltos.com/'"]) expect(migration).toContain(value)
    expect(sql).toContain("where id = 'global'")
  })
  it('returns only those four through a security definer function with an empty search path', () => {
    expect(sql).toContain('create or replace function public.public_contact()')
    expect(sql).toContain('returns table (name text, email text, phone text, website text)')
    expect(sql).toContain('security definer')
    expect(sql).toContain("set search_path = ''")
    expect(sql).toContain('select s.public_name, s.public_email, s.public_phone, s.public_website')
    expect(sql).not.toMatch(/support_email|maintenance_notice|select \*/)
    expect(sql).toContain('grant execute on function public.public_contact() to anon, authenticated;')
  })
  it('runs nothing the agent may not run (no revoke, drop or delete)', () => {
    expect(sql).not.toMatch(/\b(revoke|drop|delete)\b/)
  })
  it('is declared in the security definer manifest as public', () => {
    expect(manifest.functions?.public_contact ?? manifest.public_contact).toMatchObject({ category: 'public-token', anon: true, authenticated: true })
  })
})
