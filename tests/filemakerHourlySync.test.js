import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
const controls = read('20261211130000_filemaker_hourly_sync.sql')
const areas = read('20261211140000_filemaker_hourly_sync_areas.sql')

describe('FileMaker hourly sync', () => {
  it('runs every hour: the tables are read again at :05 and added at :35', () => {
    expect(controls).toContain("cron.schedule('limoxis-filemaker-requeue', '5 * * * *'")
    expect(controls).toContain("cron.schedule('limoxis-filemaker-sync', '35 * * * *'")
  })
  it('only adds records from 19/10/2026 on, each linked so it is never added twice', () => {
    for (const sql of [controls, areas]) {
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
  it('keeps the patient of a committee decision as initials', () => {
    expect(areas).toContain('private.fm_patient_initials(private.fm_text(s.d->>\'TopicDiscussed\'))')
  })
})
