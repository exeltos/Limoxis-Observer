// Training rows (the training_* tables, read with PostgREST embeds) to the
// in-app objects the screens use, and back to the RPC input. Pure functions:
// no Supabase here. The app object keeps its historic shape: id = the record
// key (TRN-…, TRA-…, CERT-…, REQ-…), dbId = the row uuid.

const one=value=>Array.isArray(value)?value[0]||null:value||null
const byPosition=(a,b)=>(a.position??0)-(b.position??0)||String(a.question_key||a.option_key||a.material_key||a.value||'').localeCompare(String(b.question_key||b.option_key||b.material_key||b.value||''))
const sorted=list=>[...(Array.isArray(list)?list:[])].sort(byPosition)
const num=value=>value==null||value===''?null:Number(value)

// The register reads lean rows: no assessment questions (only their keys, to count them), no
// trainer-feedback questions, answers or evaluations, and never the learner's
// access token. An opened programme reads its details (the *_DETAIL_SELECTs).
export const PROGRAM_SELECT='id,program_key,title,title_en,category,method,delivery_kind,owner,trainer,audience,description,start_date,start_time,due_date,duration_hours,location,cost,valid_months,requires_assessment,pass_score,status,department_id,feedback_template_key,feedback_title_el,feedback_title_en,created_at,updated_at,training_program_materials(material_key,position,title,material_type,url),training_program_effectiveness(planned_date,method,criterion,result,evaluated_at,evaluated_by,notes,comment),training_assessment_questions(question_key)'
export const PROGRAM_DETAIL_SELECT='id,program_key,title,title_en,category,method,delivery_kind,owner,trainer,audience,description,start_date,start_time,due_date,duration_hours,location,cost,valid_months,requires_assessment,pass_score,status,department_id,feedback_template_key,feedback_title_el,feedback_title_en,created_at,updated_at,training_program_materials(material_key,position,title,material_type,url),training_assessment_questions(question_key,position,question_type,text,points,required,correct_boolean,model_answer,manual_review,training_assessment_options(option_key,position,text,correct)),training_program_effectiveness(planned_date,method,criterion,result,evaluated_at,evaluated_by,notes,comment),training_program_feedback_questions(question_key,position,label_el,label_en)'
export const ASSIGNMENT_SELECT='id,assignment_key,program_id,employee_id,employee_code,employee_name,department_name,department_id,employee_user_id,email,account_linked,manual_entry,assigned_date,due_date,status,invitation_sent_at,attendance_response,attendance,attendance_confirmed_at,attendance_attested,attendance_attested_at,attendance_attestation_method,attendance_attestation_version,completion_confirmed_at,feedback_submitted_at,assessment_submitted_at,assessment_review_status,assessment_reviewed_at,assessment_reviewed_by,assessment_review_acknowledged,assessment_review_note,score,competent,completed_date,created_at,updated_at,training_certificates(certificate_key)'
export const ASSIGNMENT_DETAIL_SELECT='id,assignment_key,program_id,employee_id,employee_code,employee_name,department_name,department_id,employee_user_id,email,account_linked,manual_entry,assigned_date,due_date,status,invitation_sent_at,attendance_response,attendance,attendance_confirmed_at,attendance_attested,attendance_attested_at,attendance_attestation_method,attendance_attestation_version,completion_confirmed_at,feedback_submitted_at,assessment_submitted_at,assessment_review_status,assessment_reviewed_at,assessment_reviewed_by,assessment_review_acknowledged,assessment_review_note,score,competent,completed_date,created_at,updated_at,training_assessment_answers(question_key,answer_kind,answer_text,answer_boolean,answer_number,answer_option_keys,awarded_points),training_feedback_responses(employee_code,user_id,submitted_at,comment,training_feedback_scores(question_key,score)),training_certificates(certificate_key)'
// The calendar's dates only.
export const PROGRAM_CALENDAR_SELECT='id,program_key,title,title_en,audience,start_date,due_date,status,training_program_effectiveness(planned_date,result)'
export const ASSIGNMENT_CALENDAR_SELECT='id,assignment_key,program_id,employee_name,department_name,status'
export const CERTIFICATE_CALENDAR_SELECT='id,certificate_key,assignment_id,title,valid_until'
export const CERTIFICATE_SELECT='id,certificate_key,assignment_id,employee_code,title,issued_date,valid_until,issuer,issued_at,issued_by,department_id,employee_user_id,training_assignments(assignment_key)'
export const REQUIREMENT_SELECT='id,requirement_key,title,renewal_months,active,training_requirement_programs(position,training_programs(program_key)),training_requirement_targets(target_kind,value,position)'
export const HISTORY_SELECT='position,occurred_at,actor,action'
export const TEMPLATE_SELECT='template_key,title_el,title_en,updated_at,training_feedback_template_questions(question_key,position,label_el,label_en)'

export function effectivenessFromRow(row){
 if(!row)return null
 return {plannedDate:row.planned_date||'',method:row.method||'',criterion:row.criterion||'',result:row.result||'',evaluatedAt:row.evaluated_at||'',evaluatedBy:row.evaluated_by||'',notes:row.notes||'',comment:row.comment||''}
}

export function questionFromRow(row){
 return {id:row.question_key,type:row.question_type,text:row.text||'',points:num(row.points)??0,required:row.required!==false,options:sorted(row.training_assessment_options).map(o=>({id:o.option_key,text:o.text||'',correct:Boolean(o.correct)})),correctBoolean:row.correct_boolean==null?true:Boolean(row.correct_boolean),modelAnswer:row.model_answer||'',manualReview:Boolean(row.manual_review)}
}

export function programFromRow(row,feedbackResponses=[]){
 const program={id:row.program_key,dbId:row.id,title:row.title||'',category:row.category||'',method:row.method||'',owner:row.owner||'',trainer:row.trainer||'',audience:row.audience||'',description:row.description||'',startDate:row.start_date||'',dueDate:row.due_date||'',validMonths:num(row.valid_months),requiresAssessment:Boolean(row.requires_assessment),passScore:num(row.pass_score),status:row.status||'planned',departmentId:row.department_id||null,userId:null,
  deliveryKind:row.delivery_kind||'',startTime:row.start_time?String(row.start_time).slice(0,5):'',durationHours:num(row.duration_hours),location:row.location||'',cost:num(row.cost),
  materials:sorted(row.training_program_materials).map(m=>({id:m.material_key,title:m.title||'',type:m.material_type||'',url:m.url||''})),
  assessmentQuestions:sorted(row.training_assessment_questions).map(questionFromRow),
  feedbackResponses,createdAt:row.created_at||null,updatedAt:row.updated_at||null}
 if(row.title_en)program.titleEn=row.title_en
 if(row.feedback_template_key)program.trainerFeedbackTemplate={id:row.feedback_template_key,titleEl:row.feedback_title_el||'',titleEn:row.feedback_title_en||'',questions:sorted(row.training_program_feedback_questions).map(q=>({id:q.question_key,labelEl:q.label_el||'',labelEn:q.label_en||''}))}
 const effectiveness=effectivenessFromRow(one(row.training_program_effectiveness))
 if(effectiveness)program.effectiveness=effectiveness
 return program
}

// An answer row back to the value the learner gave.
export function answerValue(row){
 if(row.answer_kind==='boolean')return row.answer_boolean
 if(row.answer_kind==='number')return num(row.answer_number)
 if(row.answer_kind==='options')return Array.isArray(row.answer_option_keys)?[...row.answer_option_keys]:[]
 return row.answer_text??''
}
export function answersFromRows(rows){
 const list=Array.isArray(rows)?rows:[]
 if(!list.length)return null
 return Object.fromEntries([...list].sort((a,b)=>String(a.question_key).localeCompare(String(b.question_key))).map(row=>[row.question_key,answerValue(row)]))
}
const scoresFromRows=rows=>Object.fromEntries((Array.isArray(rows)?rows:[]).map(s=>[s.question_key,num(s.score)]))

export function assignmentFromRow(row,programKeyById=new Map()){
 const response=one(row.training_feedback_responses),certificate=one(row.training_certificates)
 const answers=answersFromRows(row.training_assessment_answers)
 const awarded=(Array.isArray(row.training_assessment_answers)?row.training_assessment_answers:[]).filter(a=>a.awarded_points!=null)
 const assignment={id:row.assignment_key,dbId:row.id,programId:programKeyById.get(row.program_id)||null,employeeId:row.employee_code||'',employeeDbId:row.employee_id||null,employeeName:row.employee_name||'',department:row.department_name||'',departmentId:row.department_id||null,userId:row.employee_user_id||null,email:row.email||'',accountLinked:row.account_linked,
  assignedDate:row.assigned_date||'',dueDate:row.due_date||'',status:row.status||'assigned',invitationSentAt:row.invitation_sent_at||null,attendanceResponse:row.attendance_response||'not_sent',attendance:row.attendance??null,attendanceConfirmedAt:row.attendance_confirmed_at||null,
  attendanceAttested:row.attendance_attested??null,attendanceAttestedAt:row.attendance_attested_at||null,attendanceAttestationMethod:row.attendance_attestation_method||null,attendanceAttestationVersion:row.attendance_attestation_version||null,
  completionConfirmedAt:row.completion_confirmed_at||null,feedbackSubmittedAt:row.feedback_submitted_at||null,assessmentSubmittedAt:row.assessment_submitted_at||null,
  assessmentAnswers:answers||(row.feedback_submitted_at?{}:null),assessmentReviewStatus:row.assessment_review_status||null,assessmentReviewedAt:row.assessment_reviewed_at||null,assessmentReviewedBy:row.assessment_reviewed_by||null,assessmentReviewAcknowledged:row.assessment_review_acknowledged??null,assessmentReviewNote:row.assessment_review_note||null,
  score:num(row.score),competent:row.competent??null,completedDate:row.completed_date||null,certificateId:certificate?.certificate_key||null,
  feedbackScores:response?scoresFromRows(response.training_feedback_scores):null,feedbackComment:response?response.comment??null:null,createdAt:row.created_at||null,updatedAt:row.updated_at||null}
 if(awarded.length)assignment.awardedPoints=Object.fromEntries(awarded.map(a=>[a.question_key,num(a.awarded_points)]))
 if(row.manual_entry)assignment.manualEntry=true
 if(row.access_token)assignment.accessToken=row.access_token
 return assignment
}

// The trainer evaluations a programme collected, from its assignments
// (programme.feedbackResponses), oldest first.
export function feedbackResponsesFromRows(assignmentRows=[]){
 const byProgram=new Map()
 for(const row of assignmentRows){
  const response=one(row.training_feedback_responses)
  if(!response)continue
  const list=byProgram.get(row.program_id)||[]
  list.push({employeeId:response.employee_code||row.employee_code||'',userId:response.user_id||null,assignmentId:row.assignment_key,submittedAt:response.submitted_at||null,scores:scoresFromRows(response.training_feedback_scores),comment:response.comment??null})
  byProgram.set(row.program_id,list)
 }
 for(const list of byProgram.values())list.sort((a,b)=>String(a.submittedAt||'').localeCompare(String(b.submittedAt||''))||String(a.assignmentId).localeCompare(String(b.assignmentId)))
 return byProgram
}

export function certificateFromRow(row,assignmentKeyById=new Map()){
 const certificate={id:row.certificate_key,dbId:row.id,assignmentId:one(row.training_assignments)?.assignment_key||assignmentKeyById.get(row.assignment_id)||null,employeeId:row.employee_code||'',title:row.title||'',issuedDate:row.issued_date||'',validUntil:row.valid_until||null,issuer:row.issuer||'',departmentId:row.department_id||null,userId:row.employee_user_id||null}
 if(row.issued_at)certificate.issuedAt=row.issued_at
 if(row.issued_by)certificate.issuedById=row.issued_by
 return certificate
}

export function requirementFromRow(row){
 const targets=sorted(row.training_requirement_targets),of=kind=>targets.filter(t=>t.target_kind===kind).map(t=>t.value)
 return {id:row.requirement_key,dbId:row.id,title:row.title||'',programIds:sorted(row.training_requirement_programs).map(rp=>one(rp.training_programs)?.program_key).filter(Boolean),professions:of('profession'),positions:of('position'),departments:of('department'),renewalMonths:num(row.renewal_months),active:row.active!==false,departmentId:null,userId:null}
}

export const historyFromRows=(rows=[])=>sorted(rows).map(row=>({at:row.occurred_at||'',actor:row.actor||'',action:row.action||''}))

export function templateFromRow(row){
 if(!row)return null
 return {id:row.template_key,titleEl:row.title_el||'',titleEn:row.title_en||'',questions:sorted(row.training_feedback_template_questions).map(q=>({id:q.question_key,labelEl:q.label_el||'',labelEn:q.label_en||''})),updatedAt:row.updated_at||null}
}

// The whole Training state from the rows of each table.
export function trainingStateFromRows({programs=[],assignments=[],certificates=[],requirements=[],history=[]}={}){
 const programKeyById=new Map(programs.map(p=>[p.id,p.program_key])),assignmentKeyById=new Map(assignments.map(a=>[a.id,a.assignment_key])),responses=feedbackResponsesFromRows(assignments)
 return {programs:programs.map(row=>programFromRow(row,responses.get(row.id)||[])),assignments:assignments.map(row=>assignmentFromRow(row,programKeyById)),certificates:certificates.map(row=>certificateFromRow(row,assignmentKeyById)),requirements:requirements.map(requirementFromRow),emailOutbox:[],history:historyFromRows(history)}
}

// A lean register row leaves the detail keys out (not empty): a save of a lean
// programme then keeps its questions and feedback template in the database
// (training_save_program only replaces what it is sent).
export function leanProgram(program,row){
 const lean={...program}
 delete lean.assessmentQuestions;delete lean.trainerFeedbackTemplate;delete lean.feedbackResponses
 lean.questionCount=Array.isArray(row?.training_assessment_questions)?row.training_assessment_questions.length:0
 return lean
}
export function leanAssignment(assignment){
 const lean={...assignment}
 delete lean.assessmentAnswers;delete lean.feedbackScores;delete lean.feedbackComment;delete lean.awardedPoints
 return lean
}
export function leanTrainingStateFromRows(rows={}){
 const state=trainingStateFromRows(rows),byKey=new Map((rows.programs||[]).map(row=>[row.program_key,row]))
 return {...state,programs:state.programs.map(program=>leanProgram(program,byKey.get(program.id))),assignments:state.assignments.map(leanAssignment)}
}

// What the learner submits through the e-mailed link, and what follows from
// it. A manager's save never sends these: the RPC ignores them and the
// database keeps them (trg_training_assignments_learner_fields).
export const learnerOwnedAssignmentFields=['attendance','attendanceResponse','attendanceConfirmedAt','attendanceAttested','attendanceAttestedAt','attendanceAttestationMethod','attendanceAttestationVersion','completionConfirmedAt','feedbackSubmittedAt','assessmentSubmittedAt','assessmentAnswers','awardedPoints','score','competent','certificateId','feedbackScores','feedbackComment','completedDate','accessToken','invitationSentAt','assessmentReviewStatus','assessmentReviewNote']
const derivedFields=['dbId','employeeDbId','computedStatus','createdAt','updatedAt']

function omit(value,keys){const clean={...value};for(const key of keys)delete clean[key];return clean}
// RPC input (JSON only as the input format; the RPC writes columns).
export const programToRpc=program=>omit(program,['dbId','feedbackResponses','questionCount','createdAt','updatedAt'])
export const assignmentToRpc=assignment=>omit(assignment,[...learnerOwnedAssignmentFields,...derivedFields])
export const requirementToRpc=requirement=>omit(requirement,['dbId','departmentId','userId'])

// Which records changed since they were loaded: only those are sent.
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,stable(value[key])])):value
export const recordFingerprint=value=>JSON.stringify(stable(value))
export function changedRecords(list=[],baseline=new Map(),toRpc=x=>x){
 return list.map(toRpc).filter(item=>item?.id&&baseline.get(item.id)!==recordFingerprint(item))
}
export function fingerprints(state){
 return {programs:new Map((state?.programs||[]).map(p=>{const v=programToRpc(p);return [v.id,recordFingerprint(v)]})),assignments:new Map((state?.assignments||[]).map(a=>{const v=assignmentToRpc(a);return [v.id,recordFingerprint(v)]}))}
}
