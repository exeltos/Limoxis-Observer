import { supabase } from '../../core/supabase/client'
import { patientDemoData } from './patientDemoData'

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

async function resolveDepartment(organizationId, departmentId){
  if(!departmentId) return null
  const {data,error}=await supabase.from('departments').select('id,name,is_active').eq('organization_id',organizationId).eq('id',departmentId).eq('is_active',true).maybeSingle()
  if(error) throw error
  if(!data) throw new Error('Selected department is not available for this organization.')
  return data
}

export async function createPatient(organizationId, existing, draft, {isDemo=false}={}){
  const patientCode=draft.patientCode
  if(isDemo || !organizationId || !supabase){
    const record={id:patientCode,status:'active',...draft}
    return {record,list:[record,...existing]}
  }
  const department=await resolveDepartment(organizationId,draft.departmentId)
  const {data,error}=await supabase.from('patients').insert({
    organization_id:organizationId,
    patient_code:patientCode,
    first_name:draft.firstName||null,
    last_name:draft.lastName||null,
    father_name:draft.fatherName||draft.patronymic||null,
    hospital_record_number:draft.hospitalRecordNumber||null,
    date_of_birth:draft.dateOfBirth||null,
    sex:draft.sex||null,
    department_id:department?.id||null,
    admission_date:draft.admissionDate,
    discharge_date:draft.dischargeDate||null,
    status:draft.status||'active',
    notes:draft.notes||null,
  }).select().single()
  if(error){
    if(error.code==='23505')error.duplicateCode=true
    throw error
  }
  const record=mapRow(data,department?.name||draft.department)
  return {record,list:[record,...existing]}
}

export async function updatePatient(organizationId, patient, patch, {isDemo=false}={}){
  if(isDemo || !organizationId || !supabase) return {...patient,...patch}
  const payload={}
  if(patch.firstName!==undefined)payload.first_name=patch.firstName||null
  if(patch.lastName!==undefined)payload.last_name=patch.lastName||null
  if(patch.admissionDate!==undefined)payload.admission_date=patch.admissionDate
  if(patch.status!==undefined)payload.status=patch.status
  let departmentLabel=patient.department
  if(patch.departmentId!==undefined){
    const department=await resolveDepartment(organizationId,patch.departmentId)
    payload.department_id=department?.id||null
    departmentLabel=department?.name||''
  }
  const {data,error}=await supabase.from('patients').update(payload).eq('id',patient.recordId).eq('organization_id',organizationId).select('*, department:departments(name)').single()
  if(error) throw error
  return mapRow(data,data.department?.name||departmentLabel)
}

export async function deletePatientWithHistory(organizationId, patient, reason, {isDemo=false}={}){
  if(isDemo || !organizationId || !supabase) return
  const {error}=await supabase.rpc('delete_patient_with_history',{target_org:organizationId,target_patient:patient.recordId,p_reason:reason})
  if(error) throw error
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
  const {data,error}=await supabase.from('patient_admissions').select('*').eq('patient_id',patientRecordId).order('admission_date',{ascending:false})
  if(error) throw error
  const rows=data??[]
  const departmentIds=[...new Set(rows.map(row=>row.department_id).filter(Boolean))]
  if(!departmentIds.length) return rows.map(row=>mapAdmission(row,''))
  const {data:departments,error:departmentError}=await supabase.from('departments').select('id,name').in('id',departmentIds)
  if(departmentError) throw departmentError
  const departmentById=new Map((departments??[]).map(department=>[department.id,department.name]))
  return rows.map(row=>mapAdmission(row,departmentById.get(row.department_id)||''))
}

export async function createAdmission(organizationId, patient, draft, {isDemo=false}={}){
  if(isDemo || !patient.recordId || !supabase){
    return mapAdmission({id:`ADM-${Date.now()}`,department_id:draft.departmentId||null,admission_date:draft.admissionDate,discharge_date:draft.dischargeDate||null,status:draft.status||'active',notes:draft.notes||null},draft.department)
  }
  const department=await resolveDepartment(organizationId,draft.departmentId)
  const {data,error}=await supabase.rpc('create_patient_admission',{
    p_organization_id:organizationId,
    p_patient_id:patient.recordId,
    p_department_id:department?.id||null,
    p_admission_date:draft.admissionDate,
    p_discharge_date:draft.dischargeDate||null,
    p_status:draft.status||'active',
    p_notes:draft.notes||null,
  })
  if(error) throw error
  return mapAdmission(data,department?.name||draft.department)
}
