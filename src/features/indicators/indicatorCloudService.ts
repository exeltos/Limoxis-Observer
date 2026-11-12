import { cloudClient } from '../../core/supabase/cloudContext'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadAccessDddTotal } from '../pharmacy/pharmacyCloudService'
import { collectIndicatorMetrics } from './indicatorEngine'
import { loadIndicatorDefinitionsLocal, loadIndicatorSnapshotsLocal, saveIndicatorSnapshotsLocal } from './indicatorStore'
import type { AnyRecord } from '../../types/featureTypes'

export interface IndicatorPeriod { from?: string | null, to?: string | null, departmentId?: string | null }
// The metric values of a period, by metric key (get_indicator_metric_snapshot or the demo engine).
export type IndicatorMetrics = Record<string, number | null | undefined>

// Supabase is configured and an organization is selected (for the types: organizationId is a string).
function assertCloud(organizationId: string|null|undefined): asserts organizationId is string{cloudClient(organizationId)}
const round=(value: unknown,digits=1)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null

export async function collectCloudIndicatorMetrics(organizationId: string|null|undefined,{from,to,departmentId=null}: IndicatorPeriod={}): Promise<IndicatorMetrics>{
 if(isDemoDataEnvironment())return collectIndicatorMetrics()
 assertCloud(organizationId)
 const {data,error}=await cloudClient().rpc('get_indicator_metric_snapshot',{p_organization_id:organizationId,p_from:from as string,p_to:to as string,p_department_id:(departmentId||null) as string})
 if(error)throw error
 // The database snapshot has no WHO AWaRe split: the Access DDD comes from the dispensing records.
 const metrics=(data||{}) as IndicatorMetrics
 if(metrics.aware_access_ddd_total==null)metrics.aware_access_ddd_total=await loadAccessDddTotal(organizationId,{from,to}).catch(()=>0)
 return metrics
}

function mapOperationalDefinition(r: AnyRecord): AnyRecord{
 return {definitionId:r.id,id:r.indicator_key,version:r.version,titleEl:r.title_el,titleEn:r.title_en,category:r.category,numerator:r.numerator_metric,denominator:r.denominator_metric,multiplier:Number(r.multiplier||1),unit:r.unit||'',unitEn:r.unit_en||r.unit||'',source:r.source_authority||'',calculation:r.calculation_type||'auto',target:r.target_value==null?null:Number(r.target_value),direction:r.direction||'context',numeratorDefinition:r.numerator_definition||{},denominatorDefinition:r.denominator_definition||{},visibleDepartmentIds:Array.isArray(r.visible_department_ids)?r.visible_department_ids:[]}
}

export async function loadOperationalIndicatorDefinitions(organizationId: string|null|undefined,{from,to}: IndicatorPeriod={}): Promise<AnyRecord[]>{
 if(isDemoDataEnvironment()){
  const off=await loadDisabledIndicatorKeys(organizationId)
  return loadIndicatorDefinitionsLocal()
   .filter(r=>r.status==='active')
   .filter(r=>!off.has(r.indicator_key))
   .filter(r=>!from||!r.effective_to||r.effective_to>=from)
   .filter(r=>!to||!r.effective_from||r.effective_from<=to)
   .map(mapOperationalDefinition)
 }
 assertCloud(organizationId)
 let query=cloudClient().from('indicator_definitions').select('id,organization_id,indicator_key,version,title_el,title_en,category,numerator_definition,denominator_definition,multiplier,unit,unit_en,source_authority,effective_from,effective_to,status,calculation_type,numerator_metric,denominator_metric,target_value,direction,visible_department_ids').or(`organization_id.eq.${organizationId},organization_id.is.null`).eq('status','active').order('category').order('title_el')
 if(from)query=query.or(`effective_to.is.null,effective_to.gte.${from}`)
 if(to)query=query.or(`effective_from.is.null,effective_from.lte.${to}`)
 const {data,error}=await query;if(error)throw error
 const rows=data||[],localKeys=new Set(rows.filter(r=>r.organization_id).map(r=>r.indicator_key))
 // A shared indicator the hospital has switched off stays in Management only.
 const off=await loadDisabledIndicatorKeys(organizationId).catch(()=>new Set<string>())
 return rows.filter(r=>r.organization_id||!localKeys.has(r.indicator_key)).filter(r=>r.organization_id||!off.has(r.indicator_key)).map(mapOperationalDefinition)
}

// Which shared indicators each hospital uses (organization_indicator_settings; no row = in use).
const DEMO_SETTINGS_KEY='limoxis.demo.indicatorSettings'
const readDemoSettings=()=>{try{return JSON.parse(window.localStorage.getItem(DEMO_SETTINGS_KEY)||'{}')}catch{return {}}}
export async function loadDisabledIndicatorKeys(organizationId: string|null|undefined): Promise<Set<string>>{
 if(isDemoDataEnvironment())return new Set(Object.entries(readDemoSettings()).filter(([,enabled])=>enabled===false).map(([key])=>key))
 assertCloud(organizationId)
 const {data,error}=await cloudClient().from('organization_indicator_settings').select('indicator_key').eq('organization_id',organizationId).eq('enabled',false)
 if(error)throw error
 return new Set((data||[]).map(row=>row.indicator_key))
}
export async function saveIndicatorEnabled(organizationId: string|null|undefined,indicatorKey: string,enabled: boolean){
 if(isDemoDataEnvironment()){const next={...readDemoSettings(),[indicatorKey]:enabled};try{window.localStorage.setItem(DEMO_SETTINGS_KEY,JSON.stringify(next))}catch{/* the demo keeps it for the page */}return}
 assertCloud(organizationId)
 const {error}=await cloudClient().from('organization_indicator_settings').upsert({organization_id:organizationId,indicator_key:indicatorKey,enabled,updated_at:new Date().toISOString()},{onConflict:'organization_id,indicator_key'})
 if(error)throw error
}

// An indicator with a non-empty visibleDepartmentIds is only relevant to
// those departments. An org-wide "whole hospital" view (no department
// selected) still sees everything, since that view is for admins/overseers;
// the restriction only applies once a specific department is being viewed
// (either because the viewer is department-scoped, or an org admin picked
// a department filter), so it mirrors what that department would see.
export function visibleForDepartment(def: AnyRecord,departmentId: string|null|undefined): boolean{
 return !def.visibleDepartmentIds?.length||!departmentId||def.visibleDepartmentIds.includes(departmentId)
}

const metricValue=(metrics: IndicatorMetrics,key: string|null|undefined)=>key?metrics[key]:null
// Consumption quantities: 0 litres / 0 DDD means no consumption data was entered.
const NOT_MEASURED_WHEN_ZERO=new Set(['abhr_litres','antibiotic_ddd_total','aware_access_ddd_total'])
// A count of events only means something when the source was running in the period: no laboratory results, no audits (the source's own
// count is 0) means «not measured», not «none happened». The source's count is a metric of the same snapshot; when the snapshot does not
// report it (the demo), nothing is withheld.
const SOURCE_METRIC=(key: string|null|undefined)=>/^(bacteremia_|mdr_isolation_|mdro_bsi)/.test(key||'')?'microbiology_results_in_period':key==='audit_major_findings'?'audit_answers_applicable':null
export function calculateCloudDefinition(def: AnyRecord,metrics: IndicatorMetrics): AnyRecord{
 const numerator=metricValue(metrics,def.numerator),denominator=def.denominator?metricValue(metrics,def.denominator):null
 let value: number|null=null
 if(def.calculation==='manual')value=Number.isFinite(Number(def.manualValue))?Number(def.manualValue):null
 // No value is not zero: a numerator the source never reported (or a quantity that reads 0 because nothing is recorded) means «not measured», never a result that meets the target.
 else if(numerator==null||(NOT_MEASURED_WHEN_ZERO.has(def.numerator)&&Number(numerator)===0)||(SOURCE_METRIC(def.numerator)&&Number(metrics[SOURCE_METRIC(def.numerator) as string])===0&&metrics[SOURCE_METRIC(def.numerator) as string]!=null))value=null
 else if(def.denominator)value=denominator?round(Number(numerator)/Number(denominator)*Number(def.multiplier||1),1):null
 else value=Number.isFinite(Number(numerator))?round(Number(numerator)*Number(def.multiplier||1),1):null
 const status=value==null||def.target==null?'context':def.direction==='higher'?(value>=def.target?'onTarget':'attention'):def.direction==='lower'?(value<=def.target?'onTarget':'attention'):'context'
 return {...def,value,numerator,denominator,status,evidence:def.calculation==='manual'?'manual':def.denominator?`${numerator??'—'} / ${denominator??'—'}`:`${numerator??'—'}`}
}

export async function loadIndicatorSnapshots(organizationId: string|null|undefined,{from,to,departmentId=null}: IndicatorPeriod={}): Promise<AnyRecord[]>{
 if(isDemoDataEnvironment()){
  return loadIndicatorSnapshotsLocal()
   .filter(s=>!from||s.period_start>=from)
   .filter(s=>!to||s.period_end<=to)
   .filter(s=>departmentId?s.department_id===departmentId:!s.department_id)
 }
 assertCloud(organizationId);let query=cloudClient().from('indicator_snapshots').select('*').eq('organization_id',organizationId).order('period_start',{ascending:true})
 if(from)query=query.gte('period_start',from);if(to)query=query.lte('period_end',to);query=departmentId?query.eq('department_id',departmentId):query.is('department_id',null)
 const {data,error}=await query;if(error)throw error;return data||[]
}
export async function approveIndicatorSnapshot(organizationId: string|null|undefined,snapshotId: string,notes=''){
 if(isDemoDataEnvironment()){
  const snapshots=loadIndicatorSnapshotsLocal();const current=snapshots.find(s=>s.id===snapshotId)
  if(!current)throw new Error('Snapshot not found.')
  const now=new Date().toISOString()
  current.status='approved';current.reviewed_at=now;current.reviewed_by='demo-user';current.notes=notes||null;current.updated_at=now
  saveIndicatorSnapshotsLocal(snapshots)
  return {...current}
 }
 assertCloud(organizationId);const {data:{user}}=await cloudClient().auth.getUser();const now=new Date().toISOString();const {data,error}=await cloudClient().from('indicator_snapshots').update({status:'approved',reviewed_at:now,reviewed_by:user?.id||null,notes:notes||null,updated_at:now}).eq('organization_id',organizationId).eq('id',snapshotId).select('*').single();if(error)throw error;return data
}
