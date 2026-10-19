import { describe,expect,it } from 'vitest'
import { trainingDemoState } from '../src/features/training/trainingData'
import { answerIsCorrect,applyReview,applySubmission,manualReviewQuestions,scoreReview,scoreSubmission } from '../src/features/training/trainingScoring'

const sc={id:'Q1',type:'single_choice',points:2,required:true,options:[{id:'A',correct:false},{id:'B',correct:true}]}
const mc={id:'Q2',type:'multiple_choice',points:2,required:true,options:[{id:'A',correct:true},{id:'B',correct:true},{id:'C',correct:false}]}
const tf={id:'Q3',type:'true_false',points:1,required:true,options:[],correctBoolean:false}
const ft={id:'Q4',type:'free_text',points:5,required:true,options:[],manualReview:true}
const program={id:'TRN-T',title:'T',requiresAssessment:true,passScore:60,validMonths:12,assessmentQuestions:[sc,mc,tf,ft],feedbackResponses:[]}
const state=()=>({programs:[structuredClone(program)],assignments:[{id:'TRA-T',programId:'TRN-T',employeeId:'EMP-9',status:'assigned',attendanceResponse:'sent',accessToken:'TRN-ACCESS-x'}],certificates:[],requirements:[],emailOutbox:[],history:[]})

describe('training scoring (same rules as the database)',()=>{
 it('scores each question type like private.training_answer_correct',()=>{
  expect(answerIsCorrect(sc,'B')).toBe(true)
  expect(answerIsCorrect(sc,'A')).toBe(false)
  expect(answerIsCorrect(mc,['B','A'])).toBe(true)
  expect(answerIsCorrect(mc,['A'])).toBe(false)
  expect(answerIsCorrect(mc,['A','B','C'])).toBe(false)
  expect(answerIsCorrect(tf,false)).toBe(true)
  expect(answerIsCorrect(tf,'false')).toBe(true)
  expect(answerIsCorrect(tf,true)).toBe(false)
  expect(answerIsCorrect(tf,undefined)).toBe(false)
 })

 it('refuses an incomplete required answer and leaves free text with manual review pending',()=>{
  expect(()=>scoreSubmission(program,{Q1:'B',Q2:['A','B']})).toThrow('TRAINING_ASSESSMENT_INCOMPLETE')
  expect(scoreSubmission(program,{Q1:'B',Q2:['A','B'],Q3:false,Q4:'because'})).toMatchObject({score:100,manualReview:true,awarded:{Q1:2,Q2:2,Q3:1}})
  expect(scoreSubmission({...program,assessmentQuestions:[sc,mc,tf]},{Q1:'A',Q2:['A','B'],Q3:false})).toMatchObject({score:60,competent:true,manualReview:false})
  expect(scoreSubmission({...program,requiresAssessment:false},{})).toMatchObject({score:null,competent:true})
 })

 it('recomputes the score at the review with the reviewer\'s points',()=>{
  const answers={Q1:'B',Q2:['A','B'],Q3:true,Q4:'because'}
  expect(manualReviewQuestions(program).map(q=>q.id)).toEqual(['Q4'])
  // automatic 4/5, free text 1/5 -> 5/10
  expect(scoreReview(program,answers,{Q4:1})).toMatchObject({score:50,competent:false,awarded:{Q1:2,Q2:2,Q3:0,Q4:1}})
  expect(scoreReview(program,answers,{Q4:9})).toMatchObject({score:90,competent:true})
  expect(scoreReview(program,answers,{Q4:-3}).awarded.Q4).toBe(0)
  expect(scoreReview(program,answers,{Q4:5},false).competent).toBe(false)
 })
})

describe('training learner and manager path (local mirror of the RPCs)',()=>{
 it('submission -> pending review -> manager completes it -> certificate',()=>{
  const submitted=applySubmission(state(),'TRA-T',{answers:{Q1:'B',Q2:['A','B'],Q3:false,Q4:'because'},feedbackScores:{clarity:5},feedbackComment:'  ok  ',now:'2026-10-18T09:00:00.000Z'})
  const a=submitted.assignments[0]
  expect(a).toMatchObject({status:'in_progress',assessmentReviewStatus:'pending',score:100,competent:null,attendanceResponse:'confirmed',attendance:true,feedbackScores:{clarity:5},feedbackComment:'ok',certificateId:null,completionConfirmedAt:null})
  expect(submitted.programs[0].feedbackResponses).toEqual([{employeeId:'EMP-9',userId:null,assignmentId:'TRA-T',submittedAt:'2026-10-18T09:00:00.000Z',scores:{clarity:5},comment:'ok'}])
  expect(submitted.certificates).toEqual([])
  expect(()=>applySubmission(submitted,'TRA-T',{answers:{}})).toThrow('TRAINING_ALREADY_SUBMITTED')

  const reviewed=applyReview(submitted,'TRA-T',{points:{Q4:3},note:'Σωστή αιτιολόγηση',reviewer:'Ε. Ελεγκτής',now:'2026-10-20T10:00:00.000Z'})
  const r=reviewed.assignments[0]
  expect(r).toMatchObject({status:'completed',assessmentReviewStatus:'reviewed',score:80,competent:true,assessmentReviewedBy:'Ε. Ελεγκτής',assessmentReviewNote:'Σωστή αιτιολόγηση',assessmentReviewAcknowledged:true,completedDate:'2026-10-20',certificateId:'CERT-TRA-T'})
  expect(reviewed.certificates).toEqual([expect.objectContaining({id:'CERT-TRA-T',assignmentId:'TRA-T',issuedDate:'2026-10-20',validUntil:'2027-10-20'})])
  expect(()=>applyReview(reviewed,'TRA-T',{})).toThrow('TRAINING_REVIEW_NOT_PENDING')
 })

 it('a fully automatic assessment completes at once and issues the certificate when passed',()=>{
  const auto={...state(),programs:[{...program,assessmentQuestions:[sc,mc,tf]}]}
  const passed=applySubmission(auto,'TRA-T',{answers:{Q1:'B',Q2:['A','B'],Q3:false},now:'2026-10-18T09:00:00.000Z'})
  expect(passed.assignments[0]).toMatchObject({status:'completed',assessmentReviewStatus:'not_required',score:100,competent:true,certificateId:'CERT-TRA-T'})
  expect(passed.certificates).toHaveLength(1)
  const failed=applySubmission(auto,'TRA-T',{answers:{Q1:'A',Q2:['A'],Q3:false},now:'2026-10-18T09:00:00.000Z'})
  expect(failed.assignments[0]).toMatchObject({status:'completed',score:20,competent:false,certificateId:null})
  expect(failed.certificates).toEqual([])
 })

 it('scores the Demo programmes as the stored Demo results', ()=>{
  const demo=structuredClone(trainingDemoState)
  for(const a of demo.assignments.filter(x=>x.assessmentAnswers&&x.score!=null)){
   const p=demo.programs.find(x=>x.id===a.programId)
   expect(scoreSubmission(p,a.assessmentAnswers).score).toBe(a.score)
  }
 })
})
