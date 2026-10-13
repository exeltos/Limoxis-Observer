// Risk assessments: an assessment (one period) with its risks and opportunities.
// Supabase tables quality_risk_assessments / quality_risks / quality_risk_opportunities;
// in Demo mode one local snapshot holds whole assessments (risks nested).
import { supabase } from '../../../core/supabase/client'
import { isDemoDataEnvironment } from '../../../core/data/dataEnvironment'
import { loadSnapshot, saveSnapshot } from '../../../core/data/repository'
import { expectVersion, guardedSingle } from '../../../core/data/recordVersion'
import { riskDemoAssessments } from './riskDemoData'
import { unpackTemplate } from './riskImport'

const LOCAL='quality_local_risk_assessments'
const ASSESSMENT_COLUMNS='id,code,title,period_label,period_kind,assessed_on,next_review_on,assessor_label,form_code,scope_note,status,approved_by_label,approved_on,source_assessment_id,history,updated_at'
const RISK_COLUMNS='id,assessment_id,lineage_key,position,section,process,scope,hazard,inherent_l,inherent_c,existing_controls,residual_l,residual_c,consequence_rationale,additional_measures,owner_label,due_date,review_frequency,indicator,target_l,target_c,jci_chapter,jci_reference,prioritized,notes,updated_at'
const OPPORTUNITY_COLUMNS='id,assessment_id,position,activity,opportunity,rating,action_plan,timeframe,owner_label,effectiveness,updated_at'

const demo=()=>isDemoDataEnvironment()||!supabase
function assertReady(organizationId){if(!organizationId)throw new Error('Organization is required.')}
const localAll=()=>{const rows=loadSnapshot(LOCAL,null);return Array.isArray(rows)?rows:riskDemoAssessments()}
const localSave=rows=>saveSnapshot(LOCAL,rows)
const uid=()=>globalThis.crypto?.randomUUID?.()||`local-${Date.now()}-${Math.random().toString(36).slice(2,9)}`
const stamp=()=>new Date().toISOString()
const nullable=value=>value===''||value===undefined?null:value
const axis=value=>{const n=Number(value);return Number.isInteger(n)&&n>=1&&n<=5?n:null}

export function newAssessmentCode(date=new Date()){const p=n=>String(n).padStart(2,'0');return `RSA-${String(date.getFullYear()).slice(2)}${p(date.getMonth()+1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`}
// R001, R002…: the risk's identity inside the assessment and across periods.
export function nextLineageKey(risks=[]){const max=risks.reduce((m,r)=>Math.max(m,Number(String(r.lineageKey||'').replace(/\D/g,''))||0),0);return `R${String(max+1).padStart(3,'0')}`}

const mapAssessment=row=>({id:row.id,code:row.code,title:row.title,periodLabel:row.period_label,periodKind:row.period_kind,assessedOn:row.assessed_on,nextReviewOn:row.next_review_on,assessorLabel:row.assessor_label||'',formCode:row.form_code||'',scopeNote:row.scope_note||'',status:row.status,approvedByLabel:row.approved_by_label||'',approvedOn:row.approved_on,sourceAssessmentId:row.source_assessment_id,history:row.history||[],updatedAt:row.updated_at})
const mapRisk=row=>({id:row.id,assessmentId:row.assessment_id,lineageKey:row.lineage_key,position:row.position,section:row.section,process:row.process||'',scope:row.scope||'',hazard:row.hazard||'',inherentL:row.inherent_l,inherentC:row.inherent_c,existingControls:row.existing_controls||'',residualL:row.residual_l,residualC:row.residual_c,consequenceRationale:row.consequence_rationale||'',additionalMeasures:row.additional_measures||'',owner:row.owner_label||'',dueDate:row.due_date,reviewFrequency:row.review_frequency||'',indicator:row.indicator||'',targetL:row.target_l,targetC:row.target_c,jci:row.jci_chapter||'',jciReference:row.jci_reference||'',prioritized:Boolean(row.prioritized),notes:row.notes||'',updatedAt:row.updated_at})
const mapOpportunity=row=>({id:row.id,assessmentId:row.assessment_id,position:row.position,activity:row.activity||'',opportunity:row.opportunity||'',rating:row.rating||'',actionPlan:row.action_plan||'',timeframe:row.timeframe||'',owner:row.owner_label||'',effectiveness:row.effectiveness||'',updatedAt:row.updated_at})

const assessmentPayload=a=>({title:a.title,period_label:a.periodLabel,period_kind:a.periodKind||'annual',assessed_on:a.assessedOn,next_review_on:nullable(a.nextReviewOn),assessor_label:nullable(a.assessorLabel),form_code:nullable(a.formCode),scope_note:nullable(a.scopeNote),status:a.status||'draft',approved_by_label:nullable(a.approvedByLabel),approved_on:nullable(a.approvedOn),history:a.history||[]})
const riskPayload=r=>({lineage_key:r.lineageKey,position:r.position||0,section:r.section||'clinical',process:nullable(r.process),scope:nullable(r.scope),hazard:r.hazard,inherent_l:axis(r.inherentL),inherent_c:axis(r.inherentC),existing_controls:nullable(r.existingControls),residual_l:axis(r.residualL),residual_c:axis(r.residualC),consequence_rationale:nullable(r.consequenceRationale),additional_measures:nullable(r.additionalMeasures),owner_label:nullable(r.owner),due_date:nullable(r.dueDate),review_frequency:nullable(r.reviewFrequency),indicator:nullable(r.indicator),target_l:axis(r.targetL),target_c:axis(r.targetC),jci_chapter:nullable(r.jci),jci_reference:nullable(r.jciReference),prioritized:Boolean(r.prioritized),notes:nullable(r.notes)})
const opportunityPayload=o=>({position:o.position||0,activity:o.activity,opportunity:nullable(o.opportunity),rating:nullable(o.rating),action_plan:nullable(o.actionPlan),timeframe:nullable(o.timeframe),owner_label:nullable(o.owner),effectiveness:nullable(o.effectiveness)})

// Every assessment of the organization with its risks (the list, the
// comparison and the trend all need them), newest first.
export async function loadRiskAssessments(organizationId){
 if(demo())return localAll().map(a=>structuredClone(a)).sort((a,b)=>String(b.assessedOn).localeCompare(String(a.assessedOn)))
 assertReady(organizationId)
 const [{data:assessments,error},{data:risks,error:riskError}]=await Promise.all([
  supabase.from('quality_risk_assessments').select(ASSESSMENT_COLUMNS).eq('organization_id',organizationId).order('assessed_on',{ascending:false}),
  supabase.from('quality_risks').select(RISK_COLUMNS).eq('organization_id',organizationId).order('position'),
 ])
 if(error)throw error;if(riskError)throw riskError
 const byAssessment=new Map();for(const r of risks||[]){const list=byAssessment.get(r.assessment_id)||[];list.push(mapRisk(r));byAssessment.set(r.assessment_id,list)}
 return (assessments||[]).map(row=>({...mapAssessment(row),risks:byAssessment.get(row.id)||[]}))
}

export async function loadRiskAssessment(organizationId,code){
 if(demo()){const found=localAll().find(a=>a.code===code);return found?structuredClone(found):null}
 assertReady(organizationId)
 const {data:row,error}=await supabase.from('quality_risk_assessments').select(ASSESSMENT_COLUMNS).eq('organization_id',organizationId).eq('code',code).maybeSingle()
 if(error)throw error;if(!row)return null
 const [{data:risks,error:e1},{data:opportunities,error:e2}]=await Promise.all([
  supabase.from('quality_risks').select(RISK_COLUMNS).eq('assessment_id',row.id).order('position'),
  supabase.from('quality_risk_opportunities').select(OPPORTUNITY_COLUMNS).eq('assessment_id',row.id).order('position'),
 ])
 if(e1)throw e1;if(e2)throw e2
 return {...mapAssessment(row),risks:(risks||[]).map(mapRisk),opportunities:(opportunities||[]).map(mapOpportunity)}
}

// A new assessment, empty or carried forward from an earlier one: the risks
// keep their lineage keys (that is what the comparison follows) and their
// scores, ready to be reassessed for the new period.
export async function createRiskAssessment(organizationId,draft,{carryFrom=null,risks=null,opportunities=null}={}){
 const code=newAssessmentCode()
 const sourceRisks=risks||(carryFrom?.risks||[])
 const sourceOpportunities=opportunities||(carryFrom?.opportunities||[])
 const header={...draft,code,status:'draft',sourceAssessmentId:carryFrom?.id||null}
 if(demo()){
  const id=uid(),now=stamp()
  const assessment={...header,id,updatedAt:now,risks:sourceRisks.map((r,i)=>({...r,id:uid(),assessmentId:id,position:i,updatedAt:now})),opportunities:sourceOpportunities.map((o,i)=>({...o,id:uid(),assessmentId:id,position:i,updatedAt:now}))}
  localSave([assessment,...localAll()])
  return assessment
 }
 assertReady(organizationId)
 const {data:row,error}=await supabase.from('quality_risk_assessments').insert({organization_id:organizationId,code,source_assessment_id:carryFrom?.id||null,...assessmentPayload(header)}).select(ASSESSMENT_COLUMNS).single()
 if(error)throw error
 if(sourceRisks.length){const {error:e}=await supabase.from('quality_risks').insert(sourceRisks.map((r,i)=>({organization_id:organizationId,assessment_id:row.id,...riskPayload({...r,position:i})})));if(e)throw e}
 if(sourceOpportunities.length){const {error:e}=await supabase.from('quality_risk_opportunities').insert(sourceOpportunities.map((o,i)=>({organization_id:organizationId,assessment_id:row.id,...opportunityPayload({...o,position:i})})));if(e)throw e}
 return mapAssessment(row)
}

function updateLocal(assessmentId,change){
 const all=localAll();const index=all.findIndex(a=>a.id===assessmentId)
 if(index<0)throw new Error('Assessment not found.')
 const next=change(structuredClone(all[index]));all[index]=next;localSave(all);return next
}

export async function saveRiskAssessment(organizationId,assessment){
 if(demo())return updateLocal(assessment.id,a=>({...a,...assessment,risks:a.risks,opportunities:a.opportunities,updatedAt:stamp()}))
 assertReady(organizationId)
 const table='quality_risk_assessments'
 const data=await guardedSingle(expectVersion(supabase.from(table).update({...assessmentPayload(assessment),updated_at:stamp()}).eq('organization_id',organizationId).eq('id',assessment.id),assessment.updatedAt).select(ASSESSMENT_COLUMNS).single(),{table,updatedAt:assessment.updatedAt})
 return mapAssessment(data)
}

export async function saveRisk(organizationId,assessmentId,risk){
 if(demo()){const id=risk.id||uid();return updateLocal(assessmentId,a=>{const list=a.risks||[];const i=list.findIndex(r=>r.id===id);const saved={...risk,id,assessmentId,position:risk.position??list.length,updatedAt:stamp()};if(i<0)list.push(saved);else list[i]=saved;return {...a,risks:list}}).risks.find(r=>r.id===id)}
 assertReady(organizationId)
 const table='quality_risks'
 if(!risk.id){const {data,error}=await supabase.from(table).insert({organization_id:organizationId,assessment_id:assessmentId,...riskPayload(risk)}).select(RISK_COLUMNS).single();if(error)throw error;return mapRisk(data)}
 const data=await guardedSingle(expectVersion(supabase.from(table).update({...riskPayload(risk),updated_at:stamp()}).eq('organization_id',organizationId).eq('id',risk.id),risk.updatedAt).select(RISK_COLUMNS).single(),{table,updatedAt:risk.updatedAt})
 return mapRisk(data)
}

export async function deleteRisk(organizationId,assessmentId,riskId){
 if(demo()){updateLocal(assessmentId,a=>({...a,risks:(a.risks||[]).filter(r=>r.id!==riskId)}));return}
 assertReady(organizationId)
 const {error}=await supabase.from('quality_risks').delete().eq('organization_id',organizationId).eq('id',riskId);if(error)throw error
}

export async function saveOpportunity(organizationId,assessmentId,item){
 if(demo()){const id=item.id||uid();return updateLocal(assessmentId,a=>{const list=a.opportunities||[];const i=list.findIndex(o=>o.id===id);const saved={...item,id,assessmentId,position:item.position??list.length,updatedAt:stamp()};if(i<0)list.push(saved);else list[i]=saved;return {...a,opportunities:list}}).opportunities.find(o=>o.id===id)}
 assertReady(organizationId)
 const table='quality_risk_opportunities'
 if(!item.id){const {data,error}=await supabase.from(table).insert({organization_id:organizationId,assessment_id:assessmentId,...opportunityPayload(item)}).select(OPPORTUNITY_COLUMNS).single();if(error)throw error;return mapOpportunity(data)}
 const data=await guardedSingle(expectVersion(supabase.from(table).update({...opportunityPayload(item),updated_at:stamp()}).eq('organization_id',organizationId).eq('id',item.id),item.updatedAt).select(OPPORTUNITY_COLUMNS).single(),{table,updatedAt:item.updatedAt})
 return mapOpportunity(data)
}

export async function deleteOpportunity(organizationId,assessmentId,id){
 if(demo()){updateLocal(assessmentId,a=>({...a,opportunities:(a.opportunities||[]).filter(o=>o.id!==id)}));return}
 assertReady(organizationId)
 const {error}=await supabase.from('quality_risk_opportunities').delete().eq('organization_id',organizationId).eq('id',id);if(error)throw error
}

// A draft assessment can be removed with everything in it (risks cascade).
export async function deleteRiskAssessment(organizationId,assessment){
 if(assessment.status!=='draft')throw new Error('Only a draft assessment can be deleted.')
 if(demo()){localSave(localAll().filter(a=>a.id!==assessment.id));return}
 assertReady(organizationId)
 const {error}=await supabase.from('quality_risk_assessments').delete().eq('organization_id',organizationId).eq('id',assessment.id).eq('status','draft');if(error)throw error
}

// Assessments created together (an import with a reassessment, a template),
// oldest first: each one points to the one before it.
export async function createAssessmentSeries(organizationId,plan,history=[]){
 let previous=null;const created=[]
 for(const item of plan){
  previous=await createRiskAssessment(organizationId,{...item.header,history},{carryFrom:previous?{id:previous.id}:null,risks:item.risks,opportunities:item.opportunities})
  created.push(previous)
 }
 return created
}

// Templates of the platform owner (quality_risk_templates): a hospital's
// register kept in the database, never in the Demo data, and loaded into an
// organization only on the platform owner's request. Row level security lets
// only the platform owner read them.
export async function loadRiskTemplates(){
 if(!supabase)return []
 const {data,error}=await supabase.from('quality_risk_templates').select('id,code,title,source_file,payload,updated_at').order('updated_at',{ascending:false})
 if(error)throw error
 return (data||[]).map(row=>({id:row.id,code:row.code,title:row.title,sourceFile:row.source_file||'',plan:unpackTemplate(row.payload),updatedAt:row.updated_at}))
}
