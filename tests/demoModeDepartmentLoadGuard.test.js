import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { demoLibrarySeed } from '../src/features/management/managementData'

// Live production bug found via Supabase edge_logs while the user was
// populating demo data for a presentation: demo mode's tenant.id is the
// literal string 'demo-hospital' (see TenantContext.jsx's DEMO_TENANT),
// not a real UUID. departmentsService.js's loadDepartments() and
// managementCloudService.js's loadManagementLibraries() are plain cloud
// calls with no demo awareness of their own — calling either with
// organization_id='demo-hospital' fails outright with a Postgres 400
// ("invalid input syntax for type uuid"), since every caller is expected
// to branch on isDemo itself before ever calling them (the pattern already
// used correctly in PatientsPage.jsx, QualityCreatePage.jsx,
// IndicatorsPage.jsx, SurveillanceCanonicalPage.jsx, LaboratoryWorkspace.jsx,
// PrevalenceSurveyPanel.jsx, AnnouncementsPanel.jsx and BedDaysPanel.jsx).
// Five call sites had been missed: creating or editing an Employee, creating
// a Document, and creating or editing a Training program all threw silent
// department/library load failures (empty dropdowns) in demo mode.
describe('every loadDepartments/loadManagementLibraries call site checks isDemo first', () => {
  const files = {
    'src/features/employees/EmployeeCreatePage.jsx': 'demoLibrarySeed.departments.map(([elName,enName])=>({id:elName,name:elName,nameEn:enName}))',
    'src/features/employees/EmployeeRecordPage.jsx': 'demoLibrarySeed.departments.map(([elName,enName])=>({id:elName,name:elName,nameEn:enName}))',
    'src/features/documents/DocumentCreatePage.jsx': 'demoLibrarySeed.departments.map(([elName,enName])=>({id:elName,name:elName,nameEn:enName}))',
    'src/features/training/TrainingCreatePage.jsx': 'demoLibrarySeed.departments.map(([elName,enName])=>({id:elName,name:elName,nameEn:enName}))',
    'src/features/training/TrainingProductionPage.jsx': 'demoLibrarySeed.departments.map(([elName,enName])=>({id:elName,name:elName,nameEn:enName}))',
  }

  for (const [path, demoSnippet] of Object.entries(files)) {
    it(`${path} imports demoLibrarySeed and branches on isDemo before loading departments`, () => {
      const source = fs.readFileSync(path, 'utf8')
      expect(source).toContain("import { demoLibrarySeed } from '../management/managementData'")
      expect(source).toContain(demoSnippet)
      expect(source).toMatch(/isDemo/)
    })
  }

  it('EmployeeCreatePage and EmployeeRecordPage also cover the professionalCategories side of loadManagementLibraries', () => {
    for (const path of ['src/features/employees/EmployeeCreatePage.jsx', 'src/features/employees/EmployeeRecordPage.jsx']) {
      const source = fs.readFileSync(path, 'utf8')
      expect(source).toContain('demoLibrarySeed.professionalCategories')
    }
  })

  // Automated review finding on this PR: demoLibrarySeed had no
  // professionalCategories property at all, so the line above always
  // installed an empty array, leaving the required "Professional category"
  // select with no options and new-employee creation impossible in demo
  // mode. Seeded with the same six categories the
  // system_master_library_baseline_seed_v2 migration seeds for every real
  // organization.
  it('demoLibrarySeed actually defines professionalCategories (not silently empty)', () => {
    expect(demoLibrarySeed.professionalCategories.length).toBeGreaterThan(0)
    expect(demoLibrarySeed.professionalCategories.map(row => row[0])).toContain('Ιατρός')
  })

  it('PatientClinicalCanonicalPage populates its own departments state from demoLibrarySeed in demo mode too (previously stayed permanently empty), with the option label following the active language', () => {
    const source = fs.readFileSync('src/features/surveillance/PatientClinicalCanonicalPage.jsx', 'utf8')
    expect(source).toContain("setDepartments(demoLibrarySeed.departments.map(([elName,enName])=>({id:elName,name:language==='el'?elName:(enName||elName),nameEn:enName})))")
  })
})
