import { describe,it,expect } from 'vitest'
import fs from 'node:fs'

const migration=fs.readFileSync('supabase/migrations/20260923192500_employee_exposure_self_read_access.sql','utf8')

describe('employee occupational exposure RLS',()=>{
  it('removes legacy public policies and scopes new policies to authenticated users',()=>{
    expect(migration).toContain('drop policy if exists occupational_exposure_incidents_read')
    expect(migration).toContain('drop policy if exists occupational_exposure_incidents_write')
    expect(migration.match(/to authenticated/g)?.length).toBe(4)
  })

  it('allows a linked employee to read only their own exposure incidents',()=>{
    expect(migration).toContain('e.id = occupational_exposure_incidents.employee_id')
    expect(migration).toContain('e.organization_id = occupational_exposure_incidents.organization_id')
    expect(migration).toContain('e.user_id = auth.uid()')
  })

  it('keeps exposure writes under occupational-health governance',()=>{
    expect(migration).toContain("current_user_has_org_role(organization_id, array['occupational_physician'::app_role])")
    expect(migration).toContain("current_user_has_capability(organization_id, 'manage_occupational_health')")
  })
})
