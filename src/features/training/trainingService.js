import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadTrainingState,saveTrainingState } from './trainingData'
import { DEFAULT_TRAINER_FEEDBACK_TEMPLATE,normalizeTrainerFeedbackTemplate } from './trainingFeedbackTemplate'
import { ASSIGNMENT_SELECT,CERTIFICATE_SELECT,HISTORY_SELECT,PROGRAM_SELECT,REQUIREMENT_SELECT,TEMPLATE_SELECT,assignmentToRpc,changedRecords,fingerprints,learnerOwnedAssignmentFields,programToRpc,requirementToRpc,templateFromRow,trainingStateFromRows } from './trainingMappers'
import { applyReview } from './trainingScoring'

// Production training lives in the training_* tables (20261115100000):
// read with PostgREST embeds, written through the SECURITY INVOKER RPCs
// training_save_state / training_save_requirement / training_delete_record,
// and the review finished with training_finalize_review. A manager's save
// never carries the learner-owned fields (learnerOwnedAssignmentFields); the
// database keeps them and the trainer evaluations the programme collected.
export { learnerOwnedAssignmentFields }

function requireProduction(organizationId,operation){
  if(isDemoDataEnvironment())return false
  if(!hasSupabaseConfig||!supabase)throw new Error(`PRODUCTION_TRAINING_CLOUD_REQUIRED:${operation}`)
  if(!organizationId)throw new Error(`PRODUCTION_TRAINING_ORGANIZATION_REQUIRED:${operation}`)
  return true
}

// Every row of a table for the organization (PostgREST returns at most 1000 per request).
const PAGE=1000
async function selectAll(table,columns,organizationId,order){
  const rows=[]
  for(let from=0;;from+=PAGE){
    let query=supabase.from(table).select(columns).eq('organization_id',organizationId)
    for(const [column,ascending] of order)query=query.order(column,{ascending})
    const {data,error}=await query.range(from,from+PAGE-1)
    if(error)throw error
    rows.push(...(data||[]))
    if(!data||data.length<PAGE)return rows
  }
}

// What was loaded, per organization: a save sends only the records that differ.
const baselines=new Map()

export async function loadTrainingStateAsync(organizationId){
  if(isDemoDataEnvironment())return loadTrainingState()
  requireProduction(organizationId,'load')
  const [programs,assignments,certificates,requirements,history]=await Promise.all([
    selectAll('training_programs',PROGRAM_SELECT,organizationId,[['updated_at',false],['id',true]]),
    selectAll('training_assignments',ASSIGNMENT_SELECT,organizationId,[['updated_at',false],['id',true]]),
    selectAll('training_certificates',CERTIFICATE_SELECT,organizationId,[['updated_at',false],['id',true]]),
    selectAll('training_requirements',REQUIREMENT_SELECT,organizationId,[['updated_at',false],['id',true]]),
    selectAll('training_history_events',HISTORY_SELECT,organizationId,[['position',true]]),
  ])
  const state=trainingStateFromRows({programs,assignments,certificates,requirements,history})
  baselines.set(organizationId,fingerprints(state))
  return state
}

async function loadTrainerFeedbackTemplateAsync(organizationId){
  if(isDemoDataEnvironment())return normalizeTrainerFeedbackTemplate(DEFAULT_TRAINER_FEEDBACK_TEMPLATE)
  requireProduction(organizationId,'feedback_template_load')
  const {data,error}=await supabase.from('training_feedback_templates').select(TEMPLATE_SELECT).eq('organization_id',organizationId).eq('template_key','TRAINER-FEEDBACK-DEFAULT').maybeSingle()
  if(error)throw error
  return normalizeTrainerFeedbackTemplate(templateFromRow(data)||DEFAULT_TRAINER_FEEDBACK_TEMPLATE)
}

async function saveRecords(organizationId,{programs=[],assignments=[]}){
  if(!programs.length&&!assignments.length)return
  const {error}=await supabase.rpc('training_save_state',{p_organization_id:organizationId,p_programs:programs,p_assignments:assignments})
  if(error)throw error
}

export async function createTrainingProgramAsync(organizationId,draft){
  const now=new Date().toISOString()
  const trainerFeedbackTemplate=isDemoDataEnvironment()?normalizeTrainerFeedbackTemplate(DEFAULT_TRAINER_FEEDBACK_TEMPLATE):await loadTrainerFeedbackTemplateAsync(organizationId)
  const program={...draft,id:`TRN-${Date.now()}`,validMonths:Number(draft.validMonths)||null,passScore:draft.requiresAssessment?Number(draft.passScore)||0:null,materials:[],assessmentQuestions:[],trainerFeedbackTemplate,feedbackResponses:[],createdAt:now,updatedAt:now}
  if(isDemoDataEnvironment()){
    const state=loadTrainingState();saveTrainingState({...state,programs:[program,...state.programs]});return program
  }
  requireProduction(organizationId,'create_program')
  const {data,error}=await supabase.rpc('training_save_program',{p_organization_id:organizationId,p_program:programToRpc(program)})
  if(error)throw error
  return {...program,dbId:data}
}

export async function saveManagedTrainingStateAsync(organizationId,state){
  if(isDemoDataEnvironment())return saveTrainingState(state)
  requireProduction(organizationId,'save')
  const baseline=baselines.get(organizationId)||fingerprints(null)
  await saveRecords(organizationId,{programs:changedRecords(state?.programs,baseline.programs,programToRpc),assignments:changedRecords(state?.assignments,baseline.assignments,assignmentToRpc)})
  return loadTrainingStateAsync(organizationId)
}

// Required-training rules are saved one at a time (not with the whole state).
export async function saveTrainingRequirementAsync(organizationId,requirement,state){
  if(isDemoDataEnvironment()){const requirements=state?.requirements||[];const next=requirements.some(r=>r.id===requirement.id)?requirements.map(r=>r.id===requirement.id?requirement:r):[...requirements,requirement];return saveTrainingState({...state,requirements:next})}
  requireProduction(organizationId,'requirement_save')
  const {error}=await supabase.rpc('training_save_requirement',{p_organization_id:organizationId,p_requirement:requirementToRpc(requirement)})
  if(error)throw error
  return loadTrainingStateAsync(organizationId)
}

export async function deleteTrainingRequirementAsync(organizationId,requirementId,state){
  if(isDemoDataEnvironment())return saveTrainingState({...state,requirements:(state?.requirements||[]).filter(r=>r.id!==requirementId)})
  await deleteTrainingRecordAsync(organizationId,requirementId)
  return loadTrainingStateAsync(organizationId)
}

export async function deleteTrainingRecordAsync(organizationId,recordKey){
  if(isDemoDataEnvironment())return true
  requireProduction(organizationId,'delete')
  const {error}=await supabase.rpc('training_delete_record',{p_organization_id:organizationId,p_record_key:recordKey})
  if(error)throw error
  return true
}

// The manager finishes a pending manual review: points per free-text
// question, an optional pass/fail decision and a note. Completes the
// assignment and issues the certificate when competent.
export async function finalizeTrainingReviewAsync(organizationId,assignmentKey,{points={},competent=null,note='',reviewer='',state=null}={}){
  if(isDemoDataEnvironment()){const current=state||loadTrainingState();return saveTrainingState(applyReview(current,assignmentKey,{points,competent,note,reviewer}))}
  requireProduction(organizationId,'review_finalize')
  const {error}=await supabase.rpc('training_finalize_review',{p_organization_id:organizationId,p_assignment_key:assignmentKey,p_points:points,p_competent:competent,p_note:note||null})
  if(error)throw error
  return loadTrainingStateAsync(organizationId)
}
