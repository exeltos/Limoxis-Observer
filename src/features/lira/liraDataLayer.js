import { supabase } from '../../core/supabase/client'
import { surveillanceDemoData } from '../surveillance/surveillanceDemoData'
import { laboratorySamples } from '../laboratory/laboratoryDemoData'
import { handHygieneRows,bundleRows } from '../prevention/preventionDemoData'
import { qualityIncidents,qualityCapas } from '../quality/qualityDemoData'

/**
 * LIRA data access contract.
 *
 * LIRA never bypasses product authorization. Production reads use the signed-in
 * Supabase client, so tenant / role / department restrictions remain enforced by
 * the same RLS policies as the source modules. The adapter also applies the
 * active organization filter defensively and only returns fields required for
 * operational decision support.
 */
export const LIRA_DATA_DOMAINS = Object.freeze([
  'surveillance','laboratory','patients','prevention','quality','training','committees','documents','indicators',
])

export function createLiraContext({actor,scope,domains={}}={}){
  return {actor:actor||null,scope:scope||null,domains:Object.fromEntries(LIRA_DATA_DOMAINS.map(key=>[key,domains[key]||[]])),generatedAt:new Date().toISOString()}
}

export function assertLiraScope(context){
  if(!context?.actor||!context?.scope) return {safe:false,reason:'missing_actor_scope'}
  return {safe:true,reason:null}
}

export async function loadLiraData({isDemo=false,organizationId=null}={}){
  if(isDemo)return {surveillance:surveillanceDemoData,laboratory:laboratorySamples,handHygiene:handHygieneRows,bundles:bundleRows,qualityIncidents,qualityCapas,patientDays:[],generatedAt:new Date().toISOString(),source:'demo'}
  if(!supabase||!organizationId) throw new Error('LIRA_CONTEXT_NOT_AVAILABLE')

  const q=(table,columns)=>supabase.from(table).select(columns).eq('organization_id',organizationId).limit(500)
  const [departmentsRes,patientsRes,casesRes,reassessmentsRes,isolationRes,samplesRes,resultsRes,handRes,bundleRes,incidentRes,capaRes,patientDaysRes]=await Promise.all([
    q('departments','id,name,code'),q('patients','id,patient_code,first_name,last_name,department_id,status'),q('surveillance_cases','id,patient_id,department_id,status,started_at,closed_at'),q('surveillance_reassessments','id,surveillance_case_id,reassessed_at,next_review_due_at'),q('isolation_episodes','id,surveillance_case_id,review_due_at,status'),q('laboratory_samples','id,patient_id,surveillance_case_id,department_id,sample_code,sample_type,status,collected_at'),q('microbiology_results','id,sample_id,result_status,organism,resistance_class,is_critical,critical_communicated_at,resulted_at,validation_status'),q('hand_hygiene_sessions','id,department_id,observation_date,observations,compliant_observations,status'),q('prevention_bundle_assessments','id,department_id,bundle_key,assessment_date,score,criteria,status'),q('quality_incidents','id,code,title,department_id,occurred_at,severity,status'),q('quality_capa_actions','id,code,title,department_id,due_date,priority,status'),q('patient_days','id,department_id,census_date,patient_days,source,review_status'),
  ])
  const responses=[departmentsRes,patientsRes,casesRes,reassessmentsRes,isolationRes,samplesRes,resultsRes,handRes,bundleRes,incidentRes,capaRes,patientDaysRes]
  const failed=responses.find(x=>x.error);if(failed?.error)throw failed.error
  const departments=new Map((departmentsRes.data||[]).map(x=>[x.id,x.name||x.code||'—']))
  const patients=new Map((patientsRes.data||[]).map(x=>[x.id,x]));const samples=samplesRes.data||[];const results=resultsRes.data||[];const sampleById=new Map(samples.map(x=>[x.id,x]));const resultsBySample=new Map()
  for(const result of results){const current=resultsBySample.get(result.sample_id)||[];current.push(result);resultsBySample.set(result.sample_id,current)}
  const patientName=(patientId)=>{const p=patients.get(patientId);return p?[p.first_name,p.last_name].filter(Boolean).join(' ')||p.patient_code:'—'}
  const latest=(rows,dateKey)=>[...rows].sort((a,b)=>String(b?.[dateKey]||'').localeCompare(String(a?.[dateKey]||'')))[0]||null

  const surveillance=(casesRes.data||[]).map(row=>{const caseSamples=samples.filter(x=>x.surveillance_case_id===row.id);const caseResults=caseSamples.flatMap(x=>resultsBySample.get(x.id)||[]);const latestResult=latest(caseResults,'resulted_at');const reviews=(reassessmentsRes.data||[]).filter(x=>x.surveillance_case_id===row.id);const latestReview=latest(reviews,'reassessed_at');const isolations=(isolationRes.data||[]).filter(x=>x.surveillance_case_id===row.id&&x.status==='active');return {id:row.id,state:row.status==='active'?'active':row.status,department:departments.get(row.department_id)||'—',patient:patientName(row.patient_id),resistance:caseResults.some(x=>Boolean(x.resistance_class)),resistanceClass:latestResult?.resistance_class||null,organism:latestResult?.organism||null,reviewDue:latestReview?.next_review_due_at||latest(isolations,'review_due_at')?.review_due_at||null,startedAt:row.started_at,signalDate:latestResult?.resulted_at||latestReview?.reassessed_at||row.started_at}}
  )
  const laboratory=results.map(result=>{const sample=sampleById.get(result.sample_id);return {id:sample?.id||result.id,resultId:result.id,patient:patientName(sample?.patient_id),department:departments.get(sample?.department_id)||'—',organism:result.organism||null,result:result.result_status,resistance:result.resistance_class||null,critical:Boolean(result.is_critical),communications:result.critical_communicated_at?[{at:result.critical_communicated_at}]:[],collectedAt:sample?.collected_at||null,resultedAt:result.resulted_at||null,signalDate:result.resulted_at||sample?.collected_at||null}}
  )
  const handHygiene=(handRes.data||[]).filter(x=>x.status!=='draft').map(row=>{const observations=Number(row.observations)||0;const compliant=Number(row.compliant_observations)||0;return {id:row.id,departmentEl:departments.get(row.department_id)||'—',departmentEn:departments.get(row.department_id)||'—',observations,rate:observations?Math.round(compliant/observations*100):0,date:row.observation_date,signalDate:row.observation_date}}
  )
  const bundles=(bundleRes.data||[]).filter(x=>x.status!=='draft').map(row=>{const criteria=Array.isArray(row.criteria)?row.criteria:[];const failedCount=criteria.filter(item=>item&&(item.compliant===false||item.passed===false||item.value===false)).length;const score=Number(row.score)||0;return {id:row.id,departmentEl:departments.get(row.department_id)||'—',departmentEn:departments.get(row.department_id)||'—',bundle:row.bundle_key,score,failedCount,allOrNone:criteria.length?failedCount===0:score>=100,date:row.assessment_date,signalDate:row.assessment_date}}
  )
  const qualityIncidentsRows=(incidentRes.data||[]).map(row=>({id:row.id,title:row.title,department:departments.get(row.department_id)||'—',severity:row.severity,status:row.status,date:row.occurred_at,signalDate:row.occurred_at}))
  const qualityCapaRows=(capaRes.data||[]).map(row=>({id:row.id,title:row.title,department:departments.get(row.department_id)||'—',status:row.status,dueDate:row.due_date,priority:row.priority,signalDate:row.due_date}))
  const patientDayRows=(patientDaysRes.data||[]).filter(row=>row.review_status!=='rejected').map(row=>({id:row.id,department:departments.get(row.department_id)||'—',date:row.census_date,patientDays:Number(row.patient_days)||0,source:row.source||null,reviewStatus:row.review_status||null,signalDate:row.census_date}))
  return {surveillance,laboratory,handHygiene,bundles,qualityIncidents:qualityIncidentsRows,qualityCapas:qualityCapaRows,patientDays:patientDayRows,generatedAt:new Date().toISOString(),source:'production'}
}
