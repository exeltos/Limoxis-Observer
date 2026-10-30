import { supabase } from '../../core/supabase/client'
import { selectAllPages } from '../../core/data/inChunks'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadQualityLocal, saveQualityLocal } from './qualityStore'
import { missingNextAudits, spreadAuditRound } from './audits/auditModel'
import { expectVersion, guardedSingle } from '../../core/data/recordVersion'
import { DETAIL_TABLES, INCIDENT_DETAIL_SELECT, incidentDetailRows, incidentDetailsFromRow, keptDetails } from './incidentDetails'
import { CHECKLIST_FIELDS, CHECKLIST_SELECT, ROOT_CAUSE_SELECT, TEAM_FIELDS, teamFromRows, teamRows, SUB_ACTION_FIELDS, analysisFromRow, analysisRows, checklistFromRows, checklistRows, diffChildRows, newRowId, progressFromRows, progressRow, sameAnalysis, subActionRows, subActionsFromRows } from './qualityRelations'

// Incidents, findings, CAPAs and audits (src/features/quality). A record's
// details live in tables of their own (20261116100000_quality_relational.sql):
// an incident's event details, a CAPA's steps, root cause analysis and
// progress notes, an audit's checklist. They are read with the record and
// written after it; the demo keeps the whole record in the browser.

const TEAM_SELECT='team:quality_audit_team_members(*,employee:employees(department_id,department_name))'

const sectionConfig={
  incidents:{table:'quality_incidents',date:'occurred_at',select:`*,department:departments(name),${INCIDENT_DETAIL_SELECT}`},
  findings:{table:'quality_findings',date:'identified_at',select:'*,department:departments(name)'},
  capas:{table:'quality_capa_actions',date:'due_date',select:`*,department:departments(name),sub_actions:quality_capa_sub_actions(*),${ROOT_CAUSE_SELECT},progress:quality_capa_progress(*)`},
  audits:{table:'quality_audits',date:'planned_date',select:`*,department:departments(name),${CHECKLIST_SELECT},${TEAM_SELECT}`},
}

function assertReady(organizationId){
  if(!supabase) throw new Error('Supabase is not configured.')
  if(!organizationId) throw new Error('Organization is required.')
}
const must=({data,error})=>{if(error)throw error;return data}

function uiStatus(value){
  return ({under_review:'underReview',in_progress:'inProgress',not_effective:'notEffective'})[value]||value||''
}
function dbStatus(value){
  return ({underReview:'under_review',inProgress:'in_progress',notEffective:'not_effective'})[value]||value||''
}

function compactCode(code=''){
  const value=String(code||'')
  const match=value.match(/^(INC|FND|CAPA|AUD)-(\d{6})-(\d{6,})$/)
  if(match)return `${match[1]}-${match[2]}-${match[3].slice(0,6)}`
  return value
}

function isUuid(value=''){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''))
}

// The responsible people's names: the owners list, or the single legacy owner.
function ownerLabels(record){
  return record.owners?.length?record.owners:(record.owner?[record.owner]:[])
}

export function mapRow(section,row){
  const department=row.department?.name||''
  const common={
    dbId:row.id,
    id:row.code,
    displayId:compactCode(row.code),
    title:row.title||'',
    titleEn:row.title_en||row.title||'',
    department,
    departmentEn:department,
    departmentId:row.department_id||null,
    status:uiStatus(row.status),
    owner:row.owner_label||'',
    owners:Array.isArray(row.owner_labels)?row.owner_labels:(row.owner_label?[row.owner_label]:[]),
    ownerId:row.owner_id||null,
    lifecycleStatus:row.lifecycle_status||'active',
    updatedAt:row.updated_at||null,
    voidReason:row.void_reason||'',
    voidedAt:row.voided_at||null,
    voidedById:row.voided_by||null,
    correctionReason:row.correction_reason||'',
    correctionOpenedAt:row.correction_opened_at||null,
    correctionOpenedById:row.correction_opened_by||null,
    attachments:[],
    history:Array.isArray(row.history)?row.history:[],
  }
  if(section==='incidents') return {
    ...common,
    severity:row.severity||'medium',
    incidentClass:row.incident_class||'nearMiss',
    reachedPatient:Boolean(row.reached_patient),
    harmOccurred:Boolean(row.harm_occurred),
    date:row.occurred_at?.slice(0,10)||'',
    description:row.description||'',
    descriptionEn:row.description_en||row.description||'',
    reportedBy:row.reported_by_label||'',
    reportedById:row.reported_by||null,
    anonymous:Boolean(row.is_anonymous),
    reportKind:row.report_kind||'',
    sentinel:Boolean(row.is_sentinel),
    rcaDueDate:row.rca_due_date||'',
    linkedPatient:row.linked_patient_id||'',
    linkedSurveillance:row.linked_surveillance_id||'',
    linkedAdmission:row.linked_admission_id||'',
    category:row.category||'clinical',
    eventType:row.event_type||'',
    ...incidentDetailsFromRow(row),
    eventTime:row.event_time||'',
    impact:row.impact||'none',
    immediateActions:row.immediate_actions||'',
    immediateActionsEn:row.immediate_actions||'',
    rootCause:row.root_cause||'',
    rootCauseEn:row.root_cause||'',
    contributingFactors:row.contributing_factors||'',
    contributingFactorsEn:row.contributing_factors||'',
  }
  if(section==='findings') return {
    ...common,
    severity:row.severity||'medium',
    date:row.identified_at?.slice(0,10)||'',
    description:row.description||'',
    descriptionEn:row.description_en||row.description||'',
    source:row.source_type||'manual',
    sourceId:row.source_id||'',
    findingClass:row.finding_class||'',
    auditItemId:row.audit_item_id||null,
    clauseRef:row.clause_ref||'',
    standard:row.standard||'',
    dueDate:row.due_date||'',
    verificationStatus:row.verification_status||'pending',
    verifiedOn:row.verified_on||'',
    verifiedBy:row.verified_by_label||'',
    verificationNote:row.verification_note||'',
    followUpAuditId:row.follow_up_audit_code||'',
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
    descriptionEn:row.description_en||row.description||'',
    source:row.source_type||'other',
    sourceId:row.source_id||'',
    subActions:subActionsFromRows(row.sub_actions),
    rootCauseAnalysis:analysisFromRow(row.root_cause),
    progress:progressFromRows(row.progress),
  }
  return {
    ...common,
    auditType:row.audit_kind||row.audit_type||'internal',
    plannedDate:row.planned_date||'',
    completedDate:row.completed_date||'',
    scope:row.scope||'',
    scopeEn:row.scope||'',
    leadAuditor:row.lead_auditor_label||'',
    leadAuditorId:row.lead_auditor_id||null,
    checklist:checklistFromRows(row.checklist),
    checklistSource:row.checklist_source||'',
    templateId:row.template_id||null,
    templateTitle:row.template_title||'',
    templateVersion:row.template_version||null,
    standard:row.standard||'',
    standards:row.standards||[],
    extraTemplateIds:row.extra_template_ids||[],
    clausesScope:row.clauses_scope||[],
    plannedMonthOnly:Boolean(row.planned_month_only),
    riskLevel:row.risk_level||'',
    frequencyMonths:row.frequency_months||null,
    openingMeeting:{date:row.opening_meeting_on||'',attendees:row.opening_attendees||''},
    closingMeeting:{date:row.closing_meeting_on||'',attendees:row.closing_attendees||''},
    auditeeRepresentative:row.auditee_representative||'',
    conclusion:row.conclusion||'',
    followUpOf:row.follow_up_code||'',
    origin:row.source||'app',
    durationDays:row.duration_days??null,
    auditBody:row.audit_body||'',
    notes:row.notes||'',
    reportSentOn:row.report_sent_on||'',
    correctionsDueOn:row.corrections_due_on||'',
    team:teamFromRows(row.team),
  }
}

// The audit a record follows up is stored by id; the screens show its code.
async function withFollowUpCodes(section,organizationId,rows){
  const column=section==='audits'?'follow_up_of':section==='findings'?'follow_up_audit_id':null
  const ids=column?[...new Set(rows.map(row=>row[column]).filter(Boolean))]:[]
  if(!ids.length)return rows
  const audits=must(await supabase.from('quality_audits').select('id,code').eq('organization_id',organizationId).in('id',ids))||[]
  const codes=new Map(audits.map(item=>[item.id,item.code]))
  const key=section==='audits'?'follow_up_code':'follow_up_audit_code'
  return rows.map(row=>(row[column]?{...row,[key]:codes.get(row[column])||''}:row))
}

export async function loadQualityRecords(section,organizationId){
  if(isDemoDataEnvironment())return structuredClone(loadQualityLocal(section))
  assertReady(organizationId)
  const config=sectionConfig[section]
  if(!config) return []
  // Page by page: a register past 1,000 records was cut at the API's row cap.
  const data=await selectAllPages(()=>supabase
    .from(config.table)
    .select(config.select)
    .eq('organization_id',organizationId)
    .order(config.date,{ascending:false,nullsFirst:false})
    .order('id'))
  return (await withFollowUpCodes(section,organizationId,data||[])).map(row=>mapRow(section,row))
}

// The incidents linked to an episode (its surveillance cases, or its admission), newest first.
// Only what the user may already read comes back (the policies of quality_incidents decide).
export async function loadLinkedIncidents(organizationId,{caseIds=[],admissionId=null,patientCode=''}={}){
  const cases=[...new Set(caseIds.map(String).filter(Boolean))]
  if(isDemoDataEnvironment())return loadQualityLocal('incidents').filter(row=>cases.includes(String(row.linkedSurveillance||''))||(patientCode&&String(row.linkedPatient||'')===String(patientCode))).map(row=>structuredClone(row))
  assertReady(organizationId)
  const filters=[cases.length&&`linked_surveillance_id.in.(${cases.join(',')})`,admissionId&&`linked_admission_id.eq.${admissionId}`].filter(Boolean)
  if(!filters.length)return []
  const {data,error}=await supabase.from('quality_incidents').select('*,department:departments(name)').eq('organization_id',organizationId).or(filters.join(',')).order('occurred_at',{ascending:false,nullsFirst:false})
  if(error)throw error
  return (data||[]).map(row=>mapRow('incidents',row))
}

export async function loadQualityRecord(section,organizationId,code){
  if(isDemoDataEnvironment())return loadQualityLocal(section).find(item=>item.id===code)??null
  assertReady(organizationId)
  const config=sectionConfig[section]
  if(!config||!code) return null
  const {data,error}=await supabase
    .from(config.table)
    .select(config.select)
    .eq('organization_id',organizationId)
    .eq('code',code)
    .maybeSingle()
  if(error) throw error
  if(!data) return null
  return mapRow(section,(await withFollowUpCodes(section,organizationId,[data]))[0])
}

async function reloadById(section,organizationId,id){
  const config=sectionConfig[section]
  const row=must(await supabase.from(config.table).select(config.select).eq('organization_id',organizationId).eq('id',id).single())
  return mapRow(section,(await withFollowUpCodes(section,organizationId,[row]))[0])
}

// --- The details in tables of their own ------------------------------------------------------

// Writes the stored rows of a parent the way `rows` says: removes the ones no
// longer there, writes the new and the changed ones.
async function syncChildRows({table,parentColumn,parentId,organizationId,rows,fields}){
  const existing=must(await supabase.from(table).select(['id',...fields].join(',')).eq('organization_id',organizationId).eq(parentColumn,parentId))||[]
  const {upsert,remove}=diffChildRows(existing,rows,fields)
  if(remove.length)must(await supabase.from(table).delete().eq('organization_id',organizationId).in('id',remove))
  if(upsert.length)must(await supabase.from(table).upsert(upsert.map(row=>({...row,organization_id:organizationId,[parentColumn]:parentId}))))
}

// An incident's event details: one row per block its event type records; a
// block the record had and no longer records is removed. A new report only
// inserts (an anonymous reporter may not read the incident back).
async function writeIncidentDetails(organizationId,incidentId,record,{creating=false}={}){
  const rows=incidentDetailRows(record)
  for(const [key,table] of Object.entries(DETAIL_TABLES)){
    const row=rows[table]
    if(row){
      const payload={...row,incident_id:incidentId,organization_id:organizationId}
      must(creating?await supabase.from(table).insert(payload):await supabase.from(table).upsert(payload,{onConflict:'incident_id'}))
    }else if(!creating&&record[key]){
      must(await supabase.from(table).delete().eq('organization_id',organizationId).eq('incident_id',incidentId))
    }
  }
}

// A CAPA's steps, and its root cause analysis when it says something new: the
// analysis row's time is when the analysis last changed.
async function writeCapaDetails(organizationId,capaId,record){
  await syncChildRows({table:'quality_capa_sub_actions',parentColumn:'capa_id',parentId:capaId,organizationId,rows:subActionRows(record.subActions||[]),fields:SUB_ACTION_FIELDS})
  if(record.rootCauseAnalysis===undefined)return
  const stored=analysisFromRow(must(await supabase.from('quality_capa_root_cause_analyses').select('*,whys:quality_capa_root_cause_whys(*),factors:quality_capa_root_cause_factors(*)').eq('organization_id',organizationId).eq('capa_id',capaId).maybeSingle()))
  if(sameAnalysis(stored,record.rootCauseAnalysis))return
  const rows=analysisRows(record.rootCauseAnalysis)
  if(!rows){must(await supabase.from('quality_capa_root_cause_analyses').delete().eq('organization_id',organizationId).eq('capa_id',capaId));return}
  must(await supabase.from('quality_capa_root_cause_analyses').upsert({...rows.analysis,capa_id:capaId,organization_id:organizationId},{onConflict:'capa_id'}))
  for(const [table,list] of [['quality_capa_root_cause_whys',rows.whys],['quality_capa_root_cause_factors',rows.factors]]){
    must(await supabase.from(table).delete().eq('organization_id',organizationId).eq('capa_id',capaId))
    if(list.length)must(await supabase.from(table).insert(list.map(row=>({...row,capa_id:capaId,organization_id:organizationId}))))
  }
}

// An audit's checklist; a «No» that became a finding points at it.
async function writeAuditChecklist(organizationId,auditId,checklist=[]){
  const codes=[...new Set(checklist.map(row=>row.findingId).filter(Boolean))]
  const findings=codes.length?must(await supabase.from('quality_findings').select('id,code').eq('organization_id',organizationId).in('code',codes))||[]:[]
  const rows=checklistRows(checklist,new Map(findings.map(item=>[item.code,item.id])))
  await syncChildRows({table:'quality_audit_checklist_items',parentColumn:'audit_id',parentId:auditId,organizationId,rows,fields:CHECKLIST_FIELDS})
}

// The audit team: employees, or external auditors by name.
async function writeAuditTeam(organizationId,auditId,team){
  if(!Array.isArray(team))return
  await syncChildRows({table:'quality_audit_team_members',parentColumn:'audit_id',parentId:auditId,organizationId,rows:teamRows(team),fields:TEAM_FIELDS})
}

// An audit code (AUD-…) as the audit's id, for the follow-up link.
async function auditIdOf(organizationId,code){
  if(!code)return null
  const row=must(await supabase.from('quality_audits').select('id').eq('organization_id',organizationId).eq('code',code).maybeSingle())
  return row?.id||null
}

async function writeDetails(section,organizationId,id,record,options){
  if(section==='incidents')await writeIncidentDetails(organizationId,id,record,options)
  if(section==='capas')await writeCapaDetails(organizationId,id,record)
  if(section==='audits'){await writeAuditChecklist(organizationId,id,record.checklist||[]);await writeAuditTeam(organizationId,id,record.team)}
}

// The kind of audit (internal, external, certification, supplier); audit_type
// stays internal / external for the earlier readers.
const auditTypePayload=kind=>{const value=['internal','external','certification','supplier'].includes(kind)?kind:'internal';return {audit_kind:value,audit_type:value==='internal'?'internal':'external'}}

// The programme fields of an audit and the audit fields of a finding.
const STANDARD_VALUES=['iso9001','iso15224','haccp','iso15189','temos','jci','other']
const CLASS_VALUES=['major','minor','observation','opportunity']
function auditProgrammePayload(record){
  return {
    template_id:isUuid(record.templateId)?record.templateId:null,
    template_title:record.templateTitle||null,
    template_version:Number(record.templateVersion)||null,
    standard:STANDARD_VALUES.includes(record.standard)?record.standard:null,
    standards:(record.standards||[]).filter(value=>STANDARD_VALUES.includes(value)&&value!==record.standard),
    extra_template_ids:(record.extraTemplateIds||[]).filter(isUuid),
    clauses_scope:Array.isArray(record.clausesScope)?record.clausesScope:[],
    planned_month_only:Boolean(record.plannedMonthOnly),
    risk_level:['low','medium','high'].includes(record.riskLevel)?record.riskLevel:null,
    frequency_months:Number(record.frequencyMonths)>=1?Math.round(Number(record.frequencyMonths)):null,
    opening_meeting_on:record.openingMeeting?.date||null,
    opening_attendees:record.openingMeeting?.attendees||null,
    closing_meeting_on:record.closingMeeting?.date||null,
    closing_attendees:record.closingMeeting?.attendees||null,
    auditee_representative:record.auditeeRepresentative||null,
    conclusion:record.conclusion||null,
    duration_days:Number(record.durationDays)>=0&&record.durationDays!==''&&record.durationDays!=null?Math.min(60,Math.round(Number(record.durationDays))):null,
    audit_body:['internal','consultant','certification','other'].includes(record.auditBody)?record.auditBody:null,
    notes:record.notes||null,
    report_sent_on:record.reportSentOn||null,
    corrections_due_on:record.correctionsDueOn||null,
  }
}
function findingAuditPayload(record){
  return {
    finding_class:CLASS_VALUES.includes(record.findingClass)?record.findingClass:null,
    audit_item_id:isUuid(record.auditItemId)?record.auditItemId:null,
    clause_ref:record.clauseRef||null,
    standard:STANDARD_VALUES.includes(record.standard)?record.standard:null,
    due_date:record.dueDate||null,
    verification_status:['pending','effective','not_effective'].includes(record.verificationStatus)?record.verificationStatus:'pending',
    verified_on:record.verifiedOn||null,
    verified_by_label:record.verifiedBy||null,
    verification_note:record.verificationNote||null,
  }
}
const AUDIT_PROGRAMME_DEFAULTS=draft=>({templateId:draft.templateId||null,templateTitle:draft.templateTitle||'',templateVersion:draft.templateVersion||null,standard:draft.standard||'',standards:draft.standards||[],clausesScope:draft.clausesScope||[],plannedMonthOnly:Boolean(draft.plannedMonthOnly),riskLevel:draft.riskLevel||'',frequencyMonths:draft.frequencyMonths||null,openingMeeting:draft.openingMeeting||{date:'',attendees:''},closingMeeting:draft.closingMeeting||{date:'',attendees:''},auditeeRepresentative:draft.auditeeRepresentative||'',conclusion:draft.conclusion||'',followUpOf:draft.followUpOf||'',origin:'app',durationDays:draft.durationDays??null,auditBody:draft.auditBody||'',notes:draft.notes||'',reportSentOn:draft.reportSentOn||'',correctionsDueOn:draft.correctionsDueOn||'',team:draft.team||[]})
const AUDIT_FINDING_DEFAULTS=draft=>({findingClass:draft.findingClass||'',auditItemId:draft.auditItemId||null,clauseRef:draft.clauseRef||'',standard:draft.standard||'',dueDate:draft.dueDate||'',verificationStatus:draft.verificationStatus||'pending',verifiedOn:'',verifiedBy:'',verificationNote:'',followUpAuditId:draft.followUpAuditId||''})

// A code from the time to the second; several records made in the same second
// (an audit's findings) take the next seconds, so no two codes are the same.
const lastStamp={}
function codeFor(section){
  const prefix={incidents:'INC',findings:'FND',capas:'CAPA',audits:'AUD'}[section]||'QLT'
  let time=Math.floor(Date.now()/1000)*1000
  if(lastStamp[prefix]&&time<=lastStamp[prefix])time=lastStamp[prefix]+1000
  lastStamp[prefix]=time
  const stamp=new Date(time).toISOString().replace(/\D/g,'')
  return `${prefix}-${stamp.slice(2,8)}-${stamp.slice(8,14)}`
}

// The English title / description are stored only when they differ from the
// written text (a record read back in English falls back to the written one).
function englishColumns(record,section){
  const own=(en,el)=>{const text=String(en||'').trim();return text&&text!==String(el||'').trim()?text:null}
  return {title_en:own(record.titleEn,record.title),...(section==='audits'?{}:{description_en:own(record.descriptionEn,record.description)})}
}

export async function createQualityRecord(section,organizationId,draft,userId){
  const code=codeFor(section)
  if(isDemoDataEnvironment()){
    // The demo keeps the department by name (its id is the name).
    const department=draft.department||draft.departmentId||''
    const common={id:code,displayId:compactCode(code),title:draft.title||draft.titleEn||'',titleEn:draft.titleEn||draft.title||'',department,departmentEn:draft.departmentEn||department,departmentId:draft.departmentId||'',owner:ownerLabels(draft)[0]||'',owners:ownerLabels(draft),ownerId:draft.ownerId||null,lifecycleStatus:'active',attachments:[],history:draft.history||[]}
    let record=common
    if(section==='incidents'){const details=keptDetails(draft);record={...common,severity:draft.severity||'medium',incidentClass:draft.incidentClass||'nearMiss',reachedPatient:Boolean(draft.reachedPatient),harmOccurred:Boolean(draft.harmOccurred),linkedPatient:draft.linkedPatient||'',linkedSurveillance:draft.linkedSurveillance||'',linkedAdmission:draft.linkedAdmission||'',category:draft.category||'clinical',eventType:details.eventType,fall:details.fall,sharp:details.sharp,blueCode:details.blueCode,obstetric:details.obstetric,eventTime:draft.eventTime||'',impact:draft.impact||'none',date:draft.date||new Date().toISOString().slice(0,10),status:draft.status||'reported',description:draft.description||'',descriptionEn:draft.descriptionEn||draft.description||'',immediateActions:draft.immediateActions||draft.immediateActionsEn||'',rootCause:draft.rootCause||'',contributingFactors:draft.contributingFactors||'',reportedBy:draft.anonymous?'':draft.reportedByLabel||'',reportedById:draft.anonymous?null:userId||null,anonymous:Boolean(draft.anonymous),reportKind:draft.reportKind||'clinical',sentinel:Boolean(draft.sentinel),rcaDueDate:draft.rcaDueDate||''}}
    if(section==='findings')record={...common,severity:draft.severity||'medium',date:draft.date||new Date().toISOString().slice(0,10),status:draft.status||'open',description:draft.description||'',descriptionEn:draft.descriptionEn||draft.description||'',source:draft.source||'manual',sourceId:draft.sourceId||'',...AUDIT_FINDING_DEFAULTS(draft)}
    if(section==='capas')record={...common,severity:draft.priority||'medium',priority:draft.priority||'medium',actionType:draft.actionType||'corrective',dueDate:draft.dueDate||'',effectivenessDue:draft.effectivenessDue||'',effectivenessStatus:draft.effectivenessStatus||'pending',status:draft.status||'open',description:draft.description||'',descriptionEn:draft.descriptionEn||draft.description||'',source:draft.source||'other',sourceId:draft.sourceId||'',subActions:draft.subActions||[],rootCauseAnalysis:null,progress:[]}
    if(section==='audits')record={...common,auditType:draft.auditType||'internal',plannedDate:draft.plannedDate||'',completedDate:'',status:draft.status||'planned',leadAuditor:draft.leadAuditor||'',leadAuditorId:draft.leadAuditorId||null,checklist:draft.checklist||[],checklistSource:draft.checklistSource||'',scope:draft.scope||'',scopeEn:draft.scopeEn||draft.scope||'',findingIds:[],...AUDIT_PROGRAMME_DEFAULTS(draft)}
    const rows=loadQualityLocal(section)
    rows.unshift(record)
    saveQualityLocal(section,rows)
    return record
  }
  assertReady(organizationId)
  const config=sectionConfig[section]
  if(!config) throw new Error('Unsupported quality record type.')
  // The id is chosen here, so the details can follow even an anonymous report.
  const id=newRowId()
  let payload={id,organization_id:organizationId,code,title:(draft.title||draft.titleEn||'').trim(),...englishColumns(draft,section),department_id:isUuid(draft.departmentId)?draft.departmentId:null,history:draft.history||[],...(section==='audits'?{}:{owner_id:isUuid(draft.ownerId)?draft.ownerId:null}),owner_label:ownerLabels(draft)[0]||null,owner_labels:ownerLabels(draft)}
  if(section==='incidents') payload={...payload,occurred_at:`${draft.date||new Date().toISOString().slice(0,10)}T12:00:00Z`,event_time:draft.eventTime||null,incident_class:draft.incidentClass||'nearMiss',reached_patient:Boolean(draft.reachedPatient),harm_occurred:Boolean(draft.harmOccurred),category:draft.category||'clinical',linked_patient_id:isUuid(draft.linkedPatient)?draft.linkedPatient:null,linked_surveillance_id:isUuid(draft.linkedSurveillance)?draft.linkedSurveillance:null,linked_admission_id:isUuid(draft.linkedAdmission)?draft.linkedAdmission:null,event_type:draft.eventType||null,impact:draft.impact||'none',severity:draft.severity||'medium',status:draft.status||'reported',description:draft.description||draft.descriptionEn||null,immediate_actions:draft.immediateActions||draft.immediateActionsEn||null,root_cause:draft.rootCause||null,contributing_factors:draft.contributingFactors||null,reported_by:draft.anonymous?null:userId||null,reported_by_label:draft.anonymous?null:draft.reportedByLabel||null,is_anonymous:Boolean(draft.anonymous),report_kind:draft.reportKind||'clinical',is_sentinel:Boolean(draft.sentinel),rca_due_date:draft.rcaDueDate||null}
  if(section==='findings') payload={...payload,identified_at:`${draft.date||new Date().toISOString().slice(0,10)}T12:00:00Z`,severity:draft.severity||'medium',status:draft.status||'open',description:draft.description||draft.descriptionEn||null,source_type:draft.source||'manual',source_id:draft.sourceId||null,...findingAuditPayload(draft),follow_up_audit_id:await auditIdOf(organizationId,draft.followUpAuditId)}
  if(section==='capas') payload={...payload,source_type:draft.source||'other',source_id:draft.sourceId||null,action_type:draft.actionType||'corrective',priority:draft.priority||'medium',status:draft.status||'open',description:draft.description||draft.descriptionEn||null,due_date:draft.dueDate||null,effectiveness_due:draft.effectivenessDue||null,effectiveness_status:draft.effectivenessStatus||'pending'}
  if(section==='audits') payload={...payload,...auditTypePayload(draft.auditType),scope:draft.scope||draft.scopeEn||null,planned_date:draft.plannedDate||null,status:draft.status||'planned',lead_auditor_id:isUuid(draft.leadAuditorId)?draft.leadAuditorId:null,lead_auditor_label:draft.leadAuditor||null,checklist_source:draft.checklistSource||null,...auditProgrammePayload(draft),follow_up_of:await auditIdOf(organizationId,draft.followUpOf)}

  // An anonymous report carries no reporter, so the reporter may not read it
  // back: it is inserted without returning the row.
  if(section==='incidents'&&draft.anonymous){
    must(await supabase.from(config.table).insert(payload))
    await writeIncidentDetails(organizationId,id,draft,{creating:true})
    return {id:code,code,dbId:id,displayId:compactCode(code),anonymous:true}
  }
  must(await supabase.from(config.table).insert(payload))
  await writeDetails(section,organizationId,id,{...draft,rootCauseAnalysis:undefined},{creating:true})
  return reloadById(section,organizationId,id)
}

function buildPersistPayload(section,record){
  const payload={
    title:(record.title||record.titleEn||'').trim(),
    ...englishColumns(record,section),
    department_id:isUuid(record.departmentId)?record.departmentId:null,
    status:dbStatus(record.status),
    // quality_audits has no owner_id: its person is the lead auditor.
    ...(section==='audits'?{}:{owner_id:isUuid(record.ownerId)?record.ownerId:null}),
    owner_label:ownerLabels(record)[0]||null,
    owner_labels:ownerLabels(record),
    lifecycle_status:record.lifecycleStatus||'active',
    void_reason:record.voidReason||null,
    voided_at:record.voidedAt||null,
    voided_by:isUuid(record.voidedById)?record.voidedById:null,
    correction_reason:record.correctionReason||null,
    correction_opened_at:record.correctionOpenedAt||null,
    correction_opened_by:isUuid(record.correctionOpenedById)?record.correctionOpenedById:null,
    history:record.history||[],
    updated_at:new Date().toISOString(),
  }
  if(section==='incidents')Object.assign(payload,{
    severity:record.severity||'medium',
    occurred_at:record.date?`${record.date}T12:00:00Z`:undefined,
    description:record.description||record.descriptionEn||null,
    linked_patient_id:record.linkedPatient||null,
    linked_surveillance_id:record.linkedSurveillance||null,
    linked_admission_id:record.linkedAdmission||null,
    event_time:record.eventTime||null,
    incident_class:record.incidentClass||'nearMiss',
    reached_patient:Boolean(record.reachedPatient),
    harm_occurred:Boolean(record.harmOccurred),
    category:record.category||'clinical',
    event_type:record.eventType||null,
    impact:record.impact||'none',
    immediate_actions:record.immediateActions||record.immediateActionsEn||null,
    root_cause:record.rootCause||record.rootCauseEn||null,
    contributing_factors:record.contributingFactors||record.contributingFactorsEn||null,
    ...(record.reportKind?{report_kind:record.reportKind}:{}),
    is_sentinel:Boolean(record.sentinel),
    rca_due_date:record.rcaDueDate||null,
  })
  if(section==='findings')Object.assign(payload,{
    severity:record.severity||'medium',
    identified_at:record.date?`${record.date}T12:00:00Z`:undefined,
    description:record.description||record.descriptionEn||null,
    source_type:record.source||'manual',
    source_id:record.sourceId||null,
    ...findingAuditPayload(record),
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
    ...auditTypePayload(record.auditType),
    scope:record.scope||record.scopeEn||null,
    planned_date:record.plannedDate||null,
    completed_date:record.completedDate||null,
    lead_auditor_label:record.leadAuditor||null,
    lead_auditor_id:isUuid(record.leadAuditorId)?record.leadAuditorId:null,
    checklist_source:record.checklistSource||null,
    ...auditProgrammePayload(record),
  })
  return payload
}

export async function saveQualityRecord(section,organizationId,record){
  if(isDemoDataEnvironment()){
    const rows=loadQualityLocal(section)
    const index=rows.findIndex(x=>x.id===record.id)
    const saved={...(section==='incidents'?keptDetails(record):record),updatedAt:new Date().toISOString()}
    if(index>=0)rows[index]=saved
    else rows.unshift(saved)
    saveQualityLocal(section,rows)
    return {...saved}
  }
  assertReady(organizationId)
  const config=sectionConfig[section]
  if(!config) throw new Error('Unsupported quality record type.')
  const payload=buildPersistPayload(section,record)
  if(section==='audits')payload.follow_up_of=await auditIdOf(organizationId,record.followUpOf)
  if(section==='findings')payload.follow_up_audit_id=await auditIdOf(organizationId,record.followUpAuditId)
  // Refused when someone else saved the record after it was loaded (src/core/data/recordVersion.js).
  const data=await guardedSingle(expectVersion(supabase.from(config.table).update(payload).eq('organization_id',organizationId).eq('code',record.id),record.updatedAt).select('id').single(),{table:config.table,updatedAt:record.updatedAt})
  await writeDetails(section,organizationId,data.id,record)
  return reloadById(section,organizationId,data.id)
}

// --- CAPA progress notes ---------------------------------------------------------------------

// A dated note on how the CAPA is going; the newest first.
export async function addCapaProgress(organizationId,record,entry){
  const row=progressRow(entry)
  if(!row)throw new Error('A progress note needs some text.')
  if(isDemoDataEnvironment()){
    const saved={id:row.id,date:row.entry_date,note:row.note,author:row.author_label||'',createdAt:new Date().toISOString()}
    return saveQualityRecord('capas',organizationId,{...record,progress:[saved,...(record.progress||[])]})
  }
  assertReady(organizationId)
  must(await supabase.from('quality_capa_progress').insert({...row,capa_id:record.dbId,organization_id:organizationId}))
  return reloadById('capas',organizationId,record.dbId)
}

export async function removeCapaProgress(organizationId,record,entryId){
  if(isDemoDataEnvironment())return saveQualityRecord('capas',organizationId,{...record,progress:(record.progress||[]).filter(item=>item.id!==entryId)})
  assertReady(organizationId)
  must(await supabase.from('quality_capa_progress').delete().eq('organization_id',organizationId).eq('id',entryId))
  return reloadById('capas',organizationId,record.dbId)
}


// The next audit of every department that has none planned. In production the
// database plans them (the same rule runs when an audit is completed); the demo
// plans them on its own copy. Returns how many were planned.
export async function fillAuditProgramme(organizationId,audits=[],userId=null){
  if(isDemoDataEnvironment()){
    const planned=missingNextAudits(audits)
    for(const audit of planned)await createQualityRecord('audits',organizationId,{...audit,id:undefined,code:undefined},userId)
    return planned.length
  }
  assertReady(organizationId)
  const {data,error}=await supabase.rpc('quality_fill_audit_programme',{p_organization_id:organizationId})
  if(error)throw error
  return Number(data)||0
}

// An audit round: the month's planned audits spread over a few working days from
// `start`. The database does it in production; the demo on its own copy.
// Returns how many audits got a day.
// An audit round arranged by hand: `items` are the departments with their day. An existing planned audit
// gets the day; a department without one gets a new audit from the basic questionnaire. Returns how many.
export async function applyAuditRound(organizationId,items=[],{template=null,userId=null,days=3}={}){
  const existing=items.filter(item=>item.auditId),fresh=items.filter(item=>!item.auditId)
  if(isDemoDataEnvironment()){
    const dates=new Map(existing.map(item=>[item.auditId,item.plannedDate]))
    saveQualityLocal('audits',loadQualityLocal('audits').map(row=>dates.has(row.id)?{...row,plannedDate:dates.get(row.id),plannedMonthOnly:false}:row))
  }else{
    assertReady(organizationId)
    for(const item of existing)must(await supabase.from('quality_audits').update({planned_date:item.plannedDate,planned_month_only:false}).eq('id',item.auditId).eq('organization_id',organizationId))
  }
  for(const item of fresh){
    await createQualityRecord('audits',organizationId,{
      title:`Επιθεώρηση τμήματος · ${item.department}`,titleEn:`Department audit · ${item.departmentEn||item.department}`,
      department:item.department,departmentEn:item.departmentEn||item.department,departmentId:item.departmentId,auditType:'internal',plannedDate:item.plannedDate,status:'planned',
      ...(template?{templateId:template.id,templateTitle:template.title,templateVersion:template.version,standard:template.standard,standards:[],checklistSource:`template:${template.id}`,scope:template.scope}:{}),
      durationDays:days,riskLevel:'medium',frequencyMonths:6,history:[]
    },userId)
  }
  return items.length
}

export async function planAuditRound(organizationId,audits=[],start,days=3){
  if(isDemoDataEnvironment()){
    const {assignments}=spreadAuditRound(audits,start,days)
    const ids=new Map(assignments.map(item=>[item.audit.id,item.plannedDate]))
    saveQualityLocal('audits',loadQualityLocal('audits').map(row=>ids.has(row.id)?{...row,plannedDate:ids.get(row.id),plannedMonthOnly:false}:row))
    return assignments.length
  }
  assertReady(organizationId)
  const {data,error}=await supabase.rpc('quality_plan_audit_round',{p_organization_id:organizationId,p_start:start,p_days:days})
  if(error)throw error
  return Number(data)||0
}
