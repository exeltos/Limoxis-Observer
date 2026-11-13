// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'

function storage() {
  const values = new Map()
  return {
    get length() { return values.size },
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    key: index => [...values.keys()][index] ?? null,
    values,
  }
}

describe('occupational exposure incident tracking (demo mode)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage())
    configureDataEnvironment({ mode: 'demo', organizationId: 'demo-hospital', demoAccountId: 'demo-user-1' })
  })

  it('ships a demo exposure incident for the seeded employee', async () => {
    const { loadAllExposureIncidentsAsync } = await import('../src/features/occupational-health/exposureIncidentService')
    const rows = await loadAllExposureIncidentsAsync('demo-hospital')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]).toMatchObject({ employeeId: 'EMP-001', exposureType: 'needlestick' })
  })

  it('creates a new exposure incident and makes it immediately loadable', async () => {
    const { loadAllExposureIncidentsAsync, createExposureIncidentAsync } = await import('../src/features/occupational-health/exposureIncidentService')
    const before = await loadAllExposureIncidentsAsync('demo-hospital')
    const created = await createExposureIncidentAsync('demo-hospital', { id: 'EMP-002' }, {
      incidentDate: '2026-09-20',
      exposureType: 'sharps_object',
      deviceOrSource: 'Χειρουργική λαβίδα',
      bodySite: 'Δεξί αντίχειρα',
      sourcePatientStatus: 'unknown',
      pepAdministered: true,
      pepDetails: 'Έναρξη PEP εντός 2 ωρών',
      followUpStatus: 'scheduled',
      followUpDueAt: '2026-12-20',
      notes: 'Follow-up ορολογικός έλεγχος προγραμματισμένος.',
    })
    expect(created.employeeId).toBe('EMP-002')
    expect(created.exposureType).toBe('sharps_object')
    const after = await loadAllExposureIncidentsAsync('demo-hospital')
    expect(after.length).toBe(before.length + 1)
    expect(after.find(x => x.id === created.id)).toMatchObject({ employeeId: 'EMP-002', followUpStatus: 'scheduled' })
  })

  it('requires an employee, incident date and exposure type', async () => {
    const { createExposureIncidentAsync } = await import('../src/features/occupational-health/exposureIncidentService')
    await expect(createExposureIncidentAsync('demo-hospital', null, { incidentDate: '2026-09-20', exposureType: 'needlestick' })).rejects.toThrow('EXPOSURE_INCIDENT_EMPLOYEE_REQUIRED')
    await expect(createExposureIncidentAsync('demo-hospital', { id: 'EMP-001' }, { exposureType: 'needlestick' })).rejects.toThrow('EXPOSURE_INCIDENT_DATE_REQUIRED')
    await expect(createExposureIncidentAsync('demo-hospital', { id: 'EMP-001' }, { incidentDate: '2026-09-20' })).rejects.toThrow('EXPOSURE_INCIDENT_TYPE_REQUIRED')
  })
})
