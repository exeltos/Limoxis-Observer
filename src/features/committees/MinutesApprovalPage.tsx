import { useCallback,useEffect,useState } from 'react'
import { useParams,useSearchParams } from 'react-router-dom'
import { CheckCircle2,Clock3,FileText,MessageSquareWarning,ShieldCheck,Users } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { RouteLoading } from '../../design-system/RouteLoading'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { decideExternalMinutesAsync,loadExternalMinutesAsync } from './committeeExternalApprovalService'
import './minutesApproval.css'

const day=(value,en)=>value?new Date(value).toLocaleDateString(en?'en-GB':'el-GR',{day:'2-digit',month:'2-digit',year:'numeric'}):'—'

// Public page of the e-mailed link: a committee member without an account
// reads the minutes and approves them or asks for changes, once.
export function MinutesApprovalPage(){
  const {token}=useParams(),[params]=useSearchParams(),{language}=useLanguage(),{notifyError}=useFeedback(),en=language==='en'
  const [state,setState]=useState({loading:true,data:null,error:null})
  const [mode,setMode]=useState(params.get('decision')==='changes'?'changes':'review')
  const [comment,setComment]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(null)
  const load=useCallback(async()=>{setState(s=>({...s,loading:true}));try{setState({loading:false,data:await loadExternalMinutesAsync(token),error:null})}catch(error){setState({loading:false,data:null,error})}},[token])
  useEffect(()=>{void load()},[load])

  if(state.loading)return <Frame><RouteLoading/></Frame>
  if(state.error||!state.data)return <Frame><Status icon={ShieldCheck} title={en?'This link is not available':'Ο σύνδεσμος δεν είναι διαθέσιμος'} text={en?'The minutes may have been submitted again, so a new e-mail has replaced this one. Contact the committee secretariat.':'Τα πρακτικά μπορεί να υποβλήθηκαν ξανά και να σας στάλθηκε νέο email. Επικοινωνήστε με τη Γραμματεία της επιτροπής.'}/></Frame>
  const m=state.data
  if(done)return <Frame><Status icon={done==='approved'?CheckCircle2:MessageSquareWarning} title={done==='approved'?(en?'Thank you, your approval was recorded':'Ευχαριστούμε, η έγκρισή σας καταγράφηκε'):(en?'Your request for changes was sent':'Το αίτημα διορθώσεων στάλθηκε')} text={done==='approved'?(en?'The minutes are finalized once every member has approved. You can close this page.':'Τα πρακτικά οριστικοποιούνται όταν εγκρίνουν όλα τα μέλη. Μπορείτε να κλείσετε τη σελίδα.'):(en?'The secretariat will correct the minutes and send them again.':'Η Γραμματεία θα διορθώσει τα πρακτικά και θα τα στείλει ξανά.')}/></Frame>
  if(m.status==='approved')return <Frame><Status icon={CheckCircle2} title={en?'You have already approved these minutes':'Έχετε ήδη εγκρίνει τα πρακτικά'} text={`${m.committeeName} · ${m.meetingTitle} · ${day(m.decidedAt,en)}`}/></Frame>
  if(m.status==='rejected')return <Frame><Status icon={MessageSquareWarning} title={en?'You have already requested changes':'Έχετε ήδη ζητήσει διορθώσεις'} text={m.comment||''}/></Frame>
  if(m.status==='expired')return <Frame><Status icon={Clock3} title={en?'The link has expired':'Ο σύνδεσμος έληξε'} text={en?'Ask the committee secretariat to send it again.':'Ζητήστε από τη Γραμματεία της επιτροπής να τον στείλει ξανά.'}/></Frame>
  if(m.status!=='pending')return <Frame><Status icon={ShieldCheck} title={en?'This link is no longer valid':'Ο σύνδεσμος δεν ισχύει πια'} text={en?'The minutes were submitted again or withdrawn.':'Τα πρακτικά υποβλήθηκαν ξανά ή αποσύρθηκαν.'}/></Frame>

  async function decide(decision){
    if(busy||(decision==='rejected'&&!comment.trim()))return
    setBusy(true)
    try{await decideExternalMinutesAsync(token,decision,decision==='rejected'?comment.trim():'');setDone(decision)}
    catch(error){notifyError(error,'save',{operation:'committee_minutes_external_decide'});await load()}
    finally{setBusy(false)}
  }
  return <Frame><div className="public-flow-card public-flow-wide minutes-approval-card">
    <div className="minutes-approval-head"><div><span className="eyebrow">{m.organizationName||'Limoxis Observer'}</span><h1>{en?'Minutes for your approval':'Πρακτικά για έγκριση'}</h1><p>{en?`For ${m.memberName}`:`Για: ${m.memberName}`}</p></div><ShieldCheck size={30}/></div>
    <section className="minutes-approval-facts">
      <div><span>{en?'Committee':'Επιτροπή'}</span><strong>{m.committeeName||'—'}</strong></div>
      <div><span>{en?'Meeting':'Συνεδρίαση'}</span><strong>{m.meetingTitle||'—'}</strong></div>
      <div><span>{en?'Date':'Ημερομηνία'}</span><strong>{day(m.scheduledAt,en)}</strong></div>
      <div><span>{en?'Minutes no.':'Αρ. πρακτικού'}</span><strong>{m.minutesNumber||'—'}</strong></div>
      {m.location&&<div><span>{en?'Place':'Χώρος'}</span><strong>{m.location}</strong></div>}
      {m.quorumMet!=null&&<div><span>{en?'Quorum':'Απαρτία'}</span><strong>{m.quorumMet?(en?'Yes':'Ναι'):(en?'No':'Όχι')}</strong></div>}
    </section>
    <section className="public-flow-section"><h2><FileText size={17}/>{en?'Topics and decisions':'Θέματα και αποφάσεις'}</h2>
      {(m.topics||[]).length?<ol className="minutes-approval-topics">{m.topics.map((t,i)=><li key={i}><strong>{t.subject}</strong>{t.decision&&<p>{t.decision}</p>}{t.action&&<small>{en?'Action':'Ενέργεια'}: {t.action}{t.owner?` · ${t.owner}`:''}{t.dueDate?` · ${day(t.dueDate,en)}`:''}</small>}</li>)}</ol>:<p>{en?'No topics recorded.':'Δεν καταγράφηκαν θέματα.'}</p>}
      {m.notes&&<div className="minutes-approval-notes"><span>{en?'General notes':'Γενικές σημειώσεις'}</span><p>{m.notes}</p></div>}
    </section>
    {(m.attendees||[]).length>0&&<section className="public-flow-section"><h2><Users size={17}/>{en?'Present':'Παρόντες'}</h2><p className="minutes-approval-attendees">{m.attendees.join(' · ')}</p></section>}
    {mode==='changes'
      ?<section className="public-flow-section minutes-approval-changes"><h2><MessageSquareWarning size={17}/>{en?'Request changes':'Αίτημα διορθώσεων'}</h2><label className="field"><span>{en?'What must be corrected?':'Τι πρέπει να διορθωθεί;'} *</span><textarea className="input" rows="4" autoFocus value={comment} onChange={e=>setComment(e.target.value)} placeholder={en?'e.g. topic 2: the deadline is the end of the month':'π.χ. θέμα 2: η προθεσμία είναι το τέλος του μήνα'}/></label>
        <div className="minutes-approval-actions"><Button variant="secondary" disabled={busy} onClick={()=>setMode('review')}>{en?'Back':'Πίσω'}</Button><Button disabled={busy||!comment.trim()} onClick={()=>decide('rejected')}>{busy?(en?'Sending…':'Αποστολή…'):(en?'Send request':'Αποστολή αιτήματος')}</Button></div></section>
      :<div className="minutes-approval-actions"><Button variant="secondary" disabled={busy} onClick={()=>setMode('changes')}><MessageSquareWarning size={15}/>{en?' Request changes':' Ζητώ διορθώσεις'}</Button><Button disabled={busy} onClick={()=>decide('approved')}><CheckCircle2 size={15}/>{busy?(en?' Saving…':' Καταχώρηση…'):(en?' I approve the minutes':' Εγκρίνω τα πρακτικά')}</Button></div>}
    <div className="source-truth-note"><ShieldCheck size={16}/><span>{en?`Personal single-use link, no account needed${m.expiresAt?`, valid until ${day(m.expiresAt,en)}`:''}. Your answer is recorded with the date and time in the committee history.`:`Προσωπικός σύνδεσμος μίας χρήσης, χωρίς λογαριασμό${m.expiresAt?` (ισχύει έως ${day(m.expiresAt,en)})`:''}. Η απάντησή σας καταγράφεται με ημερομηνία και ώρα στο ιστορικό της επιτροπής.`}</span></div>
  </div></Frame>
}

function Frame({children}){return <main className="public-flow-page"><div className="public-flow-shell">{children}</div></main>}
function Status({title,text,icon:Icon}){return <div className="public-flow-card public-flow-status"><Icon size={34}/><h1>{title}</h1>{text&&<p>{text}</p>}</div>}
