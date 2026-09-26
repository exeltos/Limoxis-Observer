import { supabase } from '../../core/supabase/client'
import { patientDemoData, demoAdmissionsForPatient } from './patientDemoData'

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
    birthWeightGrams: row.birth_weight_grams,
    gestationalAgeWeeks: row.gestational_age_weeks,
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
  const {data,error}=await supabase.from('patients').select('*, department:departments(name)').eq('organization_id',organizationId).is('archived_at',null).order('admission_date',{ascending:false})
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

async function createInitialAdmission(organizationId,record,draft,{isDemo=false}={}){
  if(!draft.admissionDate)return record
  // Best-effort: the patient is already saved, so an admission failure here must not fail the whole creation.
  const admission=await createAdmission(organizationId,record,draft,{isDemo}).catch(()=>null)
  return admission?{...record,admissionId:admission.id}:record
}

export async function createPatient(organizationId, existing, draft, {isDemo=false}={}){
  const patientCode=draft.patientCode
  if(isDemo || !organizationId || !supabase){
    // No real "patients" row is inserted here, so the patients_create_initial_admission
    // DB trigger never runs — mirror it locally so the patient isn't left without an admission.
    const record=await createInitialAdmission(organizationId,{id:patientCode,status:'active',...draft},draft,{isDemo})
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
    birth_weight_grams:draft.birthWeightGrams||null,
    gestational_age_weeks:draft.gestationalAgeWeeks||null,
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
  // The patients_create_initial_admission DB trigger already inserted the admission row.
  const record=mapRow(data,department?.name||draft.department)
  return {record,list:[record,...existing]}
}

export async function updatePatient(organizationId, patient, patch, {isDemo=false}={}){
  if(isDemo || !organizationId || !supabase) return {...patient,...patch,name:`${patch.firstName??patient.firstName??''} ${patch.lastName??patient.lastName??''}`.trim()}
  const payload={}
  if(patch.firstName!==undefined)payload.first_name=patch.firstName||null
  if(patch.lastName!==undefined)payload.last_name=patch.lastName||null
  if(patch.fatherName!==undefined)payload.father_name=patch.fatherName||null
  if(patch.hospitalRecordNumber!==undefined)payload.hospital_record_number=patch.hospitalRecordNumber||null
  if(patch.dateOfBirth!==undefined)payload.date_of_birth=patch.dateOfBirth||null
  if(patch.birthWeightGrams!==undefined)payload.birth_weight_grams=patch.birthWeightGrams||null
  if(patch.gestationalAgeWeeks!==undefined)payload.gestational_age_weeks=patch.gestationalAgeWeeks||null
  if(patch.sex!==undefined)payload.sex=patch.sex||null
  if(patch.notes!==undefined)payload.notes=patch.notes||null
  const departmentLabel=patient.department
  const {data,error}=await supabase.from('patients').update(payload).eq('id',patient.recordId).eq('organization_id',organizationId).select('*, department:departments(name)').single()
  if(error) throw error
  return mapRow(data,data.department?.name||departmentLabel)
}

export async function archivePatient(organizationId, patient, reason, {isDemo=false}={}){
  if(isDemo || !organizationId || !supabase) return
  const {error}=await supabase.rpc('archive_patient',{p_organization_id:organizationId,p_patient_id:patient.recordId,p_reason:reason})
  if(error) throw error
}

function mapAdmission(row, departmentLabel, departmentType){
  return {
    id: row.id,
    departmentId: row.department_id,
    department: departmentLabel||'',
    // read by clinical-scale recommendations (NICU/PICU/ICU context)
    department_type: departmentType||row.department_type||null,
    admissionDate: row.admission_date,
    dischargeDate: row.discharge_date,
    status: row.status,
    notes: row.notes,
  }
}

export async function loadAdmissions(patientOrRecordId, {isDemo=false}={}){
  if(isDemo) return demoAdmissionsForPatient(patientOrRecordId)
  const patientRecordId=patientOrRecordId
  if(!patientRecordId || !supabase) return []
  const {data,error}=await supabase.from('patient_admissions').select('*').eq('patient_id',patientRecordId).order('admission_date',{ascending:false})
  if(error) throw error
  const rows=data??[]
  const departmentIds=[...new Set(rows.map(row=>row.department_id).filter(Boolean))]
  if(!departmentIds.length) return rows.map(row=>mapAdmission(row,''))
  const {data:departments,error:departmentError}=await supabase.from('departments').select('id,name,department_type').in('id',departmentIds)
  if(departmentError) throw departmentError
  const departmentById=new Map((departments??[]).map(department=>[department.id,department]))
  return rows.map(row=>mapAdmission(row,departmentById.get(row.department_id)?.name||'',departmentById.get(row.department_id)?.department_type))
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

export async function dischargeAdmission(organizationId,patient,admission,draft,{isDemo=false}={}){
  if(isDemo || !supabase) return {...admission,status:'discharged',dischargeDate:draft.date,notes:draft.reason||admission.notes}
  const {data,error}=await supabase.rpc('close_patient_admission',{p_organization_id:organizationId,p_patient_id:patient.recordId,p_admission_id:admission.id,p_discharge_date:draft.date,p_reason:draft.reason||null})
  if(error) throw error
  return mapAdmission(data,admission.department)
}

export async function transferAdmission(organizationId,patient,admission,draft,{isDemo=false}={}){
  if(isDemo || !supabase) return mapAdmission({id:`ADM-${Date.now()}`,department_id:draft.departmentId,admission_date:draft.date,discharge_date:null,status:'active',notes:draft.reason||null},draft.department)
  const department=await resolveDepartment(organizationId,draft.departmentId)
  const {data,error}=await supabase.rpc('transfer_patient_admission',{p_organization_id:organizationId,p_patient_id:patient.recordId,p_admission_id:admission.id,p_to_department_id:draft.departmentId,p_transfer_date:draft.date,p_reason:draft.reason||null})
  if(error) throw error
  return mapAdmission(data,department?.name||draft.department)
}

export async function deletePatientForTesting(organizationId, patientRecordId, {isDemo=false}={}){
  if(isDemo || !organizationId || !supabase) return true
  if(!patientRecordId) throw new Error('Patient record is required.')
  const {data,error}=await supabase.rpc('delete_patient_for_testing',{p_organization_id:organizationId,p_patient_id:patientRecordId})
  if(error) throw error
  return Boolean(data)
}
