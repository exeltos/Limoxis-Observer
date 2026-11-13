import { describe, expect, it } from 'vitest'
import { createActiveTimer, formatActiveTime, IDLE_AFTER_SECONDS } from '../src/features/training/trainingMaterialTime'
import { readSource } from './helpers/readSource'

describe('training material reading time', () => {
  it('counts a second only while the page is visible and in use', () => {
    let clock = 0
    const timer = createActiveTimer({ now: () => clock })
    timer.activity()
    expect(timer.tick(true)).toBe(true)
    expect(timer.tick(false)).toBe(false)
    expect(timer.pending()).toBe(1)
    // A minute without any activity: no more counting until the person uses the page again.
    clock += (IDLE_AFTER_SECONDS + 1) * 1000
    expect(timer.tick(true)).toBe(false)
    timer.activity()
    expect(timer.tick(true)).toBe(true)
    expect(timer.pending()).toBe(2)
  })

  it('sends at most 30 seconds a call and keeps the rest', () => {
    const timer = createActiveTimer({ now: () => 0 })
    for (let i = 0; i < 45; i += 1) timer.tick(true)
    expect(timer.take()).toBe(30)
    expect(timer.pending()).toBe(15)
    timer.restore(30)
    expect(timer.pending()).toBe(45)
  })

  it('writes the time in minutes and seconds, in Greek and English', () => {
    expect(formatActiveTime(0)).toBe('—')
    expect(formatActiveTime(45)).toBe('45 δ')
    expect(formatActiveTime(125)).toBe('2΄ 5΄΄')
    expect(formatActiveTime(3900, true)).toBe('1 h 5 min')
  })

  it('records the time through a token function that limits what a call can add', () => {
    const sql = readSource('supabase/migrations/20261231180000_training_material_time.sql')
    expect(sql).toContain('least(coalesce(p_seconds, 0), 30)')
    expect(sql).toContain('v_row.last_seen_at')
    expect(sql).toContain('a.access_token = p_token')
    expect(sql).not.toMatch(/\b(drop|revoke|delete)\b\s+(policy|table|function|execute|from)/i)
  })

  it('serves the file only through the public token function, listed with verify_jwt = false', () => {
    const config = readSource('supabase/config.toml')
    expect(config).toMatch(/\[functions\.training-material-url\]\s+verify_jwt = false/)
    const code = readSource('supabase/functions/training-material-url/index.ts')
    expect(code).toContain("rpc('training_access_files'")
    expect(code).toContain('createSignedUrl(attachment.storage_path, 300)')
  })
})
