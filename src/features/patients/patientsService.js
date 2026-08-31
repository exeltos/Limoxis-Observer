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

function nextPatientCode(existing){
  const maxNumber=existing.reduce((max,item)=>{
    const number=Number(String(item.id||'').replace(/\D/g,''))
    return Number.isFinite(number)?Math.max(max,number):max
  },260000)
  return `PT-${String(maxNumber+1).slice(-6)}`
}

export async function createPatient(organizationId, existing, draft, {isDemo=false}={}){
  const patientCode=nextPatientCode(existing)
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
  if(error) throw error
  const record=mapRow(data,draft.department)
  return {record,list:[record,...existing]}
}
