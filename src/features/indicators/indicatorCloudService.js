import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { collectIndicatorMetrics } from './indicatorEngine'
import { loadIndicatorDefinitionsLocal, loadIndicatorSnapshotsLocal, saveIndicatorSnapshotsLocal } from './indicatorStore'

const assertCloud=organizationId=>{if(!supabase)throw new Error('Supabase is not configured.');if(!organizationId)throw new Error('Organization is required.')}
const round=(value,digits=1)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null
const demoId=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`

export async function collectCloudIndicatorMetrics(organizationId,{from,to,departmentId=null}={}){
 if(isDemoDataEnvironment())return collectIndicatorMetrics()
 assertCloud(organizationId)
 const {data,error}=await supabase.rpc('get_indicator_metric_snapshot',{p_organization_id:organizationId,p_from:from,p_to:to,p_department_id:departmentId||null})
 if(error)throw error
 return data||{}
}

function mapOperationalDefinition(r){
 return {definitionId:r.id,id:r.indicator_key,version:r.version,titleEl:r.title_el,titleEn:r.title_en,category:r.category,numerator:r.numerator_metric,denominator:r.denominator_metric,multiplier:Number(r.multiplier||1),unit:r.unit||'',unitEn:r.unit_en||r.unit||'',source:r.source_authority||'',calculation:r.calculation_type||'auto',target:r.target_value==null?null:Number(r.target_value),direction:r.direction||'context',numeratorDefinition:r.numerator_definition||{},denominatorDefinition:r.denominator_definition||{}}
}

export async function loadOperationalIndicatorDefinitions(organizationId,{from,to}={}){
 if(isDemoDataEnvironment()){
  return loadIndicatorDefinitionsLocal()
   .filter(r=>r.status==='active')
   .filter(r=>!from||!r.effective_to||r.effective_to>=from)
   .filter(r=>!to||!r.effective_from||r.effective_from<=to)
   .map(mapOperationalDefinition)
 }
 assertCloud(organizationId)
 let query=supabase.from('indicator_definitions').select('id,organization_id,indicator_key,version,title_el,title_en,category,numerator_definition,denominator_definition,multiplier,unit,unit_en,source_authority,effective_from,effective_to,status,calculation_type,numerator_metric,denominator_metric,target_value,direction').or(`organization_id.eq.${organizationId},organization_id.is.null`).eq('status','active').order('category').order('title_el')
 if(from)query=query.or(`effective_to.is.null,effective_to.gte.${from}`)
 if(to)query=query.or(`effective_from.is.null,effective_from.lte.${to}`)
 const {data,error}=await query;if(error)throw error
 const rows=data||[],localKeys=new Set(rows.filter(r=>r.organization_id).map(r=>r.indicator_key))
 return rows.filter(r=>r.organization_id||!localKeys.has(r.indicator_key)).map(mapOperationalDefinition)
}

const metricValue=(metrics,key)=>key?metrics[key]:null
export function calculateCloudDefinition(def,metrics){
 const numerator=metricValue(metrics,def.numerator),denominator=def.denominator?metricValue(metrics,def.denominator):null
 let value=null
 if(def.calculation==='manual')value=Number.isFinite(Number(def.manualValue))?Number(def.manualValue):null
 else if(def.denominator)value=denominator?round(Number(numerator||0)/Number(denominator)*Number(def.multiplier||1),1):null
 else value=Number.isFinite(Number(numerator))?round(Number(numerator)*Number(def.multiplier||1),1):null
 const status=value==null||def.target==null?'context':def.direction==='higher'?(value>=def.target?'onTarget':'attention'):def.direction==='lower'?(value<=def.target?'onTarget':'attention'):'context'
 return {...def,value,numerator,denominator,status,evidence:def.calculation==='manual'?'manual':def.denominator?`${numerator??'—'} / ${denominator??'—'}`:`${numerator??'—'}`}
}

export async function loadIndicatorSnapshots(organizationId,{from,to,departmentId=null}={}){
 if(isDemoDataEnvironment()){
  return loadIndicatorSnapshotsLocal()
   .filter(s=>!from||s.period_start>=from)
   .filter(s=>!to||s.period_end<=to)
   .filter(s=>departmentId?s.department_id===departmentId:!s.department_id)
 }
 assertCloud(organizationId);let query=supabase.from('indicator_snapshots').select('*').eq('organization_id',organizationId).order('period_start',{ascending:true})
 if(from)query=query.gte('period_start',from);if(to)query=query.lte('period_end',to);query=departmentId?query.eq('department_id',departmentId):query.is('department_id',null)
 const {data,error}=await query;if(error)throw error;return data||[]
}
async function findExistingSnapshot(organizationId,row,{from,to,departmentId}){let query=supabase.from('indicator_snapshots').select('id,status').eq('organization_id',organizationId).eq('indicator_key',row.id).eq('period_start',from).eq('period_end',to);query=departmentId?query.eq('department_id',departmentId):query.is('department_id',null);const {data,error}=await query.maybeSingle();if(error)throw error;return data||null}
export async function saveIndicatorSnapshots(organizationId,rows,{from,to,departmentId=null}={}){
 if(isDemoDataEnvironment()){
  const snapshots=loadIndicatorSnapshotsLocal();const now=new Date().toISOString();const saved=[]
  for(const row of (rows||[]).filter(item=>item.value!=null)){
   const existing=snapshots.find(s=>s.indicator_key===row.id&&s.period_start===from&&s.period_end===to&&(departmentId?s.department_id===departmentId:!s.department_id))
   if(existing?.status==='approved')continue
   const payload={organization_id:organizationId,indicator_key:row.id,definition_id:row.definitionId||null,department_id:departmentId||null,period_start:from,period_end:to,numerator:row.numerator??null,denominator:row.denominator??null,value:row.value,unit:row.unit||null,target_value:row.target??null,direction:row.direction||'context',calculation_type:row.calculation||'auto',source_snapshot:{source:row.source||'',version:row.version||'',evidence:row.evidence||'',numerator_definition:row.numeratorDefinition||{},denominator_definition:row.denominatorDefinition||{}},status:'calculated',calculated_at:now,calculated_by:'demo-user',reviewed_at:null,reviewed_by:null,updated_at:now}
   if(existing){Object.assign(existing,payload);saved.push({...existing})}
   else{const created={id:demoId('ind-snap'),...payload};snapshots.push(created);saved.push({...created})}
  }
  saveIndicatorSnapshotsLocal(snapshots)
  return saved
 }
 assertCloud(organizationId);const {data:{user}}=await supabase.auth.getUser();const now=new Date().toISOString();const saved=[];for(const row of (rows||[]).filter(item=>item.value!=null)){const existing=await findExistingSnapshot(organizationId,row,{from,to,departmentId});if(existing?.status==='approved')continue;const payload={organization_id:organizationId,indicator_key:row.id,definition_id:row.definitionId||null,department_id:departmentId||null,period_start:from,period_end:to,numerator:row.numerator??null,denominator:row.denominator??null,value:row.value,unit:row.unit||null,target_value:row.target??null,direction:row.direction||'context',calculation_type:row.calculation||'auto',source_snapshot:{source:row.source||'',version:row.version||'',evidence:row.evidence||'',numerator_definition:row.numeratorDefinition||{},denominator_definition:row.denominatorDefinition||{}},status:'calculated',calculated_at:now,calculated_by:user?.id||null,reviewed_at:null,reviewed_by:null,updated_at:now};const request=existing?supabase.from('indicator_snapshots').update(payload).eq('id',existing.id):supabase.from('indicator_snapshots').insert(payload);const {data,error}=await request.select('*').single();if(error)throw error;saved.push(data)}return saved
}
export async function approveIndicatorSnapshot(organizationId,snapshotId,notes=''){
 if(isDemoDataEnvironment()){
  const snapshots=loadIndicatorSnapshotsLocal();const current=snapshots.find(s=>s.id===snapshotId)
  if(!current)throw new Error('Snapshot not found.')
  const now=new Date().toISOString()
  current.status='approved';current.reviewed_at=now;current.reviewed_by='demo-user';current.notes=notes||null;current.updated_at=now
  saveIndicatorSnapshotsLocal(snapshots)
  return {...current}
 }
 assertCloud(organizationId);const {data:{user}}=await supabase.auth.getUser();const now=new Date().toISOString();const {data,error}=await supabase.from('indicator_snapshots').update({status:'approved',reviewed_at:now,reviewed_by:user?.id||null,notes:notes||null,updated_at:now}).eq('organization_id',organizationId).eq('id',snapshotId).select('*').single();if(error)throw error;return data
}
