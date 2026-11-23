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
const drift: Record<string, number> = {
  patient_admissions: patientDemoData.flatMap((patient) => demoAdmissionsForPatient(patient)).length,
  laboratory_samples: laboratorySamples.length,
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
  // Pins today's difference: it fails when either side changes, so the change is looked at and the entry moved or updated.
  const known: Record<string, number> = { patient_admissions: 55, laboratory_samples: 209 }
  for (const [key, preview] of Object.entries(drift)) {
    it(`${key}: known drift (preview ${known[key]}, Demo ${counts[key]})`, () => {
      expect(preview).toBe(known[key])
      expect(counts[key]).not.toBe(preview)
    })
  }
})
