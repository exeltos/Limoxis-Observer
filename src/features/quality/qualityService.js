import { supabase } from '../../core/supabase/client'

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

function mapRow(section,row){
  const department=row.department?.name||''
  const common={
    dbId:row.id,
    id:row.code,
    title:row.title||'',
    titleEn:row.title||'',
    department,
    departmentEn:department,
    departmentId:row.department_id||null,
    status:row.status||'',
    owner:'',
    lifecycleStatus:'active',
  }
  if(section==='incidents') return {...common,severity:row.severity||'medium',date:row.occurred_at?.slice(0,10)||'',description:row.description||''}
  if(section==='findings') return {...common,severity:row.severity||'medium',date:row.identified_at?.slice(0,10)||'',description:row.description||'',source:row.source_type||'manual',sourceId:row.source_id||''}
  if(section==='capas') return {...common,severity:row.priority||'medium',priority:row.priority||'medium',actionType:row.action_type||'corrective',dueDate:row.due_date||'',description:row.description||'',source:row.source_type||'other',sourceId:row.source_id||''}
  return {...common,auditType:row.audit_type||'internal',plannedDate:row.planned_date||'',completedDate:row.completed_date||'',scope:row.scope||'',leadAuditor:''}
}

export async function loadQualityRecords(section,organizationId){
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

function codeFor(section){
  const prefix={incidents:'INC',findings:'FND',capas:'CAPA',audits:'AUD'}[section]||'QLT'
  const stamp=new Date().toISOString().replace(/\D/g,'').slice(2,14)
  return `${prefix}-${stamp}`
}

export async function createQualityRecord(section,organizationId,draft,userId){
  assertReady(organizationId)
  const config=sectionConfig[section]
  if(!config) throw new Error('Unsupported quality record type.')
  const code=codeFor(section)
  let payload={organization_id:organizationId,code,title:(draft.title||draft.titleEn||'').trim(),department_id:draft.departmentId||null}
  if(section==='incidents') payload={...payload,occurred_at:`${draft.date||new Date().toISOString().slice(0,10)}T12:00:00Z`,severity:draft.severity||'medium',status:draft.status||'reported',description:draft.description||draft.descriptionEn||null,reported_by:userId||null,owner_id:null}
  if(section==='findings') payload={...payload,identified_at:`${draft.date||new Date().toISOString().slice(0,10)}T12:00:00Z`,severity:draft.severity||'medium',status:draft.status||'open',description:draft.description||draft.descriptionEn||null,source_type:draft.source||'manual',source_id:draft.sourceId||null,owner_id:null}
  if(section==='capas') payload={...payload,source_type:draft.source||'other',source_id:draft.sourceId||null,action_type:draft.actionType||'corrective',priority:draft.priority||'medium',status:draft.status||'open',description:draft.description||draft.descriptionEn||null,owner_id:null,due_date:draft.dueDate||null,effectiveness_due:draft.effectivenessDue||null,effectiveness_status:draft.effectivenessStatus||'pending'}
  if(section==='audits') payload={...payload,audit_type:draft.auditType||'internal',scope:draft.scope||draft.scopeEn||null,planned_date:draft.plannedDate||null,status:draft.status||'planned',lead_auditor_id:null}
  const {data,error}=await supabase.from(config.table).insert(payload).select('*,department:departments(name)').single()
  if(error) throw error
  return mapRow(section,data)
}
