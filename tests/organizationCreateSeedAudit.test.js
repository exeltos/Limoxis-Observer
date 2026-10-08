import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

// Creating an organization from an Edge Function (new Demo, new hospital) has no
// signed-in user. The library seed run by the organizations insert trigger must
// not reach the "Authentication required" branch of the management audit.
describe('organization create: library seed is not blocked by the management audit', () => {
  const sql = fs.readFileSync('supabase/migrations/20261008150000_audit_skip_system_library_seed_updates.sql', 'utf8')
  it('skips both the inserted and the re-linked (ON CONFLICT DO UPDATE) system rows of a nested seed', () => {
    expect(sql).toContain("tg_op in ('INSERT','UPDATE')")
    expect(sql).toContain("coalesce(v_new->'metadata'->>'system','false') = 'true'")
    expect(sql).toContain('pg_trigger_depth() > 1')
  })
  it('still requires a signed-in user for every other management change', () => {
    expect(sql.indexOf("tg_op in ('INSERT','UPDATE')")).toBeLessThan(sql.indexOf("raise exception 'Authentication required'"))
    expect(sql).toContain("raise exception 'Organization membership required'")
    expect(sql).toContain('insert into public.system_audit_log')
  })
})

describe('demo dates', () => {
  it('requires the end of a Demo to be after its start, as the database does', async () => {
    const { demoDatesValid } = await import('../src/features/platform/platformDemoService')
    expect(demoDatesValid('2026-10-22', '2026-11-21')).toBe(true)
    expect(demoDatesValid('2026-10-22', '2026-10-21')).toBe(false)
    expect(demoDatesValid('2026-10-22', '2026-10-22')).toBe(false)
    expect(demoDatesValid('', '2026-10-22')).toBe(false)
  })
})
