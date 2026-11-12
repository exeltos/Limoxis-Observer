// Scoring of a knowledge assessment, the same rules as the database
// (private.training_answer_correct, training_submit_evaluation,
// training_finalize_review in 20261115100000_training_relational.sql). Demo
// mode applies them locally; production calls the RPCs.
import { validityUntil } from './trainingData'

const correctOptions=question=>(question?.options||[]).filter(option=>option.correct)

// single choice = the first correct option; multiple choice = exactly the
// correct options; true/false = the correct value. A missing answer is wrong.
export function answerIsCorrect(question,answer){
 if(answer===undefined||answer===null)return false
 if(question.type==='single_choice'){const first=correctOptions(question)[0];return Boolean(first)&&String(answer)===first.id}
 if(question.type==='multiple_choice'){
  if(!Array.isArray(answer))return false
  const correct=correctOptions(question),ids=new Set(correct.map(o=>o.id))
  return correct.length===answer.length&&answer.filter(id=>ids.has(String(id))).length===correct.length
 }
 if(question.type==='true_false'){
  const value=typeof answer==='boolean'?answer:typeof answer==='number'?answer!==0:String(answer).trim().toLowerCase()==='true'?true:String(answer).trim().toLowerCase()==='false'?false:null
  return value!==null&&value===(question.correctBoolean===true)
 }
 return false
}

const blank=answer=>answer===undefined||answer===null||(typeof answer==='string'&&!answer.trim())
const points=question=>Math.max(0,Number(question?.points??1)||0)

// At submission: free text is not scored; one that needs a manual review
// leaves the attempt pending.
export function scoreSubmission(program,answers={}){
 const questions=program?.assessmentQuestions||[]
 if(!program?.requiresAssessment)return {score:null,competent:true,manualReview:false,awarded:{}}
 if(!questions.length)throw new Error('TRAINING_ASSESSMENT_NOT_CONFIGURED')
 let total=0,earned=0,manualReview=false;const awarded={}
 for(const question of questions){
  const answer=answers[question.id]
  if(question.required!==false&&blank(answer))throw new Error('TRAINING_ASSESSMENT_INCOMPLETE')
  if(question.type==='free_text'){if(question.manualReview)manualReview=true;continue}
  total+=points(question)
  const ok=answerIsCorrect(question,answer)
  if(answer!==undefined)awarded[question.id]=ok?points(question):0
  if(ok)earned+=points(question)
 }
 const score=total>0?Math.round(earned/total*100):null
 return {score,competent:score==null?true:score>=Number(program.passScore||0),manualReview,awarded}
}

// At the review: the reviewer's points for each manual-review free-text
// answer (0 up to the question's points) count with the automatic ones.
// competent, when given, is the reviewer's decision.
export function scoreReview(program,answers={},givenPoints={},competent=null){
 let total=0,earned=0;const awarded={}
 for(const question of program?.assessmentQuestions||[]){
  let value
  if(question.type==='free_text'){
   if(!question.manualReview)continue
   const given=Number(givenPoints?.[question.id])
   value=Math.min(points(question),Math.max(0,Number.isFinite(given)?given:0))
  }else value=answerIsCorrect(question,answers[question.id])?points(question):0
  total+=points(question);earned+=value;awarded[question.id]=value
 }
 const score=total>0?Math.round(earned/total*100):null
 return {score,competent:competent==null?(score==null?true:score>=Number(program?.passScore||0)):Boolean(competent),awarded}
}

const certificateFor=(assignment,program,now)=>({id:`CERT-${assignment.id}`,assignmentId:assignment.id,employeeId:assignment.employeeId,title:program.title,issuedDate:now.slice(0,10),validUntil:validityUntil(now.slice(0,10),program.validMonths)||null,issuer:'Limoxis Observer',issuedAt:now})
function withCertificate(state,assignment,program,now){
 if(state.certificates.some(c=>c.assignmentId===assignment.id))return state.certificates
 return [certificateFor(assignment,program,now),...state.certificates]
}

// The learner's submission (training_submit_evaluation) on a local state.
export function applySubmission(state,assignmentId,{answers={},feedbackScores={},feedbackComment='',now=new Date().toISOString()}={}){
 const assignment=state.assignments.find(a=>a.id===assignmentId)
 if(!assignment)throw new Error('TRAINING_ACCESS_NOT_AVAILABLE')
 if(assignment.feedbackSubmittedAt)throw new Error('TRAINING_ALREADY_SUBMITTED')
 const program=state.programs.find(p=>p.id===assignment.programId)
 if(!program)throw new Error('TRAINING_PROGRAM_NOT_FOUND')
 const {score,competent,manualReview,awarded}=scoreSubmission(program,answers)
 const comment=String(feedbackComment||'').trim()||null
 const next={...assignment,attendance:true,attendanceResponse:'confirmed',attendanceConfirmedAt:assignment.attendanceConfirmedAt||now,attendanceAttested:true,attendanceAttestedAt:now,attendanceAttestationMethod:'personal_email_token',attendanceAttestationVersion:'1.0',feedbackSubmittedAt:now,assessmentSubmittedAt:program.requiresAssessment?now:null,assessmentAnswers:answers,awardedPoints:awarded,assessmentReviewStatus:manualReview?'pending':'not_required',completionConfirmedAt:manualReview?null:now,status:manualReview?'in_progress':'completed',completedDate:manualReview?null:now.slice(0,10),score,competent:manualReview?null:competent,feedbackScores,feedbackComment:comment}
 const passed=competent&&!manualReview
 next.certificateId=passed?`CERT-${assignment.id}`:null
 const response={employeeId:assignment.employeeId,userId:null,assignmentId:assignment.id,submittedAt:now,scores:feedbackScores,comment}
 return {...state,assignments:state.assignments.map(a=>a.id===assignmentId?next:a),programs:state.programs.map(p=>p.id===program.id?{...p,feedbackResponses:[...(p.feedbackResponses||[]).filter(r=>r.assignmentId!==assignment.id),response]}:p),certificates:passed?withCertificate(state,next,program,now):state.certificates}
}

// The manager finishes a pending review (training_finalize_review).
export function applyReview(state,assignmentId,{points:givenPoints={},competent=null,note='',reviewer='',now=new Date().toISOString()}={}){
 const assignment=state.assignments.find(a=>a.id===assignmentId)
 if(!assignment)throw new Error('TRAINING_ASSIGNMENT_NOT_FOUND')
 if(assignment.assessmentReviewStatus!=='pending')throw new Error('TRAINING_REVIEW_NOT_PENDING')
 const program=state.programs.find(p=>p.id===assignment.programId)||{}
 const result=scoreReview(program,assignment.assessmentAnswers||{},givenPoints,competent)
 const next={...assignment,status:'completed',completionConfirmedAt:now,completedDate:now.slice(0,10),score:result.score,competent:result.competent,awardedPoints:result.awarded,assessmentReviewStatus:'reviewed',assessmentReviewedAt:now,assessmentReviewedBy:reviewer||null,assessmentReviewAcknowledged:true,assessmentReviewNote:String(note||'').trim()||null,certificateId:result.competent?`CERT-${assignment.id}`:null}
 return {...state,assignments:state.assignments.map(a=>a.id===assignmentId?next:a),certificates:result.competent?withCertificate(state,next,program,now):state.certificates}
}

// Free-text questions that wait for the reviewer's points.
export const manualReviewQuestions=program=>(program?.assessmentQuestions||[]).filter(q=>q.type==='free_text'&&q.manualReview)
