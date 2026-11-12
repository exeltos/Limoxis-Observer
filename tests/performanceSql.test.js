import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'

// Speed: the database work behind the slow screens, measured on the hospital's data (see the SQL files for the numbers).
describe('database speed fixes', () => {
  it('keeps the control frequency helpers in plpgsql, which keeps their plans between calls', () => {
    const sql = readSource('supabase/migrations/20261231220400_control_helpers_plpgsql.sql')
    for (const name of ['control_period_unit', 'control_period_start', 'control_period_end', 'control_working_day', 'control_set_times_count', 'control_slot_starts', 'control_slot_margin', 'control_slot_deadlines', 'control_slot_opens', 'control_required', 'control_slot_deadline']) {
      expect(sql).toMatch(new RegExp(`create or replace function private\\.${name}\\([^)]*\\)[^$]*language plpgsql immutable set search_path to ''`))
    }
  })
  it('evaluates the read rules of samples and training assignments once per query, not per row', () => {
    const sql = readSource('docs/sql/done/perf_rls_fast_read_policies.sql')
    expect(sql).toContain('create policy laboratory_samples_read_department')
    expect(sql).toContain('create policy training_assignments_read')
    expect(sql).not.toMatch(/using \([\s\S]*current_user_has_org_role\(organization_id/)
    expect(sql).toContain("(select private.current_user_department_scopes())")
  })
})
