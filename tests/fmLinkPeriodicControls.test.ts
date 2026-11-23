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
    const rows: string[] = sql.match(/\('\d+','FM-CTRL-\d{4}'\)/g) ?? []
    expect(rows).toHaveLength(28)
    // The pneumatic tube disinfection: one platform control with an assignment per department.
    expect(rows.filter(row => row.includes('FM-CTRL-1341'))).toHaveLength(15)
    expect(sql).toContain("ld.base_table = 'Departments'")
    expect(sql).toContain("def.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd'")
    expect(sql).toContain("a.status = 'scheduled'")
    expect(sql).toContain("not ilike '%ναρκωτικ%'")
  })
})

describe('FileMaker controls created 23/11/2026 (ΙΑΣΩ Θεσσαλίας, owner OK)', () => {
  const created = readSource('supabase/migrations/20261231634000_fm_create_three_controls.sql').replace(/^\s*--.*$/gm, '')
  it('creates only the 3 controls the platform did not have, once, and links them', () => {
    expect(created).not.toMatch(/\b(drop|delete|revoke|truncate|alter\s+policy|update)\b/i)
    for (const code of ['FM-CTRL-0011', 'FM-CTRL-1242', 'FM-CTRL-1380']) expect(created).toContain(`'${code}'`)
    for (const department of ['ΜΕΘ', 'ΤΕΠ', 'Χειρουργεία']) expect(created).toContain(`'${department}')`)
    expect(created).toContain('where not exists (select 1 from public.control_definitions x')
    expect(created).toContain("'created from FileMaker (23/11/2026)'")
    expect(created).toContain('select private.fm_sync_controls();')
  })
})

describe('the 3 created controls keep their FileMaker start date (Codex, #695)', () => {
  const fix = readSource('supabase/migrations/20261231635000_fm_three_controls_history_start.sql').replace(/^\s*--.*$/gm, '')
  it('sets created_at from the FileMaker CreationTimestamp for those 3 controls only', () => {
    expect(fix).not.toMatch(/\b(drop|delete|revoke|truncate|alter\s+policy)\b/i)
    expect(fix).toContain("set created_at = (c.data->>'CreationTimestamp')::timestamptz")
    expect(fix).toContain("def.code in ('FM-CTRL-0011', 'FM-CTRL-1242', 'FM-CTRL-1380')")
    expect(fix).toContain("l.note = 'created from FileMaker (23/11/2026)'")
  })
})
