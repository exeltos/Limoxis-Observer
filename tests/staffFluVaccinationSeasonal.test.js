import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = 'supabase/migrations'
const latest = fs.readdirSync(dir).filter(name => name.endsWith('.sql') && fs.readFileSync(path.join(dir, name), 'utf8').includes('function private.indicator_metric_snapshot')).sort().at(-1)
const sql = fs.readFileSync(path.join(dir, latest), 'utf8')

describe('Staff influenza vaccination indicator', () => {
  it('counts a vaccination without a «valid until» date only for the 12 months after it', () => {
    expect(sql).toContain("(v.valid_until>=p_to or (v.valid_until is null and v.vaccination_date>p_to-interval '12 months'))")
    expect(sql).not.toContain('(v.valid_until is null or v.valid_until>=p_to)')
  })
})
