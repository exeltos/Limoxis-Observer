import { supabase } from '../supabase/client'
import { hasSupabaseConfig } from '../config/env'
import { dataPartitionKey,environmentFallback,isDemoDataEnvironment } from './dataEnvironment'
const backend=(import.meta.env.VITE_DATA_BACKEND||'local').trim().toLowerCase()
const memory=new Map()

const TABLES=Object.freeze({
  employee_health_visits:{storageKey:'limoxis.employeeHealthVisits.v1',kind:'rows',cloud:false},
  employee_vaccine_records:{storageKey:'limoxis.employeeVaccineRecords.v1',kind:'rows',cloud:false},
  employee_training_summary:{storageKey:'limoxis.employeeTrainingSummary.v1',kind:'rows',cloud:false},
  employee_evaluations:{storageKey:'limoxis.employeeEvaluations.v1',kind:'rows',cloud:false},
  employee_certificates:{storageKey:'limoxis.employeeCertificates.v1',kind:'rows',cloud:false},
  training_records:{storageKey:'limoxis.training.v3',legacyKeys:['limoxis.training.v2'],kind:'training'},
  environmental_standards:{storageKey:'limoxis.environmentalStandards.v1',kind:'rows'},
  control_drafts:{storageKey:'limoxis.controlDrafts.v1',legacyPrefix:'limoxis.control.execution.',kind:'rows'},
  organization_settings:{storageKey:'limoxis.organizationSettings.v1',kind:'document',cloud:false},
  bundle_library:{storageKey:'limoxis.bundleLibrary.v1',kind:'rows',cloud:false},
  management_libraries:{storageKey:'limoxis.managementLibraries.v2',kind:'document',cloud:false},
  documents:{storageKey:'limoxis.documents.v1',kind:'rows',cloud:false},
  employees:{storageKey:'limoxis.employees.v1',kind:'rows',cloud:false},
  indicator_custom:{storageKey:'limoxis.customIndicators.v1',kind:'rows',cloud:false},
  indicator_overrides:{storageKey:'limoxis.indicatorOverrides.v1',kind:'document',cloud:false},
  indicator_deleted:{storageKey:'limoxis.deletedIndicators.v1',kind:'rows',cloud:false},
  indicator_deleted_audit:{storageKey:'limoxis.deletedIndicators.v1.audit',kind:'document',cloud:false},
  committee_approvals:{storageKey:'limoxis.committeeApprovals.v2',kind:'rows',cloud:false},
  committee_minutes_approvals:{storageKey:'limoxis.committeeMinutesApprovals.v1',kind:'rows',cloud:false},
  committee_mail_outbox:{storageKey:'limoxis.committeeMailOutbox.v1',kind:'rows',cloud:false},
  committees:{storageKey:'limoxis.committees.v1',kind:'rows',cloud:false},
  announcements:{storageKey:'limoxis.announcements.v2',kind:'rows',cloud:false},
  notification_reads:{storageKey:'limoxis.notificationReads.v1',kind:'document',cloud:false},
})

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

function readLocal(table,fallback){
  const cfg=config(table)
  try{
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
    localStorage.setItem(localKey(cfg),JSON.stringify(rows))
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
    // Keep the synchronous snapshot API for existing stores, while ensuring a
    // failed background write is reported through the data-operation event
    // without also becoming an unhandled promise rejection.
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
    const {data,error}=await supabase.from(table).select('record_key,record_type,department_id,employee_user_id,payload').eq('organization_id',organizationId).order('record_key')
    if(error)throw error
    const cfg=config(table)
    let value
    if(cfg.kind==='training'){
      value={programs:[],assignments:[],certificates:[],emailOutbox:[],history:[]}
      for(const row of data??[]){
        if(row.record_type==='program')value.programs.push(row.payload)
        else if(row.record_type==='assignment')value.assignments.push(row.payload)
        else if(row.record_type==='certificate')value.certificates.push(row.payload)
        else if(row.record_type==='email_outbox')value.emailOutbox.push(row.payload)
        else if(row.record_type==='history')value.history.push(row.payload)
      }
      if(!(data??[]).length)value=clone(fallback)
    }else{
      value=(data??[]).map(row=>row.payload)
    }
    memory.set(memoryKey(table),clone(value))
    emit({table,operation:'load',status:'success'})
    return clone(value)
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
    let records
    if(cfg.kind==='training'){
      const typed=(type,list=[])=>list.map((row,index)=>({
        organization_id:organizationId,
        record_key:`${type}:${row.id??row.recordKey??index}`,
        record_type:type,
        department_id:row.departmentId??null,
        employee_user_id:row.employeeUserId??null,
        payload:row,
      }))
      records=[
        ...typed('program',rows?.programs),
        ...typed('assignment',rows?.assignments),
        ...typed('certificate',rows?.certificates),
        ...typed('email_outbox',rows?.emailOutbox),
        ...typed('history',rows?.history),
      ]
    }else{
      records=(rows||[]).map((row,index)=>({organization_id:organizationId,record_key:String(row.id??row.recordKey??index),payload:row}))
    }
    if(records.length){
      const {error}=await supabase.from(table).upsert(records,{onConflict:'organization_id,record_key'})
      if(error)throw error
    }
    const {data:existing,error:listError}=await supabase.from(table).select('record_key').eq('organization_id',organizationId)
    if(listError)throw listError
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

export const repositoryTables=Object.freeze(Object.keys(TABLES))
