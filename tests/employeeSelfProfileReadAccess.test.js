import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const migration = fs.readFileSync('supabase/migrations/20260919260000_employee_self_profile_read_access.sql', 'utf8')
const recordPage = fs.readFileSync('src/features/employees/EmployeeRecordPage.jsx', 'utf8')

describe('Employee "My Profile" self read access', () => {
  it('grants employees SELECT to the row\'s own linked account, in addition to the existing role/department grants', () => {
    expect(migration).toContain('create policy employees_select_authorized')
    expect(migration).toContain('or user_id = auth.uid()')
    expect(migration).toContain("'hospital_admin'::public.app_role")
  })

  it('grants self-read on the occupational-health clinical sub-tables via a join back to the owning employee row', () => {
    expect(migration).toContain('create policy employee_vaccinations_select_authorized')
    expect(migration).toContain('create policy occupational_health_visits_select_authorized')
    expect(migration).toContain('create policy employee_evaluations_select_authorized')
    const selfJoin = 'and e.user_id = auth.uid()'
    expect(migration.split(selfJoin).length - 1).toBe(3)
  })

  it('does not touch insert/update/delete policies, keeping the self view read-only', () => {
    expect(migration).not.toContain('for insert')
    expect(migration).not.toContain('for update')
    expect(migration).not.toContain('for delete')
  })

  it('the self-profile page resolves the employee by its linked user_id, matching the new RLS self exception', () => {
    expect(recordPage).toContain('row.userId===linkedUserId')
    expect(recordPage).toContain('Your employee record is read-only')
  })
})
