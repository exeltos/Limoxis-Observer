import { describe, expect, it, vi } from 'vitest'
// The preview's sample data grows with the date (each day adds entries); it is measured on the day of the snapshot.
vi.hoisted(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-23T10:00:00Z')) })
import snapshot from './fixtures/demoSnapshot.json'
import { employeeCertificates, employeeEvaluations, employeeRows, employeeVaccinations } from '../src/features/employees/employeeDemoData'
import { demoAdmissionsForPatient, patientDemoData } from '../src/features/patients/patientDemoData'
import { laboratorySamples } from '../src/features/laboratory/laboratoryDemoData'
import { controlAssignmentRows, controlDefinitionRows, controlExecutionRows } from '../src/features/controls/controlDemoData'
import { indicatorSnapshotRows } from '../src/features/indicators/indicatorDemoData'
import { antibioticDispensingRows } from '../src/features/pharmacy/pharmacyDemoData'
import { qualityAudits, qualityCapas, qualityFindings, qualityIncidents } from '../src/features/quality/qualityDemoData'
import { handHygieneRows } from '../src/features/prevention/preventionDemoData'
import { demoSurveillanceList } from '../src/features/surveillance/clinicalDemoData'
import { demoRegisters } from '../src/features/registers/registerDemoData'
import { kitchenDemoState } from '../src/features/kitchen/kitchenDemoData'
import { interviewsDemoState } from '../src/features/interviews/interviewsDemoData'

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
  control_definitions: controlDefinitionRows.length,
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
  // Sections measured on 23/11/2026 whose sizes differ (preview, Demo): pinned, so a change on either side is looked at.
  it('controls: assignments 21 / 24, executions 1377 / 362 (the preview keeps its history)', () => {
    expect(controlAssignmentRows.length).toBe(21)
    expect(counts.control_assignments - controlAssignmentRows.length).toBeLessThanOrEqual(3)
    expect(controlExecutionRows.length).toBe(1377)
    expect(controlExecutionRows.length).toBeGreaterThanOrEqual(counts.control_executions)
  })
  it('indicator snapshots: 115 / 118', () => {
    expect(indicatorSnapshotRows.length).toBe(115)
    expect(counts.indicator_snapshots - indicatorSnapshotRows.length).toBeLessThanOrEqual(3)
  })
  // A difference of shape, kept on purpose: the Demo has 6 months x 12 departments x 5 agents (360); the preview has
  // 24 months of each ward's main agents (114), for the falling carbapenem trend of the stewardship charts.
  it('antibiotic dispensing periods: the preview keeps 24 months of main agents (114 / 360)', () => {
    expect(antibioticDispensingRows.length).toBe(114)
    expect(new Set(antibioticDispensingRows.map((row) => row.period)).size).toBeGreaterThanOrEqual(12)
    expect(counts.antibiotic_dispensing_periods).toBe(360)
  })
  // The other sections, measured on 24/11/2026 (preview / Demo). The preview keeps a richer history for the help
  // screens; the Demo got 12 months of incidents and closed surveillance episodes (20261231636000). Pinned, so that a
  // change on either side is looked at.
  it('quality: incidents 90 / 40, findings 38 / 17, corrective actions 40 / 15, audits 46 / 17', () => {
    expect([qualityIncidents.length, qualityFindings.length, qualityCapas.length, qualityAudits.length]).toEqual([90, 38, 40, 46])
    expect([counts.quality_incidents, counts.quality_findings, counts.quality_capa_actions, counts.quality_audits]).toEqual([40, 17, 15, 17])
  })
  it('surveillance episodes: 54 / 40', () => {
    expect((demoSurveillanceList() as unknown[]).length).toBe(54)
    expect(counts.surveillance_cases).toBe(40)
  })
  it('hand hygiene sessions 64 / 36, department registers 10 / 7', () => {
    expect(handHygieneRows.length).toBe(64)
    expect(counts.hand_hygiene_sessions).toBe(36)
    expect((demoRegisters() as unknown[]).length).toBe(10)
    expect(counts.department_registers).toBe(7)
  })
  it('kitchen receipts 129 / 7, interview candidates 23 / 14', () => {
    expect((kitchenDemoState() as { receipts: unknown[] }).receipts.length).toBe(129)
    expect(counts.kitchen_receipts).toBe(7)
    expect((interviewsDemoState() as { candidates: unknown[] }).candidates.length).toBe(23)
    expect(counts.hr_candidates).toBe(14)
  })
})
