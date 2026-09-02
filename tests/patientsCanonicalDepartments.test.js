import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const page=fs.readFileSync('src/features/patients/PatientsPage.jsx','utf8')
const service=fs.readFileSync('src/features/patients/patientsService.js','utf8')
const migration=fs.readFileSync('supabase/migrations/202609021245_clinical_core_rls_authenticated_scope.sql','utf8')

describe('patient registry governance',()=>{
  it('loads production department options from the hospital library',()=>{
    expect(page).toContain("import { loadDepartments } from '../management/departmentsService'")
    expect(page).toContain('loadDepartments(tenant?.id)')
    expect(page).toContain('departments={departmentOptions}')
  })

  it('persists canonical department ids without creating departments from patient workflows',()=>{
    expect(service).toContain('resolveDepartment(organizationId,draft.departmentId)')
    expect(service).toContain(".eq('is_active',true).maybeSingle()")
    expect(service).not.toContain('ensureDepartment')
    expect(service).toContain('department_id:department?.id||null')
  })

  it('targets clinical RLS policies at authenticated users and removes anon table access',()=>{
    expect(migration).toContain('alter policy patients_clinical_read on public.patients to authenticated')
    expect(migration).toContain('alter policy laboratory_samples_read on public.laboratory_samples to authenticated')
    expect(migration).toContain('revoke all on table public.patients from anon')
    expect(migration).toContain('revoke all on table public.laboratory_samples from anon')
  })
})
