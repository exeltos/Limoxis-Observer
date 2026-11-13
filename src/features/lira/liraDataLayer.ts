import { supabase } from '../../core/supabase/client'
import type { LiraAst, LiraCapaRow, LiraData, LiraDeviceRow, LiraHaiRow, LiraIncidentRow, LiraLabRow } from './liraTypes'
import { surveillanceDemoData } from '../surveillance/surveillanceDemoData'
import { laboratorySamples } from '../laboratory/laboratoryDemoData'
import { handHygieneRows,bundleRows } from '../prevention/preventionDemoData'
import { qualityIncidents,qualityCapas } from '../quality/qualityDemoData'
import { collectDeviceDaySources } from '../surveillance/deviceDayIndicators'

/**
 * LIRA data access contract.
 *
 * LIRA never bypasses product authorization. Production reads use the signed-in
 * Supabase client, so tenant / role / department restrictions remain enforced by
 * the same RLS policies as the source modules. The adapter also applies the
 * active organization filter defensively and only returns fields required for
 * operational decision support.
 */

function bundleSignals(criteria: unknown,score: number){
  if(Array.isArray(criteria)){
    const failedCount=criteria.filter((item: {compliant?: unknown, passed?: unknown, value?: unknown}|null)=>item&&(item.compliant===false||item.passed===false||item.value===false)).length
    return {failedCount,allOrNone:criteria.length?failedCount===0:Number(score)>=100}
  }
  const bundle=criteria as {answers?: Record<string, unknown>}|null
  const answers=bundle?.answers&&typeof bundle.answers==='object'?bundle.answers:{}
  const applicable=Object.values(answers).filter(value=>value==='yes'||value==='no')
  const failedCount=applicable.filter(value=>value==='no').length
  return {failedCount,allOrNone:applicable.length?failedCount===0:Number(score)>=100}
}

export async function loadLiraData({isDemo=false,organizationId=null}: {isDemo?: boolean; organizationId?: string|null}={}): Promise<LiraData>{
  // surveillanceDemoData's own field is `status` (matching the real
  // surveillance_cases.status column and SurveillancePage's expectations).
  // LIRA's production mapping below normalizes that into its own `state`
  // field; do the same for demo so LIRA's consumers keep working.
  if(isDemo){const {devices,haiClassifications}=collectDeviceDaySources();return {surveillance:surveillanceDemoData.map(row=>({...row,state:row.status})),laboratory:laboratorySamples as unknown as LiraLabRow[],handHygiene:handHygieneRows,bundles:bundleRows,qualityIncidents:qualityIncidents as unknown as LiraIncidentRow[],qualityCapas:qualityCapas as unknown as LiraCapaRow[],patientDays:[],haiClassifications:haiClassifications as LiraHaiRow[],devices:devices as LiraDeviceRow[],isolations:[],generatedAt:new Date().toISOString(),source:'demo',provenance:{mode:'demo',surveillance:'surveillanceDemoData',laboratory:'laboratoryDemoData',prevention:'preventionDemoData',quality:'qualityDemoData',haiClassifications:'demo device-day sources',devices:'demo device-day sources'}}}
  if(!supabase||!organizationId) throw new Error('LIRA_CONTEXT_NOT_AVAILABLE')

  const db=supabase,org=organizationId
  const [departmentsRes,patientsRes,casesRes,reassessmentsRes,isolationRes,samplesRes,resultsRes,astRes,handRes,bundleRes,incidentRes,capaRes,patientDayPeriodsRes,haiRes,devicesRes]=await Promise.all([
    db.from('departments').select('id,name,code').eq('organization_id',org).limit(500),db.from('patients').select('id,patient_code,first_name,last_name,department_id,status').eq('organization_id',org).limit(500),db.from('surveillance_cases').select('id,patient_id,department_id,status,started_at,closed_at').eq('organization_id',org).limit(500),db.from('surveillance_reassessments').select('id,surveillance_case_id,reassessed_at,next_review_due_at').eq('organization_id',org).limit(500),db.from('isolation_episodes').select('id,surveillance_case_id,patient_id,started_at,ended_at,review_due_at,status').eq('organization_id',org).limit(500),db.from('laboratory_samples').select('id,patient_id,surveillance_case_id,department_id,sample_code,sample_type,status,collected_at').eq('organization_id',org).limit(500),db.from('microbiology_results').select('id,sample_id,result_status,organism,resistance_class,is_critical,critical_communicated_at,resulted_at,validation_status').eq('organization_id',org).limit(500),db.from('antimicrobial_susceptibility_results').select('id,microbiology_result_id,antimicrobial_code,antimicrobial_name,method,mic_value,mic_operator,zone_diameter_mm,sir_category,breakpoint_standard,breakpoint_version,technical_uncertainty').eq('organization_id',org).limit(500),db.from('hand_hygiene_sessions').select('id,department_id,observation_date,observations,compliant_observations,status').eq('organization_id',org).limit(500),db.from('prevention_bundle_assessments').select('id,department_id,bundle_key,assessment_date,score,criteria,status').eq('organization_id',org).limit(500),db.from('quality_incidents').select('id,code,title,department_id,occurred_at,severity,status').eq('organization_id',org).limit(500),db.from('quality_capa_actions').select('id,code,title,department_id,due_date,priority,status').eq('organization_id',org).limit(500),db.from('patient_day_periods').select('id,department_id,period_start,period_end,patient_days,source,source_reference,review_status').eq('organization_id',org).limit(500),db.from('hai_classifications').select('id,surveillance_case_id,patient_id,case_status,hai_type,definition_set,definition_version,criteria_met,classified_at').eq('organization_id',org).limit(500),db.from('surveillance_devices').select('id,surveillance_case_id,patient_id,department_id,device_type,inserted_at,removed_at,status').eq('organization_id',org).limit(500),
  ])
  const responses=[departmentsRes,patientsRes,casesRes,reassessmentsRes,isolationRes,samplesRes,resultsRes,astRes,handRes,bundleRes,incidentRes,capaRes,patientDayPeriodsRes,haiRes,devicesRes]
  const failed=responses.find(x=>x.error);if(failed?.error)throw failed.error
  // Οι γραμμές όπως τις επιστρέφουν τα ερωτήματα (τύποι από το database.types).
  type PatientRow=NonNullable<typeof patientsRes.data>[number];type SampleRow=NonNullable<typeof samplesRes.data>[number];type ResultRow=NonNullable<typeof resultsRes.data>[number];type CaseRow=NonNullable<typeof casesRes.data>[number]
  const departments=new Map<string|null|undefined,string>((departmentsRes.data||[]).map(x=>[x.id,x.name||x.code||'—']))
  const astByResult=new Map<string,LiraAst[]>();for(const ast of astRes.data||[]){const current=astByResult.get(ast.microbiology_result_id)||[];current.push({id:ast.id,antimicrobialCode:ast.antimicrobial_code,antimicrobialName:ast.antimicrobial_name,method:ast.method,micValue:ast.mic_value,micOperator:ast.mic_operator,zoneDiameterMm:ast.zone_diameter_mm,sirCategory:ast.sir_category,breakpointStandard:ast.breakpoint_standard,breakpointVersion:ast.breakpoint_version,technicalUncertainty:ast.technical_uncertainty});astByResult.set(ast.microbiology_result_id,current)}
  const patients=new Map<string|null|undefined,PatientRow>((patientsRes.data||[]).map(x=>[x.id,x]));const samples=samplesRes.data||[];const results=resultsRes.data||[];const sampleById=new Map<string|null|undefined,SampleRow>(samples.map(x=>[x.id,x]));const resultsBySample=new Map<string|null|undefined,ResultRow[]>()
  for(const result of results){const current=resultsBySample.get(result.sample_id)||[];current.push(result);resultsBySample.set(result.sample_id,current)}
  const patientName=(patientId: string|null|undefined)=>{const p=patients.get(patientId);return p?[p.first_name,p.last_name].filter(Boolean).join(' ')||p.patient_code:'—'}
  const latest=<T extends object>(rows: T[],dateKey: keyof T)=>[...rows].sort((a,b)=>String(b?.[dateKey]||'').localeCompare(String(a?.[dateKey]||'')))[0]||null
  const casesById=new Map<string|null|undefined,CaseRow>((casesRes.data||[]).map(row=>[row.id,row]))

  const surveillance=(casesRes.data||[]).map(row=>{const caseSamples=samples.filter(x=>x.surveillance_case_id===row.id);const caseResults=caseSamples.flatMap(x=>resultsBySample.get(x.id)||[]);const latestResult=latest(caseResults,'resulted_at');const reviews=(reassessmentsRes.data||[]).filter(x=>x.surveillance_case_id===row.id);const latestReview=latest(reviews,'reassessed_at');const isolations=(isolationRes.data||[]).filter(x=>x.surveillance_case_id===row.id&&x.status==='active');return {id:row.id,state:row.status==='active'?'active':row.status,department:departments.get(row.department_id)||'—',patient:patientName(row.patient_id),resistance:caseResults.some(x=>Boolean(x.resistance_class)),resistanceClass:latestResult?.resistance_class||null,organism:latestResult?.organism||null,reviewDue:latestReview?.next_review_due_at||latest(isolations,'review_due_at')?.review_due_at||null,startedAt:row.started_at,signalDate:latestResult?.resulted_at||latestReview?.reassessed_at||row.started_at}}
  )
  const laboratory=results.map(result=>{const sample=sampleById.get(result.sample_id);return {id:sample?.id||result.id,resultId:result.id,patient:patientName(sample?.patient_id),patientCode:patients.get(sample?.patient_id)?.patient_code||null,department:departments.get(sample?.department_id)||'—',organism:result.organism||null,result:result.result_status,resistance:result.resistance_class||null,critical:Boolean(result.is_critical),communications:result.critical_communicated_at?[{at:result.critical_communicated_at}]:[],collectedAt:sample?.collected_at||null,specimenType:sample?.sample_type||null,resultedAt:result.resulted_at||null,signalDate:result.resulted_at||sample?.collected_at||null,patientId:sample?.patient_id||null,validationStatus:result.validation_status||null,ast:astByResult.get(result.id)||[]}}
  )
  const handHygiene=(handRes.data||[]).filter(x=>x.status!=='draft').map(row=>{const observations=Number(row.observations)||0;const compliant=Number(row.compliant_observations)||0;return {id:row.id,departmentEl:departments.get(row.department_id)||'—',departmentEn:departments.get(row.department_id)||'—',observations,rate:observations?Math.round(compliant/observations*100):0,date:row.observation_date,signalDate:row.observation_date}}
  )
  const bundles=(bundleRes.data||[]).filter(x=>x.status!=='draft').map(row=>{const score=Number(row.score)||0;const signals=bundleSignals(row.criteria,score);return {id:row.id,departmentEl:departments.get(row.department_id)||'—',departmentEn:departments.get(row.department_id)||'—',bundle:row.bundle_key,score,failedCount:signals.failedCount,allOrNone:signals.allOrNone,date:row.assessment_date,signalDate:row.assessment_date}}
  )
  const qualityIncidentsRows=(incidentRes.data||[]).map(row=>({id:row.id,title:row.title,department:departments.get(row.department_id)||'—',severity:row.severity,status:row.status,date:row.occurred_at,signalDate:row.occurred_at}))
  const qualityCapaRows=(capaRes.data||[]).map(row=>({id:row.id,title:row.title,department:departments.get(row.department_id)||'—',status:row.status,dueDate:row.due_date,priority:row.priority,signalDate:row.due_date}))
  const patientDayRows=(patientDayPeriodsRes.data||[]).filter(row=>row.review_status!=='rejected').map(row=>({id:row.id,department:departments.get(row.department_id)||'—',periodStart:row.period_start,periodEnd:row.period_end,patientDays:Number(row.patient_days)||0,source:row.source||null,sourceReference:row.source_reference||null,reviewStatus:row.review_status||null,signalDate:row.period_end||row.period_start}))
  const haiClassifications=(haiRes.data||[]).filter(row=>row.criteria_met!==false).map(row=>{const surveillanceCase=casesById.get(row.surveillance_case_id);return {id:row.id,caseId:row.surveillance_case_id,patientId:row.patient_id,department:departments.get(surveillanceCase?.department_id)||'—',haiType:row.hai_type,caseStatus:row.case_status,definitionSet:row.definition_set,definitionVersion:row.definition_version,criteriaMet:row.criteria_met,classifiedAt:row.classified_at,signalDate:row.classified_at}})
  const devices=(devicesRes.data||[]).map(row=>({id:row.id,caseId:row.surveillance_case_id,patientId:row.patient_id,department:departments.get(row.department_id)||'—',deviceType:row.device_type,insertedAt:row.inserted_at,removedAt:row.removed_at,status:row.status,signalDate:row.inserted_at}))
  const isolationRows=(isolationRes.data||[]).map(row=>{const surveillanceCase=casesById.get(row.surveillance_case_id);return {id:row.id,caseId:row.surveillance_case_id,patientId:row.patient_id||surveillanceCase?.patient_id||null,department:departments.get(surveillanceCase?.department_id)||'—',startedAt:row.started_at||null,endedAt:row.ended_at||null,reviewDue:row.review_due_at||null,status:row.status||null,signalDate:row.started_at||row.review_due_at||null}})
  return {surveillance,laboratory,handHygiene,bundles,qualityIncidents:qualityIncidentsRows,qualityCapas:qualityCapaRows,patientDays:patientDayRows,haiClassifications,devices,isolations:isolationRows,generatedAt:new Date().toISOString(),source:'production',provenance:{patientDays:'patient_day_periods',haiClassifications:'hai_classifications',devices:'surveillance_devices',isolations:'isolation_episodes'}}
}
