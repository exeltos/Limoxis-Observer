import { describe,expect,it,vi,beforeEach } from 'vitest'
import { patientDemoData } from '../src/features/patients/patientDemoData'

const patientRows=new Map()
const admissionRows=new Map()
const departmentRows=new Map()
let failAdmissionTransaction=false
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
function seedDepartment(organizationId,name='ICU'){
  const row={id:`dept-${departmentsFor(organizationId).length+1}`,name,is_active:true}
  departmentsFor(organizationId).push(row)
  return row
}

vi.mock('../src/core/supabase/client', () => ({
  supabase: {
    rpc: (_name,payload) => {
      if(failAdmissionTransaction)return Promise.resolve({data:null,error:{message:'admission transaction failed'}})
      const patient=[...patientRows.values()].flat().find(row=>row.id===payload.p_patient_id&&row.organization_id===payload.p_organization_id)
      if(!patient)return Promise.resolve({data:null,error:{message:'patient does not belong to organization'}})
      const row={id:`adm-${admissionsFor(payload.p_organization_id).length+1}`,organization_id:payload.p_organization_id,patient_id:payload.p_patient_id,department_id:payload.p_department_id,admission_date:payload.p_admission_date,discharge_date:payload.p_discharge_date,status:payload.p_status,notes:payload.p_notes}
      admissionsFor(payload.p_organization_id).push(row)
      Object.assign(patient,{department_id:payload.p_department_id,admission_date:payload.p_admission_date,discharge_date:payload.p_discharge_date,status:payload.p_status})
      return Promise.resolve({data:row,error:null})
    },
    from: table => {
      if(table==='departments'){
        return {
          select: () => ({
            eq: (_orgCol, organizationId) => ({
              eq: (_idCol, departmentId) => ({
                eq: (_activeCol, active) => ({
                  maybeSingle: () => Promise.resolve({ data: departmentsFor(organizationId).find(d=>d.id===departmentId&&d.is_active===active)||null, error: null }),
                }),
              }),
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
              admissionsFor(payload.organization_id).push({id:`adm-${admissionsFor(payload.organization_id).length+1}`,organization_id:payload.organization_id,patient_id:row.id,department_id:payload.department_id,admission_date:payload.admission_date,discharge_date:payload.discharge_date,status:payload.status,notes:payload.notes})
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
  beforeEach(() => { patientRows.clear(); admissionRows.clear(); departmentRows.clear(); failAdmissionTransaction=false })

  it('gives a brand new organization an empty patient list, never the demo roster', async () => {
    expect(await loadPatients('hospital-new')).toEqual([])
  })

  it('returns the demo roster for demo sessions without touching Supabase', async () => {
    expect(await loadPatients('hospital-new', { isDemo: true })).toEqual(patientDemoData)
  })

  it('keeps patients created in one organization out of another', async () => {
    const department=seedDepartment('hospital-a')
    const { record, list } = await createPatient('hospital-a', [], { patientCode: 'HOSP-1001', firstName: 'Real', lastName: 'Patient', departmentId:department.id, department:department.name, admissionDate: '2026-08-31' })
    expect(record.id).toBe('HOSP-1001')
    expect(list).toHaveLength(1)
    expect(await loadPatients('hospital-a')).toHaveLength(1)
    expect(await loadPatients('hospital-b')).toEqual([])
  })

  it('rejects a duplicate patient code in the same organization', async () => {
    const department=seedDepartment('hospital-a')
    await createPatient('hospital-a', [], { patientCode: 'HOSP-1001', firstName: 'A', lastName: 'One', departmentId:department.id, department:department.name, admissionDate: '2026-08-31' })
    await expect(createPatient('hospital-a', [], { patientCode: 'HOSP-1001', firstName: 'B', lastName: 'Two', departmentId:department.id, department:department.name, admissionDate: '2026-08-31' }))
      .rejects.toMatchObject({ duplicateCode: true })
  })

  it('uses an existing canonical department without creating a duplicate', async () => {
    const department=seedDepartment('hospital-a')
    await createPatient('hospital-a', [], { patientCode: 'HOSP-1001', firstName: 'A', lastName: 'One', departmentId:department.id, department:department.name, admissionDate: '2026-08-31' })
    await createPatient('hospital-a', [], { patientCode: 'HOSP-1002', firstName: 'B', lastName: 'Two', departmentId:department.id, department:department.name, admissionDate: '2026-08-31' })
    expect(departmentsFor('hospital-a')).toHaveLength(1)
  })

  it('lets a patient have more than one admission over time', async () => {
    const department=seedDepartment('hospital-a')
    const { record } = await createPatient('hospital-a', [], { patientCode: 'HOSP-1001', firstName: 'Dialysis', lastName: 'Patient', departmentId:department.id, department:department.name, admissionDate: '2026-01-10' })
    await createAdmission('hospital-a', record, { departmentId:department.id, department:department.name, admissionDate: '2026-08-31' })
    const admissions = await loadAdmissions(record.recordId)
    expect(admissions).toHaveLength(2)
  })

  it('does not create a partial admission when the atomic operation fails', async () => {
    const department=seedDepartment('hospital-a')
    const { record } = await createPatient('hospital-a', [], { patientCode: 'HOSP-1001', firstName: 'A', lastName: 'Patient', departmentId:department.id, department:department.name, admissionDate: '2026-01-10' })
    failAdmissionTransaction=true
    await expect(createAdmission('hospital-a', record, { departmentId:department.id, department:department.name, admissionDate: '2026-08-31' }))
      .rejects.toMatchObject({message:'admission transaction failed'})
    expect(await loadAdmissions(record.recordId)).toHaveLength(1)
  })
})