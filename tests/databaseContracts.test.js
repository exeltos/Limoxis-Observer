import { readFileSync } from 'node:fs'
import { URL } from 'node:url'
import { describe,expect,it } from 'vitest'

const migration=readFileSync(new URL('../supabase/migrations/202608310028_v0287_patient_admission_integrity.sql',import.meta.url),'utf8')
const verification=readFileSync(new URL('../supabase/maintenance/06_verify_v0287_deployment.sql',import.meta.url),'utf8')

describe('patient admission database contracts',()=>{
  it('enforces status and date invariants at the table boundary',()=>{
    expect(migration).toContain("check (status in ('active', 'discharged'))")
    expect(migration).toContain('discharge_date >= admission_date')
    expect(migration).not.toMatch(/add constraint patients_status_check/)
  })

  it('enforces patient and department tenant ownership with composite keys',()=>{
    expect(migration).toContain('foreign key (organization_id, patient_id)')
    expect(migration).toContain('foreign key (organization_id, department_id)')
  })

  it('verifies deployment without querying the removed legacy table',()=>{
    expect(verification).toContain("to_regclass('public.demo_entitlements') is null")
    expect(verification).not.toMatch(/from\s+public\.demo_entitlements/i)
    expect(verification).toContain("to_regprocedure('public.create_patient_admission(uuid,uuid,uuid,date,date,text,text)')")
  })
})
