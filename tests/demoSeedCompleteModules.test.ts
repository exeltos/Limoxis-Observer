import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'

const read = path => readSource(path)
const wiring = read('supabase/migrations/20261231410000_demo_seed_complete_modules.sql')
const seeds = {
  demo_seed_rosters_regulations: 'supabase/migrations/20261231350000_demo_seed_rosters_regulations.sql',
  demo_seed_registers: 'supabase/migrations/20261231360000_demo_seed_registers.sql',
  demo_seed_interviews: 'supabase/migrations/20261231370000_demo_seed_interviews.sql',
  demo_seed_quality_resources: 'supabase/migrations/20261231380000_demo_seed_quality_resources.sql',
  demo_seed_quality_governance: 'supabase/migrations/20261231390000_demo_seed_quality_governance.sql',
}
const strip = sql => sql.replace(/--[^\n]*/g, '')

describe('Demo data pack: the modules that were empty', () => {
  it('the orchestrator calls every new seed after the kitchen, once', () => {
    const kitchen = wiring.indexOf('perform private.demo_seed_kitchen(v_org, p_actor);')
    expect(kitchen).toBeGreaterThan(0)
    for (const name of Object.keys(seeds)) {
      const call = `perform private.${name}(v_org, p_actor);`
      expect(wiring.split(call).length - 1).toBe(1)
      expect(wiring.indexOf(call)).toBeGreaterThan(kitchen)
    }
    for (const key of ['rosters', 'regulations', 'registers', 'candidates', 'suppliers', 'equipment', 'departmentMeetings', 'objectives']) expect(wiring).toContain(`'${key}'`)
  })
  it('every seed is a private security definer function that only fills a Demo', () => {
    for (const [name, path] of Object.entries(seeds)) {
      const sql = read(path)
      expect(sql).toContain(`create or replace function private.${name}(p_organization_id uuid, p_actor uuid)`)
      expect(/security\s+definer\s+set\s+search_path\s*(=|to)\s*''/i.test(sql), name).toBe(true)
      expect(/o\.is_demo/.test(sql), name).toBe(true)
      expect(sql.includes(`revoke all on function private.${name}(uuid, uuid) from public, anon, authenticated;`), name).toBe(true)
    }
  })
  it('no seed deletes data: the Demo reset clears the organization first', () => {
    for (const path of Object.values(seeds)) expect(/\bdelete\s+from\b|\btruncate\b|\bdrop\s+(table|function)\b/i.test(strip(read(path))), path).toBe(false)
  })
  it('contact addresses in the Demo are never real mailboxes', () => {
    for (const path of Object.values(seeds)) {
      const emails = strip(read(path)).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []
      for (const email of emails) expect(email).toMatch(/@(example\.(com|org|net)|[a-z.]*\.invalid)$/)
    }
  })
})
