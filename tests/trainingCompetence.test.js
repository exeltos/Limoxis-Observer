import { describe, expect, it } from 'vitest'
import { competenceMatrix, requirementApplies, requirementStatus, retrainingPlan } from '../src/features/training/trainingCompetence'

const today = '2026-10-08'
const nurseIcu = { id: 'EMP-1', firstName: 'Μαρία', lastName: 'Π.', department: 'ΜΕΘ', profession: 'Νοσηλευτικό προσωπικό' }
const doctor = { id: 'EMP-2', firstName: 'Νίκος', lastName: 'Δ.', department: 'Παθολογική', profession: 'Ιατρικό προσωπικό' }
const handHygiene = { id: 'R1', title: 'Hand hygiene', programIds: ['P1', 'P1b'], professions: [], departments: [], renewalMonths: 12 }
const clabsi = { id: 'R2', title: 'CLABSI', programIds: ['P2'], professions: ['νοσηλευτικό προσωπικό'], departments: ['ΜΕΘ'], renewalMonths: 12 }

describe('training competence', () => {
  it('applies requirements by professional category and department (case-insensitive, empty = all)', () => {
    expect(requirementApplies(handHygiene, doctor)).toBe(true)
    expect(requirementApplies(clabsi, nurseIcu)).toBe(true)
    expect(requirementApplies(clabsi, doctor)).toBe(false)
    expect(requirementApplies({ ...handHygiene, active: false }, doctor)).toBe(false)
  })

  it('uses the latest completion of any listed programme, the certificate date first, then renewal months', () => {
    const assignments = [
      { id: 'A1', programId: 'P1', employeeId: 'EMP-1', status: 'completed', completedDate: '2025-09-01' },
      { id: 'A2', programId: 'P1b', employeeId: 'EMP-1', status: 'completed', completedDate: '2026-01-15' },
      { id: 'A3', programId: 'P1', employeeId: 'EMP-2', status: 'completed', completedDate: '2025-10-20' },
      { id: 'A4', programId: 'P2', employeeId: 'EMP-1', status: 'assigned' },
    ]
    const certificates = [{ assignmentId: 'A3', validUntil: '2026-11-01' }]
    expect(requirementStatus(handHygiene, nurseIcu, { assignments, certificates, today })).toMatchObject({ state: 'valid', completedOn: '2026-01-15', validUntil: '2027-01-15' })
    expect(requirementStatus(handHygiene, doctor, { assignments, certificates, today })).toMatchObject({ state: 'expiring', validUntil: '2026-11-01' })
    expect(requirementStatus(clabsi, nurseIcu, { assignments, certificates, today }).state).toBe('missing')
    expect(requirementStatus(handHygiene, doctor, { assignments: [{ ...assignments[2], completedDate: '2024-01-01' }], today }).state).toBe('expired')
  })

  it('builds the matrix, coverage rate and a plan ordered by due date', () => {
    const assignments = [{ id: 'A1', programId: 'P1', employeeId: 'EMP-1', status: 'completed', completedDate: '2026-02-01' }]
    const matrix = competenceMatrix({ requirements: [handHygiene, clabsi], employees: [nurseIcu, doctor], assignments, today })
    expect(matrix.rows.map((r) => r.cells.map((c) => c?.state ?? null))).toEqual([['valid', 'missing'], ['missing', null]])
    expect(matrix.counts).toEqual({ valid: 1, expiring: 0, expired: 0, missing: 2 })
    expect(matrix.rate).toBe(33)
    const plan = retrainingPlan(matrix, { today })
    expect(plan.map((p) => `${p.employee.id}:${p.requirement.id}:${p.due}`)).toEqual(['EMP-1:R2:2026-10-08', 'EMP-2:R1:2026-10-08'])
  })
})
