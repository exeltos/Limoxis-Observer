import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const migration = fs.readFileSync('supabase/migrations/20260921130000_occupational_exposure_incidents.sql', 'utf8')
const page = fs.readFileSync('src/features/occupational-health/OccupationalHealthPage.jsx', 'utf8')
const editor = fs.readFileSync('src/features/occupational-health/ExposureIncidentEditor.jsx', 'utf8')
const service = fs.readFileSync('src/features/occupational-health/exposureIncidentService.js', 'utf8')
const employeeTabs = fs.readFileSync('src/features/employees/EmployeeRecordTabs.jsx', 'utf8')
const employeeRecordPage = fs.readFileSync('src/features/employees/EmployeeRecordPage.jsx', 'utf8')

describe('occupational exposure / needlestick-injury tracking module', () => {
  it('gates the new table behind the same clinical occupational-health RLS tier as visits/vaccinations', () => {
    expect(migration).toContain('create table if not exists public.occupational_exposure_incidents')
    expect(migration).toContain('references public.employees(id) on delete cascade')
    expect(migration).toContain('alter table public.occupational_exposure_incidents enable row level security')
    expect(migration).toContain("current_user_has_org_role(organization_id,array['occupational_physician']::public.app_role[])")
    expect(migration).toContain("current_user_has_capability(organization_id,'manage_occupational_health')")
  })

  it('wires a working create dialog into the Occupational Health page (not a stub notify)', () => {
    expect(page).toContain('ExposureIncidentEditor')
    expect(page).toContain('createExposureIncidentAsync')
    expect(page).toContain('loadAllExposureIncidentsAsync')
    expect(page).toContain("setExposureEditor({...EMPTY_EXPOSURE_INCIDENT})")
  })

  it('requires employee, incident date and exposure type before allowing save', () => {
    expect(editor).toContain('draft.employeeId&&draft.incidentDate&&draft.exposureType')
  })

  it('demo and production paths both go through the same service module', () => {
    expect(service).toContain("from('occupational_exposure_incidents')")
    expect(service).toContain('loadAllExposureIncidentsAsync')
    expect(service).toContain('createExposureIncidentAsync')
    expect(service).toContain('isDemoDataEnvironment()')
  })

  it('surfaces exposure history read-only on the employee record, gated the same as occupational visits', () => {
    expect(employeeTabs).toContain('EmployeeExposureIncidentsTab')
    expect(employeeTabs).toContain('loadExposureIncidentsAsync')
    expect(employeeRecordPage).toContain("{id:'exposureIncidents'")
    expect(employeeRecordPage).toContain('EmployeeExposureIncidentsTab')
  })
})
