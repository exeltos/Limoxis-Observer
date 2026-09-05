import { supabase } from '../../core/supabase/client'

const assertCloud=organizationId=>{if(!supabase)throw new Error('Supabase is not configured.');if(!organizationId)throw new Error('Organization is required.')}
const isUuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''))
const select='id,organization_id,indicator_key,version,title_el,title_en,category,numerator_definition,denominator_definition,numerator_metric,denominator_metric,multiplier,unit,unit_en,source_authority,effective_from,effective_to,status,calculation_type,target_value,direction,approved_at'
const toDefinition=row=>({id:row.id,organizationId:row.organization_id||null,system:row.organization_id==null,key:row.indicator_key,version:row.version,titleEl:row.title_el,category:row.category,numeratorDefinition:row.numerator_definition||{},denominatorDefinition:row.denominator_definition||{},numeratorMetric:row.numerator_metric||'',denominatorMetric:row.denominator_metric||'',multiplier:Number(row.multiplier||1),unit:row.unit||'',sourceAuthority:row.source_authority||'',effectiveFrom:row.effective_from||'',effectiveTo:row.effective_to||'',status:row.status||'draft',calculationType:row.calculation_type||'auto',targetValue:row.target_value==null?'':String(row.target_value),direction:row.direction||'context',approvedAt:row.approved_at||null})

export async function loadIndicatorDefinitions(organizationId){assertCloud(organizationId);const {data,error}=await supabase.from('indicator_definitions').select(select).or(`organization_id.eq.${organizationId},organization_id.is.null`).order('category').order('title_el');if(error)throw error;return (data||[]).map(toDefinition)}

export async function saveIndicatorDefinition(organizationId,item){
 assertCloud(organizationId)
 const {data:{user}}=await supabase.auth.getUser();const actor=user?.id||null,activating=item.status==='active'
 const payload={organization_id:item.system?null:organizationId,indicator_key:String(item.key||'').trim(),version:String(item.version||'1.0').trim(),title_el:String(item.titleEl||'').trim(),title_en:String(item.titleEl||'').trim(),category:String(item.category||'general').trim(),numerator_definition:item.numeratorDefinition||{},denominator_definition:item.denominatorDefinition||{},numerator_metric:item.calculationType==='auto'?(item.numeratorMetric||null):null,denominator_metric:item.calculationType==='auto'?(item.denominatorMetric||null):null,multiplier:Number(item.multiplier||1),unit:item.unit||null,unit_en:item.unit||null,source_authority:item.sourceAuthority||null,effective_from:item.effectiveFrom||null,effective_to:item.effectiveTo||null,status:item.status||'draft',calculation_type:item.calculationType||'auto',target_value:item.targetValue===''||item.targetValue==null?null:Number(item.targetValue),direction:item.direction||'context',approved_by:activating?actor:null,approved_at:activating?new Date().toISOString():null}
 if(!isUuid(item.id))payload.created_by=actor
 let query=isUuid(item.id)?supabase.from('indicator_definitions').update(payload).eq('id',item.id):supabase.from('indicator_definitions').insert(payload)
 if(item.system&&isUuid(item.id))query=query.is('organization_id',null);else if(isUuid(item.id))query=query.eq('organization_id',organizationId)
 const {data,error}=await query.select(select).single();if(error)throw error;return toDefinition(data)
}

export async function retireIndicatorDefinition(organizationId,item){assertCloud(organizationId);if(!isUuid(item?.id))return;let query=supabase.from('indicator_definitions').update({status:'retired'}).eq('id',item.id);query=item.system?query.is('organization_id',null):query.eq('organization_id',organizationId);const {error}=await query;if(error)throw error}
