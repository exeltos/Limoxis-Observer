import { supabase } from '../../core/supabase/client'
import { patientDemoData } from './patientDemoData'
import { ensureDepartment } from '../management/departmentsService'

function mapRow(row, departmentLabel){
  const name=`${row.first_name||''} ${row.last_name||''}`.trim()
  return {
    id: row.patient_code,
    recordId: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fatherName: row.father_name,
    name,
    nameEn: name,
    hospitalRecordNumber: row.hospital_record_number,
    dateOfBirth: row.date_of_birth,
    sex: row.sex,
    departmentId: row.department_id,
    department: departmentLabel||'',
    departmentEn: departmentLabel||'',
    admissionDate: row.admission_date,
    dischargeDate: row.discharge_date,
    status: row.status,
    notes: row.notes,
  }
}

export async function loadPatients(organizationId, {isDemo=false}={}){
  if(isDemo || !organizationId || !supabase) return structuredClone(patientDemoData)
  const {data,error}=await supabase.from('patients').select('*, department:departments(name)').eq('organization_id',organizationId).order('admission_date',{ascending:false})
  if(error) throw error
  return (data??[]).map(row=>mapRow(row,row.department?.name))
}

export async function createPatient(organizationId, existing, draft, {isDemo=false}={}){
  const patientCode=draft.patientCode
  if(isDemo || !organizationId || !supabase){
    const record={id:patientCode,status:'active',...draft}
    return {record,list:[record,...existing]}
  }
  const departmentId=draft.department?await ensureDepartment(organizationId,draft.department):null
  const {data,error}=await supabase.from('patients').insert({
    organization_id:organizationId,
    patient_code:patientCode,
    first_name:draft.firstName||null,
    last_name:draft.lastName||null,
    father_name:draft.fatherName||draft.patronymic||null,
    hospital_record_number:draft.hospitalRecordNumber||null,
    date_of_birth:draft.dateOfBirth||null,
    sex:draft.sex||null,
    department_id:departmentId,
    admission_date:draft.admissionDate,
    discharge_date:draft.dischargeDate||null,
    status:draft.status||'active',
    notes:draft.notes||null,
  }).select().single()
  if(error){
    if(error.code==='23505')error.duplicateCode=true
    throw error
  }
  const record=mapRow(data,draft.department)
  return {record,list:[record,...existing]}
}

function mapAdmission(row, departmentLabel){
  return {
    id: row.id,
    departmentId: row.department_id,
    department: departmentLabel||'',
    admissionDate: row.admission_date,
    dischargeDate: row.discharge_date,
    status: row.status,
    notes: row.notes,
  }
}

export async function loadAdmissions(patientRecordId){
  if(!patientRecordId || !supabase) return []
  const {data,error}=await supabase.from('patient_admissions').select('*, department:departments(name)').eq('patient_id',patientRecordId).order('admission_date',{ascending:false})
  if(error) throw error
  return (data??[]).map(row=>mapAdmission(row,row.department?.name))
}

export async function createAdmission(organizationId, patient, draft, {isDemo=false}={}){
  if(isDemo || !patient.recordId || !supabase){
    return mapAdmission({id:`ADM-${Date.now()}`,department_id:null,admission_date:draft.admissionDate,discharge_date:draft.dischargeDate||null,status:draft.status||'active',notes:draft.notes||null},draft.department)
  }
  const departmentId=draft.department?await ensureDepartment(organizationId,draft.department):null
  const {data,error}=await supabase.rpc('create_patient_admission',{
    p_organization_id:organizationId,
    p_patient_id:patient.recordId,
    p_department_id:departmentId,
    p_admission_date:draft.admissionDate,
    p_discharge_date:draft.dischargeDate||null,
    p_status:draft.status||'active',
    p_notes:draft.notes||null,
  })
  if(error) throw error
  return mapAdmission(data,draft.department)
}
