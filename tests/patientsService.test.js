import { describe,expect,it,vi,beforeEach } from 'vitest'
import { patientDemoData } from '../src/features/patients/patientDemoData'

const patientRows=new Map()
const departmentRows=new Map()
function patientsFor(organizationId){
  if(!patientRows.has(organizationId))patientRows.set(organizationId,[])
  return patientRows.get(organizationId)
}
function departmentsFor(organizationId){
  if(!departmentRows.has(organizationId))departmentRows.set(organizationId,[])
  return departmentRows.get(organizationId)
}

vi.mock('../src/core/supabase/client', () => ({
  supabase: {
    from: table => {
      if(table==='departments'){
        return {
          select: () => ({
            eq: (_orgCol, organizationId) => ({
              eq: (_nameCol, name) => ({
                maybeSingle: () => Promise.resolve({ data: departmentsFor(organizationId).find(d=>d.name===name)||null, error: null }),
              }),
            }),
          }),
          insert: payload => ({
            select: () => ({
              single: () => {
                const row={id:`dept-${departmentsFor(payload.organization_id).length+1}`,name:payload.name}
                departmentsFor(payload.organization_id).push(row)
                return Promise.resolve({ data: row, error: null })
              },
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: (_col, organizationId) => ({
            order: () => Promise.resolve({ data: patientsFor(organizationId), error: null }),
          }),
        }),
        insert: payload => ({
          select: () => ({
            single: () => {
              patientsFor(payload.organization_id).unshift(payload)
              return Promise.resolve({ data: payload, error: null })
            },
          }),
        }),
      }
    },
  },
}))

const { loadPatients, createPatient } = await import('../src/features/patients/patientsService')

describe('patientsService', () => {
  beforeEach(() => { patientRows.clear(); departmentRows.clear() })

  it('gives a brand new organization an empty patient list, never the demo roster', async () => {
    expect(await loadPatients('hospital-new')).toEqual([])
  })

  it('returns the demo roster for demo sessions without touching Supabase', async () => {
    expect(await loadPatients('hospital-new', { isDemo: true })).toEqual(patientDemoData)
  })

  it('keeps patients created in one organization out of another', async () => {
    const { record, list } = await createPatient('hospital-a', [], { firstName: 'Real', lastName: 'Patient', department: 'ICU', admissionDate: '2026-08-31' })
    expect(record.id).toMatch(/^PT-\d{6}$/)
    expect(list).toHaveLength(1)
    expect(await loadPatients('hospital-a')).toHaveLength(1)
    expect(await loadPatients('hospital-b')).toEqual([])
  })

  it('reuses an existing department instead of creating a duplicate', async () => {
    await createPatient('hospital-a', [], { firstName: 'A', lastName: 'One', department: 'ICU', admissionDate: '2026-08-31' })
    await createPatient('hospital-a', [], { firstName: 'B', lastName: 'Two', department: 'ICU', admissionDate: '2026-08-31' })
    expect(departmentsFor('hospital-a')).toHaveLength(1)
  })
})
