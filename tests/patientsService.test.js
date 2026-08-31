import { describe,expect,it,vi,beforeEach } from 'vitest'
import { patientDemoData } from '../src/features/patients/patientDemoData'

const tables=new Map()
function rowsFor(organizationId){
  if(!tables.has(organizationId))tables.set(organizationId,[])
  return tables.get(organizationId)
}

vi.mock('../src/core/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: (_col, organizationId) => ({
          order: () => Promise.resolve({ data: rowsFor(organizationId), error: null }),
        }),
      }),
      insert: payload => ({
        select: () => ({
          single: () => {
            rowsFor(payload.organization_id).unshift(payload)
            return Promise.resolve({ data: payload, error: null })
          },
        }),
      }),
    }),
  },
}))

const { loadPatients, createPatient } = await import('../src/features/patients/patientsService')

describe('patientsService', () => {
  beforeEach(() => tables.clear())

  it('gives a brand new organization an empty patient list, never the demo roster', async () => {
    expect(await loadPatients('hospital-new')).toEqual([])
  })

  it('returns the demo roster for demo sessions without touching Supabase', async () => {
    expect(await loadPatients('hospital-new', { isDemo: true })).toEqual(patientDemoData)
  })

  it('keeps patients created in one organization out of another', async () => {
    const { record, list } = await createPatient('hospital-a', [], { name: 'Real Patient', department: 'ICU', admissionDate: '2026-08-31' })
    expect(record.id).toMatch(/^PT-\d{6}$/)
    expect(list).toHaveLength(1)
    expect(await loadPatients('hospital-a')).toHaveLength(1)
    expect(await loadPatients('hospital-b')).toEqual([])
  })
})
