import {useMemo,useState} from 'react'
import {CheckCircle2,ClipboardCheck,Eye,Star} from 'lucide-react'
import {MetricCard} from '../../design-system/MetricCard'
import {ObserverDialog,DialogActions} from '../../design-system/ObserverDialog'
import {useAuth} from '../../core/auth/AuthContext'
import {normalizeTrainingQuestion,trainingAssessmentTypeLabel} from './trainingAssessment'

const fmt=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('el-GR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}

function answerText(question,answer,en){
 const q=normalizeTrainingQuestion(question)
 if(answer===undefined||answer===null||answer==='')return '—'
 if(q.type==='single_choice')return q.options.find(option=>option.id===answer)?.text||String(answer)
 if(q.type==='multiple_choice')return (Array.isArray(answer)?answer:[]).map(value=>q.options.find(option=>option.id===value)?.text||String(value)).join(', ')||'—'
 if(q.type==='true_false'){const value=answer===true||answer==='true'||answer===1||answer==='1';return value?(en?'True':'Σωστό'):(en?'False':'Λάθος')}
 return String(answer)
}

export function TrainingResultsReview({program,rows,state,onPersist,busy=false,en=false,language='el'}){
 const {profile,user}=useAuth()
 const [selected,setSelected]=useState(null)
 const [reviewed,setReviewed]=useState(false)
 const questions=Array.isArray(program?.assessmentQuestions)?program.assessmentQuestions:[]
 const completed=rows.filter(x=>x.status==='completed').length
 const scored=rows.filter(x=>x.score!=null)
 const avg=scored.length?Math.round(scored.reduce((sum,row)=>sum+Number(row.score||0),0)/scored.length):0
 const submittedRows=rows.filter(x=>x.feedbackSubmittedAt||x.assessmentSubmittedAt)
 const reviewedCount=submittedRows.filter(x=>x.assessmentReviewedAt).length
 const reviewerName=profile?.fullName||profile?.name||profile?.username||user?.email||'—'
 const selectedAnswers=useMemo(()=>selected?.assessmentAnswers||{},[selected])

 function open(row){if(!row.feedbackSubmittedAt&&!row.assessmentSubmittedAt)return;setSelected(row);setReviewed(Boolean(row.assessmentReviewedAt))}
 async function saveReview(){
  if(!selected||!reviewed)return
  const stamp=new Date().toISOString()
  const nextAssignment={...selected,assessmentReviewedAt:selected.assessmentReviewedAt||stamp,assessmentReviewedBy:selected.assessmentReviewedBy||reviewerName,assessmentReviewAcknowledged:true}
  const ok=await onPersist({...state,assignments:state.assignments.map(row=>row.id===selected.id?nextAssignment:row)},en?'Assessment marked as reviewed.':'Η αξιολόγηση σημειώθηκε ως ελεγμένη.')
  if(ok)setSelected(null)
 }
 return <div className="workspace-column workspace-fill">
  <div className="module-summary-strip"><MetricCard icon={CheckCircle2} value={completed} label={en?'Completed':'Ολοκληρώσεις'}/><MetricCard icon={ClipboardCheck} value={scored.length?`${avg}%`:'—'} label={en?'Average score':'Μέση επίδοση'}/><MetricCard icon={Star} value={rows.filter(x=>x.competent===true).length} label={en?'Competent':'Επαρκείς'}/><MetricCard icon={Eye} value={`${reviewedCount}/${submittedRows.length}`} label={en?'Reviewed':'Ελεγμένες'}/></div>
  <div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>{en?'Participant':'Συμμετέχων'}</th><th>{en?'Attendance':'Συμμετοχή'}</th><th>{en?'Score':'Βαθμολογία'}</th><th>{en?'Outcome':'Αποτέλεσμα'}</th><th>{en?'Review':'Έλεγχος'}</th></tr></thead><tbody>{rows.map(row=>{const submitted=Boolean(row.feedbackSubmittedAt||row.assessmentSubmittedAt);return <tr key={row.id} className={submitted?'clickable-row':''} onClick={()=>open(row)}><td><strong>{row.employeeName||'—'}</strong><small>{row.department||'—'}</small></td><td>{row.attendanceResponse==='confirmed'?(en?'Confirmed':'Επιβεβαιωμένη'):'—'}</td><td>{row.score!=null?`${row.score}%`:'—'}</td><td>{row.assessmentReviewStatus==='pending'?(en?'Manual review pending':'Αναμονή χειροκίνητου ελέγχου'):row.competent===true?(en?'Successful':'Επιτυχής'):row.competent===false?(en?'Retraining required':'Απαιτείται επανεκπαίδευση'):'—'}</td><td>{row.assessmentReviewedAt?<span className="status-badge active">{en?'Reviewed':'Ελέγχθηκε'}</span>:submitted?<span className="status-badge">{en?'Open to review':'Προς έλεγχο'}</span>:'—'}</td></tr>})}</tbody></table></div>
  {selected&&<ObserverDialog width="wide" eyebrow={en?'Participant assessment':'Αξιολόγηση συμμετέχοντα'} title={selected.employeeName||'—'} onClose={()=>setSelected(null)} footer={!selected.assessmentReviewedAt?<DialogActions onSave={saveReview} saveLabel={en?'Mark as reviewed':'Σήμανση ως ελεγμένη'} disabled={busy||!reviewed}/>:null}>
   <div className="workspace-column">
    <div className="module-summary-strip"><MetricCard icon={ClipboardCheck} value={selected.score!=null?`${selected.score}%`:'—'} label={en?'Score':'Βαθμολογία'}/><MetricCard icon={CheckCircle2} value={selected.competent===true?(en?'Passed':'Επιτυχής'):selected.competent===false?(en?'Failed':'Μη επιτυχής'):'—'} label={en?'Result':'Αποτέλεσμα'}/><MetricCard icon={Eye} value={selected.assessmentReviewedAt?fmt(selected.assessmentReviewedAt):(en?'Pending':'Εκκρεμεί')} label={en?'Review':'Έλεγχος'}/></div>
    <section className="record-section"><div className="record-section-header"><div><span className="eyebrow">{en?'Submitted answers':'Υποβληθείσες απαντήσεις'}</span><h3>{en?'Knowledge assessment':'Αξιολόγηση γνώσεων'}</h3></div></div>{questions.length?questions.map((question,index)=><div key={question.id} className="source-truth-note"><strong>{index+1}. {question.text||'—'}</strong><div><small>{trainingAssessmentTypeLabel(question.type,language)}</small></div><div style={{marginTop:6}}>{answerText(question,selectedAnswers[question.id],en)}</div></div>):<div className="registry-empty-state"><strong>{en?'No knowledge questions were configured.':'Δεν είχαν οριστεί ερωτήσεις γνώσεων.'}</strong></div>}</section>
    <section className="record-section"><div className="record-section-header"><div><span className="eyebrow">{en?'Training feedback':'Αξιολόγηση εκπαίδευσης'}</span><h3>{en?'Participant feedback':'Απαντήσεις φόρμας'}</h3></div></div><div className="entry-grid"><div><strong>{en?'Feedback scores':'Βαθμολογίες'}</strong><pre style={{whiteSpace:'pre-wrap',fontFamily:'inherit'}}>{Object.keys(selected.feedbackScores||{}).length?Object.entries(selected.feedbackScores||{}).map(([key,value])=>`${key}: ${value}`).join('\n'):'—'}</pre></div><div><strong>{en?'Comment':'Σχόλιο'}</strong><p>{selected.feedbackComment||'—'}</p></div></div></section>
    <label className="training-required-toggle"><input type="checkbox" checked={reviewed} disabled={Boolean(selected.assessmentReviewedAt)||busy} onChange={event=>setReviewed(event.target.checked)}/><span>{selected.assessmentReviewedAt?(en?`Reviewed by ${selected.assessmentReviewedBy||'—'} on ${fmt(selected.assessmentReviewedAt)}`:`Ελέγχθηκε από ${selected.assessmentReviewedBy||'—'} στις ${fmt(selected.assessmentReviewedAt)}`):(en?'I reviewed the participant responses and result.':'Έλεγξα τις απαντήσεις και το αποτέλεσμα του εκπαιδευόμενου.')}</span></label>
   </div>
  </ObserverDialog>}
 </div>
}
