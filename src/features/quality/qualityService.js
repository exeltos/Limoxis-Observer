import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadQualityLocal, saveQualityLocal } from './qualityStore'

const sectionConfig={
  incidents:{table:'quality_incidents',date:'occurred_at'},
  findings:{table:'quality_findings',date:'identified_at'},
  capas:{table:'quality_capa_actions',date:'due_date'},
  audits:{table:'quality_audits',date:'planned_date'},
}

function assertReady(organizationId){
  if(!supabase) throw new Error('Supabase is not configured.')
  if(!organizationId) throw new Error('Organization is required.')
}

function uiStatus(value){
  return ({under_review:'underReview',in_progress:'inProgress',not_effective:'notEffective'})[value]||value||''
}
function dbStatus(value){
  return ({underReview:'under_review',inProgress:'in_progress',notEffective:'not_effective'})[value]||value||''
}

function compactCode(code=''){
  const value=String(code||'')
  const match=value.match(/^(INC|FND|CAPA|AUD)-(\d{6})(\d{6,})$/)
  if(match)return `${match[1]}-${match[2]}-${match[3].slice(0,6)}`
  return value
}

function isUuid(value=''){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''))
}

function mapRow(section,row){
  const department=row.department?.name||''
  const common={
    dbId:row.id,
    id:row.code,
    displayId:compactCode(row.code),
    title:row.title||'',
    titleEn:row.title||'',
    department,
    departmentEn:department,
    departmentId:row.department_id||null,
    status:uiStatus(row.status),
    owner:row.owner_label||'',
    ownerId:row.owner_id||null,
    lifecycleStatus:row.lifecycle_status||'active',
    voidReason:row.void_reason||'',
    voidedAt:row.voided_at||null,
    voidedById:row.voided_by||null,
    correctionReason:row.correction_reason||'',
    correctionOpenedAt:row.correction_opened_at||null,
    correctionOpenedById:row.correction_opened_by||null,
    attachments:[],
    history:row.history||[],
  }
  if(section==='incidents') return {
    ...common,
    severity:row.severity||'medium',
    date:row.occurred_at?.slice(0,10)||'',
    description:row.description||'',
    descriptionEn:row.description||'',
    reportedBy:isUuid(row.reported_by)?'':(row.reported_by||''),
    reportedById:row.reported_by||null,
    linkedPatient:row.linked_patient_id||'',
    linkedSurveillance:row.linked_surveillance_id||'',
  }
  if(section==='findings') return {
    ...common,
    severity:row.severity||'medium',
    date:row.identified_at?.slice(0,10)||'',
    description:row.description||'',
    descriptionEn:row.description||'',
    source:row.source_type||'manual',
    sourceId:row.source_id||'',
  }
  if(section==='capas') return {
    ...common,
    severity:row.priority||'medium',
    priority:row.priority||'medium',
    actionType:row.action_type||'corrective',
    dueDate:row.due_date||'',
    effectivenessDue:row.effectiveness_due||'',
    effectivenessStatus:uiStatus(row.effectiveness_status||'pending'),
    description:row.description||'',
    descriptionEn:row.description||'',
    source:row.source_type||'other',
    sourceId:row.source_id||'',
  }
  return {
    ...common,
    auditType:row.audit_type||'internal',
    plannedDate:row.planned_date||'',
    completedDate:row.completed_date||'',
    scope:row.scope||'',
    scopeEn:row.scope||'',
    leadAuditor:isUuid(row.lead_auditor_id)?'':(row.lead_auditor_id||''),
    leadAuditorId:row.lead_auditor_id||null,
  }
}

export async function loadQualityRecords(section,organizationId){
  if(isDemoDataEnvironment())return structuredClone(loadQualityLocal(section))
  assertReady(organizationId)
  const config=sectionConfig[section]
  if(!config) return []
  const {data,error}=await supabase
    .from(config.table)
    .select('*,department:departments(name)')
    .eq('organization_id',organizationId)
    .order(config.date,{ascending:false,nullsFirst:false})
  if(error) throw error
  return (data||[]).map(row=>mapRow(section,row))
}

export async function loadQualityRecord(section,organizationId,code){
  if(isDemoDataEnvironment())return loadQualityLocal(section).find(item=>item.id===code)??null
  assertReady(organizationId)
  const config=sectionConfig[section]
  if(!config||!code) return null
  const {data,error}=await supabase
    .from(config.table)
    .select('*,department:departments(name)')
    .eq('organization_id',organizationId)
    .eq('code',code)
    .maybeSingle()
  if(error) throw error
  if(!data) return null
  return mapRow(section,data)
}

function codeFor(section){
  const prefix={incidents:'INC',findings:'FND',capas:'CAPA',audits:'AUD'}[section]||'QLT'
  const stamp=new Date().toISOString().replace(/\D/g,'')
  return `${prefix}-${stamp.slice(2,8)}-${stamp.slice(8,14)}`
}

export async function createQualityRecord(section,organizationId,draft,userId){
  const code=codeFor(section)
  if(isDemoDataEnvironment()){
    const department=draft.departmentId||''
    const common={id:code,displayId:compactCode(code),title:draft.title||draft.titleEn||'',titleEn:draft.titleEn||draft.title||'',department,departmentEn:department,owner:'',lifecycleStatus:'active',attachments:[],history:[]}
    let record=common
    if(section==='incidents')record={...common,severity:draft.severity||'medium',date:draft.date||new Date().toISOString().slice(0,10),status:draft.status||'reported',description:draft.description||'',descriptionEn:draft.descriptionEn||draft.description||'',reportedBy:userId||'',linkedPatient:'',linkedSurveillance:''}
    if(section==='findings')record={...common,severity:draft.severity||'medium',date:draft.date||new Date().toISOString().slice(0,10),status:draft.status||'open',description:draft.description||'',descriptionEn:draft.descriptionEn||draft.description||'',source:draft.source||'manual',sourceId:draft.sourceId||''}
    if(section==='capas')record={...common,severity:draft.priority||'medium',priority:draft.priority||'medium',actionType:draft.actionType||'corrective',dueDate:draft.dueDate||'',effectivenessDue:draft.effectivenessDue||'',effectivenessStatus:draft.effectivenessStatus||'pending',status:draft.status||'open',description:draft.description||'',descriptionEn:draft.descriptionEn||draft.description||'',source:draft.source||'other',sourceId:draft.sourceId||''}
    if(section==='audits')record={...common,auditType:draft.auditType||'internal',plannedDate:draft.plannedDate||'',completedDate:'',status:draft.status||'planned',leadAuditor:'',scope:draft.scope||'',scopeEn:draft.scopeEn||draft.scope||'',findingIds:[]}
    const rows=loadQualityLocal(section)
    rows.unshift(record)
    saveQualityLocal(section,rows)
    return record
  }
  assertReady(organizationId)
  const config=sectionConfig[section]
  if(!config) throw new Error('Unsupported quality record type.')
  let payload={organization_id:organizationId,code,title:(draft.title||draft.titleEn||'').trim(),department_id:draft.departmentId||null}
  if(section==='incidents') payload={...payload,occurred_at:`${draft.date||new Date().toISOString().slice(0,10)}T12:00:00Z`,severity:draft.severity||'medium',status:draft.status||'reported',description:draft.description||draft.descriptionEn||null,reported_by:userId||null,owner_id:null}
  if(section==='findings') payload={...payload,identified_at:`${draft.date||new Date().toISOString().slice(0,10)}T12:00:00Z`,severity:draft.severity||'medium',status:draft.status||'open',description:draft.description||draft.descriptionEn||null,source_type:draft.source||'manual',source_id:draft.sourceId||null,owner_id:null}
  if(section==='capas') payload={...payload,source_type:draft.source||'other',source_id:draft.sourceId||null,action_type:draft.actionType||'corrective',priority:draft.priority||'medium',status:draft.status||'open',description:draft.description||draft.descriptionEn||null,owner_id:null,due_date:draft.dueDate||null,effectiveness_due:draft.effectivenessDue||null,effectiveness_status:draft.effectivenessStatus||'pending'}
  if(section==='audits') payload={...payload,audit_type:draft.auditType||'internal',scope:draft.scope||draft.scopeEn||null,planned_date:draft.plannedDate||null,status:draft.status||'planned',lead_auditor_id:null}

  const {data,error}=await supabase.from(config.table).insert(payload).select('*,department:departments(name)').single()
  if(error) throw error
  return mapRow(section,data)
}

function buildPersistPayload(section,record){
  const payload={
    title:(record.title||record.titleEn||'').trim(),
    department_id:record.departmentId||null,
    status:dbStatus(record.status),
    owner_label:record.owner||null,
    lifecycle_status:record.lifecycleStatus||'active',
    void_reason:record.voidReason||null,
    voided_at:record.voidedAt||null,
    voided_by:isUuid(record.voidedById)?record.voidedById:null,
    correction_reason:record.correctionReason||null,
    correction_opened_at:record.correctionOpenedAt||null,
    correction_opened_by:isUuid(record.correctionOpenedById)?record.correctionOpenedById:null,
    history:record.history||[],
    updated_at:record.updatedAt||new Date().toISOString(),
  }
  if(section==='incidents')Object.assign(payload,{
    severity:record.severity||'medium',
    occurred_at:record.date?`${record.date}T12:00:00Z`:undefined,
    description:record.description||record.descriptionEn||null,
    linked_patient_id:record.linkedPatient||null,
    linked_surveillance_id:record.linkedSurveillance||null,
  })
  if(section==='findings')Object.assign(payload,{
    severity:record.severity||'medium',
    identified_at:record.date?`${record.date}T12:00:00Z`:undefined,
    description:record.description||record.descriptionEn||null,
    source_type:record.source||'manual',
    source_id:record.sourceId||null,
  })
  if(section==='capas')Object.assign(payload,{
    priority:record.priority||record.severity||'medium',
    action_type:record.actionType||'corrective',
    description:record.description||record.descriptionEn||null,
    due_date:record.dueDate||null,
    effectiveness_due:record.effectivenessDue||null,
    effectiveness_status:dbStatus(record.effectivenessStatus)||'pending',
  })
  if(section==='audits')Object.assign(payload,{
    audit_type:record.auditType||'internal',
    scope:record.scope||record.scopeEn||null,
    planned_date:record.plannedDate||null,
    completed_date:record.completedDate||null,
  })
  return payload
}

export async function saveQualityRecord(section,organizationId,record){
  if(isDemoDataEnvironment()){
    const rows=loadQualityLocal(section)
    const index=rows.findIndex(x=>x.id===record.id)
    if(index>=0)rows[index]={...record}
    else rows.unshift({...record})
    saveQualityLocal(section,rows)
    return {...record}
  }
  assertReady(organizationId)
  const config=sectionConfig[section]
  if(!config) throw new Error('Unsupported quality record type.')
  const payload=buildPersistPayload(section,record)
  const {data,error}=await supabase.from(config.table).update(payload).eq('organization_id',organizationId).eq('code',record.id).select('*,department:departments(name)').single()
  if(error) throw error
  return mapRow(section,data)
}
