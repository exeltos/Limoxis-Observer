import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadIndicatorDefinitionsLocal, saveIndicatorDefinitionsLocal } from './indicatorStore'

const demoId=()=>`ind-def-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`

export const INDICATOR_METRICS=Object.freeze([
 'patient_days','active_surveillance','resistant_active_surveillance','hh_compliant_actions','hh_opportunities','bundle_all_or_none_pass','bundle_executions','abhr_litres','active_staff','active_staff_with_vaccination','training_completed','training_assignments','open_high_incidents','mdro_bsi',
 'bacteremia_total','bacteremia_ecoli','bacteremia_proteus','bacteremia_acinetobacter','bacteremia_klebsiella','bacteremia_enterobacter','bacteremia_pseudomonas','bacteremia_saureus','bacteremia_enterococcus',
 'amr_tested_ecoli','amr_resistant_ecoli','amr_tested_proteus','amr_resistant_proteus','amr_tested_acinetobacter','amr_resistant_acinetobacter','amr_tested_klebsiella','amr_resistant_klebsiella','amr_tested_enterobacter','amr_resistant_enterobacter','amr_tested_pseudomonas','amr_resistant_pseudomonas','amr_tested_saureus','amr_resistant_saureus','amr_tested_enterococcus','amr_resistant_enterococcus',
 'antibiotic_ddd_total',
 'mdr_isolation_total','mdr_isolation_ecoli','mdr_isolation_proteus','mdr_isolation_acinetobacter','mdr_isolation_klebsiella','mdr_isolation_enterobacter','mdr_isolation_pseudomonas','mdr_isolation_saureus','mdr_isolation_enterococcus',
 'pps_patients_total','pps_patients_with_hai','pps_patients_on_antibiotics',
])

export const INDICATOR_RATIO_RULES=Object.freeze({
 resistant_active_surveillance:{active_surveillance:{multiplier:100,unit:'%'}},
 hh_compliant_actions:{hh_opportunities:{multiplier:100,unit:'%'}},
 bundle_all_or_none_pass:{bundle_executions:{multiplier:100,unit:'%'}},
 active_staff_with_vaccination:{active_staff:{multiplier:100,unit:'%'}},
 training_completed:{training_assignments:{multiplier:100,unit:'%'}},
 mdro_bsi:{patient_days:{multiplier:1000,unit:'/1.000 patient-days'}},
 abhr_litres:{patient_days:{multiplier:1000,unit:'L/1.000 patient-days'}},
 bacteremia_total:{patient_days:{multiplier:1000,unit:'/1.000 patient-days'}},
 bacteremia_ecoli:{patient_days:{multiplier:1000,unit:'/1.000 patient-days'}},
 bacteremia_proteus:{patient_days:{multiplier:1000,unit:'/1.000 patient-days'}},
 bacteremia_acinetobacter:{patient_days:{multiplier:1000,unit:'/1.000 patient-days'}},
 bacteremia_klebsiella:{patient_days:{multiplier:1000,unit:'/1.000 patient-days'}},
 bacteremia_enterobacter:{patient_days:{multiplier:1000,unit:'/1.000 patient-days'}},
 bacteremia_pseudomonas:{patient_days:{multiplier:1000,unit:'/1.000 patient-days'}},
 bacteremia_saureus:{patient_days:{multiplier:1000,unit:'/1.000 patient-days'}},
 bacteremia_enterococcus:{patient_days:{multiplier:1000,unit:'/1.000 patient-days'}},
 amr_resistant_ecoli:{amr_tested_ecoli:{multiplier:100,unit:'%'}},
 amr_resistant_proteus:{amr_tested_proteus:{multiplier:100,unit:'%'}},
 amr_resistant_acinetobacter:{amr_tested_acinetobacter:{multiplier:100,unit:'%'}},
 amr_resistant_klebsiella:{amr_tested_klebsiella:{multiplier:100,unit:'%'}},
 amr_resistant_enterobacter:{amr_tested_enterobacter:{multiplier:100,unit:'%'}},
 amr_resistant_pseudomonas:{amr_tested_pseudomonas:{multiplier:100,unit:'%'}},
 amr_resistant_saureus:{amr_tested_saureus:{multiplier:100,unit:'%'}},
 amr_resistant_enterococcus:{amr_tested_enterococcus:{multiplier:100,unit:'%'}},
 antibiotic_ddd_total:{patient_days:{multiplier:100,unit:'DDD/100 patient-days'}},
 pps_patients_with_hai:{pps_patients_total:{multiplier:100,unit:'%'}},
 pps_patients_on_antibiotics:{pps_patients_total:{multiplier:100,unit:'%'}},
})

export function allowedIndicatorDenominators(numerator){return numerator?Object.keys(INDICATOR_RATIO_RULES[numerator]||{}):[]}
export function indicatorRatioRule(numerator,denominator){return numerator&&denominator?INDICATOR_RATIO_RULES[numerator]?.[denominator]||null:null}
export function indicatorMetricRule(numerator){const denominator=allowedIndicatorDenominators(numerator)[0]||'';const rule=indicatorRatioRule(numerator,denominator);return rule?{denominator,...rule}:null}
export function indicatorMetricCombinationIsValid(numerator,denominator){return !denominator||Boolean(indicatorRatioRule(numerator,denominator))}
export const indicatorMetricPairIsValid=indicatorMetricCombinationIsValid
export function normalizeIndicatorDefinition(item){const next={...item};if(next.calculationType!=='auto')return next;const rule=indicatorRatioRule(next.numeratorMetric,next.denominatorMetric);if(rule){next.multiplier=rule.multiplier;next.unit=rule.unit}return next}

const assertCloud=(organizationId,{system=false}={})=>{if(!supabase)throw new Error('Supabase is not configured.');if(!organizationId&&!system)throw new Error('Organization is required.')}
const isUuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''))
const select='id,organization_id,indicator_key,version,title_el,title_en,category,numerator_definition,denominator_definition,numerator_metric,denominator_metric,multiplier,unit,unit_en,source_authority,effective_from,effective_to,status,calculation_type,target_value,direction,approved_at'
const toDefinition=row=>({id:row.id,organizationId:row.organization_id||null,system:row.organization_id==null,key:row.indicator_key,version:row.version,titleEl:row.title_el,category:row.category,numeratorDefinition:row.numerator_definition||{},denominatorDefinition:row.denominator_definition||{},numeratorMetric:row.numerator_metric||'',denominatorMetric:row.denominator_metric||'',multiplier:Number(row.multiplier||1),unit:row.unit||'',sourceAuthority:row.source_authority||'',effectiveFrom:row.effective_from||'',effectiveTo:row.effective_to||'',status:row.status||'draft',calculationType:row.calculation_type||'auto',targetValue:row.target_value==null?'':String(row.target_value),direction:row.direction||'context',approvedAt:row.approved_at||null})

export async function loadIndicatorDefinitions(organizationId){
 if(isDemoDataEnvironment())return loadIndicatorDefinitionsLocal().map(toDefinition)
 assertCloud(organizationId,{system:!organizationId})
 const query=supabase.from('indicator_definitions').select(select)
 const {data,error}=await(organizationId?query.or(`organization_id.eq.${organizationId},organization_id.is.null`):query.is('organization_id',null)).order('category').order('title_el')
 if(error)throw error;return (data||[]).map(toDefinition)
}
export async function loadIndicatorDefinition(organizationId,id){
 if(isDemoDataEnvironment()){
  const row=loadIndicatorDefinitionsLocal().find(r=>r.id===id)
  return row?toDefinition(row):null
 }
 assertCloud(organizationId);if(!isUuid(id))return null;const {data,error}=await supabase.from('indicator_definitions').select(select).eq('id',id).or(`organization_id.eq.${organizationId},organization_id.is.null`).maybeSingle();if(error)throw error;return data?toDefinition(data):null
}

export async function saveIndicatorDefinition(organizationId,item){
 const normalized=normalizeIndicatorDefinition(item)
 if(normalized.calculationType==='auto'&&!INDICATOR_METRICS.includes(normalized.numeratorMetric))throw new Error('Unsupported numerator metric.')
 if(normalized.denominatorMetric&&!INDICATOR_METRICS.includes(normalized.denominatorMetric))throw new Error('Unsupported denominator metric.')
 if(normalized.calculationType==='auto'&&!indicatorMetricCombinationIsValid(normalized.numeratorMetric,normalized.denominatorMetric))throw new Error('Unsupported numerator / denominator combination.')
 const activating=normalized.status==='active'
 const payload={organization_id:normalized.system?null:organizationId,indicator_key:String(normalized.key||'').trim(),version:String(normalized.version||'1.0').trim(),title_el:String(normalized.titleEl||'').trim(),title_en:String(normalized.titleEl||'').trim(),category:String(normalized.category||'general').trim(),numerator_definition:normalized.numeratorDefinition||{},denominator_definition:normalized.denominatorDefinition||{},numerator_metric:normalized.calculationType==='auto'?(normalized.numeratorMetric||null):null,denominator_metric:normalized.calculationType==='auto'?(normalized.denominatorMetric||null):null,multiplier:Number(normalized.multiplier||1),unit:normalized.unit||null,unit_en:normalized.unit||null,source_authority:normalized.sourceAuthority||null,effective_from:normalized.effectiveFrom||null,effective_to:normalized.effectiveTo||null,status:normalized.status||'draft',calculation_type:normalized.calculationType||'auto',target_value:normalized.targetValue===''||normalized.targetValue==null?null:Number(normalized.targetValue),direction:normalized.direction||'context'}
 if(isDemoDataEnvironment()){
  const rows=loadIndicatorDefinitionsLocal()
  const actor='demo-user'
  let saved
  const index=normalized.id?rows.findIndex(row=>row.id===normalized.id):-1
  if(index>=0){
   saved=Object.assign(rows[index],payload,{approved_by:activating?actor:rows[index].approved_by,approved_at:activating?new Date().toISOString():rows[index].approved_at})
  }else{
   saved={id:demoId(),...payload,created_by:actor,approved_by:activating?actor:null,approved_at:activating?new Date().toISOString():null}
   rows.push(saved)
  }
  saveIndicatorDefinitionsLocal(rows)
  return toDefinition(saved)
 }
 assertCloud(organizationId,{system:normalized.system})
 const {data:{user}}=await supabase.auth.getUser();const actor=user?.id||null
 const cloudPayload={...payload,approved_by:activating?actor:null,approved_at:activating?new Date().toISOString():null}
 if(!isUuid(normalized.id))cloudPayload.created_by=actor
 let query=isUuid(normalized.id)?supabase.from('indicator_definitions').update(cloudPayload).eq('id',normalized.id):supabase.from('indicator_definitions').insert(cloudPayload)
 if(normalized.system&&isUuid(normalized.id))query=query.is('organization_id',null);else if(isUuid(normalized.id))query=query.eq('organization_id',organizationId)
 const {data,error}=await query.select(select).single();if(error)throw error;return toDefinition(data)
}

export async function deleteIndicatorDefinition(organizationId,item){
 if(isDemoDataEnvironment()){
  saveIndicatorDefinitionsLocal(loadIndicatorDefinitionsLocal().filter(row=>row.id!==item?.id))
  return
 }
 assertCloud(organizationId,{system:item?.system})
 if(!isUuid(item?.id))throw new Error('Indicator definition is required.')
 let query=supabase.from('indicator_definitions').delete().eq('id',item.id)
 query=item.system?query.is('organization_id',null):query.eq('organization_id',organizationId)
 const {error}=await query;if(error)throw error
}

export async function retireIndicatorDefinition(organizationId,item){
 if(isDemoDataEnvironment()){
  const rows=loadIndicatorDefinitionsLocal();const row=rows.find(r=>r.id===item?.id)
  if(row){row.status='retired';saveIndicatorDefinitionsLocal(rows)}
  return
 }
 assertCloud(organizationId,{system:item?.system});if(!isUuid(item?.id))return;let query=supabase.from('indicator_definitions').update({status:'retired'}).eq('id',item.id);query=item.system?query.is('organization_id',null):query.eq('organization_id',organizationId);const {error}=await query;if(error)throw error
}
