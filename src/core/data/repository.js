import { supabase } from '../supabase/client'
import { hasSupabaseConfig } from '../config/env'
import { dataPartitionKey,environmentFallback,isDemoDataEnvironment } from './dataEnvironment'
import { isEmptyPreview } from '../preview/emptyPreview'
const backend=(import.meta.env.VITE_DATA_BACKEND||'local').trim().toLowerCase()
const memory=new Map()

const TABLES=Object.freeze({
  employee_health_visits:{storageKey:'limoxis.employeeHealthVisits.v1',kind:'rows',cloud:false},
  employee_vaccine_records:{storageKey:'limoxis.employeeVaccineRecords.v1',kind:'rows',cloud:false},
  employee_training_summary:{storageKey:'limoxis.employeeTrainingSummary.v1',kind:'rows',cloud:false},
  employee_evaluations:{storageKey:'limoxis.employeeEvaluations.v1',kind:'rows',cloud:false},
  employee_certificates:{storageKey:'limoxis.employeeCertificates.v1',kind:'rows',cloud:false},
  occupational_exposure_incidents:{storageKey:'limoxis.occupationalExposureIncidents.v1',kind:'rows',cloud:false},
  // Demo Training state (programmes, assignments, …). Production training
  // lives in the training_* tables (src/features/training/trainingService.js).
  training_local_state:{storageKey:'limoxis.training.v3',legacyKeys:['limoxis.training.v2'],kind:'document',cloud:false},
  environmental_standards:{storageKey:'limoxis.environmentalStandards.v1',kind:'rows'},
  organization_settings:{storageKey:'limoxis.organizationSettings.v1',kind:'document',cloud:false},
  bundle_library:{storageKey:'limoxis.bundleLibrary.v1',kind:'rows',cloud:false},
  management_libraries:{storageKey:'limoxis.managementLibraries.v2',kind:'document',cloud:false},
  management_questionnaires_v1:{storageKey:'limoxis.managementQuestionnaires.v1',kind:'rows',cloud:false},
  management_hospital_structure:{storageKey:'limoxis.managementHospitalStructure.v1',kind:'rows',cloud:false},
  management_prevalence_survey:{storageKey:'limoxis.managementPrevalenceSurvey.v1',kind:'rows',cloud:false},
  pharmacy_antibiotic_dispensing:{storageKey:'limoxis.pharmacyAntibioticDispensing.v1',kind:'rows',cloud:false},
  documents:{storageKey:'limoxis.documents.v1',kind:'rows',cloud:false},
  protocol_update_suggestions:{storageKey:'limoxis.protocolUpdateSuggestions.v1',kind:'rows',cloud:false},
  employees:{storageKey:'limoxis.employees.v1',kind:'rows',cloud:false},
  employee_position_acknowledgements:{storageKey:'limoxis.employeePositionAcknowledgements.v1',kind:'rows',cloud:false},
  indicator_local_definitions:{storageKey:'limoxis.indicatorLocalDefinitions.v1',kind:'rows',cloud:false},
  indicator_local_snapshots:{storageKey:'limoxis.indicatorLocalSnapshots.v1',kind:'rows',cloud:false},
  committees:{storageKey:'limoxis.committees.v1',kind:'rows',cloud:false},
  announcements:{storageKey:'limoxis.announcements.v2',kind:'rows',cloud:false},
  notification_reads:{storageKey:'limoxis.notificationReads.v1',kind:'document',cloud:false},
  prevention_hand_hygiene:{storageKey:'limoxis.preventionHandHygiene.v1',kind:'rows',cloud:false},
  prevention_waste:{storageKey:'limoxis.preventionWaste.v1',kind:'rows',cloud:false},
  prevention_antiseptic:{storageKey:'limoxis.preventionAntiseptic.v1',kind:'rows',cloud:false},
  prevention_bundles:{storageKey:'limoxis.preventionBundles.v1',kind:'rows',cloud:false},
  control_local_definitions:{storageKey:'limoxis.controlLocalDefinitions.v1',kind:'rows',cloud:false},
  control_local_assignments:{storageKey:'limoxis.controlLocalAssignments.v1',kind:'rows',cloud:false},
  control_local_executions:{storageKey:'limoxis.controlLocalExecutions.v1',kind:'rows',cloud:false},
  control_local_drafts:{storageKey:'limoxis.controlLocalDrafts.v1',kind:'rows',cloud:false},
  quality_local_incidents:{storageKey:'limoxis.qualityLocalIncidents.v1',kind:'rows',cloud:false},
  quality_local_findings:{storageKey:'limoxis.qualityLocalFindings.v1',kind:'rows',cloud:false},
  quality_local_capas:{storageKey:'limoxis.qualityLocalCapas.v1',kind:'rows',cloud:false},
  quality_local_audits:{storageKey:'limoxis.qualityLocalAudits.v1',kind:'rows',cloud:false},
  quality_local_audit_templates:{storageKey:'limoxis.qualityLocalAuditTemplates.v1',kind:'rows',cloud:false},
  quality_local_risk_assessments:{storageKey:'limoxis.qualityLocalRiskAssessments.v1',kind:'rows',cloud:false},
  quality_local_reviews:{storageKey:'limoxis.qualityLocalReviews.v1',kind:'rows',cloud:false},
  quality_local_department_meetings:{storageKey:'limoxis.qualityLocalDepartmentMeetings.v1',kind:'rows',cloud:false},
  quality_local_surveys:{storageKey:'limoxis.qualityLocalSurveys.v1',kind:'rows',cloud:false},
  quality_local_survey_responses:{storageKey:'limoxis.qualityLocalSurveyResponses.v1',kind:'rows',cloud:false},
  quality_local_suppliers:{storageKey:'limoxis.qualityLocalSuppliers.v1',kind:'rows',cloud:false},
  quality_local_supplier_templates:{storageKey:'limoxis.qualityLocalSupplierTemplates.v1',kind:'rows',cloud:false},
  quality_local_equipment:{storageKey:'limoxis.qualityLocalEquipment.v1',kind:'rows',cloud:false},
  quality_local_equipment_events:{storageKey:'limoxis.qualityLocalEquipmentEvents.v1',kind:'rows',cloud:false},
  legislation_local_library:{storageKey:'limoxis.legislationLocalLibrary.v1',kind:'rows',cloud:false},
  legislation_local_versions:{storageKey:'limoxis.legislationLocalVersions.v1',kind:'rows',cloud:false},
  legislation_local_rows:{storageKey:'limoxis.legislationLocalRows.v1',kind:'rows',cloud:false},
  legislation_local_candidates:{storageKey:'limoxis.legislationLocalCandidates.v1',kind:'rows',cloud:false},
  legislation_local_sources:{storageKey:'limoxis.legislationLocalSources.v1',kind:'rows',cloud:false},
  regulations_local:{storageKey:'limoxis.regulationsLocal.v1',kind:'rows',cloud:false},
  quality_local_objectives:{storageKey:'limoxis.qualityLocalObjectives.v1',kind:'rows',cloud:false},
  quality_department_registers:{storageKey:'limoxis.qualityDepartmentRegisters.v1',kind:'rows',cloud:false},
  quality_department_register_entries:{storageKey:'limoxis.qualityDepartmentRegisterEntries.v1',kind:'rows',cloud:false},
  quality_department_register_identities:{storageKey:'limoxis.qualityDepartmentRegisterIdentities.v1',kind:'document',cloud:false},
  recycle_bin_local:{storageKey:'limoxis.recycleBin.v1',kind:'rows',cloud:false},
  // Demo kitchen (HACCP). Production kitchen lives in the kitchen_* tables (src/features/kitchen/kitchenService.js).
  kitchen_local_state:{storageKey:'limoxis.kitchen.v1',kind:'document',cloud:false},
})

// The hospital's own records (not the product's libraries, templates or the
// hospital structure): the empty-hospital preview (?helpEmpty=1) starts them empty.
const SAMPLE_RECORD_TABLES=new Set(['employee_health_visits','employee_vaccine_records','employee_training_summary','employee_evaluations','employee_certificates','occupational_exposure_incidents','training_local_state','management_prevalence_survey','pharmacy_antibiotic_dispensing','documents','protocol_update_suggestions','employees','employee_position_acknowledgements','indicator_local_snapshots','committees','announcements','prevention_hand_hygiene','prevention_waste','prevention_antiseptic','prevention_bundles','control_local_definitions','control_local_assignments','control_local_executions','control_local_drafts','quality_local_incidents','quality_local_findings','quality_local_capas','quality_local_audits','quality_local_risk_assessments','quality_local_reviews','quality_local_department_meetings','quality_local_surveys','quality_local_survey_responses','quality_local_suppliers','quality_local_equipment','quality_local_equipment_events','quality_local_objectives','quality_department_registers','quality_department_register_entries','quality_department_register_identities'])
function emptyRecords(value){
  if(Array.isArray(value))return []
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,Array.isArray(item)?[]:item]))
  return value
}
function demoFallback(table,cfg,fallback){
  if(!isEmptyPreview()||!SAMPLE_RECORD_TABLES.has(table))return clone(fallback)
  return cfg.kind==='rows'?[]:emptyRecords(clone(fallback))
}

export class DataAccessError extends Error{
  constructor(message,{table,operation,cause,code}={}){
    super(message); this.name='DataAccessError'; this.table=table; this.operation=operation; this.cause=cause; this.code=code||cause?.code||null
  }
}

function config(table){
  const value=TABLES[table]
  if(!value)throw new DataAccessError(`Unknown repository table: ${table}`,{table,operation:'config'})
  return value
}
function emit(detail){
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('limoxis:data-operation',{detail}))
}
function clone(v){return v==null?v:structuredClone(v)}
function memoryKey(table){return `${dataPartitionKey()}:${table}`}
function localKey(cfg){return `${dataPartitionKey()}:${cfg.storageKey}`}

function toRecords(cfg,rows,organizationId){
  return (rows||[]).map((row,index)=>({organization_id:organizationId,record_key:String(row.id??row.recordKey??index),payload:row}))
}
function recordSetFingerprint(records){
  return records.map(r=>`${r.record_key}:${JSON.stringify(r.payload)}`).sort().join('\n')
}

function readLocal(table,fallback){
  const cfg=config(table)
  try{
    // Demo is ephemeral by design: refresh restores the canonical seed.
    // Mutations remain available only in the in-memory repository cache.
    // The empty-hospital preview runs outside the Demo environment too (help frame): its records still start empty.
    if(isDemoDataEnvironment()||(isEmptyPreview()&&SAMPLE_RECORD_TABLES.has(table)))return demoFallback(table,cfg,fallback)
    const scopedKey=localKey(cfg)
    const keys=[scopedKey,...(isDemoDataEnvironment()?[cfg.storageKey,...(cfg.legacyKeys||[])]:[])]
    const raw=keys.map(k=>localStorage.getItem(k)).find(Boolean)
    if(raw){
      const parsed=JSON.parse(raw)
      if(!localStorage.getItem(scopedKey))localStorage.setItem(scopedKey,JSON.stringify(parsed))
      return parsed
    }
    if(isDemoDataEnvironment()&&cfg.legacyPrefix){
      const migrated=[]
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i)
        if(!key?.startsWith(cfg.legacyPrefix))continue
        const value=JSON.parse(localStorage.getItem(key)||'null')
        if(value)migrated.push({...value,recordKey:key.slice(cfg.legacyPrefix.length)})
      }
      if(migrated.length){localStorage.setItem(scopedKey,JSON.stringify(migrated));return migrated}
    }
    return environmentFallback(fallback)
  }catch(cause){
    throw new DataAccessError('Local data could not be read.',{table,operation:'load',cause})
  }
}
function writeLocal(table,rows){
  const cfg=config(table)
  try{
    if(!isDemoDataEnvironment())localStorage.setItem(localKey(cfg),JSON.stringify(rows))
    memory.set(memoryKey(table),clone(rows))
    return clone(rows)
  }catch(cause){
    throw new DataAccessError('Local data could not be saved.',{table,operation:'save',cause})
  }
}

export function loadSnapshot(table,fallback=null){
  const key=memoryKey(table)
  if(memory.has(key))return clone(memory.get(key))
  try{
    const value=readLocal(table,fallback)
    memory.set(key,clone(value))
    return clone(value)
  }catch(error){
    emit({table,operation:'load',status:'error',error})
    throw error
  }
}

export function saveSnapshot(table,rows,{organizationId=null}={}){
  if(backend==='supabase'&&hasSupabaseConfig&&supabase&&config(table).cloud!==false&&!isDemoDataEnvironment()){
    memory.set(memoryKey(table),clone(rows))
    void save(table,rows,{organizationId}).catch(()=>{})
    return clone(rows)
  }
  try{
    emit({table,operation:'save',status:'saving'})
    const value=writeLocal(table,rows)
    emit({table,operation:'save',status:'success'})
    return value
  }catch(error){
    const retry=()=>saveSnapshot(table,rows,{organizationId})
    emit({table,operation:'save',status:'error',error,retry})
    throw error
  }
}

export async function load(table,{fallback=null,organizationId=null}={}){
  emit({table,operation:'load',status:'loading'})
  try{
    if(backend!=='supabase'||!hasSupabaseConfig||!supabase||config(table).cloud===false||isDemoDataEnvironment()){
      const value=readLocal(table,fallback); memory.set(memoryKey(table),clone(value))
      emit({table,operation:'load',status:'success'}); return clone(value)
    }
    if(!organizationId)throw new DataAccessError('Organization is required for cloud data.',{table,operation:'load'})
    const {data,error}=await supabase.from(table).select('record_key,payload').eq('organization_id',organizationId).order('record_key')
    if(error)throw error
    const value=(data??[]).map(row=>row.payload)
    memory.set(memoryKey(table),clone(value))
    emit({table,operation:'load',status:'success'}); return clone(value)
  }catch(cause){
    const error=cause instanceof DataAccessError?cause:new DataAccessError('Data could not be loaded.',{table,operation:'load',cause})
    emit({table,operation:'load',status:'error',error})
    throw error
  }
}

export async function save(table,rows,{organizationId=null}={}){
  const retry=()=>save(table,rows,{organizationId})
  emit({table,operation:'save',status:'saving',retry})
  try{
    if(backend!=='supabase'||!hasSupabaseConfig||!supabase||config(table).cloud===false||isDemoDataEnvironment()){
      const value=writeLocal(table,rows); emit({table,operation:'save',status:'success'}); return value
    }
    if(!organizationId)throw new DataAccessError('Organization is required for cloud data.',{table,operation:'save'})
    const cfg=config(table)
    const records=toRecords(cfg,rows,organizationId)
    const {data:existing,error:listError}=await supabase.from(table).select('record_key,payload').eq('organization_id',organizationId)
    if(listError)throw listError
    const basis=memory.get(memoryKey(table))
    if(basis!==undefined){
      const expected=recordSetFingerprint(toRecords(cfg,basis,organizationId))
      const actual=recordSetFingerprint((existing??[]).map(row=>({record_key:row.record_key,payload:row.payload})))
      if(expected!==actual){
        throw new DataAccessError('Someone else already changed this data. Reload before saving again.',{table,operation:'save',code:'CONFLICT'})
      }
    }
    if(records.length){
      const {error}=await supabase.from(table).upsert(records,{onConflict:'organization_id,record_key'})
      if(error)throw error
    }
    const keep=new Set(records.map(row=>row.record_key))
    for(const row of existing??[]){
      if(keep.has(row.record_key))continue
      const {error:deleteError}=await supabase.from(table).delete().eq('organization_id',organizationId).eq('record_key',row.record_key)
      if(deleteError)throw deleteError
    }
    memory.set(memoryKey(table),clone(rows)); emit({table,operation:'save',status:'success'}); return clone(rows)
  }catch(cause){
    const error=cause instanceof DataAccessError?cause:new DataAccessError('Data could not be saved.',{table,operation:'save',cause})
    emit({table,operation:'save',status:'error',error,retry})
    throw error
  }
}
