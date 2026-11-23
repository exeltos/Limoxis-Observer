import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'

const raw = readSource('supabase/migrations/20261231623000_fm_link_unlinked_controls.sql')
const sql = raw.replace(/^\s*--.*$/gm, '')

describe('FileMaker controls linked 22/11/2026 (ΙΑΣΩ Θεσσαλίας)', () => {
  it('only inserts links and runs the existing sync: no drop, delete, revoke, truncate or policy change', () => {
    expect(sql).not.toMatch(/\b(drop|delete|revoke|truncate|alter\s+policy)\b/i)
    expect(sql).toContain("insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)")
    expect(sql).toContain("'Controls', m.record_id, 'control_assignments', a.id, 'matched'")
    expect(sql).toContain('on conflict (base_table, record_id, target_table) do nothing;')
    expect(sql).toContain('select private.fm_sync_controls();')
  })

  it('links the 16 controls of the hospital to existing department controls, never the narcotics check', () => {
    const rows = sql.match(/\('\d+',\s+'[^']+',\s+'FM-CTRL-\d{4}'\)/g) ?? []
    expect(rows).toHaveLength(16)
    expect(sql).toContain("d.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd'")
    expect(sql).toContain("a.status = 'scheduled'")
    expect(sql).toContain("not ilike '%ναρκωτικ%'")
    for (const department of ['Αναισθησιολογικό', 'Αιμοδυναμικό', 'Ενδοσκοπικό', 'Οφθαλμολογικό Χειρουργείο', 'Τεχνική Υπηρεσία', 'Αιμοδοσία', 'Κεντρικά Εργαστήρια']) {
      expect(sql).toContain(`'${department}'`)
    }
    expect(sql).not.toMatch(/insert into public\.control_(definitions|assignments)/)
  })
})
