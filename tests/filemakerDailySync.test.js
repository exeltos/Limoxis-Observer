import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
const controls = read('20261211130000_filemaker_hourly_sync.sql')
const areas = read('20261211140000_filemaker_hourly_sync_areas.sql')
const daily = read('20261211150000_filemaker_daily_sync_indicators.sql')
const nicu = read('20261211160000_filemaker_daily_sync_nicu.sql')

describe('FileMaker daily sync', () => {
  it('runs once a day (owner, 27/10/2026): read again at 01:05 UTC, added at 01:35 UTC', () => {
    expect(daily).toContain("cron.schedule('limoxis-filemaker-requeue', '5 1 * * *'")
    expect(daily).toContain("cron.schedule('limoxis-filemaker-sync', '35 1 * * *'")
  })
  it('adds the new days of the monthly department indicators once each', () => {
    for (const table of ['Indicators TEP', 'Indicators Α.Τ', 'Indicators Ενδοσκοπικό', 'Indicators eyelab']) expect(daily).toContain(`private.fm_sync_counts('${table}'`)
    expect(daily).toContain("'indicators', private.fm_sync_indicators()")
    expect(daily).not.toMatch(/\bdelete\s+from\b/i)
  })
  it('only adds records from 19/10/2026 on, each linked so it is never added twice', () => {
    for (const sql of [controls, areas, daily]) {
      expect(sql).not.toMatch(/\bdelete\s+from\b/i)
      expect(sql).not.toMatch(/\bdrop\s+(table|function)\b/i)
      expect(sql).not.toMatch(/\bupdate\s+public\.(employees|control_executions|training_programs|training_assignments|quality_incidents|committee_meetings|committee_decisions|quality_department_meetings)\b/i)
    }
    for (const table of ['People', 'Training', 'Training Participants', 'Meeting_REVIEWS', 'Μeeting_Decisions', 'Commitees_REVIEWS', 'Commitees_Decisions', 'IncidentManagement', 'Death']) {
      expect(areas).toContain(`r.base_table = '${table}'`)
      expect(areas).toContain(`select '${table}', `)
    }
    expect((areas.match(/>= '2026-10-19'/g) || []).length).toBeGreaterThanOrEqual(9)
  })
  it('adds a NICU newborn once the stay is closed, linking a known case number', () => {
    expect(nicu).toContain("nullif(s.data->>'ΗΜΕΡΟΜΗΝΙΑ ΕΞΟΔΟΥ ΑΠΟ ΤΗ  ΜΕΝΝ', '') is not null")
    expect(nicu).toContain("'matched', 'daily sync'")
    expect(nicu).toContain('+ private.fm_sync_nicu()')
    expect(nicu).not.toMatch(/\bdelete\s+from\b/i)
  })
  it('keeps the patient of a committee decision as initials', () => {
    expect(areas).toContain('private.fm_patient_initials(private.fm_text(s.d->>\'TopicDiscussed\'))')
  })
})
