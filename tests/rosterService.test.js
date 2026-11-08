import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { rosterPeriod } from '../src/features/rosters/rosterService'

// The department's shift roster (owner, 8/11/2026): the IASO payroll period and who may write it.
describe('roster period and access', () => {
  it('runs from the 21st of a month to the 20th of the next', () => {
    expect(rosterPeriod(new Date(2026, 10, 8))).toEqual({ start: '2026-10-21', end: '2026-11-20' })
    expect(rosterPeriod(new Date(2026, 10, 25))).toEqual({ start: '2026-11-21', end: '2026-12-20' })
    expect(rosterPeriod(new Date(2026, 11, 22), 1)).toEqual({ start: '2027-01-21', end: '2027-02-20' })
    expect(rosterPeriod(new Date(2026, 0, 5), -1)).toEqual({ start: '2025-11-21', end: '2025-12-20' })
  })
  it('is written by the department manager of the department, the administrator or the HR office; read by the department', () => {
    const sql = readFileSync('supabase/migrations/20261231260100_department_rosters.sql', 'utf8')
    expect(sql).toContain("current_user_has_org_role(organization_id, array['department_manager']::public.app_role[])\n        and public.current_user_has_department_scope(organization_id, department_id)")
    expect(sql).toContain('public.current_user_has_department_scope(organization_id, department_id)\n  );')
    expect(sql).toContain('revoke all on public.department_rosters from anon')
  })
})
