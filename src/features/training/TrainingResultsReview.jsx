import {useMemo,useState} from 'react'
import { ExportMenu } from '../../design-system/ExportMenu'
import { CheckCircle2, ClipboardCheck, Eye, Star } from 'lucide-react'


import {MetricCard} from '../../design-system/MetricCard'
import {ObserverDialog,DialogActions} from '../../design-system/ObserverDialog'
import {useAuth} from '../../core/auth/AuthContext'
import {useFeedback} from '../../core/feedback/FeedbackContext'
import {normalizeTrainingQuestion,trainingAssessmentTypeLabel} from './trainingAssessment'
import {downloadCertificatePdf} from './trainingCertificate'
import {manualReviewQuestions,scoreReview} from './trainingScoring'
import {finalizeTrainingReviewAsync} from './trainingService'
import './TrainingResultsReview.css'
import {trainerFeedbackQuestionsForProgram} from './trainingFeedbackTemplate'

const fmt=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('el-GR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}

function answerText(question,answer,en){
 const q=normalizeTrainingQuestion(question)
 if(answer===undefined||answer===null||answer==='')return '—'
 if(q.type==='single_choice')return q.options.find(option=>option.id===answer)?.text||String(answer)
 if(q.type==='multiple_choice')return (Array.isArray(answer)?answer:[]).map(value=>q.options.find(option=>option.id===value)?.text||String(value)).join(', ')||'—'
 if(q.type==='true_false'){const value=answer===true||answer==='true'||answer===1||answer==='1';return value?(en?'True':'Σωστό'):(en?'False':'Λάθος')}
 return String(answer)
}

export function TrainingResultsReview({program,rows,state,onPersist,busy=false,en=false,language='el',organizationId=null,onReviewed=null}){
 const {profile,user}=useAuth()
 const {notify}=useFeedback()
 const [selected,setSelected]=useState(null)
 const [reviewed,setReviewed]=useState(false)
 const [certBusyId,setCertBusyId]=useState(null)
 const [reviewPoints,setReviewPoints]=useState({}),[decision,setDecision]=useState('auto'),[reviewNote,setReviewNote]=useState(''),[finalizing,setFinalizing]=useState(false)
 const certificateFor=row=>row?.certificateId?(state.certificates||[]).find(c=>c.id===row.certificateId)||null:null
 const selectedCertificate=certificateFor(selected)
 async function downloadCertificateFor(row,pdf=false){
  const certificate=certificateFor(row)
  if(certBusyId||!certificate)return
  setCertBusyId(row.id)
  try{await downloadCertificatePdf({certificate,program,participantName:row.employeeName,en,pdf})}
  catch(error){notify(error?.message||(en?'Could not export the certificate.':'Δεν ήταν δυνατή η εξαγωγή του πιστοποιητικού.'),'danger')}
  finally{setCertBusyId(null)}
 }
 const questions=Array.isArray(program?.assessmentQuestions)?program.assessmentQuestions:[]
 // The programme's own trainer-evaluation questions, or the default ones (clarity, knowledge, …) the answers were given to.
 const feedbackLabelById=useMemo(()=>new Map(trainerFeedbackQuestionsForProgram(program,language).map(question=>[question.id,question.label||question.id])),[program,language])
 const completed=rows.filter(x=>x.status==='completed').length
 const scored=rows.filter(x=>x.score!=null)
 const avg=scored.length?Math.round(scored.reduce((sum,row)=>sum+Number(row.score||0),0)/scored.length):0
 const submittedRows=rows.filter(x=>x.feedbackSubmittedAt||x.assessmentSubmittedAt)
 const reviewedCount=submittedRows.filter(x=>x.assessmentReviewedAt).length
 const reviewerName=profile?.fullName||profile?.name||profile?.username||user?.email||'—'
 const selectedAnswers=useMemo(()=>selected?.assessmentAnswers||{},[selected])

 const pendingReview=selected?.assessmentReviewStatus==='pending'
 const manualQuestions=useMemo(()=>manualReviewQuestions(program),[program])
 const projected=useMemo(()=>pendingReview?scoreReview(program,selectedAnswers,reviewPoints,decision==='auto'?null:decision==='pass'):null,[pendingReview,program,selectedAnswers,reviewPoints,decision])
 function open(row){if(!row.feedbackSubmittedAt&&!row.assessmentSubmittedAt)return;setSelected(row);setReviewed(Boolean(row.assessmentReviewedAt));setReviewPoints(Object.fromEntries(manualReviewQuestions(program).map(q=>[q.id,row.awardedPoints?.[q.id]??0])));setDecision('auto');setReviewNote('')}
 // A free-text answer that needs a manual review: the reviewer awards its
 // points, the score is recomputed and the assignment completed (with its
 // certificate when competent).
 async function finalizeReview(){
  if(!selected||finalizing)return
  setFinalizing(true)
  try{
   const next=await finalizeTrainingReviewAsync(organizationId,selected.id,{points:reviewPoints,competent:decision==='auto'?null:decision==='pass',note:reviewNote,reviewer:reviewerName,state})
   notify(en?'Review completed.':'Ο έλεγχος ολοκληρώθηκε.','success')
   setSelected(null)
   if(onReviewed)await onReviewed(next)
  }catch(error){notify(error?.message||(en?'Could not complete the review.':'Δεν ήταν δυνατή η ολοκλήρωση του ελέγχου.'),'danger')}
  finally{setFinalizing(false)}
 }
 async function saveReview(){
  if(!selected||!reviewed)return
  const stamp=new Date().toISOString()
  const nextAssignment={...selected,assessmentReviewedAt:selected.assessmentReviewedAt||stamp,assessmentReviewedBy:selected.assessmentReviewedBy||reviewerName,assessmentReviewAcknowledged:true}
  const ok=await onPersist({...state,assignments:state.assignments.map(row=>row.id===selected.id?nextAssignment:row)},en?'Assessment marked as reviewed.':'Η αξιολόγηση σημειώθηκε ως ελεγμένη.')
  if(ok)setSelected(null)
 }
 return <div className="workspace-column workspace-fill">
  <div className="module-summary-strip"><MetricCard icon={CheckCircle2} value={completed} label={en?'Completed':'Ολοκληρώσεις'}/><MetricCard icon={ClipboardCheck} value={scored.length?`${avg}%`:'—'} label={en?'Average score':'Μέση επίδοση'}/><MetricCard icon={Star} value={rows.filter(x=>x.competent===true).length} label={en?'Competent':'Επαρκείς'}/><MetricCard icon={Eye} value={`${reviewedCount}/${submittedRows.length}`} label={en?'Reviewed':'Ελεγμένες'}/></div>
  <div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>{en?'Participant':'Συμμετέχων'}</th><th>{en?'Attendance':'Συμμετοχή'}</th><th>{en?'Score':'Βαθμολογία'}</th><th>{en?'Outcome':'Αποτέλεσμα'}</th><th>{en?'Review status':'Κατάσταση ελέγχου'}</th><th>{en?'Certificate':'Πιστοποιητικό'}</th></tr></thead><tbody>{rows.map(row=>{const submitted=Boolean(row.feedbackSubmittedAt||row.assessmentSubmittedAt),certificate=certificateFor(row);return <tr key={row.id} className={submitted?'clickable-row':''} onClick={()=>open(row)}><td><strong>{row.employeeName||'—'}</strong><small>{row.department||'—'}</small></td><td>{row.attendanceResponse==='confirmed'?(en?'Confirmed':'Επιβεβαιωμένη'):'—'}</td><td>{row.score!=null?`${row.score}%`:'—'}</td><td>{row.assessmentReviewStatus==='pending'?(en?'Manual review required':'Απαιτείται χειροκίνητος έλεγχος'):row.competent===true?(en?'Successful':'Επιτυχής'):row.competent===false?(en?'Retraining required':'Απαιτείται επανεκπαίδευση'):'—'}</td><td>{row.assessmentReviewedAt?<span className="status-badge active">{en?'Reviewed':'Ελέγχθηκε'}</span>:submitted?<span className="status-badge">{en?'Ready for review':'Προς έλεγχο'}</span>:'—'}</td><td className="open-record-cell">{certificate&&<ExportMenu compact disabled={Boolean(certBusyId)} onPrint={()=>downloadCertificateFor(row)} onPdf={()=>downloadCertificateFor(row,true)}/>}</td></tr>})}</tbody></table></div>
  {selected&&<ObserverDialog width="wide" className="training-review-dialog" eyebrow={en?'Participant assessment':'Αξιολόγηση συμμετέχοντα'} title={selected.employeeName||'—'} onClose={()=>setSelected(null)} footer={pendingReview?<DialogActions onSave={finalizeReview} saveLabel={finalizing?(en?'Completing…':'Ολοκλήρωση…'):(en?'Complete review':'Ολοκλήρωση ελέγχου')} disabled={busy||finalizing}/>:!selected.assessmentReviewedAt?<DialogActions onSave={saveReview} saveLabel={en?'Mark as reviewed':'Σήμανση ως ελεγμένη'} disabled={busy||!reviewed}/>:null}>
   <div className="workspace-column training-review-content">
    <div className="module-summary-strip training-review-summary"><MetricCard icon={ClipboardCheck} value={selected.score!=null?`${selected.score}%`:'—'} label={en?'Score':'Βαθμολογία'}/><MetricCard icon={CheckCircle2} value={selected.competent===true?(en?'Passed':'Επιτυχής'):selected.competent===false?(en?'Failed':'Μη επιτυχής'):'—'} label={en?'Result':'Αποτέλεσμα'}/><MetricCard icon={Eye} value={selected.assessmentReviewedAt?fmt(selected.assessmentReviewedAt):(en?'Pending':'Εκκρεμεί')} label={en?'Review status':'Κατάσταση ελέγχου'}/></div>
    {selectedCertificate&&<div className="training-review-certificate-row"><ExportMenu disabled={Boolean(certBusyId)} onPrint={()=>downloadCertificateFor(selected)} onPdf={()=>downloadCertificateFor(selected,true)}/></div>}
    <section className="record-section training-review-section"><div className="record-section-header"><div><span className="eyebrow">{en?'Submitted answers':'Υποβληθείσες απαντήσεις'}</span><h3>{en?'Knowledge assessment answers':'Απαντήσεις αξιολόγησης γνώσεων'}</h3></div></div>{questions.length?<div className="training-answer-list">{questions.map((question,index)=><article key={question.id} className="training-answer-card"><div className="training-answer-question"><span className="training-answer-index">{index+1}</span><div><strong>{question.text||'—'}</strong><small>{trainingAssessmentTypeLabel(question.type,language)}</small></div></div><div className="training-answer-value">{answerText(question,selectedAnswers[question.id],en)}{pendingReview&&question.type==='free_text'&&question.manualReview?<label className="training-review-points"><span>{en?`Points (0–${question.points||0})`:`Βαθμοί (0–${question.points||0})`}</span><input type="number" min="0" max={question.points||0} step="0.5" value={reviewPoints[question.id]??0} disabled={busy||finalizing} onChange={event=>setReviewPoints(current=>({...current,[question.id]:Math.min(Number(question.points)||0,Math.max(0,Number(event.target.value)||0))}))}/></label>:selected.awardedPoints?.[question.id]!=null&&<small className="training-review-awarded">{en?'Points':'Βαθμοί'}: {selected.awardedPoints[question.id]}/{question.points||0}</small>}</div></article>)}</div>:<div className="registry-empty-state"><strong>{en?'No knowledge questions were configured.':'Δεν είχαν οριστεί ερωτήσεις γνώσεων.'}</strong></div>}</section>
    <section className="record-section training-review-section"><div className="record-section-header"><div><span className="eyebrow">{en?'Training evaluation':'Αξιολόγηση της εκπαίδευσης'}</span><h3>{en?'Participant feedback':'Απαντήσεις συμμετέχοντα'}</h3></div></div><div className="training-feedback-layout"><div className="training-feedback-scores"><strong>{en?'Ratings':'Βαθμολογίες'}</strong>{Object.keys(selected.feedbackScores||{}).length?<div className="training-feedback-grid">{Object.entries(selected.feedbackScores||{}).map(([key,value])=><div key={key} className="training-feedback-row"><span>{feedbackLabelById.get(key)||key}</span><strong>{value}/5</strong></div>)}</div>:<div className="inline-empty">—</div>}</div><div className="training-feedback-comment"><strong>{en?'Comment':'Σχόλιο'}</strong><p>{selected.feedbackComment||'—'}</p></div></div></section>
    {pendingReview&&<section className="record-section training-review-section training-review-finalize"><div className="record-section-header"><div><span className="eyebrow">{en?'Manual review':'Χειροκίνητος έλεγχος'}</span><h3>{en?'Complete the assessment':'Ολοκλήρωση της αξιολόγησης'}</h3></div></div><p>{manualQuestions.length?(en?'Award the points of each free-text answer. The score is recomputed with the automatically scored answers.':'Ορίστε τους βαθμούς κάθε απάντησης ελεύθερου κειμένου. Η βαθμολογία υπολογίζεται ξανά μαζί με τις αυτόματες απαντήσεις.'):(en?'No free-text question needs points; decide the result.':'Καμία ερώτηση ελεύθερου κειμένου δεν απαιτεί βαθμούς· ορίστε το αποτέλεσμα.')}</p><div className="entry-grid"><label><span>{en?'Score after review':'Βαθμολογία μετά τον έλεγχο'}</span><strong>{projected?.score!=null?`${projected.score}%`:'—'} · {projected?.competent?(en?'Passed':'Επιτυχής'):(en?'Failed':'Μη επιτυχής')}</strong></label><label><span>{en?'Result':'Αποτέλεσμα'}</span><select value={decision} disabled={busy||finalizing} onChange={event=>setDecision(event.target.value)}><option value="auto">{en?`From the score (pass ≥ ${program?.passScore||0}%)`:`Από τη βαθμολογία (επιτυχία ≥ ${program?.passScore||0}%)`}</option><option value="pass">{en?'Passed':'Επιτυχής'}</option><option value="fail">{en?'Failed':'Μη επιτυχής'}</option></select></label><label className="entry-span-2"><span>{en?'Reviewer note':'Σημείωση ελέγχου'}</span><textarea rows={2} value={reviewNote} disabled={busy||finalizing} onChange={event=>setReviewNote(event.target.value)}/></label></div></section>}
    {selected.assessmentReviewNote&&<p className="training-review-note"><strong>{en?'Reviewer note':'Σημείωση ελέγχου'}:</strong> {selected.assessmentReviewNote}</p>}
    {!pendingReview&&<label className={`training-review-check ${selected.assessmentReviewedAt?'is-reviewed':''}`}><input type="checkbox" checked={reviewed} disabled={Boolean(selected.assessmentReviewedAt)||busy} onChange={event=>setReviewed(event.target.checked)}/><span>{selected.assessmentReviewedAt?(en?`Reviewed by ${selected.assessmentReviewedBy||'—'} on ${fmt(selected.assessmentReviewedAt)}`:`Ελέγχθηκε από ${selected.assessmentReviewedBy||'—'} στις ${fmt(selected.assessmentReviewedAt)}`):(en?'I reviewed the participant responses and result.':'Έλεγξα τις απαντήσεις και το αποτέλεσμα του εκπαιδευόμενου.')}</span></label>}
   </div>
  </ObserverDialog>}
 </div>
}
