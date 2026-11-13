import { binCloudRows,binLocalRow,describeDeleted } from '../../core/recycleBin/recycleBinService'
import { supabase } from '../../core/supabase/client'
import { cloudClient } from '../../core/supabase/cloudContext'
import type { Tables } from '../../core/supabase/database.types'
import type { EmployeeRow } from './occupationalHealthTypes'
import { selectAllPages } from '../../core/data/inChunks'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadVaccinations,saveVaccinations } from '../employees/employeeRecordsService'

const COLUMNS='id,employee_id,vaccine_label_snapshot,dose,vaccination_date,lot_number,valid_until,status,clinical_notes,created_at,updated_at'
type VaccinationRow=Pick<Tables<'employee_vaccinations'>,'id'|'employee_id'|'vaccine_label_snapshot'|'dose'|'vaccination_date'|'lot_number'|'valid_until'|'status'|'clinical_notes'|'created_at'|'updated_at'>
// A vaccination of the register (demo rows have the same shape).
export interface Vaccination { id: string, employeeId: string, vaccine: string, dose: string, date: string, lotNumber: string, validUntil: string | null, status: string, clinicalNotes: string, createdAt?: string | null, updatedAt?: string | null }
export interface VaccinationDraft { vaccine?: string, dose?: string | null, date?: string, lotNumber?: string | null, validUntil?: string | null, status?: string, clinicalNotes?: string | null }

function ensureCloud(organizationId: string | null | undefined,operation: string){
  if(isDemoDataEnvironment())return false
  if(!hasSupabaseConfig||!supabase)throw new Error(`PRODUCTION_CLOUD_REQUIRED:${operation}`)
  if(!organizationId)throw new Error(`PRODUCTION_ORGANIZATION_REQUIRED:${operation}`)
  return true
}

function fromRow(row: VaccinationRow): Vaccination{
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

export async function loadAllVaccinationsAsync(organizationId: string | null | undefined): Promise<Vaccination[]>{
  if(isDemoDataEnvironment())return loadVaccinations()
  ensureCloud(organizationId,'employee_vaccinations.load_all')
  const supabase=cloudClient()
  const data=await selectAllPages(()=>supabase
    .from('employee_vaccinations')
    .select(COLUMNS)
    .eq('organization_id',organizationId as string)
    .order('vaccination_date',{ascending:false,nullsFirst:false})
    .order('id'))
  return data.map(fromRow)
}

export async function createVaccinationsBulkAsync(organizationId: string | null | undefined,employees: Array<EmployeeRow | null | undefined> | null | undefined,draft: VaccinationDraft): Promise<Vaccination[]>{
  const selected=(employees||[]).filter(Boolean)
  if(!selected.length)throw new Error('VACCINATION_EMPLOYEE_REQUIRED')
  if(!draft?.vaccine?.trim())throw new Error('VACCINATION_VACCINE_REQUIRED')
  if(!draft?.date)throw new Error('VACCINATION_DATE_REQUIRED')

  if(isDemoDataEnvironment()){
    const existing=loadVaccinations()
    const now=Date.now()
    const added: Vaccination[]=selected.map((employee,index)=>({
      id:`VAC-${now}-${index+1}`,
      employeeId:employee.id,
      vaccine:String(draft.vaccine).trim(),
      dose:String(draft.dose||'').trim(),
      date:draft.date as string,
      lotNumber:String(draft.lotNumber||'').trim(),
      validUntil:draft.validUntil||null,
      status:draft.status||'complete',
      clinicalNotes:String(draft.clinicalNotes||'').trim(),
    }))
    saveVaccinations([...added,...existing])
    return added
  }

  ensureCloud(organizationId,'employee_vaccinations.create_bulk')
  const supabase=cloudClient()
  if(selected.some(employee=>!employee.dbId))throw new Error('PRODUCTION_EMPLOYEE_DB_ID_REQUIRED:employee_vaccinations.create_bulk')
  const payload=selected.map(employee=>({
    organization_id:organizationId as string,
    employee_id:employee.dbId as string,
    vaccine_label_snapshot:String(draft.vaccine).trim(),
    dose:String(draft.dose||'').trim()||null,
    vaccination_date:draft.date as string,
    lot_number:String(draft.lotNumber||'').trim()||null,
    valid_until:draft.validUntil||null,
    status:draft.status||'complete',
    clinical_notes:String(draft.clinicalNotes||'').trim()||null,
  }))
  const {data,error}=await supabase.from('employee_vaccinations').insert(payload).select(COLUMNS)
  if(error)throw error
  return (data||[]).map(fromRow)
}


export async function updateVaccinationAsync(organizationId: string | null | undefined,id: string,draft: VaccinationDraft){
  if(!id)throw new Error('VACCINATION_ID_REQUIRED')
  if(!draft?.vaccine?.trim())throw new Error('VACCINATION_VACCINE_REQUIRED')
  if(!draft?.date)throw new Error('VACCINATION_DATE_REQUIRED')
  if(isDemoDataEnvironment()){
    const rows: Vaccination[]=loadVaccinations();const next=rows.map(row=>row.id===id?{...row,...draft,id,employeeId:row.employeeId}:row);saveVaccinations(next);return next.find(row=>row.id===id)
  }
  ensureCloud(organizationId,'employee_vaccinations.update')
  const supabase=cloudClient()
  const payload={vaccine_label_snapshot:String(draft.vaccine).trim(),dose:String(draft.dose||'').trim()||null,vaccination_date:draft.date,lot_number:String(draft.lotNumber||'').trim()||null,valid_until:draft.validUntil||null,status:draft.status||'complete',clinical_notes:String(draft.clinicalNotes||'').trim()||null}
  const {data,error}=await supabase.from('employee_vaccinations').update(payload).eq('organization_id',organizationId as string).eq('id',id).select(COLUMNS).single()
  if(error)throw error
  return fromRow(data)
}

export async function deleteVaccinationAsync(organizationId: string | null | undefined,id: string){
  if(!id)throw new Error('VACCINATION_ID_REQUIRED')
  if(isDemoDataEnvironment()){const rows: Vaccination[]=loadVaccinations(),row=rows.find(item=>item.id===id);await binLocalRow(organizationId,{module:'occupational',kind:'employee_vaccinations',...describeDeleted('Εμβολιασμός',{...row,name:row?.vaccine}),table:'employee_vaccine_records',row});saveVaccinations(rows.filter(item=>item.id!==id));return}
  ensureCloud(organizationId,'employee_vaccinations.delete')
  const supabase=cloudClient()
  const {data:deleted}=await supabase.from('employee_vaccinations').select('*').eq('organization_id',organizationId as string).eq('id',id).maybeSingle()
  await binCloudRows(organizationId,{module:'occupational',kind:'employee_vaccinations',...describeDeleted('Εμβολιασμός',{name:deleted?.vaccine_label_snapshot,date:deleted?.vaccination_date}),parts:[{table:'employee_vaccinations',match:{id}}]})
  const {error}=await supabase.from('employee_vaccinations').delete().eq('organization_id',organizationId as string).eq('id',id)
  if(error)throw error
}
