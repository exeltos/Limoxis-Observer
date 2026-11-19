import {cloudClient} from '../../core/supabase/cloudContext'
import type { Json, TablesUpdate } from '../../core/supabase/database.types'
import type { OutbreakCaseDefinition } from './liraOutbreakInvestigation'
import type { LiraLabRow } from './liraTypes'

// Τα στοιχεία που δίνει η οθόνη για νέα διερεύνηση, αξιολόγηση περιστατικού και διορθωτική ενέργεια.
export type NewOutbreakInvestigation = { title: string, organism?: string|null, departmentId?: string|null, definition?: OutbreakCaseDefinition|null, from?: string|null, to?: string|null }
export type NewOutbreakCaseReview = { recordKey: string, patientId?: string|null, classification: string, rationale: string, supersedesReviewId?: string|null }
export type NewOutbreakAction = { title: string, actionType?: string|null, priority?: string|null, description?: string|null, owner?: string|null, dueDate?: string|null }
export async function listOutbreakInvestigations(organizationId: string){const {data,error}=await cloudClient().from('lira_outbreak_investigations').select('*').eq('organization_id',organizationId).order('updated_at',{ascending:false});if(error)throw error;return data||[]}
export async function createOutbreakInvestigation(organizationId: string,input: NewOutbreakInvestigation){const row={organization_id:organizationId,title:input.title,organism:input.organism||null,department_id:input.departmentId||null,status:'draft',definition_id:input.definition?.id||null,definition_version:input.definition?.version||null,definition_json:input.definition||{},scope_from:input.from||null,scope_to:input.to||null};const {data,error}=await cloudClient().from('lira_outbreak_investigations').insert(row).select().single();if(error)throw error;return data}
export async function updateOutbreakInvestigation(id: string,patch: TablesUpdate<'lira_outbreak_investigations'>){const row={...patch,updated_at:new Date().toISOString()};const {data,error}=await cloudClient().from('lira_outbreak_investigations').update(row).eq('id',id).select().single();if(error)throw error;return data}
export async function appendOutbreakInvestigationEvent(organizationId: string,investigationId: string,eventType: string,payload: Json){const {data,error}=await cloudClient().from('lira_outbreak_investigation_events').insert({organization_id:organizationId,investigation_id:investigationId,event_type:eventType,payload}).select().single();if(error)throw error;return data}
export async function loadOutbreakInvestigationEvents(investigationId: string){const {data,error}=await cloudClient().from('lira_outbreak_investigation_events').select('*').eq('investigation_id',investigationId).order('created_at',{ascending:true});if(error)throw error;return data||[]}

export async function loadOutbreakCaseReviews(investigationId: string){const {data,error}=await cloudClient().from('lira_outbreak_case_reviews').select('*').eq('investigation_id',investigationId).order('reviewed_at',{ascending:true});if(error)throw error;return data||[]}
export async function createOutbreakCaseReview(organizationId: string,investigationId: string,input: NewOutbreakCaseReview){const {data,error}=await cloudClient().from('lira_outbreak_case_reviews').insert({organization_id:organizationId,investigation_id:investigationId,record_key:input.recordKey,patient_id:input.patientId||null,classification:input.classification,rationale:input.rationale,supersedes_review_id:input.supersedesReviewId||null}).select().single();if(error)throw error;return data}

function outbreakCapaCode(){return 'CAPA-OUT-'+new Date().toISOString().replace(/\D/g,'').slice(2,14)}
export async function loadOutbreakActions(organizationId: string,investigationId: string){const {data,error}=await cloudClient().from('quality_capa_actions').select('id,code,title,action_type,priority,status,description,owner_id,owner_label,due_date,effectiveness_due,effectiveness_status,created_at,updated_at').eq('organization_id',organizationId).eq('source_type','outbreak_investigation').eq('source_id',investigationId).order('due_date',{ascending:true,nullsFirst:false});if(error)throw error;return data||[]}
export async function createOutbreakAction(organizationId: string,investigationId: string,input: NewOutbreakAction){const {data,error}=await cloudClient().from('quality_capa_actions').insert({organization_id:organizationId,code:outbreakCapaCode(),title:input.title.trim(),source_type:'outbreak_investigation',source_id:investigationId,action_type:input.actionType||'corrective',priority:input.priority||'medium',status:'open',description:input.description?.trim()||null,owner_label:input.owner?.trim()||null,due_date:input.dueDate||null,effectiveness_status:'pending'}).select().single();if(error)throw error;return data}
export async function updateOutbreakActionStatus(organizationId: string,actionId: string,status: string){const {data,error}=await cloudClient().from('quality_capa_actions').update({status,updated_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('id',actionId).eq('source_type','outbreak_investigation').select().single();if(error)throw error;return data}

// The positive results of one organism, every one of them (owner, 19/11/2026): the general LIRA data reads at most 500
// samples and 500 results, so an investigation showed a few cases with no patient and no department. Paged by 1,000,
// with the sample, the patient and the department joined; the line list then keeps the period and the department.
const OUTBREAK_LAB_PAGE=1000
type OutbreakLabResult={id: string,organism: string|null,result_status: string|null,resistance_class: string|null,resulted_at: string|null,validation_status: string|null,sample: {id: string,patient_id: string|null,sample_type: string|null,collected_at: string|null,patient: {patient_code: string|null,first_name: string|null,last_name: string|null}|null,department: {name: string|null,code: string|null}|null}|null}
export async function loadOutbreakLaboratory(organizationId: string,organism: string|null|undefined): Promise<LiraLabRow[]>{
 const name=String(organism||'').replace(/\s*\([^)]*\)\s*$/,'').trim().replace(/[%_,()]/g,' ').trim()
 if(!name)return []
 const rows: OutbreakLabResult[]=[]
 for(let from=0;from<50*OUTBREAK_LAB_PAGE;from+=OUTBREAK_LAB_PAGE){
  const {data,error}=await cloudClient().from('microbiology_results').select('id,organism,result_status,resistance_class,resulted_at,validation_status,sample:laboratory_samples!inner(id,patient_id,sample_type,collected_at,patient:patients(patient_code,first_name,last_name),department:departments(name,code))').eq('organization_id',organizationId).eq('result_status','positive').ilike('organism',`%${name}%`).order('resulted_at',{ascending:true}).range(from,from+OUTBREAK_LAB_PAGE-1)
  if(error)throw error
  rows.push(...((data||[]) as unknown as OutbreakLabResult[]))
  if((data||[]).length<OUTBREAK_LAB_PAGE)break
 }
 return rows.map(result=>{const sample=result.sample;const patient=sample?.patient;const patientName=[patient?.first_name,patient?.last_name].filter(Boolean).join(' ');return {id:sample?.id||result.id,resultId:result.id,patient:patientName||patient?.patient_code||'—',patientCode:patient?.patient_code||null,department:sample?.department?.name||sample?.department?.code||'—',organism:result.organism,result:result.result_status,resistance:result.resistance_class,collectedAt:sample?.collected_at||null,specimenType:sample?.sample_type||null,resultedAt:result.resulted_at,signalDate:result.resulted_at||sample?.collected_at||null,patientId:sample?.patient_id||null,validationStatus:result.validation_status} as LiraLabRow})
}
