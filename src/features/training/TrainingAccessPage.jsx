import { useCallback,useEffect,useMemo,useState } from 'react'
import { Award,CheckCircle2,ClipboardCheck,FileText,ShieldCheck,Star } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Button } from '../../design-system/Button'
import { RouteLoading } from '../../design-system/RouteLoading'
import { findTrainingAccess,loadTrainingState,saveTrainingState } from './trainingData'
import { applySubmission } from './trainingScoring'
import { loadTrainingEmailAccessAsync,submitTrainingEvaluationAsync } from './trainingInvitationService'
import { trainerFeedbackQuestionsForProgram } from './trainingFeedbackTemplate'
import { trainingCategoryLabel,trainingMethodLabel } from './TrainingProgramForm'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'

export function TrainingAccessPage(){
 const {token}=useParams();const {language}=useLanguage();const {notifyError}=useFeedback()
 const demoAccess=useMemo(()=>findTrainingAccess(loadTrainingState(),token),[token])
 if(demoAccess)return <DemoTrainingAccess token={token} language={language}/>
 return <ProductionTrainingAccess token={token} language={language} notifyError={notifyError}/>
}

function questionAnswered(question,answer){
 if(question?.required===false)return true
 if(answer===undefined||answer===null)return false
 if(Array.isArray(answer))return answer.length>0
 if(typeof answer==='string')return answer.trim().length>0
 return true
}

function ProductionTrainingAccess({token,language,notifyError}){
 const en=language==='en'
 const [state,setState]=useState({loading:true,data:null,error:null}),[busy,setBusy]=useState(false),[scores,setScores]=useState({}),[comment,setComment]=useState(''),[answers,setAnswers]=useState({}),[result,setResult]=useState(null),[attested,setAttested]=useState(false)
 const load=useCallback(async()=>{if(!token){setState({loading:false,data:null,error:new Error('TRAINING_ACCESS_NOT_AVAILABLE')});return}setState(s=>({...s,loading:true,error:null}));try{const data=await loadTrainingEmailAccessAsync(token);setState({loading:false,data,error:data?null:new Error('TRAINING_ACCESS_NOT_AVAILABLE')})}catch(error){setState({loading:false,data:null,error})}},[token])
 useEffect(()=>{void load()},[load])
 const feedbackQuestions=useMemo(()=>trainerFeedbackQuestionsForProgram(state.data?.program,language),[state.data?.program,language])
 useEffect(()=>{if(feedbackQuestions.length)setScores(current=>Object.keys(current).length?current:Object.fromEntries(feedbackQuestions.map(q=>[q.id,5])))},[feedbackQuestions])
 if(state.loading)return <PublicFrame><RouteLoading/></PublicFrame>
 if(state.error||!state.data?.program||!state.data?.assignment)return <PublicFrame><Status title={en?'This training link is not available':'Ο σύνδεσμος εκπαίδευσης δεν είναι διαθέσιμος'} text={en?'The personal secure link may have expired or been revoked.':'Ο προσωπικός ασφαλής σύνδεσμος μπορεί να έχει λήξει ή να έχει ακυρωθεί.'} icon={ShieldCheck}/></PublicFrame>
 const {program,assignment}=state.data,questions=program.assessmentQuestions||[],incomplete=program.requiresAssessment&&(!questions.length||questions.some(q=>!questionAnswered(q,answers[q.id])))
 if(result){return <PublicFrame><Status title={result.manualReviewRequired?(en?'Evaluation submitted':'Η αξιολόγηση υποβλήθηκε'):(en?'Training completed':'Η εκπαίδευση ολοκληρώθηκε')} text={result.manualReviewRequired?(en?'Your attendance has been confirmed. A free-text answer is pending review.':'Η συμμετοχή σας επιβεβαιώθηκε. Υπάρχει απάντηση ελεύθερου κειμένου που αναμένει αξιολόγηση.'):result.score==null?program.title:`${en?'Knowledge assessment':'Αξιολόγηση γνώσεων'}: ${result.score}% · ${result.competent?(en?'Successful':'Επιτυχής'):(en?'Retraining required':'Απαιτείται επανεκπαίδευση')}`} icon={result.competent===false?ClipboardCheck:Award}/></PublicFrame>}
 if(assignment.feedbackSubmittedAt||assignment.status==='completed'||assignment.completionConfirmedAt)return <PublicFrame><Status title={en?'Form already submitted':'Η φόρμα έχει ήδη υποβληθεί'} text={en?'This personal link has been locked and cannot be submitted again.':'Ο προσωπικός σύνδεσμος έχει κλειδωθεί και δεν μπορεί να χρησιμοποιηθεί για νέα υποβολή.'} icon={Award}/></PublicFrame>
 async function submit(){if(busy||incomplete||!attested)return;setBusy(true);try{const data=await submitTrainingEvaluationAsync(token,{answers,feedbackScores:scores,feedbackComment:comment,attendanceAttested:true});setResult(data);await load()}catch(error){notifyError(error,'save',{operation:'training_evaluation_submit'})}finally{setBusy(false)}}
 return <PublicFrame><div className="public-flow-card public-flow-wide training-email-flow">
  <div className="training-public-header"><div><span className="eyebrow">Limoxis Observer · Training</span><h1>{program.title}</h1><p><strong>{assignment.employeeName||''}</strong>{assignment.department?` · ${assignment.department}`:''}</p></div><ShieldCheck size={30}/></div>
  <section className="training-public-details">
   <div><span>{en?'Category':'Κατηγορία'}</span><strong>{trainingCategoryLabel(program.category,language)||'—'}</strong></div>
   <div><span>{en?'Method':'Τρόπος'}</span><strong>{trainingMethodLabel(program.method,language)||'—'}</strong></div>
   <div><span>{en?'Trainer':'Εκπαιδευτής'}</span><strong>{program.trainer||program.owner||'—'}</strong></div>
   <div><span>{en?'Due date':'Προθεσμία'}</span><strong>{program.dueDate?new Date(`${program.dueDate}T12:00:00`).toLocaleDateString(en?'en-GB':'el-GR'):'—'}</strong></div>
  </section>
  <div className="training-confirmation-summary"><div><CheckCircle2 size={18}/><span><strong>{en?'Attendance confirmation':'Επιβεβαίωση συμμετοχής'}</strong><small>{en?'The final submission records your attendance and timestamp.':'Η τελική υποβολή καταγράφει την παρουσία και τη χρονική σήμανση.'}</small></span></div><div><ClipboardCheck size={18}/><span><strong>{questions.length} {en?'knowledge questions':'ερωτήσεις γνώσεων'}</strong><small>{program.requiresAssessment?`${en?'Pass threshold':'Όριο επιτυχίας'}: ${program.passScore}%`:(en?'Knowledge assessment not required':'Δεν απαιτείται αξιολόγηση γνώσεων')}</small></span></div></div>
  {program.requiresAssessment&&<section className="public-flow-section training-public-section"><div className="training-public-section-title"><ClipboardCheck size={18}/><div><span className="eyebrow">{en?'Trainee evaluation':'Αξιολόγηση εκπαιδευομένου'}</span><h2>{en?'Knowledge assessment':'Αξιολόγηση γνώσεων'}</h2></div></div><p>{en?'Required score:':'Απαιτούμενη επίδοση:'} {program.passScore}% · {questions.length} {en?'questions':'ερωτήσεις'}</p>{questions.length?questions.map((q,i)=><AssessmentQuestion key={q.id} question={q} index={i} answer={answers[q.id]} onChange={value=>setAnswers(a=>({...a,[q.id]:value}))} en={en}/>):<div className="setup-note">{en?'The assessment has not been configured. Contact the training coordinator.':'Η αξιολόγηση δεν έχει διαμορφωθεί. Επικοινωνήστε με τον υπεύθυνο εκπαίδευσης.'}</div>}</section>}
  <section className="public-flow-section training-public-section"><div className="training-public-section-title"><Star size={18}/><div><span className="eyebrow">{en?'Trainer evaluation':'Αξιολόγηση εκπαιδευτή'}</span><h2>{en?'Trainer & training evaluation':'Αξιολόγηση εκπαιδευτή & εκπαίδευσης'}</h2></div></div><p>{en?'Rate each statement from 1 to 5. These answers do not affect your knowledge score.':'Αξιολογήστε κάθε πρόταση από 1 έως 5. Οι απαντήσεις δεν επηρεάζουν τη βαθμολογία γνώσεων.'}</p><div className="training-feedback-grid">{feedbackQuestions.map(q=><label className="field" key={q.id}><span>{q.label}</span><select className="input" value={scores[q.id]??5} onChange={e=>setScores(v=>({...v,[q.id]:Number(e.target.value)}))}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label>)}</div><label className="field"><span>{en?'Comment (optional)':'Σχόλιο (προαιρετικό)'}</span><textarea className="input" rows="3" value={comment} onChange={e=>setComment(e.target.value)}/></label></section>
  {(program.materials||[]).length>0&&<section className="public-flow-section training-public-section"><h2><FileText size={17}/> {en?'Training material':'Εκπαιδευτικό υλικό'}</h2>{program.materials.map(m=><div key={m.id} className="public-flow-row"><strong>{m.title}</strong><span>{m.type||''}</span></div>)}</section>}
  <label className="training-attestation"><input type="checkbox" checked={attested} onChange={e=>setAttested(e.target.checked)}/><span><strong>{en?'Attendance declaration':'Δήλωση παρουσίας'}</strong><small>{en?'I confirm that I attended this training. My personal secure link and final submission timestamp are recorded as electronic attendance evidence.':'Επιβεβαιώνω ότι συμμετείχα στην παρούσα εκπαίδευση. Ο προσωπικός ασφαλής σύνδεσμος και η χρονική σήμανση της τελικής υποβολής καταγράφονται ως ηλεκτρονικό τεκμήριο παρουσίας.'}</small></span></label>
  <div className="source-truth-note"><ShieldCheck size={16}/><span>{en?'This personal link is your secure access credential. No Limoxis account is required. After final submission the form is locked.':'Ο προσωπικός σύνδεσμος αποτελεί το ασφαλές διαπιστευτήριο πρόσβασης. Δεν απαιτείται λογαριασμός Limoxis. Μετά την τελική υποβολή η φόρμα κλειδώνει.'}</span></div>
  <Button disabled={busy||incomplete||!attested} onClick={submit}>{busy?(en?'Submitting…':'Υποβολή…'):(en?'Confirm attendance & submit once':'Επιβεβαίωση παρουσίας & οριστική υποβολή')}</Button>
 </div></PublicFrame>
}

function AssessmentQuestion({question,index,answer,onChange,en}){
 const type=question.type==='multiple'?'single_choice':question.type==='boolean'?'true_false':question.type||'single_choice',options=question.options||[]
 if(type==='free_text')return <fieldset className="public-flow-question"><legend>{index+1}. {question.text}{question.required===false?'': ' *'}</legend><textarea className="input" rows="4" value={answer||''} onChange={e=>onChange(e.target.value)}/></fieldset>
 if(type==='true_false')return <fieldset className="public-flow-question"><legend>{index+1}. {question.text}</legend>{[true,false].map(value=><label key={String(value)} className="check-option"><input type="radio" name={question.id} checked={answer===value} onChange={()=>onChange(value)}/><span>{value?(en?'True':'Σωστό'):(en?'False':'Λάθος')}</span></label>)}</fieldset>
 if(type==='multiple_choice')return <fieldset className="public-flow-question"><legend>{index+1}. {question.text}</legend>{options.map((opt,idx)=>{const id=typeof opt==='object'?(opt.id||String(idx)):String(idx),text=typeof opt==='object'?opt.text:opt,selected=Array.isArray(answer)&&answer.includes(id);return <label key={id} className="check-option"><input type="checkbox" checked={selected} onChange={e=>onChange(e.target.checked?[...(Array.isArray(answer)?answer:[]),id]:(Array.isArray(answer)?answer:[]).filter(x=>x!==id))}/><span>{text}</span></label>})}</fieldset>
 return <fieldset className="public-flow-question"><legend>{index+1}. {question.text}</legend>{options.map((opt,idx)=>{const id=typeof opt==='object'?(opt.id||String(idx)):idx,text=typeof opt==='object'?opt.text:opt;return <label key={String(id)} className="check-option"><input type="radio" name={question.id} checked={String(answer)===String(id)} onChange={()=>onChange(id)}/><span>{text}</span></label>})}</fieldset>
}

function DemoTrainingAccess({token,language}){const en=language==='en';const [state,setState]=useState(loadTrainingState);const access=useMemo(()=>findTrainingAccess(state,token),[state,token]);const [employeeCode,setEmployeeCode]=useState('');const [assignmentId,setAssignmentId]=useState(null);const assignment=state.assignments.find(x=>x.id===assignmentId);if(!access)return <PublicFrame><Status title={en?'This demo link is not active':'Ο σύνδεσμος demo δεν είναι ενεργός'} text={en?'Use an active demo training link.':'Χρησιμοποιήστε ενεργό σύνδεσμο demo εκπαίδευσης.'}/></PublicFrame>;if(!assignment)return <PublicFrame><div className="public-flow-card"><span className="eyebrow">Limoxis Observer · Training · Demo</span><h1>{access.program.title}</h1><form onSubmit={e=>{e.preventDefault();const row=state.assignments.find(x=>x.programId===access.program.id&&String(x.employeeId).toUpperCase()===employeeCode.trim().toUpperCase());if(row)setAssignmentId(row.id)}}><label className="field"><span>{en?'Employee code':'Κωδικός εργαζομένου'}</span><input className="input" value={employeeCode} onChange={e=>setEmployeeCode(e.target.value)}/></label><Button type="submit">{en?'Continue':'Συνέχεια'}</Button></form></div></PublicFrame>;return <DemoFlow state={state} setState={setState} assignment={assignment} program={access.program} language={language}/>} 
// Demo: the same submission rules as production (trainingScoring mirrors
// training_submit_evaluation), on the local Demo state.
function DemoFlow({state,setState,assignment,program,language}){
 const en=language==='en',questions=program.assessmentQuestions||[]
 const feedbackQuestions=useMemo(()=>trainerFeedbackQuestionsForProgram(program,language),[program,language])
 const [answers,setAnswers]=useState({}),[scores,setScores]=useState(()=>Object.fromEntries(feedbackQuestions.map(q=>[q.id,5]))),[comment,setComment]=useState(''),[result,setResult]=useState(null),[error,setError]=useState('')
 const incomplete=program.requiresAssessment&&questions.some(q=>!questionAnswered(q,answers[q.id]))
 function finish(){if(incomplete)return;try{const next=saveTrainingState(applySubmission(state,assignment.id,{answers,feedbackScores:scores,feedbackComment:comment}));setState(next);setResult(next.assignments.find(a=>a.id===assignment.id)||null)}catch(failure){setError(failure?.message||'TRAINING_SUBMIT_FAILED')}}
 if(result)return <PublicFrame><Status title={result.assessmentReviewStatus==='pending'?(en?'Evaluation submitted':'Η αξιολόγηση υποβλήθηκε'):(en?'Training completed':'Η εκπαίδευση ολοκληρώθηκε')} text={result.assessmentReviewStatus==='pending'?(en?'A free-text answer is pending review.':'Υπάρχει απάντηση ελεύθερου κειμένου που αναμένει αξιολόγηση.'):result.score==null?program.title:`${en?'Knowledge assessment':'Αξιολόγηση γνώσεων'}: ${result.score}% · ${result.competent?(en?'Successful':'Επιτυχής'):(en?'Retraining required':'Απαιτείται επανεκπαίδευση')}`} icon={result.competent===false?ClipboardCheck:Award}/></PublicFrame>
 if(assignment.feedbackSubmittedAt||assignment.completionConfirmedAt)return <PublicFrame><Status title={en?'Form already submitted':'Η φόρμα έχει ήδη υποβληθεί'} text={program.title} icon={Award}/></PublicFrame>
 return <PublicFrame><div className="public-flow-card public-flow-wide"><h1>{program.title}</h1><p>{en?'Submit this form to confirm attendance and complete the evaluation.':'Υποβάλετε τη φόρμα για επιβεβαίωση συμμετοχής και ολοκλήρωση της αξιολόγησης.'}</p>
  {program.requiresAssessment&&<section className="public-flow-section"><h2>{en?'Knowledge assessment':'Αξιολόγηση γνώσεων'}</h2>{questions.map((q,i)=><AssessmentQuestion key={q.id} question={q} index={i} answer={answers[q.id]} onChange={value=>setAnswers(a=>({...a,[q.id]:value}))} en={en}/>)}</section>}
  <section className="public-flow-section"><h2>{en?'Training evaluation':'Αξιολόγηση εκπαίδευσης'}</h2>{feedbackQuestions.map(q=><label className="field" key={q.id}><span>{q.label}</span><select className="input" value={scores[q.id]??5} onChange={e=>setScores(v=>({...v,[q.id]:Number(e.target.value)}))}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label>)}<label className="field"><span>{en?'Comment (optional)':'Σχόλιο (προαιρετικό)'}</span><textarea className="input" rows="3" value={comment} onChange={e=>setComment(e.target.value)}/></label></section>
  {error&&<div className="setup-note">{error}</div>}
  <Button disabled={incomplete} onClick={finish}>{en?'Confirm & submit':'Επιβεβαίωση & υποβολή'}</Button>
 </div></PublicFrame>
}
function PublicFrame({children}){return <main className="public-flow-page"><div className="public-flow-shell">{children}</div></main>}
function Status({title,text,icon:Icon=CheckCircle2}){return <div className="public-flow-card public-flow-status"><Icon size={34}/><h1>{title}</h1><p>{text}</p></div>}