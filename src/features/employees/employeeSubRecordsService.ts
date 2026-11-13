import { supabase } from '../../core/supabase/client'
import { selectAllPages } from '../../core/data/inChunks'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { cloudClient } from '../../core/supabase/cloudContext'
import type { Tables, TablesUpdate } from '../../core/supabase/database.types'
import type { TrainingAssignment, TrainingCertificate, TrainingProgram } from '../training/trainingTypes'
import type { EmployeeCertificate, EmployeeCertificateDraft, EmployeeEvaluation, EmployeeEvaluationDraft, EmployeeTraining, EmployeeVaccination, EvaluationCriterion, ExposureIncident, ExposureIncidentDraft, OccupationalVisit, OccupationalVisitDraft } from './employeeTypes'
import { loadTrainingState } from '../training/trainingData'
import { ASSIGNMENT_DETAIL_SELECT,CERTIFICATE_SELECT,PROGRAM_DETAIL_SELECT,trainingStateFromRows } from '../training/trainingMappers'
import { loadOccupationalVisits as loadVisitsLocal, saveOccupationalVisits as saveVisitsLocal, loadVaccinations as loadVaccinationsLocal, loadEmployeeTraining as loadTrainingLocal, loadEvaluations as loadEvaluationsLocal, saveEvaluations as saveEvaluationsLocal, loadCertificates as loadCertificatesLocal, loadExposureIncidents as loadExposureIncidentsLocal } from './employeeRecordsService'

type OrgId=string|null|undefined
// The Training module's state (programmes, assignments, certificates) as this file reads it.
// An assignment may carry its programme title and certificate (older rows and the demo).
type EmployeeAssignment = TrainingAssignment & { programTitle?: string, title?: string, certificate?: TrainingCertificate | null, createdAt?: string | null, updatedAt?: string | null }
interface TrainingState { programs: TrainingProgram[], assignments: EmployeeAssignment[], certificates: TrainingCertificate[] }
// The database id of the employee: required outside the demo (ensureProductionContext checks it).
type EmployeeDbId = string | null | undefined
const trainingFromRows=trainingStateFromRows as unknown as (rows: Record<string, unknown[]>) => TrainingState

// After it (outside the demo) Supabase is configured, an organization is chosen and the employee has a database id.
function ensureProductionContext(organizationId: OrgId,employeeDbId: unknown,operation: string): asserts organizationId is string{
  if(isDemoDataEnvironment())return
  if(!hasSupabaseConfig||!supabase)throw new Error(`PRODUCTION_CLOUD_REQUIRED:${operation}`)
  if(!organizationId)throw new Error(`PRODUCTION_ORGANIZATION_REQUIRED:${operation}`)
  if(!employeeDbId)throw new Error(`PRODUCTION_EMPLOYEE_DB_ID_REQUIRED:${operation}`)
}

function cloudEnabled() {
  return hasSupabaseConfig && Boolean(supabase) && !isDemoDataEnvironment()
}

// Production training: the employee's assignments (training_assignments,
// matched by employee row, account or employee code) with their answers,
// trainer evaluation and certificate, and the programmes they belong to.
async function loadCanonicalTrainingContext(organizationId: OrgId,employeeDbId: EmployeeDbId,employeeId: string){
  ensureProductionContext(organizationId,employeeDbId,'training_assignments.employee_context')
  const {data:employee,error:employeeError}=await cloudClient()
    .from('employees')
    .select('id,employee_code,user_id')
    .eq('organization_id',organizationId)
    .eq('id',employeeDbId as string)
    .maybeSingle()
  if(employeeError)throw employeeError

  const employeeCode=String(employee?.employee_code||employeeId||'').trim()
  const userId=employee?.user_id||null
  const quoted=(value: unknown)=>`"${String(value).replace(/["\\]/g,'')}"`
  const matches=[`employee_id.eq.${employeeDbId}`,userId&&`employee_user_id.eq.${userId}`,employeeCode&&`employee_code.eq.${quoted(employeeCode)}`,employeeId&&String(employeeId)!==employeeCode&&`employee_code.eq.${quoted(employeeId)}`].filter(Boolean)
  const assignmentRows=await selectAllPages(()=>cloudClient()
    .from('training_assignments')
    .select(ASSIGNMENT_DETAIL_SELECT)
    .eq('organization_id',organizationId)
    .or(matches.join(','))
    .order('updated_at',{ascending:false})
    .order('id'))

  const programIds=[...new Set((assignmentRows||[]).map(row=>row.program_id).filter(Boolean))]
  let programRows: unknown[]=[]
  if(programIds.length){
    const {data,error:programError}=await cloudClient().from('training_programs').select(PROGRAM_DETAIL_SELECT).eq('organization_id',organizationId).in('id',programIds)
    if(programError)throw programError
    programRows=data||[]
  }
  let certificateRows: unknown[]=[]
  const assignmentIds=(assignmentRows||[]).map(row=>row.id)
  if(assignmentIds.length){
    const {data,error:certificateError}=await cloudClient().from('training_certificates').select(CERTIFICATE_SELECT).eq('organization_id',organizationId).in('assignment_id',assignmentIds)
    if(certificateError)throw certificateError
    certificateRows=data||[]
  }
  const state=trainingFromRows({programs:programRows,assignments:assignmentRows||[],certificates:certificateRows})
  return {assignments:state.assignments,programMap:new Map<unknown,TrainingProgram>(state.programs.map(p=>[p.id,p])),certificateMap:new Map<unknown,TrainingCertificate>(state.certificates.map(c=>[c.id,c]))}
}


// Demo: the same Training programmes/assignments the Training module shows.
function demoTrainingContext(employeeId: string){
  const state: TrainingState=loadTrainingState()
  const programs=new Map<unknown,TrainingProgram>(state.programs.map(p=>[p.id,p]))
  const certificates=new Map<unknown,TrainingCertificate>(state.certificates.map(c=>[c.id,c]))
  return state.assignments.filter(a=>a.employeeId===employeeId).map(a=>({a,program:programs.get(a.programId)||{} as Partial<TrainingProgram>,certificate:certificates.get(a.certificateId)||null}))
}
function demoTrainingRows(employeeId: string){
  const current=demoTrainingContext(employeeId).map(({a,program})=>({id:a.id,employeeId,titleEl:program.title||a.programId,titleEn:program.titleEn||program.title||a.programId,date:a.completedDate||a.assignedDate||program.startDate||'',assignedDate:a.assignedDate||'',completedDate:a.completedDate||'',dueDate:program.dueDate||a.dueDate||'',status:a.status||'assigned',programId:a.programId,score:a.score??null,competent:a.competent??null,source:'training_records'}))
  return [...current,...loadTrainingLocal().filter(x=>x.employeeId===employeeId)].sort((x,y)=>String(y.date||'').localeCompare(String(x.date||'')))
}
function demoTrainingEvaluations(employeeId: string){
  return demoTrainingContext(employeeId).filter(({a})=>a.score!=null||a.assessmentSubmittedAt).map(({a,program,certificate})=>{const title=(program.title||a.programId) as string;const score=a.score!=null?Number(a.score):null;const competent=a.competent===true;return {id:`training-${a.id}`,employeeId,titleEl:`Αξιολόγηση γνώσεων · ${title}`,titleEn:`Knowledge assessment · ${program.titleEn||title}`,date:a.completedDate||String(a.assessmentSubmittedAt||'').slice(0,10),period:String(a.completedDate||a.assignedDate||'').slice(0,4),status:'finalized',resultEl:score!=null?`Βαθμολογία ${score}%${a.competent!=null?` · ${competent?'Επιτυχής':'Μη επιτυχής'}`:''}`:'Υποβλήθηκε',resultEn:score!=null?`Score ${score}%${a.competent!=null?` · ${competent?'Passed':'Not passed'}`:''}`:'Submitted',score,competent:a.competent??null,programId:a.programId,assessmentAnswers:a.assessmentAnswers||{},assessmentQuestions:Array.isArray(program.assessmentQuestions)?program.assessmentQuestions:[],certificateId:a.certificateId||null,certificate,program:{title,titleEn:program.titleEn||title},source:'training'}})
}

// --- Occupational health visits ---
function visitFromRow(row: Partial<Tables<'occupational_health_visits'>>): OccupationalVisit {
  return {
    id:row.id as string,
    employeeId:row.employee_id as string,
    date:row.visit_date as string,
    type:row.visit_type as string,
    status:row.status as string,
    followUpDate:row.follow_up_date||null,
    fitStatus:row.fitness_status||'',
    clinicalNotes:row.clinical_notes||'',
    createdAt:row.created_at||null,
    updatedAt:row.updated_at||null,
  }
}
export async function loadOccupationalVisitsAsync(organizationId: OrgId, employeeDbId: EmployeeDbId, employeeId: string): Promise<OccupationalVisit[]> {
  if(isDemoDataEnvironment())return loadVisitsLocal().filter((x: OccupationalVisit) => x.employeeId === employeeId)
  ensureProductionContext(organizationId,employeeDbId,'occupational_health_visits.load')
  const data = await selectAllPages(() => cloudClient()
    .from('occupational_health_visits')
    .select('id,employee_id,visit_date,visit_type,status,follow_up_date,fitness_status,clinical_notes,created_at,updated_at')
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeDbId as string)
    .order('visit_date', { ascending: false })
    .order('id'))
  return data.map(visitFromRow)
}

// Every employee's visits, for the Occupational Health registry. Rows keep the
// employee's database id (employeeId), which the page maps back to the employee.
// Browser storage is used only for the sample demo or without Supabase.
export async function loadAllOccupationalVisitsAsync(organizationId: OrgId) {
  if(!cloudEnabled())return loadVisitsLocal()
  if(!organizationId)return []
  const data = await selectAllPages(() => cloudClient()
    .from('occupational_health_visits')
    .select('id,employee_id,visit_date,visit_type,status,follow_up_date,fitness_status,clinical_notes,created_at,updated_at')
    .eq('organization_id', organizationId)
    .order('visit_date', { ascending: false })
    .order('id'))
  return data.map(visitFromRow)
}

// Records a visit of the occupational physician (scheduled, or done with its
// fitness outcome). Demo: browser storage; cloud: RLS allows the occupational
// physician and holders of manage_occupational_health.
export async function createOccupationalVisitAsync(organizationId: OrgId, employee: { id: string, dbId?: string | null } | null | undefined, draft: OccupationalVisitDraft) {
  if (!employee) throw new Error('OCCUPATIONAL_VISIT_EMPLOYEE_REQUIRED')
  if (!draft?.date || !draft?.type) throw new Error('OCCUPATIONAL_VISIT_FIELDS_REQUIRED')
  const done = draft.status === 'completed'
  const fitStatus = done ? (draft.fitStatus || 'pending') : 'pending'
  if (isDemoDataEnvironment()) {
    const added = { id: `OHV-${Date.now()}`, employeeId: employee.id, date: draft.date, type: draft.type, status: draft.status || 'scheduled', followUpDate: done ? draft.followUpDate || null : null, fitStatus, clinicalNotes: String(draft.clinicalNotes || '').trim() }
    saveVisitsLocal([added, ...loadVisitsLocal()])
    return added
  }
  ensureProductionContext(organizationId, employee.dbId, 'occupational_health_visits.create')
  const { data, error } = await cloudClient()
    .from('occupational_health_visits')
    .insert({ organization_id: organizationId, employee_id: employee.dbId as string, visit_date: draft.date, visit_type: draft.type, status: draft.status || 'scheduled', fitness_status: fitStatus, follow_up_date: done ? draft.followUpDate || null : null, clinical_notes: String(draft.clinicalNotes || '').trim() || null })
    .select('id,employee_id,visit_date,visit_type,status,follow_up_date,fitness_status,clinical_notes,created_at,updated_at')
    .single()
  if (error) throw error
  return visitFromRow(data)
}

// The visit of the Occupational Health registry changed or removed (RLS: the occupational physician and the
// holders of manage_occupational_health). `employee` is the one the visit belongs to.
export async function updateOccupationalVisitAsync(organizationId: OrgId, visit: OccupationalVisit | null, draft: OccupationalVisitDraft): Promise<OccupationalVisit> {
  if (!draft?.date || !draft?.type) throw new Error('OCCUPATIONAL_VISIT_FIELDS_REQUIRED')
  const done = draft.status === 'completed'
  const fitStatus = done ? (draft.fitStatus || 'pending') : 'pending'
  const notes = String(draft.clinicalNotes || '').trim()
  if (isDemoDataEnvironment()) {
    const next = { ...visit, date: draft.date, type: draft.type, status: draft.status || 'scheduled', followUpDate: done ? draft.followUpDate || null : null, fitStatus, clinicalNotes: notes }
    saveVisitsLocal(loadVisitsLocal().map((item: OccupationalVisit) => (item.id === visit?.id ? next : item)))
    return next as OccupationalVisit
  }
  const { data, error } = await cloudClient()
    .from('occupational_health_visits')
    .update({ visit_date: draft.date, visit_type: draft.type, status: draft.status || 'scheduled', fitness_status: fitStatus, follow_up_date: done ? draft.followUpDate || null : null, clinical_notes: notes || null })
    .eq('organization_id', organizationId as string)
    .eq('id', visit?.id as string)
    .select('id,employee_id,visit_date,visit_type,status,follow_up_date,fitness_status,clinical_notes,created_at,updated_at')
    .single()
  if (error) throw error
  return visitFromRow(data)
}
export async function deleteOccupationalVisitAsync(organizationId: OrgId, visitId: string) {
  if (isDemoDataEnvironment()) { saveVisitsLocal(loadVisitsLocal().filter((item: OccupationalVisit) => item.id !== visitId)); return }
  const { error } = await cloudClient().from('occupational_health_visits').delete().eq('organization_id', organizationId as string).eq('id', visitId)
  if (error) throw error
}

// --- Vaccinations ---
function vaccinationFromRow(row: Partial<Tables<'employee_vaccinations'>>) {
  return {
    id:row.id as string,
    employeeId:row.employee_id as string,
    vaccine:row.vaccine_label_snapshot as string,
    dose:row.dose||'',
    date:row.vaccination_date as string | null,
    lotNumber:row.lot_number||'',
    validUntil:row.valid_until||null,
    status:row.status as string,
    clinicalNotes:row.clinical_notes||'',
    createdAt:row.created_at||null,
    updatedAt:row.updated_at||null,
  }
}
export async function loadVaccinationsAsync(organizationId: OrgId, employeeDbId: EmployeeDbId, employeeId: string): Promise<EmployeeVaccination[]> {
  if(isDemoDataEnvironment())return loadVaccinationsLocal().filter((x: EmployeeVaccination) => x.employeeId === employeeId)
  ensureProductionContext(organizationId,employeeDbId,'employee_vaccinations.load')
  const data = await selectAllPages(() => cloudClient()
    .from('employee_vaccinations')
    .select('id,employee_id,vaccine_label_snapshot,dose,vaccination_date,lot_number,valid_until,status,clinical_notes,created_at,updated_at')
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeDbId as string)
    .order('vaccination_date', { ascending: false, nullsFirst: false })
    .order('id'))
  return data.map(vaccinationFromRow)
}

// --- Training summary ---
// Production training has one source of truth: the training_* tables (the
// former training_records). The employee tab derives its rows from the
// employee's assignments and joins the programme.
export async function loadEmployeeTrainingAsync(organizationId: OrgId, employeeDbId: EmployeeDbId, employeeId: string): Promise<EmployeeTraining[]> {
  if(isDemoDataEnvironment())return demoTrainingRows(employeeId)
  const {assignments,programMap}=await loadCanonicalTrainingContext(organizationId,employeeDbId,employeeId)
  return assignments.map(assignment=>{
    const program: Partial<TrainingProgram>=programMap.get(assignment.programId)||{}
    const title=program.title||assignment.programTitle||assignment.title||assignment.programId||'Training'
    return {
      id:assignment.id,
      employeeId:employeeDbId as string,
      titleEl:title,
      titleEn:program.titleEn||title,
      date:assignment.completedDate||program.startDate||assignment.assignedDate||program.dueDate||String(assignment.updatedAt||assignment.createdAt||'').slice(0,10),
      assignedDate:assignment.assignedDate||'',
      completedDate:assignment.completedDate||'',
      dueDate:program.dueDate||assignment.dueDate||'',
      status:assignment.status||'assigned',
      programId:assignment.programId||null,
      programDbId:program.dbId||null,
      assignmentDbId:assignment.dbId||null,
      materialCount:program.materials?.length||0,
      organiser:program.owner||'',
      hours:program.durationHours??null,
      score:assignment.score??null,
      competent:assignment.competent??null,
      source:'training_records',
    }
  })
}

// --- Evaluations ---
const EVALUATION_COLUMNS='id,employee_id,title,title_en,evaluation_date,result,result_en,notes,evaluation_period,status,evaluator_user_id,criteria,overall_score,employee_comment,employee_agreement,employee_acknowledged_at,employee_acknowledged_by,hr_approved_at,hr_approved_by,admin_approved_at,admin_approved_by,finalized_at'

function evaluationFromRow(row: Partial<Tables<'employee_evaluations'>> & { evaluator_name?: string }): EmployeeEvaluation {
  return { id:row.id as string,employeeId:row.employee_id as string,titleEl:row.title as string,titleEn:(row.title_en||row.title) as string,date:row.evaluation_date as string,resultEl:row.result||'',resultEn:row.result_en||row.result||'',period:row.evaluation_period||'',status:row.status||'draft',evaluatorUserId:row.evaluator_user_id||null,evaluatorName:row.evaluator_name||'',criteria:Array.isArray(row.criteria)?row.criteria as EvaluationCriterion[]:[],overallScore:row.overall_score==null?null:Number(row.overall_score),notes:row.notes||'',employeeComment:row.employee_comment||'',employeeAgreement:row.employee_agreement||'',employeeAcknowledgedAt:row.employee_acknowledged_at||null,hrApprovedAt:row.hr_approved_at||null,adminApprovedAt:row.admin_approved_at||null,finalizedAt:row.finalized_at||null,source:'employee_evaluations' }
}

function evaluationScore(criteria: EvaluationCriterion[]=[]){const valid=criteria.filter(x=>Number(x.score)>=1&&Number(x.score)<=5);if(!valid.length)return null;const totalWeight=valid.reduce((n,x)=>n+(Number(x.weight)||1),0);return Number((valid.reduce((n,x)=>n+Number(x.score)*(Number(x.weight)||1),0)/totalWeight).toFixed(2))}

// Demo mirrors of createEmployeeEvaluationAsync/updateEmployeeEvaluationWorkflowAsync,
// matching the shape evaluationFromRow produces so the workflow (submit ->
// employee acknowledgement -> HR approval -> final approval) is exercisable
// in demo the same way it is in production.
function createEvaluationLocal(employeeDbId: EmployeeDbId,draft: EmployeeEvaluationDraft){
  const rows=loadEvaluationsLocal()
  const score=evaluationScore(draft.criteria)
  const row={id:`EV-${Date.now()}`,employeeId:employeeDbId,titleEl:'Αξιολόγηση απόδοσης',titleEn:'Performance evaluation',date:draft.date,period:draft.period,status:'draft',evaluatorUserId:null,evaluatorName:'Demo user',criteria:draft.criteria||[],overallScore:score,notes:draft.notes||'',resultEl:score==null?'':`${score} / 5`,resultEn:score==null?'':`${score} / 5`,employeeComment:'',employeeAgreement:'',employeeAcknowledgedAt:null,hrApprovedAt:null,adminApprovedAt:null,finalizedAt:null,source:'employee_evaluations'}
  saveEvaluationsLocal([row,...rows])
  return row
}
function updateEvaluationWorkflowLocal(evaluationId: string,{action,comment='',agreement=''}: WorkflowStep){
  const rows=loadEvaluationsLocal()
  const now=new Date().toISOString()
  let updatedRow: EmployeeEvaluation|null=null
  const next=rows.map(row=>{
    if(row.id!==evaluationId)return row
    let patch: Partial<EmployeeEvaluation>={}
    if(action==='submit')patch={status:'submitted'}
    else if(action==='acknowledge')patch={status:'employee_acknowledged',employeeComment:comment||'',employeeAgreement:agreement||'',employeeAcknowledgedAt:now}
    else if(action==='hrApprove')patch={status:'hr_approved',hrApprovedAt:now}
    else if(action==='finalize')patch={status:'finalized',adminApprovedAt:now,finalizedAt:now}
    else throw new Error('Unsupported evaluation workflow action')
    updatedRow={...row,...patch}
    return updatedRow
  })
  saveEvaluationsLocal(next)
  return updatedRow
}

// A step of the evaluation workflow (submit, acknowledge, hrApprove, finalize).
export interface WorkflowStep { action: string, comment?: string, agreement?: string }
export async function createEmployeeEvaluationAsync(organizationId: OrgId,employeeDbId: EmployeeDbId,draft: EmployeeEvaluationDraft){
  if(isDemoDataEnvironment())return createEvaluationLocal(employeeDbId,draft)
  ensureProductionContext(organizationId,employeeDbId,'employee_evaluations.create')
  const {data:userData}=await cloudClient().auth.getUser();const userId=userData?.user?.id||null
  const score=evaluationScore(draft.criteria)
  const {data,error}=await cloudClient().from('employee_evaluations').insert({organization_id:organizationId,employee_id:employeeDbId as string,title:'Αξιολόγηση απόδοσης',title_en:'Performance evaluation',evaluation_date:draft.date as string,evaluation_period:draft.period,status:'draft',evaluator_user_id:userId,created_by:userId,criteria:draft.criteria||[],overall_score:score,notes:draft.notes||'',result:score==null?'':`${score} / 5`,result_en:score==null?'':`${score} / 5`}).select(EVALUATION_COLUMNS).single()
  if(error)throw error;return evaluationFromRow(data)
}

export async function updateEmployeeEvaluationWorkflowAsync(organizationId: OrgId,employeeDbId: EmployeeDbId,evaluationId: string,{action,comment='',agreement=''}: WorkflowStep){
  if(isDemoDataEnvironment())return updateEvaluationWorkflowLocal(evaluationId,{action,comment,agreement})
  ensureProductionContext(organizationId,employeeDbId,'employee_evaluations.workflow')
  const {data:userData,error:userError}=await cloudClient().auth.getUser();if(userError)throw userError;const userId=userData?.user?.id;if(!userId)throw new Error('Authentication required')
  const now=new Date().toISOString();let patch: TablesUpdate<'employee_evaluations'>
  if(action==='submit')patch={status:'submitted'}
  else if(action==='acknowledge')patch={status:'employee_acknowledged',employee_comment:comment||null,employee_agreement:agreement||null,employee_acknowledged_at:now,employee_acknowledged_by:userId}
  else if(action==='hrApprove')patch={status:'hr_approved',hr_approved_at:now,hr_approved_by:userId}
  else if(action==='finalize')patch={status:'finalized',admin_approved_at:now,admin_approved_by:userId,finalized_at:now}
  else throw new Error('Unsupported evaluation workflow action')
  const {data,error}=await cloudClient().from('employee_evaluations').update(patch).eq('organization_id',organizationId).eq('employee_id',employeeDbId as string).eq('id',evaluationId).select(EVALUATION_COLUMNS).single();if(error)throw error;return evaluationFromRow(data)
}
export async function loadEvaluationsAsync(organizationId: OrgId, employeeDbId: EmployeeDbId, employeeId: string): Promise<EmployeeEvaluation[]> {
  if(isDemoDataEnvironment())return [...loadEvaluationsLocal().filter(x => x.employeeId === employeeId),...demoTrainingEvaluations(employeeId)].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))
  ensureProductionContext(organizationId,employeeDbId,'employee_evaluations.load')

  const [{data:formalRows,error:formalError},trainingContext]=await Promise.all([
    cloudClient()
      .from('employee_evaluations')
      .select(EVALUATION_COLUMNS)
      .eq('organization_id', organizationId)
      .eq('employee_id', employeeDbId as string)
      .order('evaluation_date', { ascending: false }),
    loadCanonicalTrainingContext(organizationId,employeeDbId,employeeId),
  ])
  if(formalError)throw formalError
  const evaluatorIds=[...new Set((formalRows||[]).map(row=>row.evaluator_user_id).filter(Boolean))]
  let evaluatorNames=new Map<unknown,string>()
  if(evaluatorIds.length){const {data:profiles}=await cloudClient().from('profiles').select('id,full_name,username').in('id',evaluatorIds);evaluatorNames=new Map((profiles||[]).map(p=>[p.id,p.full_name||p.username||'']))}
  const formalWithEvaluator=(formalRows||[]).map(row=>({...row,evaluator_name:evaluatorNames.get(row.evaluator_user_id)||''}))

  const trainingEvaluations=trainingContext.assignments
    .filter(a=>a.score!=null||Boolean(a.assessmentSubmittedAt)||Boolean(a.assessmentReviewStatus))
    .map(a=>{
      const program: Partial<TrainingProgram>=trainingContext.programMap.get(a.programId)||{}
      const title=program.title||a.programTitle||a.programId||'Training'
      const score=a.score!=null?Number(a.score):null
      const competent=a.competent===true
      // Words, never the stored codes (an imported assessment has only «reviewed»).
      const reviewEl=({pending:'Προς έλεγχο',reviewed:'Ελέγχθηκε',not_required:'Υποβλήθηκε'} as Record<string,string>)[a.assessmentReviewStatus ?? '']||'Υποβλήθηκε'
      const reviewEn=({pending:'To be reviewed',reviewed:'Reviewed',not_required:'Submitted'} as Record<string,string>)[a.assessmentReviewStatus ?? '']||'Submitted'
      const verdictEl=a.competent!=null?(competent?'Επιτυχής':'Μη επιτυχής'):'',verdictEn=a.competent!=null?(competent?'Passed':'Not passed'):''
      const resultEl=score!=null?`Βαθμολογία ${score}%${verdictEl?` · ${verdictEl}`:''}`:(verdictEl||reviewEl)
      const resultEn=score!=null?`Score ${score}%${verdictEn?` · ${verdictEn}`:''}`:(verdictEn||reviewEn)
      const status=a.competent!=null?(competent?'passed':'failed'):a.assessmentReviewStatus==='pending'?'pending_review':a.assessmentReviewStatus==='reviewed'?'reviewed':'submitted'
      return {
        id:`training-${a.id}`,
        employeeId:employeeDbId as string,
        titleEl:`Αξιολόγηση γνώσεων · ${title}`,
        titleEn:`Knowledge assessment · ${program.titleEn||title}`,
        date:a.completedDate||String(a.assessmentSubmittedAt||a.updatedAt||a.createdAt||'').slice(0,10),
        resultEl,
        resultEn,
        score,
        competent:a.competent??null,
        programId:a.programId||null,
        assessmentAnswers:a.assessmentAnswers||{},
        assessmentQuestions:Array.isArray(program.assessmentQuestions)?program.assessmentQuestions:[],
        certificateId:a.certificateId||null,
        certificate:trainingContext.certificateMap?.get(a.certificateId)||a.certificate||null,
        program:{title, titleEn:program.titleEn||title},
        status,
        source:'training',
      }
    })

  return [...formalWithEvaluator.map(evaluationFromRow),...trainingEvaluations]
    .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))
}

// --- Certificates ---
function certificateFromRow(row: Pick<Tables<'employee_certificates'>, 'id' | 'employee_id' | 'title' | 'title_en' | 'issuer' | 'issue_date' | 'valid_until' | 'certificate_number'>): EmployeeCertificate {
  return { id: row.id, employeeId: row.employee_id, titleEl: row.title, titleEn: row.title_en || row.title, issuer: row.issuer || '', issueDate: row.issue_date || '', validUntil: row.valid_until || '', certificateNumber: row.certificate_number || '', attachments: [] }
}
const CERTIFICATE_COLUMNS = 'id,employee_id,title,title_en,issuer,issue_date,valid_until,certificate_number'

export async function loadCertificatesAsync(organizationId: OrgId, employeeDbId: EmployeeDbId, employeeId: string): Promise<EmployeeCertificate[]> {
  if(isDemoDataEnvironment())return loadCertificatesLocal().filter(x => x.employeeId === employeeId)
  ensureProductionContext(organizationId,employeeDbId,'employee_certificates.load')
  const data = await selectAllPages(() => cloudClient()
    .from('employee_certificates')
    .select(CERTIFICATE_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeDbId as string)
    .order('issue_date', { ascending: false })
    .order('id'))
  return data.map(certificateFromRow)
}

export async function createCertificateAsync(organizationId: OrgId, employeeDbId: EmployeeDbId, draft: EmployeeCertificateDraft) {
  ensureProductionContext(organizationId,employeeDbId,'employee_certificates.create')
  const { data, error } = await cloudClient()
    .from('employee_certificates')
    .insert({
      organization_id: organizationId,
      employee_id: employeeDbId as string,
      title: draft.titleEl as string,
      title_en: draft.titleEn || draft.titleEl,
      issuer: draft.issuer || null,
      issue_date: draft.issueDate || null,
      valid_until: draft.validUntil || null,
      certificate_number: draft.certificateNumber || null,
    })
    .select(CERTIFICATE_COLUMNS)
    .single()
  if (error) throw error
  return certificateFromRow(data)
}

// --- Occupational exposure incidents (needlestick/sharps/mucocutaneous) ---
function exposureIncidentFromRow(row: Pick<Tables<'occupational_exposure_incidents'>, 'id' | 'employee_id' | 'incident_date' | 'exposure_type' | 'device_or_source' | 'body_site' | 'source_patient_status' | 'reported_at' | 'pep_administered' | 'pep_details' | 'follow_up_status' | 'follow_up_due_at' | 'notes' | 'status'>): ExposureIncident {
  return {
    id: row.id, employeeId: row.employee_id, incidentDate: row.incident_date, exposureType: row.exposure_type,
    deviceOrSource: row.device_or_source || '', bodySite: row.body_site || '', sourcePatientStatus: row.source_patient_status || '',
    reportedAt: row.reported_at || null, pepAdministered: row.pep_administered ?? null, pepDetails: row.pep_details || '',
    followUpStatus: row.follow_up_status || 'pending', followUpDueAt: row.follow_up_due_at || '', notes: row.notes || '', status: row.status || 'open',
  }
}
const EXPOSURE_INCIDENT_COLUMNS = 'id,employee_id,incident_date,exposure_type,device_or_source,body_site,source_patient_status,reported_at,pep_administered,pep_details,follow_up_status,follow_up_due_at,notes,status'

export async function loadExposureIncidentsAsync(organizationId: OrgId, employeeDbId: EmployeeDbId, employeeId: string): Promise<ExposureIncident[]> {
  if(isDemoDataEnvironment())return loadExposureIncidentsLocal().filter((x: { employeeId?: string }) => x.employeeId === employeeId)
  ensureProductionContext(organizationId,employeeDbId,'occupational_exposure_incidents.load')
  const data = await selectAllPages(() => cloudClient()
    .from('occupational_exposure_incidents')
    .select(EXPOSURE_INCIDENT_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeDbId as string)
    .order('incident_date', { ascending: false })
    .order('id'))
  return data.map(exposureIncidentFromRow)
}

export async function createExposureIncidentAsync(organizationId: OrgId, employeeDbId: EmployeeDbId, draft: ExposureIncidentDraft) {
  ensureProductionContext(organizationId,employeeDbId,'occupational_exposure_incidents.create')
  const { data, error } = await cloudClient()
    .from('occupational_exposure_incidents')
    .insert({
      organization_id: organizationId,
      employee_id: employeeDbId as string,
      incident_date: draft.incidentDate as string,
      exposure_type: draft.exposureType as string,
      device_or_source: draft.deviceOrSource || null,
      body_site: draft.bodySite || null,
      source_patient_status: draft.sourcePatientStatus || null,
      pep_administered: draft.pepAdministered ?? null,
      pep_details: draft.pepDetails || null,
      follow_up_status: draft.followUpStatus || 'pending',
      follow_up_due_at: draft.followUpDueAt || null,
      notes: draft.notes || null,
      status: draft.status || 'open',
    })
    .select(EXPOSURE_INCIDENT_COLUMNS)
    .single()
  if (error) throw error
  return exposureIncidentFromRow(data)
}
