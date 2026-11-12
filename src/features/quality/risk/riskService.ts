// Risk assessments: an assessment (one period) with its risks and opportunities.
// Supabase tables quality_risk_assessments / quality_risks / quality_risk_opportunities;
// in Demo mode one local snapshot holds whole assessments (risks nested).
import { supabase as configuredClient, type Cloud } from '../../../core/supabase/client'
import { isDemoDataEnvironment } from '../../../core/data/dataEnvironment'
import { loadSnapshot, saveSnapshot } from '../../../core/data/repository'
import { expectVersion, guardedSingle } from '../../../core/data/recordVersion'
import { riskDemoAssessments } from './riskDemoData'
import { visibleAssessments } from './riskModel'
import type { AnyRecord } from '../../../types/featureTypes'

// The calls below run with a configured client: the demo and an unconfigured build return before them.
const supabase = configuredClient as Cloud

const LOCAL='quality_local_risk_assessments'
const ASSESSMENT_COLUMNS='id,code,title,period_label,period_kind,assessed_on,next_review_on,assessor_label,form_code,scope_note,status,approved_by_label,approved_on,source_assessment_id,history,updated_at'
const RISK_COLUMNS='id,assessment_id,lineage_key,position,section,process,scope,hazard,inherent_l,inherent_c,existing_controls,residual_l,residual_c,consequence_rationale,additional_measures,owner_label,due_date,review_frequency,indicator,target_l,target_c,jci_chapter,jci_reference,indicator_keys,prioritized,notes,updated_at'
const OPPORTUNITY_COLUMNS='id,assessment_id,position,activity,opportunity,rating,action_plan,timeframe,owner_label,effectiveness,effectiveness_status,updated_at'

const demo=()=>isDemoDataEnvironment()||!supabase
function assertReady(organizationId: string | null | undefined): asserts organizationId is string{if(!organizationId)throw new Error('Organization is required.')}
const localAll=()=>{const rows=loadSnapshot(LOCAL,null);return Array.isArray(rows)?rows:riskDemoAssessments()}
const localSave=(rows: AnyRecord[])=>saveSnapshot(LOCAL,rows)
// The demo risk assessments as they are in this browser (the Analysis demo reads them).
export const loadRiskAssessmentsLocal=()=>localAll()
const uid=()=>globalThis.crypto?.randomUUID?.()||`local-${Date.now()}-${Math.random().toString(36).slice(2,9)}`
const stamp=()=>new Date().toISOString()
const nullable=<T>(value: T)=>value===''||value===undefined?null:value
const axis=(value: unknown)=>{const n=Number(value);return Number.isInteger(n)&&n>=1&&n<=5?n:null}

export function newAssessmentCode(date=new Date()){const p=(n: number)=>String(n).padStart(2,'0');return `RSA-${String(date.getFullYear()).slice(2)}${p(date.getMonth()+1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`}
// R001, R002…: the risk's identity inside the assessment and across periods.
export function nextLineageKey(risks: AnyRecord[]=[]){const max=risks.reduce((m,r)=>Math.max(m,Number(String(r.lineageKey||'').replace(/\D/g,''))||0),0);return `R${String(max+1).padStart(3,'0')}`}

const mapAssessment=(row: AnyRecord)=>({id:row.id,code:row.code,title:row.title,periodLabel:row.period_label,periodKind:row.period_kind,assessedOn:row.assessed_on,nextReviewOn:row.next_review_on,assessorLabel:row.assessor_label||'',formCode:row.form_code||'',scopeNote:row.scope_note||'',status:row.status,approvedByLabel:row.approved_by_label||'',approvedOn:row.approved_on,sourceAssessmentId:row.source_assessment_id,history:row.history||[],updatedAt:row.updated_at})
const mapRisk=(row: AnyRecord)=>({id:row.id,assessmentId:row.assessment_id,lineageKey:row.lineage_key,position:row.position,section:row.section,process:row.process||'',scope:row.scope||'',hazard:row.hazard||'',inherentL:row.inherent_l,inherentC:row.inherent_c,existingControls:row.existing_controls||'',residualL:row.residual_l,residualC:row.residual_c,consequenceRationale:row.consequence_rationale||'',additionalMeasures:row.additional_measures||'',owner:row.owner_label||'',dueDate:row.due_date,reviewFrequency:row.review_frequency||'',indicator:row.indicator||'',targetL:row.target_l,targetC:row.target_c,jci:row.jci_chapter||'',jciReference:row.jci_reference||'',indicatorKeys:Array.isArray(row.indicator_keys)?row.indicator_keys:[],prioritized:Boolean(row.prioritized),notes:row.notes||'',updatedAt:row.updated_at})
const mapOpportunity=(row: AnyRecord)=>({id:row.id,assessmentId:row.assessment_id,position:row.position,activity:row.activity||'',opportunity:row.opportunity||'',rating:row.rating||'',actionPlan:row.action_plan||'',timeframe:row.timeframe||'',owner:row.owner_label||'',effectiveness:row.effectiveness||'',effectivenessStatus:row.effectiveness_status||'',updatedAt:row.updated_at})

const assessmentPayload=(a: AnyRecord)=>({title:a.title,period_label:a.periodLabel,period_kind:a.periodKind||'annual',assessed_on:a.assessedOn,next_review_on:nullable(a.nextReviewOn),assessor_label:nullable(a.assessorLabel),form_code:nullable(a.formCode),scope_note:nullable(a.scopeNote),status:a.status||'draft',approved_by_label:nullable(a.approvedByLabel),approved_on:nullable(a.approvedOn),history:a.history||[]})
const riskPayload=(r: AnyRecord)=>({lineage_key:r.lineageKey,position:r.position||0,section:r.section||'clinical',process:nullable(r.process),scope:nullable(r.scope),hazard:r.hazard,inherent_l:axis(r.inherentL),inherent_c:axis(r.inherentC),existing_controls:nullable(r.existingControls),residual_l:axis(r.residualL),residual_c:axis(r.residualC),consequence_rationale:nullable(r.consequenceRationale),additional_measures:nullable(r.additionalMeasures),owner_label:nullable(r.owner),due_date:nullable(r.dueDate),review_frequency:nullable(r.reviewFrequency),indicator:nullable(r.indicator),target_l:axis(r.targetL),target_c:axis(r.targetC),jci_chapter:nullable(r.jci),jci_reference:nullable(r.jciReference),indicator_keys:Array.isArray(r.indicatorKeys)?[...new Set(r.indicatorKeys.filter(Boolean))]:[],prioritized:Boolean(r.prioritized),notes:nullable(r.notes)})
const opportunityPayload=(o: AnyRecord)=>({position:o.position||0,activity:o.activity,opportunity:nullable(o.opportunity),rating:nullable(o.rating),action_plan:nullable(o.actionPlan),timeframe:nullable(o.timeframe),owner_label:nullable(o.owner),effectiveness:nullable(o.effectiveness),effectiveness_status:o.effectivenessStatus||null})

// Every assessment of the organization with its risks (the list, the
// comparison and the trend all need them), newest first.
export async function loadRiskAssessments(organizationId: string | null | undefined){
 if(demo())return visibleAssessments(localAll().map(a=>structuredClone(a)).sort((a,b)=>String(b.assessedOn).localeCompare(String(a.assessedOn))))
 assertReady(organizationId)
 const [{data:assessments,error},{data:risks,error:riskError}]=await Promise.all([
  supabase.from('quality_risk_assessments').select(ASSESSMENT_COLUMNS).eq('organization_id',organizationId).order('assessed_on',{ascending:false}),
  supabase.from('quality_risks').select(RISK_COLUMNS).eq('organization_id',organizationId).order('position'),
 ])
 if(error)throw error;if(riskError)throw riskError
 const byAssessment=new Map();for(const r of risks||[]){const list=byAssessment.get(r.assessment_id)||[];list.push(mapRisk(r));byAssessment.set(r.assessment_id,list)}
 return visibleAssessments((assessments||[]).map(row=>({...mapAssessment(row),risks:byAssessment.get(row.id)||[]})))
}

export async function loadRiskAssessment(organizationId: string | null | undefined,code: string){
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
export async function createRiskAssessment(organizationId: string | null | undefined,draft: AnyRecord,{carryFrom=null,risks=null,opportunities=null,code:givenCode=null}: {carryFrom?: AnyRecord|null,risks?: AnyRecord[]|null,opportunities?: AnyRecord[]|null,code?: string|null}={}){
 const code=givenCode||newAssessmentCode()
 const sourceRisks=risks||(carryFrom?.risks||[])
 const sourceOpportunities=opportunities||(carryFrom?.opportunities||[])
 const header={...draft,code,status:'draft',sourceAssessmentId:carryFrom?.id||null}
 if(demo()){
  const id=uid(),now=stamp()
  const assessment={...header,id,updatedAt:now,risks:sourceRisks.map((r: AnyRecord,i: number)=>({...r,id:uid(),assessmentId:id,position:i,updatedAt:now})),opportunities:sourceOpportunities.map((o: AnyRecord,i: number)=>({...o,id:uid(),assessmentId:id,position:i,updatedAt:now}))}
  localSave([assessment,...localAll()])
  return assessment
 }
 assertReady(organizationId)
 const {data:row,error}=await supabase.from('quality_risk_assessments').insert({organization_id:organizationId,code,source_assessment_id:carryFrom?.id||null,...assessmentPayload(header)}).select(ASSESSMENT_COLUMNS).single()
 if(error)throw error
 if(sourceRisks.length){const {error:e}=await supabase.from('quality_risks').insert(sourceRisks.map((r: AnyRecord,i: number)=>({organization_id:organizationId,assessment_id:row.id,...riskPayload({...r,position:i})})));if(e)throw e}
 if(sourceOpportunities.length){const {error:e}=await supabase.from('quality_risk_opportunities').insert(sourceOpportunities.map((o: AnyRecord,i: number)=>({organization_id:organizationId,assessment_id:row.id,...opportunityPayload({...o,position:i})})));if(e)throw e}
 return mapAssessment(row)
}

function updateLocal(assessmentId: string,change: (assessment: AnyRecord)=>AnyRecord){
 const all=localAll();const index=all.findIndex(a=>a.id===assessmentId)
 if(index<0)throw new Error('Assessment not found.')
 const next=change(structuredClone(all[index]));all[index]=next;localSave(all);return next
}

export async function saveRiskAssessment(organizationId: string | null | undefined,assessment: AnyRecord){
 if(demo())return updateLocal(assessment.id,(a: AnyRecord)=>({...a,...assessment,risks:a.risks,opportunities:a.opportunities,updatedAt:stamp()}))
 assertReady(organizationId)
 const table='quality_risk_assessments'
 const data=await guardedSingle(expectVersion(supabase.from(table).update({...assessmentPayload(assessment),updated_at:stamp()}).eq('organization_id',organizationId).eq('id',assessment.id),assessment.updatedAt).select(ASSESSMENT_COLUMNS).single(),{table,updatedAt:assessment.updatedAt})
 return mapAssessment(data as AnyRecord)
}

export async function saveRisk(organizationId: string | null | undefined,assessmentId: string,risk: AnyRecord){
 if(demo()){const id=risk.id||uid();return updateLocal(assessmentId,(a: AnyRecord)=>{const list=a.risks||[];const i=list.findIndex((r: AnyRecord)=>r.id===id);const saved={...risk,id,assessmentId,position:risk.position??list.length,updatedAt:stamp()};if(i<0)list.push(saved);else list[i]=saved;return {...a,risks:list}}).risks.find((r: AnyRecord)=>r.id===id)}
 assertReady(organizationId)
 const table='quality_risks'
 if(!risk.id){const {data,error}=await supabase.from(table).insert({organization_id:organizationId,assessment_id:assessmentId,...riskPayload(risk)}).select(RISK_COLUMNS).single();if(error)throw error;return mapRisk(data)}
 const data=await guardedSingle(expectVersion(supabase.from(table).update({...riskPayload(risk),updated_at:stamp()}).eq('organization_id',organizationId).eq('id',risk.id),risk.updatedAt).select(RISK_COLUMNS).single(),{table,updatedAt:risk.updatedAt})
 return mapRisk(data as AnyRecord)
}

export async function deleteRisk(organizationId: string | null | undefined,assessmentId: string,riskId: string){
 if(demo()){updateLocal(assessmentId,(a: AnyRecord)=>({...a,risks:(a.risks||[]).filter((r: AnyRecord)=>r.id!==riskId)}));return}
 assertReady(organizationId)
 const {error}=await supabase.from('quality_risks').delete().eq('organization_id',organizationId).eq('id',riskId);if(error)throw error
}

export async function saveOpportunity(organizationId: string | null | undefined,assessmentId: string,item: AnyRecord){
 if(demo()){const id=item.id||uid();return updateLocal(assessmentId,(a: AnyRecord)=>{const list=a.opportunities||[];const i=list.findIndex((o: AnyRecord)=>o.id===id);const saved={...item,id,assessmentId,position:item.position??list.length,updatedAt:stamp()};if(i<0)list.push(saved);else list[i]=saved;return {...a,opportunities:list}}).opportunities.find((o: AnyRecord)=>o.id===id)}
 assertReady(organizationId)
 const table='quality_risk_opportunities'
 if(!item.id){const {data,error}=await supabase.from(table).insert({organization_id:organizationId,assessment_id:assessmentId,...opportunityPayload(item)}).select(OPPORTUNITY_COLUMNS).single();if(error)throw error;return mapOpportunity(data)}
 const data=await guardedSingle(expectVersion(supabase.from(table).update({...opportunityPayload(item),updated_at:stamp()}).eq('organization_id',organizationId).eq('id',item.id),item.updatedAt).select(OPPORTUNITY_COLUMNS).single(),{table,updatedAt:item.updatedAt})
 return mapOpportunity(data as AnyRecord)
}

export async function deleteOpportunity(organizationId: string | null | undefined,assessmentId: string,id: string){
 if(demo()){updateLocal(assessmentId,(a: AnyRecord)=>({...a,opportunities:(a.opportunities||[]).filter((o: AnyRecord)=>o.id!==id)}));return}
 assertReady(organizationId)
 const {error}=await supabase.from('quality_risk_opportunities').delete().eq('organization_id',organizationId).eq('id',id);if(error)throw error
}

// A draft assessment can be removed with everything in it (risks cascade).
export async function deleteRiskAssessment(organizationId: string | null | undefined,assessment: AnyRecord){
 if(assessment.status!=='draft')throw new Error('Only a draft assessment can be deleted.')
 if(demo()){localSave(localAll().filter(a=>a.id!==assessment.id));return}
 assertReady(organizationId)
 const {error}=await supabase.from('quality_risk_assessments').delete().eq('organization_id',organizationId).eq('id',assessment.id).eq('status','draft');if(error)throw error
}

// Assessments created together (an import with a reassessment),
// oldest first: each one points to the one before it.
export async function createAssessmentSeries(organizationId: string | null | undefined,plan: AnyRecord,history: AnyRecord[]=[]){
 // Codes come from the clock to the second; a second apart each, so two
 // assessments created together never share one.
 let previous: AnyRecord|null=null;const created: AnyRecord[]=[];const start=Date.now()
 for(const [i,item] of plan.entries()){
  previous=await createRiskAssessment(organizationId,{...item.header,history},{carryFrom:previous?{id:previous.id}:null,risks:item.risks,opportunities:item.opportunities,code:newAssessmentCode(new Date(start+i*1000))})
  created.push(previous)
 }
 return created
}
