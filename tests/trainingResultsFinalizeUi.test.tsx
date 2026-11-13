// @vitest-environment jsdom
// The manager finishes a pending manual review from the Results tab: points
// for the free-text answer, the score is recomputed, the assignment completed
// and the certificate issued (Demo mode runs the same rules locally).
import { afterEach,describe,expect,it,vi } from 'vitest'
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const feedback={notify:vi.fn(),notifyError:vi.fn(),confirm:vi.fn(async()=>true)}
vi.mock('../src/core/supabase/client',()=>({supabase:null}))
vi.mock('../src/core/feedback/FeedbackContext',()=>({useFeedback:()=>feedback,useOptionalFeedback:()=>feedback}))
vi.mock('../src/core/auth/AuthContext',()=>({useAuth:()=>({profile:{fullName:'Ελένη Ελέγκτρια'},user:{email:'e@example.org'}})}))

const { configureDataEnvironment }=await import('../src/core/data/dataEnvironment')
const { LanguageProvider }=await import('../src/core/i18n/LanguageContext')
const { TrainingResultsReview }=await import('../src/features/training/TrainingResultsReview')

const program={id:'TRN-R',title:'Review programme',requiresAssessment:true,passScore:50,validMonths:12,feedbackResponses:[],trainerFeedbackTemplate:{id:'T',titleEl:'',titleEn:'',questions:[{id:'clarity',labelEl:'Σαφήνεια',labelEn:'Clarity'}]},
 assessmentQuestions:[{id:'Q1',type:'single_choice',text:'Pick B',points:2,required:true,options:[{id:'A',text:'A',correct:false},{id:'B',text:'B',correct:true}]},{id:'Q2',type:'free_text',text:'Explain',points:4,required:true,options:[],manualReview:true}]}
const pending={id:'TRA-R',programId:'TRN-R',employeeId:'EMP-1',employeeName:'Μαρία Π.',department:'ΜΕΘ',status:'in_progress',attendanceResponse:'confirmed',feedbackSubmittedAt:'2026-10-01T09:00:00Z',assessmentSubmittedAt:'2026-10-01T09:00:00Z',assessmentReviewStatus:'pending',assessmentAnswers:{Q1:'B',Q2:'Because'},feedbackScores:{clarity:5},feedbackComment:'',score:100,competent:null,certificateId:null}
const state={programs:[program],assignments:[pending],certificates:[],requirements:[],emailOutbox:[],history:[]}

afterEach(()=>{cleanup();vi.clearAllMocks()})

describe('training results review: complete a pending manual review',()=>{
 it('awards the free-text points, recomputes the score and completes the assignment with its certificate',async()=>{
  configureDataEnvironment({mode:'demo',organizationId:'demo-hospital'})
  const onReviewed=vi.fn()
  render(<LanguageProvider><TrainingResultsReview program={program} rows={[pending]} state={state} onPersist={vi.fn()} organizationId="demo-hospital" onReviewed={onReviewed}/></LanguageProvider>)
  fireEvent.click(screen.getByText('Μαρία Π.'))
  expect(screen.getByText('Ολοκλήρωση της αξιολόγησης')).toBeInTheDocument()
  // 2/2 automatic + 0/4 free text = 33% until the reviewer awards points
  expect(screen.getByText(/33% · Μη επιτυχής/)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Βαθμοί (0–4)'),{target:{value:'2'}})
  expect(screen.getByText(/67% · Επιτυχής/)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Σημείωση ελέγχου'),{target:{value:'Επαρκής αιτιολόγηση'}})
  fireEvent.click(screen.getByRole('button',{name:'Ολοκλήρωση ελέγχου'}))
  await waitFor(()=>expect(onReviewed).toHaveBeenCalled())
  const next=onReviewed.mock.calls[0][0]
  expect(next.assignments[0]).toMatchObject({status:'completed',score:67,competent:true,assessmentReviewStatus:'reviewed',assessmentReviewedBy:'Ελένη Ελέγκτρια',assessmentReviewNote:'Επαρκής αιτιολόγηση',certificateId:'CERT-TRA-R'})
  expect(next.certificates).toEqual([expect.objectContaining({id:'CERT-TRA-R',assignmentId:'TRA-R'})])
  expect(feedback.notify).toHaveBeenCalledWith('Ο έλεγχος ολοκληρώθηκε.','success')
 })

 it('keeps the "mark as reviewed" acknowledgement for an attempt without a pending review',()=>{
  configureDataEnvironment({mode:'demo',organizationId:'demo-hospital'})
  const done={...pending,status:'completed',assessmentReviewStatus:'not_required',competent:true}
  render(<LanguageProvider><TrainingResultsReview program={program} rows={[done]} state={{...state,assignments:[done]}} onPersist={vi.fn()}/></LanguageProvider>)
  fireEvent.click(screen.getByText('Μαρία Π.'))
  expect(screen.queryByText('Ολοκλήρωση της αξιολόγησης')).not.toBeInTheDocument()
  expect(screen.getByText('Έλεγξα τις απαντήσεις και το αποτέλεσμα του εκπαιδευόμενου.')).toBeInTheDocument()
 })
})
