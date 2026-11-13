import { describe,it,expect } from 'vitest'
import { readSource } from './helpers/readSource'

const panel=readSource('src/features/management/BedDaysPanel.jsx')
const service=readSource('src/features/management/patientDayPeriodsCloudService.js')
const migration=readSource('supabase/migrations/20260902101057_patient_day_periods_governance.sql')

describe('Management Center patient days persistence',()=>{
  it('keeps demo patient-day data isolated from production loading',()=>{
    expect(panel).toContain('isDemo?demoPatientDayPeriods:[]')
    expect(panel).toContain('loadPatientDayPeriods(tenant.id)')
    expect(panel).toContain('loadDepartments(tenant.id)')
  })
  it('uses tenant-scoped cloud CRUD for patient day periods',()=>{
    expect(service).toContain("from('patient_day_periods')")
    expect(service).toContain("eq('organization_id',organizationId)")
    expect(service).toContain('createPatientDayPeriod')
    expect(service).toContain('updatePatientDayPeriod')
    expect(service).toContain('removePatientDayPeriod')
  })
  it('hardens patient-day grants, policies and audit trail',()=>{
    expect(migration).toContain('revoke all on table public.patient_day_periods from anon')
    expect(migration).toContain('to authenticated')
    expect(migration).toContain('trg_audit_patient_day_periods')
    expect(migration).toContain('private.audit_management_change()')
  })
})
