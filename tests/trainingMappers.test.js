import { describe,expect,it } from 'vitest'
import { trainingDemoState } from '../src/features/training/trainingData'
import { answerValue,assignmentToRpc,changedRecords,fingerprints,programFromRow,programToRpc,requirementFromRow,requirementToRpc,trainingStateFromRows } from '../src/features/training/trainingMappers'

// The rows PostgREST returns for a state, column by column, as the migration
// copies training_records (empty strings become NULL, arrays keep their order
// in position). A test mirror of 20261115100000's copy, not app code.
const nul=v=>v===''||v===undefined?null:v
const kind=v=>typeof v==='string'?'text':typeof v==='boolean'?'boolean':typeof v==='number'?'number':'options'
function rowsFromState(state){
 const programId=key=>`p-${key}`,assignmentId=key=>`a-${key}`
 const certificateOf=new Map(state.certificates.map(c=>[c.assignmentId,c]))
 const programs=state.programs.map(p=>({id:programId(p.id),program_key:p.id,title:p.title,title_en:nul(p.titleEn),category:nul(p.category),method:nul(p.method),owner:nul(p.owner),trainer:nul(p.trainer),audience:nul(p.audience),description:nul(p.description),start_date:nul(p.startDate),due_date:nul(p.dueDate),valid_months:p.validMonths??null,requires_assessment:Boolean(p.requiresAssessment),pass_score:p.passScore??null,status:p.status,department_id:null,
  feedback_template_key:p.trainerFeedbackTemplate?.id||null,feedback_title_el:nul(p.trainerFeedbackTemplate?.titleEl),feedback_title_en:nul(p.trainerFeedbackTemplate?.titleEn),created_at:'2026-01-01T00:00:00+00:00',updated_at:'2026-01-02T00:00:00+00:00',
  training_program_materials:(p.materials||[]).map((m,i)=>({material_key:m.id,position:i+1,title:m.title,material_type:nul(m.type),url:nul(m.url)})).reverse(),
  training_assessment_questions:(p.assessmentQuestions||[]).map((q,i)=>({question_key:q.id,position:i+1,question_type:q.type,text:q.text,points:q.points,required:q.required,correct_boolean:q.correctBoolean,model_answer:nul(q.modelAnswer),manual_review:q.manualReview,training_assessment_options:(q.options||[]).map((o,j)=>({option_key:o.id,position:j+1,text:o.text,correct:o.correct}))})).reverse(),
  training_program_effectiveness:p.effectiveness?[{planned_date:nul(p.effectiveness.plannedDate),method:nul(p.effectiveness.method),criterion:nul(p.effectiveness.criterion),result:nul(p.effectiveness.result),evaluated_at:nul(p.effectiveness.evaluatedAt),evaluated_by:nul(p.effectiveness.evaluatedBy),notes:nul(p.effectiveness.notes),comment:null}]:[],
  training_program_feedback_questions:(p.trainerFeedbackTemplate?.questions||[]).map((q,i)=>({question_key:q.id,position:i+1,label_el:q.labelEl,label_en:nul(q.labelEn)}))}))
 const assignments=state.assignments.map(a=>({id:assignmentId(a.id),assignment_key:a.id,program_id:programId(a.programId),employee_id:null,employee_code:nul(a.employeeId),employee_name:nul(a.employeeName),department_name:nul(a.department),department_id:null,employee_user_id:null,email:nul(a.email),account_linked:a.accountLinked??null,manual_entry:Boolean(a.manualEntry),assigned_date:nul(a.assignedDate),due_date:nul(a.dueDate),status:a.status,invitation_sent_at:a.invitationSentAt??null,access_token:a.accessToken??null,attendance_response:a.attendanceResponse||'not_sent',attendance:a.attendance??null,attendance_confirmed_at:a.attendanceConfirmedAt??null,attendance_attested:null,attendance_attested_at:null,attendance_attestation_method:null,attendance_attestation_version:null,completion_confirmed_at:a.completionConfirmedAt??null,feedback_submitted_at:a.feedbackSubmittedAt??null,assessment_submitted_at:a.assessmentSubmittedAt??null,assessment_review_status:a.assessmentReviewStatus??null,assessment_reviewed_at:a.assessmentReviewedAt??null,assessment_reviewed_by:a.assessmentReviewedBy??null,assessment_review_acknowledged:a.assessmentReviewAcknowledged??null,assessment_review_note:null,score:a.score??null,competent:a.competent??null,completed_date:a.completedDate??null,created_at:'2026-01-01T00:00:00+00:00',updated_at:'2026-01-02T00:00:00+00:00',
  training_assessment_answers:Object.entries(a.assessmentAnswers||{}).map(([key,value])=>({question_key:key,answer_kind:kind(value),answer_text:typeof value==='string'?value:null,answer_boolean:typeof value==='boolean'?value:null,answer_number:typeof value==='number'?value:null,answer_option_keys:Array.isArray(value)?value:null,awarded_points:null})),
  training_feedback_responses:a.feedbackScores?[{employee_code:a.employeeId,user_id:null,submitted_at:a.feedbackSubmittedAt,comment:a.feedbackComment??null,training_feedback_scores:Object.entries(a.feedbackScores).map(([k,v])=>({question_key:k,score:v}))}]:[],
  training_certificates:certificateOf.has(a.id)?[{certificate_key:certificateOf.get(a.id).id}]:[]}))
 const certificates=state.certificates.map(c=>({id:`c-${c.id}`,certificate_key:c.id,assignment_id:assignmentId(c.assignmentId),employee_code:c.employeeId,title:c.title,issued_date:c.issuedDate,valid_until:c.validUntil??null,issuer:c.issuer,issued_at:null,issued_by:null,department_id:null,employee_user_id:null,training_assignments:{assignment_key:c.assignmentId}}))
 const requirements=(state.requirements||[]).map(r=>({id:`r-${r.id}`,requirement_key:r.id,title:r.title,renewal_months:r.renewalMonths,active:r.active,training_requirement_programs:r.programIds.map((id,i)=>({position:i+1,training_programs:{program_key:id}})),training_requirement_targets:[...(r.professions||[]).map((v,i)=>({target_kind:'profession',value:v,position:i+1})),...(r.positions||[]).map((v,i)=>({target_kind:'position',value:v,position:i+1})),...(r.departments||[]).map((v,i)=>({target_kind:'department',value:v,position:i+1}))]}))
 const history=state.history.map((h,i)=>({position:i+1,occurred_at:h.at,actor:h.actor,action:h.action}))
 return {programs,assignments,certificates,requirements,history}
}

describe('training mappers: rows to the in-app objects',()=>{
 const state=structuredClone(trainingDemoState)
 const mapped=trainingStateFromRows(rowsFromState(state))

 it('rebuilds every programme as the screens use it (id = key, dbId = row id)',()=>{
  expect(mapped.programs).toHaveLength(state.programs.length)
  for(const original of state.programs){
   const program=mapped.programs.find(p=>p.id===original.id)
   expect(program.dbId).toBe(`p-${original.id}`)
   for(const key of ['title','category','method','owner','trainer','audience','startDate','dueDate','validMonths','requiresAssessment','passScore','status','description'])expect(program[key]).toEqual(original[key])
   expect(program.materials).toEqual(original.materials.map(m=>({id:m.id,title:m.title,type:m.type||'',url:m.url||''})))
   expect(program.assessmentQuestions).toEqual(original.assessmentQuestions)
   if(original.effectiveness)expect(program.effectiveness).toEqual({...original.effectiveness,comment:''})
   else expect(program).not.toHaveProperty('effectiveness')
  }
 })

 it('rebuilds every assignment, its answers, trainer evaluation and certificate',()=>{
  expect(mapped.assignments).toHaveLength(state.assignments.length)
  for(const original of state.assignments){
   const a=mapped.assignments.find(x=>x.id===original.id)
   expect(a.dbId).toBe(`a-${original.id}`)
   for(const key of ['programId','employeeId','employeeName','department','email','assignedDate','dueDate','status','attendanceResponse','score','competent','certificateId'])expect(a[key]).toEqual(original[key]??null)
   expect(a.assessmentAnswers).toEqual(original.assessmentAnswers||(original.feedbackSubmittedAt?{}:null))
   expect(a.feedbackScores).toEqual(original.feedbackScores||null)
   if(original.feedbackScores)expect(a.feedbackComment).toBe(original.feedbackComment??null)
  }
 })

 it('collects the trainer evaluations of a programme from its assignments, oldest first',()=>{
  const program=mapped.programs.find(p=>p.id==='TRN-003')
  const expected=state.assignments.filter(a=>a.programId==='TRN-003'&&a.feedbackScores).sort((x,y)=>x.feedbackSubmittedAt.localeCompare(y.feedbackSubmittedAt))
  expect(program.feedbackResponses.map(r=>r.assignmentId)).toEqual(expected.map(a=>a.id))
  expect(program.feedbackResponses[0]).toMatchObject({employeeId:expected[0].employeeId,scores:expected[0].feedbackScores,submittedAt:expected[0].feedbackSubmittedAt})
 })

 it('rebuilds certificates, requirements and history',()=>{
  expect(mapped.certificates.map(c=>[c.id,c.assignmentId,c.validUntil])).toEqual(state.certificates.map(c=>[c.id,c.assignmentId,c.validUntil]))
  for(const original of state.requirements){
   const r=mapped.requirements.find(x=>x.id===original.id)
   expect(r).toMatchObject({title:original.title,programIds:original.programIds,professions:original.professions||[],positions:original.positions||[],departments:original.departments||[],renewalMonths:original.renewalMonths,active:true})
  }
  expect(mapped.history).toEqual(state.history)
 })

 it('reads each answer kind back to the value the learner gave',()=>{
  expect(answerValue({answer_kind:'text',answer_text:'Q-1-O2'})).toBe('Q-1-O2')
  expect(answerValue({answer_kind:'boolean',answer_boolean:false})).toBe(false)
  expect(answerValue({answer_kind:'number',answer_number:'2'})).toBe(2)
  expect(answerValue({answer_kind:'options',answer_option_keys:['a','b']})).toEqual(['a','b'])
 })

 it('takes a one-to-one embed as an object or as a one-element array',()=>{
  const base={id:'u',program_key:'TRN-X',title:'X',status:'active',requires_assessment:false}
  const asObject=programFromRow({...base,training_program_effectiveness:{planned_date:'2027-01-01',result:'effective',evaluated_by:'Ε. Αξιολογητής',evaluated_at:'2027-01-05',comment:'Από το FileMaker'}})
  const asArray=programFromRow({...base,training_program_effectiveness:[{planned_date:'2027-01-01',result:'effective',evaluated_by:'Ε. Αξιολογητής',evaluated_at:'2027-01-05',comment:'Από το FileMaker'}]})
  expect(asObject.effectiveness).toEqual(asArray.effectiveness)
  expect(asObject.effectiveness).toMatchObject({result:'effective',evaluatedBy:'Ε. Αξιολογητής',evaluatedAt:'2027-01-05',comment:'Από το FileMaker'})
  expect(programFromRow({...base,training_program_effectiveness:null})).not.toHaveProperty('effectiveness')
 })
})

describe('training mappers: the RPC input',()=>{
 it('sends only what changed since the load',()=>{
  const state=structuredClone(trainingDemoState),baseline=fingerprints(state)
  expect(changedRecords(state.programs,baseline.programs,programToRpc)).toEqual([])
  const edited={...state.programs[1],title:'Changed'}
  const next=[state.programs[0],edited,...state.programs.slice(2),{id:'TRN-NEW',title:'New'}]
  expect(changedRecords(next,baseline.programs,programToRpc).map(p=>p.id)).toEqual([edited.id,'TRN-NEW'])
  // learner-owned fields and derived fields never make an assignment "changed"
  const assignments=state.assignments.map((a,i)=>i===0?{...a,score:12,computedStatus:'overdue',dbId:'x'}:a)
  expect(changedRecords(assignments,baseline.assignments,assignmentToRpc)).toEqual([])
 })

 it('round-trips a requirement through its RPC input',()=>{
  const requirement={id:'REQ-1',title:'R',programIds:['TRN-1'],professions:['Ιατρός'],positions:[],departments:['ΜΕΘ'],renewalMonths:12,active:true,dbId:'u',departmentId:null,userId:null}
  const input=requirementToRpc(requirement)
  expect(input).toEqual({id:'REQ-1',title:'R',programIds:['TRN-1'],professions:['Ιατρός'],positions:[],departments:['ΜΕΘ'],renewalMonths:12,active:true})
  const row={id:'u',requirement_key:input.id,title:input.title,renewal_months:input.renewalMonths,active:input.active,training_requirement_programs:[{position:1,training_programs:{program_key:'TRN-1'}}],training_requirement_targets:[{target_kind:'department',value:'ΜΕΘ',position:1},{target_kind:'profession',value:'Ιατρός',position:1}]}
  expect(requirementFromRow(row)).toEqual(requirement)
 })
})

describe('training mappers: programme details (delivery kind, time, hours, location, cost)',()=>{
 const row={id:'p-1',program_key:'TRN-FM-1',title:'T',status:'completed',delivery_kind:'intra_department',start_time:'14:00:00',duration_hours:'1.5',location:'Αίθουσα',cost:'300'}
 it('reads each detail from its own column',()=>{
  const program=programFromRow(row)
  expect(program).toMatchObject({deliveryKind:'intra_department',startTime:'14:00',durationHours:1.5,location:'Αίθουσα',cost:300})
 })
 it('leaves missing details empty',()=>{
  const program=programFromRow({id:'p-2',program_key:'TRN-2',title:'T'})
  expect(program).toMatchObject({deliveryKind:'',startTime:'',durationHours:null,location:'',cost:null})
 })
 it('sends the details to the RPC',()=>{
  expect(programToRpc(programFromRow(row))).toMatchObject({deliveryKind:'intra_department',startTime:'14:00',durationHours:1.5,location:'Αίθουσα',cost:300})
 })
})
