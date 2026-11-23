import { describe, expect, it } from 'vitest'
import snapshot from './fixtures/demoSnapshot.json'
import { employeeCertificates, employeeEvaluations, employeeRows, employeeVaccinations } from '../src/features/employees/employeeDemoData'
import { demoAdmissionsForPatient, patientDemoData } from '../src/features/patients/patientDemoData'
import { laboratorySamples } from '../src/features/laboratory/laboratoryDemoData'

// The help preview (no sign-in) keeps its own sample data (*DemoData.ts). Each section is compared with the real
// Demo's counts (tests/fixtures/demoSnapshot.json, from docs/sql/demo_snapshot_counts.sql) so that the two do not
// drift apart. When the seeds change, run the SQL again and update the snapshot.
// `drift` holds what differs today (23/11/2026): [the preview, the Demo]. A section that gets aligned moves to `aligned`.
const aligned: Record<string, number> = {
  patients: patientDemoData.length,
  employees: employeeRows.length,
  employee_vaccinations: employeeVaccinations.length,
  employee_certificates: employeeCertificates.length,
  employee_evaluations: employeeEvaluations.length,
}
const counts = snapshot.counts as Record<string, number>

describe('the preview matches the real Demo', () => {
  it('the staff ids are unique', () => {
    const ids = employeeRows.map((row) => row.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  for (const [key, preview] of Object.entries(aligned)) {
    it(`${key}: same count`, () => expect(preview).toBe(counts[key]))
  }
  // Differences kept on purpose (23/11/2026). A change on either side fails these, so it is looked at.
  it('laboratory samples: the preview keeps its 24 months of history, richer than the Demo', () => {
    expect(laboratorySamples.length).toBeGreaterThanOrEqual(counts.laboratory_samples)
    expect(laboratorySamples.length).toBe(209)
  })
  it('admissions: the preview has one per patient with an admission date; the Demo has one readmission more', () => {
    const admissions = patientDemoData.flatMap((patient) => demoAdmissionsForPatient(patient)).length
    expect(admissions).toBe(55)
    expect(counts.patient_admissions - admissions).toBeLessThanOrEqual(3)
  })
})
