import { supabase } from '../../core/supabase/client'
import { selectAllPages } from '../../core/data/inChunks'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadExposureIncidents,saveExposureIncidents } from '../employees/employeeRecordsService'

const COLUMNS='id,employee_id,incident_date,exposure_type,device_or_source,body_site,source_patient_status,reported_at,pep_administered,pep_details,follow_up_status,follow_up_due_at,notes,status,created_at,updated_at,employee_surveillance_record_id,source_case_id'

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
    incidentDate:row.incident_date||'',
    exposureType:row.exposure_type||'',
    deviceOrSource:row.device_or_source||'',
    bodySite:row.body_site||'',
    sourcePatientStatus:row.source_patient_status||'',
    reportedAt:row.reported_at||null,
    pepAdministered:row.pep_administered??null,
    pepDetails:row.pep_details||'',
    followUpStatus:row.follow_up_status||'pending',
    followUpDueAt:row.follow_up_due_at||'',
    notes:row.notes||'',
    status:row.status||'open',
    createdAt:row.created_at||null,
    updatedAt:row.updated_at||null,
    employeeSurveillanceRecordId:row.employee_surveillance_record_id||'',
    sourceCaseId:row.source_case_id||'',
  }
}

export async function loadAllExposureIncidentsAsync(organizationId){
  if(isDemoDataEnvironment())return loadExposureIncidents()
  ensureCloud(organizationId,'occupational_exposure_incidents.load_all')
  const data=await selectAllPages(()=>supabase
    .from('occupational_exposure_incidents')
    .select(COLUMNS)
    .eq('organization_id',organizationId)
    .order('incident_date',{ascending:false})
    .order('id'))
  return data.map(fromRow)
}

export async function createExposureIncidentAsync(organizationId,employee,draft){
  if(!employee)throw new Error('EXPOSURE_INCIDENT_EMPLOYEE_REQUIRED')
  if(!draft?.incidentDate)throw new Error('EXPOSURE_INCIDENT_DATE_REQUIRED')
  if(!draft?.exposureType)throw new Error('EXPOSURE_INCIDENT_TYPE_REQUIRED')

  if(isDemoDataEnvironment()){
    const existing=loadExposureIncidents()
    const added={
      id:`EXP-${Date.now()}`,
      employeeId:employee.id,
      incidentDate:draft.incidentDate,
      exposureType:draft.exposureType,
      deviceOrSource:String(draft.deviceOrSource||'').trim(),
      bodySite:String(draft.bodySite||'').trim(),
      sourcePatientStatus:draft.sourcePatientStatus||'',
      reportedAt:new Date().toISOString(),
      pepAdministered:draft.pepAdministered??null,
      pepDetails:String(draft.pepDetails||'').trim(),
      followUpStatus:draft.followUpStatus||'pending',
      followUpDueAt:draft.followUpDueAt||'',
      notes:String(draft.notes||'').trim(),
      status:draft.status||'open',
      employeeSurveillanceRecordId:draft.employeeSurveillanceRecordId||'',
      sourceCaseId:draft.sourceCaseId||'',
    }
    saveExposureIncidents([added,...existing])
    return added
  }

  ensureCloud(organizationId,'occupational_exposure_incidents.create')
  if(!employee.dbId)throw new Error('PRODUCTION_EMPLOYEE_DB_ID_REQUIRED:occupational_exposure_incidents.create')
  const {data,error}=await supabase
    .from('occupational_exposure_incidents')
    .insert({
      organization_id:organizationId,
      employee_id:employee.dbId,
      incident_date:draft.incidentDate,
      exposure_type:draft.exposureType,
      device_or_source:String(draft.deviceOrSource||'').trim()||null,
      body_site:String(draft.bodySite||'').trim()||null,
      source_patient_status:draft.sourcePatientStatus||null,
      pep_administered:draft.pepAdministered??null,
      pep_details:String(draft.pepDetails||'').trim()||null,
      follow_up_status:draft.followUpStatus||'pending',
      follow_up_due_at:draft.followUpDueAt||null,
      notes:String(draft.notes||'').trim()||null,
      status:draft.status||'open',
      employee_surveillance_record_id:draft.employeeSurveillanceRecordId||null,
      source_case_id:draft.sourceCaseId||null,
    })
    .select(COLUMNS)
    .single()
  if(error)throw error
  return fromRow(data)
}

// The exposures recorded from one staff surveillance record (the «Έκθεση προσωπικού» section).
export async function loadExposureIncidentsForRecordAsync(organizationId,recordId){
  if(!recordId)return []
  if(isDemoDataEnvironment())return loadExposureIncidents().filter(row=>String(row.employeeSurveillanceRecordId||'')===String(recordId))
  ensureCloud(organizationId,'occupational_exposure_incidents.load_for_record')
  const {data,error}=await supabase
    .from('occupational_exposure_incidents')
    .select(COLUMNS)
    .eq('organization_id',organizationId)
    .eq('employee_surveillance_record_id',recordId)
    .order('incident_date',{ascending:false})
  if(error)throw error
  return (data||[]).map(fromRow)
}

// How many employees were exposed to the source patient of a surveillance episode: a number only,
// never names. Production asks the database (surveillance_case_exposure_count checks that the
// caller may see the episode); the demo counts its own sample exposures.
export async function countSourceExposuresAsync(organizationId,caseRef){
  if(!caseRef)return 0
  if(isDemoDataEnvironment())return new Set(loadExposureIncidents().filter(row=>String(row.sourceCaseId||'')===String(caseRef)).map(row=>row.employeeId)).size
  if(!hasSupabaseConfig||!supabase||!organizationId)return 0
  const {data,error}=await supabase.rpc('surveillance_case_exposure_count',{p_case_id:caseRef})
  if(error)throw error
  return Number(data)||0
}
