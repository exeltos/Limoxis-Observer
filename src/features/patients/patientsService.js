import { supabase } from '../../core/supabase/client'
import { patientDemoData } from './patientDemoData'

function mapRow(row){
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    patronymic: row.father_name,
    firstNameEn: row.first_name_en,
    lastNameEn: row.last_name_en,
    patronymicEn: row.father_name_en,
    name: row.name,
    nameEn: row.name_en,
    hospitalRecordNumber: row.hospital_record_number,
    dateOfBirth: row.date_of_birth,
    sex: row.sex,
    department: row.department,
    departmentEn: row.department_en,
    admissionDate: row.admission_date,
    dischargeDate: row.discharge_date,
    status: row.status,
    notes: row.notes,
  }
}

export async function loadPatients(organizationId, {isDemo=false}={}){
  if(isDemo || !organizationId || !supabase) return structuredClone(patientDemoData)
  const {data,error}=await supabase.from('patients').select('*').eq('organization_id',organizationId).order('admission_date',{ascending:false})
  if(error) throw error
  return (data??[]).map(mapRow)
}

function nextPatientId(existing){
  const maxNumber=existing.reduce((max,item)=>{
    const number=Number(String(item.id||'').replace(/\D/g,''))
    return Number.isFinite(number)?Math.max(max,number):max
  },260000)
  return `PT-${String(maxNumber+1).slice(-6)}`
}

export async function createPatient(organizationId, existing, draft, {isDemo=false}={}){
  const id=nextPatientId(existing)
  if(isDemo || !organizationId || !supabase){
    const record={id,status:'active',...draft}
    return {record,list:[record,...existing]}
  }
  const {data,error}=await supabase.from('patients').insert({
    id,
    organization_id:organizationId,
    first_name:draft.firstName||null,
    last_name:draft.lastName||null,
    father_name:draft.patronymic||null,
    first_name_en:draft.firstNameEn||null,
    last_name_en:draft.lastNameEn||null,
    father_name_en:draft.patronymicEn||null,
    name:draft.name,
    name_en:draft.nameEn||draft.name,
    hospital_record_number:draft.hospitalRecordNumber||null,
    date_of_birth:draft.dateOfBirth||null,
    sex:draft.sex||null,
    department:draft.department||null,
    department_en:draft.departmentEn||null,
    admission_date:draft.admissionDate,
    discharge_date:draft.dischargeDate||null,
    status:draft.status||'active',
    notes:draft.notes||null,
  }).select().single()
  if(error) throw error
  const record=mapRow(data)
  return {record,list:[record,...existing]}
}
