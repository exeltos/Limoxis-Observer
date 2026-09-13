import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadVaccinations,saveVaccinations } from '../employees/employeeRecordsService'

const COLUMNS='id,employee_id,vaccine_label_snapshot,dose,vaccination_date,lot_number,valid_until,status,clinical_notes,created_at,updated_at'

function ensureCloud(organizationId,operation){
  if(isDemoDataEnvironment())return false
  if(!hasSupabaseConfig||!supabase)throw new Error(`PRODUCTION_CLOUD_REQUIRED:${operation}`)
  if(!organizationId)throw new Error(`PRODUCTION_ORGANIZATION_REQUIRED:${operation}`)
  return true
}

function fromRow(row){
  return {
    id:row.id,
    employeeId:row.employee_id,
    vaccine:row.vaccine_label_snapshot||'',
    dose:row.dose||'',
    date:row.vaccination_date||'',
    lotNumber:row.lot_number||'',
    validUntil:row.valid_until||null,
    status:row.status||'complete',
    clinicalNotes:row.clinical_notes||'',
    createdAt:row.created_at||null,
    updatedAt:row.updated_at||null,
  }
}

export async function loadAllVaccinationsAsync(organizationId){
  if(isDemoDataEnvironment())return loadVaccinations()
  ensureCloud(organizationId,'employee_vaccinations.load_all')
  const {data,error}=await supabase
    .from('employee_vaccinations')
    .select(COLUMNS)
    .eq('organization_id',organizationId)
    .order('vaccination_date',{ascending:false})
  if(error)throw error
  return (data||[]).map(fromRow)
}

export async function createVaccinationsBulkAsync(organizationId,employees,draft){
  const selected=(employees||[]).filter(Boolean)
  if(!selected.length)throw new Error('VACCINATION_EMPLOYEE_REQUIRED')
  if(!draft?.vaccine?.trim())throw new Error('VACCINATION_VACCINE_REQUIRED')
  if(!draft?.date)throw new Error('VACCINATION_DATE_REQUIRED')

  if(isDemoDataEnvironment()){
    const existing=loadVaccinations()
    const now=Date.now()
    const added=selected.map((employee,index)=>({
      id:`VAC-${now}-${index+1}`,
      employeeId:employee.id,
      vaccine:draft.vaccine.trim(),
      dose:String(draft.dose||'').trim(),
      date:draft.date,
      lotNumber:String(draft.lotNumber||'').trim(),
      validUntil:draft.validUntil||null,
      status:draft.status||'complete',
      clinicalNotes:String(draft.clinicalNotes||'').trim(),
    }))
    saveVaccinations([...added,...existing])
    return added
  }

  ensureCloud(organizationId,'employee_vaccinations.create_bulk')
  if(selected.some(employee=>!employee.dbId))throw new Error('PRODUCTION_EMPLOYEE_DB_ID_REQUIRED:employee_vaccinations.create_bulk')
  const payload=selected.map(employee=>({
    organization_id:organizationId,
    employee_id:employee.dbId,
    vaccine_label_snapshot:draft.vaccine.trim(),
    dose:String(draft.dose||'').trim()||null,
    vaccination_date:draft.date,
    lot_number:String(draft.lotNumber||'').trim()||null,
    valid_until:draft.validUntil||null,
    status:draft.status||'complete',
    clinical_notes:String(draft.clinicalNotes||'').trim()||null,
  }))
  const {data,error}=await supabase.from('employee_vaccinations').insert(payload).select(COLUMNS)
  if(error)throw error
  return (data||[]).map(fromRow)
}
