import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'

const raw = readSource('supabase/migrations/20261231633000_fm_link_periodic_controls.sql')
const sql = raw.replace(/^\s*--.*$/gm, '')

describe('FileMaker periodic controls linked 23/11/2026 (ΙΑΣΩ Θεσσαλίας)', () => {
  it('only inserts links and runs the existing sync: no drop, delete, revoke, truncate or policy change', () => {
    expect(sql).not.toMatch(/\b(drop|delete|revoke|truncate|alter\s+policy)\b/i)
    expect(sql).toContain("'Controls', m.record_id, 'control_assignments', a.id, 'matched'")
    expect(sql).toContain('on conflict (base_table, record_id, target_table) do nothing;')
    expect(sql).toContain('select private.fm_sync_controls();')
    expect(sql).not.toMatch(/insert into public\.control_(definitions|assignments)/)
  })

  it('links 28 controls through the FileMaker department link, never the narcotics check', () => {
    const rows = sql.match(/\('\d+','FM-CTRL-\d{4}'\)/g) ?? []
    expect(rows).toHaveLength(28)
    // The pneumatic tube disinfection: one platform control with an assignment per department.
    expect(rows.filter(row => row.includes('FM-CTRL-1341'))).toHaveLength(15)
    expect(sql).toContain("ld.base_table = 'Departments'")
    expect(sql).toContain("def.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd'")
    expect(sql).toContain("a.status = 'scheduled'")
    expect(sql).toContain("not ilike '%ναρκωτικ%'")
  })
})
