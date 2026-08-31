import { describe,expect,it,vi,beforeEach } from 'vitest'
import { patientDemoData } from '../src/features/patients/patientDemoData'

const patientRows=new Map()
const admissionRows=new Map()
const departmentRows=new Map()
function patientsFor(organizationId){
  if(!patientRows.has(organizationId))patientRows.set(organizationId,[])
  return patientRows.get(organizationId)
}
function admissionsFor(organizationId){
  if(!admissionRows.has(organizationId))admissionRows.set(organizationId,[])
  return admissionRows.get(organizationId)
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
      if(table==='patient_admissions'){
        return {
          select: () => ({
            eq: (_col, patientId) => ({
              order: () => Promise.resolve({ data: [...admissionRows.values()].flat().filter(row=>row.patient_id===patientId), error: null }),
            }),
          }),
          insert: payload => {
            const row={id:`adm-${admissionsFor(payload.organization_id).length+1}`,...payload}
            admissionsFor(payload.organization_id).push(row)
            const result=Promise.resolve({ data: row, error: null })
            return {
              select: () => ({ single: () => result }),
              then: (resolve, reject) => result.then(resolve, reject),
            }
          },
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
              const rows=patientsFor(payload.organization_id)
              if(rows.some(row=>row.patient_code===payload.patient_code)){
                return Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key' } })
              }
              const row={id:`patient-${rows.length+1}`,...payload}
              rows.unshift(row)
              return Promise.resolve({ data: row, error: null })
            },
          }),
        }),
        update: payload => ({
          eq: (_col, id) => {
            const rows=[...patientRows.values()].flat()
            const row=rows.find(r=>r.id===id)
            if(row)Object.assign(row,payload)
            return Promise.resolve({ data: null, error: null })
          },
        }),
      }
    },
  },
}))

const { loadPatients, createPatient, loadAdmissions, createAdmission } = await import('../src/features/patients/patientsService')

describe('patientsService', () => {
  beforeEach(() => { patientRows.clear(); admissionRows.clear(); departmentRows.clear() })

  it('gives a brand new organization an empty patient list, never the demo roster', async () => {
    expect(await loadPatients('hospital-new')).toEqual([])
  })

  it('returns the demo roster for demo sessions without touching Supabase', async () => {
    expect(await loadPatients('hospital-new', { isDemo: true })).toEqual(patientDemoData)
  })

  it('keeps patients created in one organization out of another', async () => {
    const { record, list } = await createPatient('hospital-a', [], { patientCode: 'HOSP-1001', firstName: 'Real', lastName: 'Patient', department: 'ICU', admissionDate: '2026-08-31' })
    expect(record.id).toBe('HOSP-1001')
    expect(list).toHaveLength(1)
    expect(await loadPatients('hospital-a')).toHaveLength(1)
    expect(await loadPatients('hospital-b')).toEqual([])
  })

  it('rejects a duplicate patient code in the same organization', async () => {
    await createPatient('hospital-a', [], { patientCode: 'HOSP-1001', firstName: 'A', lastName: 'One', department: 'ICU', admissionDate: '2026-08-31' })
    await expect(createPatient('hospital-a', [], { patientCode: 'HOSP-1001', firstName: 'B', lastName: 'Two', department: 'ICU', admissionDate: '2026-08-31' }))
      .rejects.toMatchObject({ duplicateCode: true })
  })

  it('reuses an existing department instead of creating a duplicate', async () => {
    await createPatient('hospital-a', [], { patientCode: 'HOSP-1001', firstName: 'A', lastName: 'One', department: 'ICU', admissionDate: '2026-08-31' })
    await createPatient('hospital-a', [], { patientCode: 'HOSP-1002', firstName: 'B', lastName: 'Two', department: 'ICU', admissionDate: '2026-08-31' })
    expect(departmentsFor('hospital-a')).toHaveLength(1)
  })

  it('lets a patient have more than one admission over time', async () => {
    const { record } = await createPatient('hospital-a', [], { patientCode: 'HOSP-1001', firstName: 'Dialysis', lastName: 'Patient', department: 'ICU', admissionDate: '2026-01-10' })
    await createAdmission('hospital-a', record, { department: 'ICU', admissionDate: '2026-08-31' })
    const admissions = await loadAdmissions(record.recordId)
    expect(admissions).toHaveLength(2)
  })
})
