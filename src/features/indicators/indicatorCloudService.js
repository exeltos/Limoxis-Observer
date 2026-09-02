import { supabase } from '../../core/supabase/client'

const assertCloud=organizationId=>{if(!supabase)throw new Error('Supabase is not configured.');if(!organizationId)throw new Error('Organization is required.')}
const round=(value,digits=1)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null
const inPeriod=(query,column,from,to)=>query.gte(column,from).lte(column,to)
const scopeDepartment=(query,departmentId)=>departmentId?query.eq('department_id',departmentId):query

async function countRows(table,organizationId,{from,to,dateColumn,departmentId,extra}={}){
 let query=supabase.from(table).select('id',{count:'exact',head:true}).eq('organization_id',organizationId)
 if(dateColumn&&from)query=query.gte(dateColumn,from)
 if(dateColumn&&to)query=query.lte(dateColumn,`${to}T23:59:59.999Z`)
 if(departmentId)query=query.eq('department_id',departmentId)
 if(extra)query=extra(query)
 const {count,error}=await query;if(error)throw error;return count||0
}

async function patientDays(organizationId,{from,to,departmentId}){
 let daily=supabase.from('patient_days').select('patient_days').eq('organization_id',organizationId)
 daily=inPeriod(daily,'census_date',from,to);daily=scopeDepartment(daily,departmentId)
 const {data:dailyRows,error:dailyError}=await daily;if(dailyError)throw dailyError
 if(dailyRows?.length)return dailyRows.reduce((sum,row)=>sum+Number(row.patient_days||0),0)
 let periods=supabase.from('patient_day_periods').select('patient_days').eq('organization_id',organizationId).lte('period_start',to).gte('period_end',from)
 periods=scopeDepartment(periods,departmentId)
 const {data,error}=await periods;if(error)throw error
 return (data||[]).reduce((sum,row)=>sum+Number(row.patient_days||0),0)
}

async function mdroBloodstreamCount(organizationId,{from,to,departmentId}){
 let samples=supabase.from('laboratory_samples').select('id').eq('organization_id',organizationId).gte('collected_at',`${from}T00:00:00Z`).lte('collected_at',`${to}T23:59:59.999Z`)
 if(departmentId)samples=samples.eq('department_id',departmentId)
 const {data:sampleRows,error:sampleError}=await samples;if(sampleError)throw sampleError
 const sampleIds=(sampleRows||[]).map(row=>row.id);if(!sampleIds.length)return 0
 const {data:micro,error:microError}=await supabase.from('microbiology_results').select('id,sample_id,result_status,resistance_class').eq('organization_id',organizationId).in('sample_id',sampleIds).eq('result_status','positive')
 if(microError)throw microError
 const direct=(micro||[]).filter(row=>['MDR','XDR','PDR'].includes(String(row.resistance_class||'').toUpperCase()))
 const ids=(micro||[]).map(row=>row.id);if(!ids.length)return direct.length
 const {data:amr,error:amrError}=await supabase.from('amr_classifications').select('microbiology_result_id,classification,status').eq('organization_id',organizationId).in('microbiology_result_id',ids)
 if(amrError)throw amrError
 const classified=new Set((amr||[]).filter(row=>row.status!=='rejected'&&['MDR','XDR','PDR'].includes(String(row.classification||'').toUpperCase())).map(row=>row.microbiology_result_id))
 direct.forEach(row=>classified.add(row.id));return classified.size
}

export async function collectCloudIndicatorMetrics(organizationId,{from,to,departmentId=null}){
 assertCloud(organizationId)
 const [patientDayValue,activeSurveillance,resistantSurveillance,hhRows,bundleRows,antisepticRows,activeStaff,vaccinations,trainingRows,highIncidents,mdroBsi]=await Promise.all([
  patientDays(organizationId,{from,to,departmentId}),
  countRows('surveillance_cases',organizationId,{from,to,dateColumn:'started_at',departmentId,extra:q=>q.eq('status','active')}),
  countRows('surveillance_cases',organizationId,{from,to,dateColumn:'started_at',departmentId,extra:q=>q.eq('status','active').not('resistance_status','is',null)}),
  (()=>{let q=supabase.from('hand_hygiene_sessions').select('observations,compliant_observations').eq('organization_id',organizationId).eq('status','completed');q=inPeriod(q,'observation_date',from,to);return scopeDepartment(q,departmentId)})(),
  (()=>{let q=supabase.from('prevention_bundle_assessments').select('score').eq('organization_id',organizationId).eq('status','completed');q=inPeriod(q,'assessment_date',from,to);return scopeDepartment(q,departmentId)})(),
  (()=>{let q=supabase.from('antiseptic_consumption_periods').select('litres').eq('organization_id',organizationId).lte('period_start',to).gte('period_end',from);return scopeDepartment(q,departmentId)})(),
  countRows('employees',organizationId,{departmentId,extra:q=>q.eq('employment_status','active')}),
  supabase.from('employee_vaccinations').select('employee_id').eq('organization_id',organizationId).gte('vaccination_date',from).lte('vaccination_date',to),
  supabase.from('employee_training_summary').select('employee_id,status').eq('organization_id',organizationId).gte('training_date',from).lte('training_date',to),
  countRows('quality_incidents',organizationId,{from,to,dateColumn:'occurred_at',departmentId,extra:q=>q.eq('severity','high').neq('status','closed')}),
  mdroBloodstreamCount(organizationId,{from,to,departmentId}),
 ])
 for(const result of [hhRows,bundleRows,antisepticRows,vaccinations,trainingRows])if(result.error)throw result.error
 const hh=hhRows.data||[],bundles=bundleRows.data||[],antiseptics=antisepticRows.data||[],training=trainingRows.data||[]
 const hhOpp=hh.reduce((s,row)=>s+Number(row.observations||0),0),hhOk=hh.reduce((s,row)=>s+Number(row.compliant_observations||0),0)
 const vaccinated=new Set((vaccinations.data||[]).map(row=>row.employee_id))
 return {
  active_surveillance:activeSurveillance,resistant_active_surveillance:resistantSurveillance,
  hh_compliant_actions:hhOk,hh_opportunities:hhOpp,
  bundle_all_or_none_pass:bundles.filter(row=>Number(row.score)>=100).length,bundle_executions:bundles.length,
  abhr_litres:round(antiseptics.reduce((s,row)=>s+Number(row.litres||0),0),2),abhr_patient_days:patientDayValue,
  training_completed:training.filter(row=>row.status==='completed').length,training_assignments:training.length,
  active_staff:activeStaff,active_staff_with_vaccination:vaccinated.size,
  open_high_incidents:highIncidents,mdro_bsi:mdroBsi,patient_days:patientDayValue,
 }
}

const metricAlias={compliant_hh_actions:'hh_compliant_actions',completed_training_assignments:'training_completed',active_staff_with_vaccination_record:'active_staff_with_vaccination'}
const metricValue=(metrics,key)=>metrics[metricAlias[key]||key]
export function calculateCloudDefinition(def,metrics){
 const numerator=metricValue(metrics,def.numerator),denominator=def.denominator?metricValue(metrics,def.denominator):null
 let value=null
 if(def.calculation==='manual')value=Number.isFinite(Number(def.manualValue))?Number(def.manualValue):null
 else if(def.denominator)value=denominator?round(Number(numerator||0)/Number(denominator)*Number(def.multiplier||1),1):null
 else value=Number.isFinite(Number(numerator))?round(Number(numerator)*Number(def.multiplier||1),1):null
 const status=value==null||def.target==null?'context':def.direction==='higher'?(value>=def.target?'onTarget':'attention'):def.direction==='lower'?(value<=def.target?'onTarget':'attention'):'context'
 return {...def,value,numerator,denominator,status,evidence:def.denominator?`${numerator??'—'} / ${denominator??'—'}`:`${numerator??'—'}`}
}

export async function loadIndicatorSnapshots(organizationId,{from,to,departmentId=null}={}){
 assertCloud(organizationId);let query=supabase.from('indicator_snapshots').select('*').eq('organization_id',organizationId).order('period_start',{ascending:true})
 if(from)query=query.gte('period_start',from);if(to)query=query.lte('period_end',to);query=departmentId?query.eq('department_id',departmentId):query.is('department_id',null)
 const {data,error}=await query;if(error)throw error;return data||[]
}

async function findExistingSnapshot(organizationId,row,{from,to,departmentId}){
 let query=supabase.from('indicator_snapshots').select('id').eq('organization_id',organizationId).eq('indicator_key',row.id).eq('period_start',from).eq('period_end',to)
 query=departmentId?query.eq('department_id',departmentId):query.is('department_id',null)
 const {data,error}=await query.maybeSingle();if(error)throw error;return data?.id||null
}

export async function saveIndicatorSnapshots(organizationId,rows,{from,to,departmentId=null}={}){
 assertCloud(organizationId);const {data:{user}}=await supabase.auth.getUser();const now=new Date().toISOString();const saved=[]
 for(const row of (rows||[]).filter(item=>item.value!=null)){
  const payload={organization_id:organizationId,indicator_key:row.id,definition_id:/^[0-9a-f-]{36}$/i.test(String(row.definitionId||''))?row.definitionId:null,department_id:departmentId||null,period_start:from,period_end:to,numerator:row.numerator??null,denominator:row.denominator??null,value:row.value,unit:row.unit||null,target_value:row.target??null,direction:row.direction||'context',calculation_type:row.calculation||'auto',source_snapshot:{source:row.source||'',version:row.version||'',evidence:row.evidence||''},status:'calculated',calculated_at:now,calculated_by:user?.id||null,updated_at:now}
  const existingId=await findExistingSnapshot(organizationId,row,{from,to,departmentId})
  const request=existingId?supabase.from('indicator_snapshots').update(payload).eq('id',existingId):supabase.from('indicator_snapshots').insert(payload)
  const {data,error}=await request.select('*').single();if(error)throw error;saved.push(data)
 }
 return saved
}
