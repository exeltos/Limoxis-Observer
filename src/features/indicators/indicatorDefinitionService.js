import { supabase } from '../../core/supabase/client'

export const INDICATOR_METRICS=Object.freeze([
 'patient_days','active_surveillance','resistant_active_surveillance','hh_compliant_actions','hh_opportunities','bundle_all_or_none_pass','bundle_executions','abhr_litres','active_staff','active_staff_with_vaccination','training_completed','training_assignments','open_high_incidents','mdro_bsi',
])

export const INDICATOR_RATIO_RULES=Object.freeze({
 resistant_active_surveillance:{active_surveillance:{multiplier:100,unit:'%'}},
 hh_compliant_actions:{hh_opportunities:{multiplier:100,unit:'%'}},
 bundle_all_or_none_pass:{bundle_executions:{multiplier:100,unit:'%'}},
 active_staff_with_vaccination:{active_staff:{multiplier:100,unit:'%'}},
 training_completed:{training_assignments:{multiplier:100,unit:'%'}},
 mdro_bsi:{patient_days:{multiplier:1000,unit:'/1.000 patient-days'}},
 abhr_litres:{patient_days:{multiplier:1000,unit:'L/1.000 patient-days'}},
})

export function allowedIndicatorDenominators(numerator){return numerator?Object.keys(INDICATOR_RATIO_RULES[numerator]||{}):[]}
export function indicatorRatioRule(numerator,denominator){return numerator&&denominator?INDICATOR_RATIO_RULES[numerator]?.[denominator]||null:null}
export function indicatorMetricRule(numerator){const denominator=allowedIndicatorDenominators(numerator)[0]||'';const rule=indicatorRatioRule(numerator,denominator);return rule?{denominator,...rule}:null}
export function indicatorMetricCombinationIsValid(numerator,denominator){return !denominator||Boolean(indicatorRatioRule(numerator,denominator))}
export const indicatorMetricPairIsValid=indicatorMetricCombinationIsValid
export function normalizeIndicatorDefinition(item){const next={...item};if(next.calculationType!=='auto')return next;const rule=indicatorRatioRule(next.numeratorMetric,next.denominatorMetric);if(rule){next.multiplier=rule.multiplier;next.unit=rule.unit}return next}

const assertCloud=organizationId=>{if(!supabase)throw new Error('Supabase is not configured.');if(!organizationId)throw new Error('Organization is required.')}
const isUuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''))
const select='id,organization_id,indicator_key,version,title_el,title_en,category,numerator_definition,denominator_definition,numerator_metric,denominator_metric,multiplier,unit,unit_en,source_authority,effective_from,effective_to,status,calculation_type,target_value,direction,approved_at'
const toDefinition=row=>({id:row.id,organizationId:row.organization_id||null,system:row.organization_id==null,key:row.indicator_key,version:row.version,titleEl:row.title_el,category:row.category,numeratorDefinition:row.numerator_definition||{},denominatorDefinition:row.denominator_definition||{},numeratorMetric:row.numerator_metric||'',denominatorMetric:row.denominator_metric||'',multiplier:Number(row.multiplier||1),unit:row.unit||'',sourceAuthority:row.source_authority||'',effectiveFrom:row.effective_from||'',effectiveTo:row.effective_to||'',status:row.status||'draft',calculationType:row.calculation_type||'auto',targetValue:row.target_value==null?'':String(row.target_value),direction:row.direction||'context',approvedAt:row.approved_at||null})

export async function loadIndicatorDefinitions(organizationId){assertCloud(organizationId);const {data,error}=await supabase.from('indicator_definitions').select(select).or(`organization_id.eq.${organizationId},organization_id.is.null`).order('category').order('title_el');if(error)throw error;return (data||[]).map(toDefinition)}
export async function loadIndicatorDefinition(organizationId,id){assertCloud(organizationId);if(!isUuid(id))return null;const {data,error}=await supabase.from('indicator_definitions').select(select).eq('id',id).or(`organization_id.eq.${organizationId},organization_id.is.null`).maybeSingle();if(error)throw error;return data?toDefinition(data):null}

export async function saveIndicatorDefinition(organizationId,item){
 assertCloud(organizationId)
 const normalized=normalizeIndicatorDefinition(item)
 if(normalized.calculationType==='auto'&&!INDICATOR_METRICS.includes(normalized.numeratorMetric))throw new Error('Unsupported numerator metric.')
 if(normalized.denominatorMetric&&!INDICATOR_METRICS.includes(normalized.denominatorMetric))throw new Error('Unsupported denominator metric.')
 if(normalized.calculationType==='auto'&&!indicatorMetricCombinationIsValid(normalized.numeratorMetric,normalized.denominatorMetric))throw new Error('Unsupported numerator / denominator combination.')
 const {data:{user}}=await supabase.auth.getUser();const actor=user?.id||null,activating=normalized.status==='active'
 const payload={organization_id:normalized.system?null:organizationId,indicator_key:String(normalized.key||'').trim(),version:String(normalized.version||'1.0').trim(),title_el:String(normalized.titleEl||'').trim(),title_en:String(normalized.titleEl||'').trim(),category:String(normalized.category||'general').trim(),numerator_definition:normalized.numeratorDefinition||{},denominator_definition:normalized.denominatorDefinition||{},numerator_metric:normalized.calculationType==='auto'?(normalized.numeratorMetric||null):null,denominator_metric:normalized.calculationType==='auto'?(normalized.denominatorMetric||null):null,multiplier:Number(normalized.multiplier||1),unit:normalized.unit||null,unit_en:normalized.unit||null,source_authority:normalized.sourceAuthority||null,effective_from:normalized.effectiveFrom||null,effective_to:normalized.effectiveTo||null,status:normalized.status||'draft',calculation_type:normalized.calculationType||'auto',target_value:normalized.targetValue===''||normalized.targetValue==null?null:Number(normalized.targetValue),direction:normalized.direction||'context',approved_by:activating?actor:null,approved_at:activating?new Date().toISOString():null}
 if(!isUuid(normalized.id))payload.created_by=actor
 let query=isUuid(normalized.id)?supabase.from('indicator_definitions').update(payload).eq('id',normalized.id):supabase.from('indicator_definitions').insert(payload)
 if(normalized.system&&isUuid(normalized.id))query=query.is('organization_id',null);else if(isUuid(normalized.id))query=query.eq('organization_id',organizationId)
 const {data,error}=await query.select(select).single();if(error)throw error;return toDefinition(data)
}

export async function deleteIndicatorDefinition(organizationId,item){
 assertCloud(organizationId)
 if(!isUuid(item?.id))throw new Error('Indicator definition is required.')
 let query=supabase.from('indicator_definitions').delete().eq('id',item.id)
 query=item.system?query.is('organization_id',null):query.eq('organization_id',organizationId)
 const {error}=await query;if(error)throw error
}

export async function retireIndicatorDefinition(organizationId,item){assertCloud(organizationId);if(!isUuid(item?.id))return;let query=supabase.from('indicator_definitions').update({status:'retired'}).eq('id',item.id);query=item.system?query.is('organization_id',null):query.eq('organization_id',organizationId);const {error}=await query;if(error)throw error}
