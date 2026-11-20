import './trainingScreens.css'
import { useCallback,useEffect,useMemo,useState } from 'react'
import { AlertCircle,ArrowLeft,Award,CheckCircle2,ChevronLeft,ChevronRight,ClipboardCheck,Clock,ShieldCheck } from 'lucide-react'
import { useLocation,useNavigate,useParams } from 'react-router-dom'
import { Button } from '../../design-system/Button'
import { RouteLoading } from '../../design-system/RouteLoading'
import { StepList } from '../../design-system/StepList'
import { ExportMenu } from '../../design-system/ExportMenu'
import { findTrainingAccess,loadTrainingState,saveTrainingState } from './trainingData'
import { applySubmission } from './trainingScoring'
import { loadTrainingAccessCertificateAsync,loadTrainingEmailAccessAsync,submitTrainingEvaluationAsync } from './trainingInvitationService'
import { trainerFeedbackQuestionsForProgram } from './trainingFeedbackTemplate'
import { downloadCertificatePdf } from './trainingCertificate'
import { TrainingMaterialReader } from './TrainingMaterialReader'
import { accessDetailParts,accessMissing,accessReady,accessResult,accessStepLabel,accessSteps,accessSubmitted,clampStep,questionAnswered } from './trainingAccessFlow'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import type { ReactNode } from 'react'
import type { AssessmentAnswer, AssessmentAnswers, AssessmentOption, AssessmentQuestion as Question, TrainingAssignment, TrainingCertificate, TrainingProgram } from './trainingTypes'
// A question as a learner's link reads it: older programmes kept their options as plain text
// and named the types 'multiple' / 'boolean'.
type AccessQuestion = Omit<Partial<Question>, 'options'> & { id: string, options?: (AssessmentOption | string)[] }
// What a learner's link opens: the programme and the learner's own attempt.
type AccessProgram = Omit<TrainingProgram, 'assessmentQuestions'> & { assessmentQuestions?: AccessQuestion[] }
type AccessData = { program: AccessProgram, assignment: TrainingAssignment }
// What a submission says back: the score, and whether a person still has to review it.
type SubmissionOutcome = Pick<TrainingAssignment, 'score' | 'competent' | 'assessmentReviewStatus'> & { manualReviewRequired?: boolean }
// The certificate of the link's assignment and the hospital that issued it (training_access_certificate).
type AccessCertificate = Partial<TrainingCertificate> & { completedDate?: string | null }
type AccessOrganization = { name?: string, logo?: string, reportHeader?: string }
// What the learner gives in the steps.
type AccessValues = { answers: AssessmentAnswers, scores: Record<string, number>, comment: string }
type FeedbackQuestion = { id: string, label: string }
import type { FeedbackContextValue } from '../../core/feedback/feedbackTypes'
import type { IconType } from '../../design-system/types'
import type { TrainingState } from './trainingData'

// The learner's page (owner, 20/11/2026): one step at a time — 1. Υλικό → 2. Ερωτήσεις (when the programme has an
// assessment) → 3. Αξιολόγηση → 4. Υποβολή — and, after the submission, the result on the same link (score or
// «Ολοκληρώθηκε» / «Αναμονή ελέγχου», the certificate, the material read only). See trainingAccessFlow.
export function TrainingAccessPage(){
 const {token}=useParams();const {language}=useLanguage();const {notifyError}=useFeedback()
 const demoAccess=useMemo(()=>findTrainingAccess(loadTrainingState(),token),[token])
 if(demoAccess)return <DemoTrainingAccess token={token as string} language={language}/>
 return <ProductionTrainingAccess token={token} language={language} notifyError={notifyError}/>
}

function ProductionTrainingAccess({token,language,notifyError}: {token: string|undefined,language: string,notifyError: FeedbackContextValue['notifyError']}){
 const en=language==='en'
 const [state,setState]=useState<{loading: boolean,data: AccessData|null,error: unknown}>({loading:true,data:null,error:null}),[busy,setBusy]=useState(false),[result,setResult]=useState<SubmissionOutcome|null>(null),[certificate,setCertificate]=useState<{certificate?: AccessCertificate,organization?: AccessOrganization}|null>(null)
 const load=useCallback(async()=>{if(!token){setState({loading:false,data:null,error:new Error('TRAINING_ACCESS_NOT_AVAILABLE')});return}setState(s=>({...s,loading:!s.data,error:null}));try{const data=await loadTrainingEmailAccessAsync(token) as AccessData|null;setState({loading:false,data,error:data?null:new Error('TRAINING_ACCESS_NOT_AVAILABLE')})}catch(error){setState({loading:false,data:null,error})}},[token])
 useEffect(()=>{void load()},[load])
 const feedbackQuestions=useMemo(()=>trainerFeedbackQuestionsForProgram(state.data?.program,language),[state.data?.program,language])
 const submitted=Boolean(result)||accessSubmitted(state.data?.assignment)
 useEffect(()=>{let active=true;if(!submitted||!token)return()=>{active=false};loadTrainingAccessCertificateAsync(token).then(data=>{if(active)setCertificate((data as typeof certificate)||null)}).catch(()=>{if(active)setCertificate(null)});return()=>{active=false}},[submitted,token,state.data?.assignment?.certificateId])
 if(state.loading)return <PublicFrame><RouteLoading/></PublicFrame>
 if(state.error||!state.data?.program||!state.data?.assignment)return <PublicFrame><Status title={en?'This training link is not available':'Ο σύνδεσμος εκπαίδευσης δεν είναι διαθέσιμος'} text={en?'The personal secure link may have expired or been revoked.':'Ο προσωπικός ασφαλής σύνδεσμος μπορεί να έχει λήξει ή να έχει ακυρωθεί.'} icon={ShieldCheck}/></PublicFrame>
 const {program,assignment}=state.data
 if(submitted){const org=certificate?.organization;return <PublicFrame><AccessResultView program={program} assignment={assignment} outcome={result} certificate={certificate?.certificate||null} branding={org?{name:org.name||'',logo:org.logo||'',reportHeader:org.reportHeader||'',demo:false,printedBy:''}:null} token={token as string} language={language}/></PublicFrame>}
 async function submit({answers,scores,comment}: AccessValues){if(busy)return;setBusy(true);try{const data=await submitTrainingEvaluationAsync(token as string,{answers,feedbackScores:scores,feedbackComment:comment,attendanceAttested:true});setResult((data as SubmissionOutcome|null)||{score:null,competent:null,assessmentReviewStatus:null});await load()}catch(error){notifyError(error,'save',{operation:'training_evaluation_submit'})}finally{setBusy(false)}}
 return <PublicFrame><AccessSteps program={program} assignment={assignment} token={token as string} language={language} feedbackQuestions={feedbackQuestions} busy={busy} onSubmit={submit}/></PublicFrame>
}

// Title, then «Κατηγορία · Τρόπος · Εκπαιδευτής · Προθεσμία» on one or two lines, then the learner.
function AccessHeader({program,assignment,language,demo=false}: {program: Pick<TrainingProgram,'title'|'requiresAssessment'>&Partial<Omit<TrainingProgram,'assessmentQuestions'>>,assignment?: Partial<TrainingAssignment>|null,language: string,demo?: boolean}){
 const en=language==='en',parts=accessDetailParts(program,language)
 return <div className="training-public-header training-access-header"><div><span className="eyebrow">Limoxis Observer · {en?'Training':'Εκπαίδευση'}{demo?' · Demo':''}</span><h1>{program.title}</h1>{parts.length>0&&<p className="training-access-meta">{parts.join(' · ')}</p>}{assignment?.employeeName&&<p className="training-access-person"><strong>{assignment.employeeName}</strong>{assignment.department?` · ${assignment.department}`:''}</p>}</div><ShieldCheck size={28}/></div>
}

interface AccessStepsProps { program: AccessProgram, assignment: TrainingAssignment, token: string|null, language: string, feedbackQuestions: FeedbackQuestion[], busy?: boolean, demo?: boolean, error?: string, onSubmit: (values: AccessValues)=>unknown }
// The steps. The answers stay while the learner moves between steps; the submission is one, at the last step.
function AccessSteps({program,assignment,token,language,feedbackQuestions,busy=false,demo=false,error='',onSubmit}: AccessStepsProps){
 const en=language==='en',steps=accessSteps(program),questions: AccessQuestion[]=program.assessmentQuestions||[]
 const [step,setStep]=useState(0),[answers,setAnswers]=useState<AssessmentAnswers>({}),[scores,setScores]=useState<Record<string, number>>({}),[comment,setComment]=useState(''),[attested,setAttested]=useState(false)
 useEffect(()=>{if(feedbackQuestions.length)setScores(current=>Object.keys(current).length?current:Object.fromEntries(feedbackQuestions.map(q=>[q.id,5])))},[feedbackQuestions])
 const current=steps[clampStep(step,steps)],missing=accessMissing(program,questions,answers,attested),ready=accessReady(missing),answered=questions.filter(q=>questionAnswered(q,answers[q.id])).length
 const go=(index: number)=>{setStep(clampStep(index,steps));if(typeof window!=='undefined')window.scrollTo({top:0})}
 const goTo=(key: string)=>go(steps.indexOf(key as typeof steps[number]))
 const submit=()=>{if(busy||!ready)return;void onSubmit({answers,scores,comment})}
 return <div className="public-flow-card public-flow-wide training-email-flow training-access-flow">
  <AccessHeader program={program} assignment={assignment} language={language} demo={demo}/>
  <StepList className="training-access-steps" steps={steps.map(key=>accessStepLabel(key,en))} current={clampStep(step,steps)} valid={steps.map(()=>true)} done={steps.map((key,index)=>key==='questions'?index<clampStep(step,steps)&&!missing.unanswered&&!missing.notConfigured:key==='submit'?false:index<clampStep(step,steps))} onSelect={go} ariaLabel={en?'Training steps':'Βήματα εκπαίδευσης'}/>
  {current==='material'&&<div className="training-access-step">
   {program.description&&<p className="training-access-description">{program.description}</p>}
   <TrainingMaterialReader token={token} language={language} materials={program.materials||[]} emptyText={en?'This training has no material to read. Continue to the next step.':'Η εκπαίδευση δεν έχει υλικό για ανάγνωση. Συνεχίστε στο επόμενο βήμα.'}/>
  </div>}
  {current==='questions'&&<section className="public-flow-section training-public-section training-access-step"><div className="training-public-section-title"><ClipboardCheck size={18}/><div><span className="eyebrow">{en?'Trainee evaluation':'Αξιολόγηση εκπαιδευομένου'}</span><h2>{en?'Knowledge assessment':'Αξιολόγηση γνώσεων'}</h2></div></div><p>{en?'Pass threshold':'Όριο επιτυχίας'}: {program.passScore}% · {en?`Answered ${answered} of ${questions.length}`:`Απαντήθηκαν ${answered} από ${questions.length}`}</p>{questions.length?questions.map((q,i)=><AssessmentQuestion key={q.id} question={q} index={i} answer={answers[q.id]} onChange={value=>setAnswers(a=>({...a,[q.id]:value}))} en={en}/>):<div className="setup-note">{en?'The assessment has not been configured. Contact the training coordinator.':'Η αξιολόγηση δεν έχει διαμορφωθεί. Επικοινωνήστε με τον υπεύθυνο εκπαίδευσης.'}</div>}</section>}
  {current==='evaluation'&&<section className="public-flow-section training-public-section training-access-step"><div className="training-public-section-title"><Award size={18}/><div><span className="eyebrow">{en?'Trainer evaluation':'Αξιολόγηση εκπαιδευτή'}</span><h2>{en?'Trainer & training evaluation':'Αξιολόγηση εκπαιδευτή & εκπαίδευσης'}</h2></div></div><p>{en?'Rate each statement from 1 to 5. These answers do not affect your knowledge score.':'Αξιολογήστε κάθε πρόταση από 1 έως 5. Οι απαντήσεις δεν επηρεάζουν τη βαθμολογία γνώσεων.'}</p><div className="training-feedback-grid">{feedbackQuestions.map(q=><label className="field" key={q.id}><span>{q.label}</span><select className="input" value={scores[q.id]??5} onChange={e=>setScores(v=>({...v,[q.id]:Number(e.target.value)}))}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label>)}</div><label className="field"><span>{en?'Comment (optional)':'Σχόλιο (προαιρετικό)'}</span><textarea className="input" rows={3} value={comment} onChange={e=>setComment(e.target.value)}/></label></section>}
  {current==='submit'&&<section className="public-flow-section training-public-section training-access-step">
   <ul className="training-access-checklist" aria-label={en?'Before submitting':'Πριν την υποβολή'}>
    {program.requiresAssessment&&<li className={missing.unanswered||missing.notConfigured?'is-missing':'is-done'}>{missing.unanswered||missing.notConfigured?<AlertCircle size={16}/>:<CheckCircle2 size={16}/>}<span>{missing.notConfigured?(en?'The assessment has not been configured':'Η αξιολόγηση δεν έχει διαμορφωθεί'):missing.unanswered?(en?`${missing.unanswered} question${missing.unanswered===1?'':'s'} unanswered`:`${missing.unanswered} ${missing.unanswered===1?'ερώτηση χωρίς απάντηση':'ερωτήσεις χωρίς απάντηση'}`):(en?'All questions answered':'Απαντήθηκαν όλες οι ερωτήσεις')}</span>{missing.unanswered>0&&<Button variant="quiet" onClick={()=>goTo('questions')}>{en?'Answer':'Απάντηση'}</Button>}</li>}
    <li className="is-done"><CheckCircle2 size={16}/><span>{en?'Trainer & training evaluation':'Αξιολόγηση εκπαιδευτή & εκπαίδευσης'}</span><Button variant="quiet" onClick={()=>goTo('evaluation')}>{en?'Review':'Έλεγχος'}</Button></li>
   </ul>
   <label className="training-attestation"><input type="checkbox" checked={attested} onChange={e=>setAttested(e.target.checked)}/><span><strong>{en?'Attendance declaration':'Δήλωση παρουσίας'}</strong><small>{en?'I confirm that I attended this training. My personal secure link and final submission timestamp are recorded as electronic attendance evidence.':'Επιβεβαιώνω ότι συμμετείχα στην παρούσα εκπαίδευση. Ο προσωπικός ασφαλής σύνδεσμος και η χρονική σήμανση της τελικής υποβολής καταγράφονται ως ηλεκτρονικό τεκμήριο παρουσίας.'}</small></span></label>
   <div className="source-truth-note"><ShieldCheck size={16}/><span>{en?'This personal link is your secure access credential. No Limoxis account is required. After final submission the form is locked.':'Ο προσωπικός σύνδεσμος αποτελεί το ασφαλές διαπιστευτήριο πρόσβασης. Δεν απαιτείται λογαριασμός Limoxis. Μετά την τελική υποβολή η φόρμα κλειδώνει.'}</span></div>
   {error&&<div className="setup-note" role="alert">{error}</div>}
  </section>}
  <div className="training-access-nav">
   {step>0?<Button variant="secondary" onClick={()=>go(step-1)}><ChevronLeft size={16}/>{en?'Back':'Πίσω'}</Button>:<span/>}
   {current==='submit'?<Button disabled={busy||!ready} onClick={submit}>{busy?(en?'Submitting…':'Υποβολή…'):(en?'Confirm attendance & submit once':'Επιβεβαίωση παρουσίας & οριστική υποβολή')}</Button>:<Button onClick={()=>go(step+1)}>{en?'Next':'Επόμενο'}<ChevronRight size={16}/></Button>}
  </div>
 </div>
}

interface AccessResultViewProps { program: AccessProgram, assignment: TrainingAssignment, outcome?: SubmissionOutcome|null, certificate: AccessCertificate|null, branding?: Parameters<typeof downloadCertificatePdf>[0]['branding']|null, token: string|null, language: string, demo?: boolean }
// After the submission: the result, the certificate (when one was issued) and the material, read only. The answers stay
// locked: the link takes no second submission.
function AccessResultView({program,assignment,outcome=null,certificate,branding=null,token,language,demo=false}: AccessResultViewProps){
 const en=language==='en',{notify}=useFeedback(),[downloading,setDownloading]=useState(false)
 const result=accessResult(assignment,outcome),day=(value: unknown)=>value?new Date(`${String(value).slice(0,10)}T12:00:00`).toLocaleDateString(en?'en-GB':'el-GR'):''
 // The score is shown large beside the text, so the text says the threshold it is measured against.
 const scoreText=result.score!=null&&program.passScore!=null?`${en?'Knowledge assessment, pass threshold':'Αξιολόγηση γνώσεων, όριο επιτυχίας'} ${program.passScore}%`:''
 const view={
  review:{icon:Clock,title:en?'Review pending':'Αναμονή ελέγχου',text:en?'Your attendance has been confirmed. A free-text answer is pending review by the training coordinator.':'Η συμμετοχή σας επιβεβαιώθηκε. Μια απάντηση ελεύθερου κειμένου αναμένει έλεγχο από τον υπεύθυνο εκπαίδευσης.'},
  passed:{icon:Award,title:en?'Training completed successfully':'Η εκπαίδευση ολοκληρώθηκε με επιτυχία',text:scoreText},
  failed:{icon:ClipboardCheck,title:en?'Retraining required':'Απαιτείται επανεκπαίδευση',text:`${scoreText}${scoreText?'. ':''}${en?'The training coordinator will contact you.':'Ο υπεύθυνος εκπαίδευσης θα σας ενημερώσει.'}`},
  completed:{icon:CheckCircle2,title:en?'Completed':'Ολοκληρώθηκε',text:en?'Your attendance has been recorded.':'Η συμμετοχή σας καταγράφηκε.'},
 }[result.kind]
 const done=day(assignment.completedDate||assignment.completionConfirmedAt||assignment.feedbackSubmittedAt)
 async function download(pdf: boolean){if(!certificate||downloading)return;setDownloading(true);try{await downloadCertificatePdf({certificate,program:{title:program.title,trainer:program.trainer,durationHours:program.durationHours,startDate:program.startDate},participantName:assignment.employeeName,en,pdf,...(branding?{branding}:{})})}catch(error){notify((error as Error)?.message||(en?'Could not export the certificate.':'Δεν ήταν δυνατή η εξαγωγή του πιστοποιητικού.'),'danger')}finally{setDownloading(false)}}
 const Icon=view.icon
 return <div className="public-flow-card public-flow-wide training-email-flow training-access-flow">
  <AccessHeader program={program} assignment={assignment} language={language} demo={demo}/>
  <section className={`training-access-result is-${result.kind}`} aria-live="polite"><Icon size={26}/><div><h2>{view.title}</h2>{view.text&&<p>{view.text}</p>}{done&&<small>{result.kind==='review'?(en?'Submitted':'Υποβλήθηκε'):(en?'Completed':'Ολοκληρώθηκε')} {done}</small>}</div>{result.score!=null&&<strong className="training-access-score">{result.score}%</strong>}</section>
  {certificate&&<section className="training-access-certificate"><Award size={18}/><div><strong>{en?'Certificate':'Πιστοποιητικό'} {certificate.id}</strong><small>{certificate.validUntil?`${en?'Valid until':'Ισχύει έως'} ${day(certificate.validUntil)}`:(en?'No expiry':'Χωρίς λήξη')}</small></div><ExportMenu language={language} disabled={downloading} buttonLabel={en?'Download':'Λήψη'} onPrint={()=>download(false)} onPdf={()=>download(true)}/></section>}
  <TrainingMaterialReader token={token} language={language} materials={program.materials||[]} readOnly/>
  <div className="source-truth-note"><ShieldCheck size={16}/><span>{en?'Your answers have been submitted and locked. This link does not accept a new submission.':'Οι απαντήσεις σας υποβλήθηκαν και κλείδωσαν. Ο σύνδεσμος δεν δέχεται νέα υποβολή.'}</span></div>
 </div>
}

function AssessmentQuestion({question,index,answer,onChange,en}: {question: AccessQuestion,index: number,answer: unknown,onChange: (value: AssessmentAnswer)=>void,en: boolean}){
 const type=question.type==='multiple'?'single_choice':question.type==='boolean'?'true_false':question.type||'single_choice',options: (AssessmentOption|string)[]=question.options||[]
 if(type==='free_text')return <fieldset className="public-flow-question"><legend>{index+1}. {question.text}{question.required===false?'': ' *'}</legend><textarea className="input" rows={4} value={(answer as string)||''} onChange={e=>onChange(e.target.value)}/></fieldset>
 if(type==='true_false')return <fieldset className="public-flow-question"><legend>{index+1}. {question.text}</legend>{[true,false].map(value=><label key={String(value)} className="check-option"><input type="radio" name={question.id} checked={answer===value} onChange={()=>onChange(value)}/><span>{value?(en?'True':'Σωστό'):(en?'False':'Λάθος')}</span></label>)}</fieldset>
 if(type==='multiple_choice')return <fieldset className="public-flow-question"><legend>{index+1}. {question.text}</legend>{options.map((opt,idx)=>{const id=typeof opt==='object'?(opt.id||String(idx)):String(idx),text=typeof opt==='object'?opt.text:opt,selected=Array.isArray(answer)&&answer.includes(id);return <label key={id} className="check-option"><input type="checkbox" checked={selected} onChange={e=>onChange(e.target.checked?[...(Array.isArray(answer)?answer:[]),id]:(Array.isArray(answer)?answer:[]).filter(x=>x!==id))}/><span>{text}</span></label>})}</fieldset>
 return <fieldset className="public-flow-question"><legend>{index+1}. {question.text}</legend>{options.map((opt,idx)=>{const id=typeof opt==='object'?(opt.id||String(idx)):idx,text=typeof opt==='object'?opt.text:opt;return <label key={String(id)} className="check-option"><input type="radio" name={question.id} checked={String(answer)===String(id)} onChange={()=>onChange(id)}/><span>{text}</span></label>})}</fieldset>
}

// Demo: a link opened from «Οι δικές μου» names the assignment itself; an e-mail-style link of the programme asks for
// the employee code first.
function DemoTrainingAccess({token,language}: {token: string,language: string}){const en=language==='en';const [state,setState]=useState<TrainingState>(loadTrainingState);const access=useMemo(()=>findTrainingAccess(state,token),[state,token]);const [employeeCode,setEmployeeCode]=useState('');const [assignmentId,setAssignmentId]=useState<string|null>(()=>findTrainingAccess(loadTrainingState(),token)?.assignment?.id||null);const assignment=state.assignments.find(x=>x.id===assignmentId);if(!access)return <PublicFrame><Status title={en?'This demo link is not active':'Ο σύνδεσμος demo δεν είναι ενεργός'} text={en?'Use an active demo training link.':'Χρησιμοποιήστε ενεργό σύνδεσμο demo εκπαίδευσης.'}/></PublicFrame>;if(!assignment)return <PublicFrame><div className="public-flow-card"><span className="eyebrow">Limoxis Observer · {en?'Training':'Εκπαίδευση'} · Demo</span><h1>{access.program.title}</h1><form onSubmit={e=>{e.preventDefault();const row=state.assignments.find(x=>x.programId===access.program.id&&String(x.employeeId).toUpperCase()===employeeCode.trim().toUpperCase());if(row)setAssignmentId(row.id)}}><label className="field"><span>{en?'Employee code':'Κωδικός εργαζομένου'}</span><input className="input" value={employeeCode} onChange={e=>setEmployeeCode(e.target.value)}/></label><Button type="submit">{en?'Continue':'Συνέχεια'}</Button></form></div></PublicFrame>;return <DemoFlow state={state} setState={setState} assignment={assignment} program={access.program} language={language}/>}
// Demo: the same submission rules as production (trainingScoring mirrors
// training_submit_evaluation), on the local Demo state.
function DemoFlow({state,setState,assignment,program,language}: {state: TrainingState,setState: (state: TrainingState)=>void,assignment: TrainingAssignment,program: TrainingProgram,language: string}){
 const feedbackQuestions=useMemo(()=>trainerFeedbackQuestionsForProgram(program,language),[program,language])
 const [error,setError]=useState('')
 function finish({answers,scores,comment}: AccessValues){try{setState(saveTrainingState(applySubmission(state,assignment.id,{answers,feedbackScores:scores,feedbackComment:comment})))}catch(failure){setError((failure as Error)?.message||'TRAINING_SUBMIT_FAILED')}}
 if(accessSubmitted(assignment)){const certificate=(state.certificates||[]).find(c=>(assignment.certificateId&&c.id===assignment.certificateId)||c.assignmentId===assignment.id)||null;return <PublicFrame><AccessResultView program={program} assignment={assignment} certificate={certificate?{...certificate,completedDate:assignment.completedDate}:null} token={null} language={language} demo/></PublicFrame>}
 return <PublicFrame><AccessSteps program={program} assignment={assignment} token={null} language={language} feedbackQuestions={feedbackQuestions} demo error={error} onSubmit={finish}/></PublicFrame>
}
// A learner who came from the app («Έναρξη» / «Συνέχεια» in «Οι δικές μου») goes back to it.
function PublicFrame({children}: {children?: ReactNode}){const location=useLocation(),navigate=useNavigate(),{language}=useLanguage(),fromApp=Boolean((location.state as {trainingFromApp?: boolean}|null)?.trainingFromApp);return <main className="public-flow-page"><div className="public-flow-shell">{fromApp&&<Button variant="quiet" className="training-access-back" onClick={()=>navigate('/training')}><ArrowLeft size={15}/>{language==='en'?'My trainings':'Οι εκπαιδεύσεις μου'}</Button>}{children}</div></main>}
function Status({title,text,icon:Icon=CheckCircle2}: {title: ReactNode,text?: ReactNode,icon?: IconType}){return <div className="public-flow-card public-flow-status"><Icon size={34}/><h1>{title}</h1><p>{text}</p></div>}
