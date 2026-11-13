// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'

function storage() {
  const values = new Map()
  return { get length() { return values.size }, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), key: index => [...values.keys()][index] ?? null }
}

describe('occupational health visits can be recorded (demo mode)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage())
    configureDataEnvironment({ mode: 'demo', organizationId: 'demo-hospital', demoAccountId: 'demo-user-1' })
  })

  it('stores a completed visit with its fitness outcome and lists it', async () => {
    const { createOccupationalVisitAsync, loadAllOccupationalVisitsAsync } = await import('../src/features/employees/employeeSubRecordsService')
    const before = (await loadAllOccupationalVisitsAsync('demo-hospital')).length
    const created = await createOccupationalVisitAsync('demo-hospital', { id: 'EMP-004' }, { date: '2026-10-01', type: 'periodic', status: 'completed', fitStatus: 'fit_with_restrictions', followUpDate: '2027-10-01', clinicalNotes: ' Χωρίς άρση βαρών ' })
    expect(created).toMatchObject({ employeeId: 'EMP-004', status: 'completed', fitStatus: 'fit_with_restrictions', followUpDate: '2027-10-01', clinicalNotes: 'Χωρίς άρση βαρών' })
    const rows = await loadAllOccupationalVisitsAsync('demo-hospital')
    expect(rows).toHaveLength(before + 1)
    expect(rows[0].id).toBe(created.id)
  })

  it('a scheduled visit has no outcome yet', async () => {
    const { createOccupationalVisitAsync } = await import('../src/features/employees/employeeSubRecordsService')
    const created = await createOccupationalVisitAsync('demo-hospital', { id: 'EMP-004' }, { date: '2026-11-01', type: 'followUp', status: 'scheduled', fitStatus: 'fit', followUpDate: '2027-01-01' })
    expect(created).toMatchObject({ status: 'scheduled', fitStatus: 'pending', followUpDate: null })
  })

  it('needs an employee, a date and a type', async () => {
    const { createOccupationalVisitAsync } = await import('../src/features/employees/employeeSubRecordsService')
    await expect(createOccupationalVisitAsync('demo-hospital', null, { date: '2026-10-01', type: 'periodic' })).rejects.toThrow('EMPLOYEE_REQUIRED')
    await expect(createOccupationalVisitAsync('demo-hospital', { id: 'EMP-004' }, { type: 'periodic' })).rejects.toThrow('FIELDS_REQUIRED')
  })
})
