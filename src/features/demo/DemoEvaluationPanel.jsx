import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Circle, Send, Star } from 'lucide-react'
import { supabase } from '../../core/supabase/client'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuth } from '../../core/auth/AuthContext'
import { DEMO_SCENARIOS } from './demoScenarios'
import { loadDemoEvaluationOverview, updateDemoApplicationRequestStatus } from './demoEvaluationService'
import './demoEvaluation.css'

const fmt=(value,en)=>value?new Date(value).toLocaleString(en?'en-GB':'el-GR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):''

// Platform Owner, Demo record: what each evaluator went through in the guide,
// and their "I want the application" requests.
export function DemoEvaluationPanel({organizationId,language='el',onInterestChange}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const {notifyError}=useFeedback();const {user}=useAuth()
  const [state,setState]=useState({loading:true,progress:[],requests:[],names:{}})
  const reload=useCallback(async()=>{
    if(!organizationId){setState({loading:false,progress:[],requests:[],names:{}});return}
    try{
      const overview=await loadDemoEvaluationOverview(organizationId)
      const ids=[...new Set([...overview.progress.map(row=>row.user_id),...overview.requests.map(row=>row.user_id)].filter(Boolean))]
      const {data:profiles}=ids.length&&supabase?await supabase.from('profiles').select('id,full_name,username').in('id',ids):{data:[]}
      setState({loading:false,...overview,names:Object.fromEntries((profiles||[]).map(p=>[p.id,p.full_name||p.username||'']))})
      onInterestChange?.(overview.requests.some(row=>row.status==='new'))
    }catch(error){setState(current=>({...current,loading:false}));notifyError(error,'load',{operation:'demo_evaluation_overview'})}
  },[organizationId,notifyError,onInterestChange])
  useEffect(()=>{void reload()},[reload])

  async function changeStatus(request,status){try{await updateDemoApplicationRequestStatus(request.id,status,user?.id);await reload()}catch(error){notifyError(error,'save',{operation:'demo_application_status'})}}

  const evaluators=[...new Set(state.progress.map(row=>row.user_id))]
  const statusLabel={new:tx('Νέο','New'),contacted:tx('Έγινε επικοινωνία','Contacted'),closed:tx('Ολοκληρώθηκε','Closed')}
  return <section className="platform-form-section demo-evaluation-panel">
    <header><div><strong>{tx('Αξιολόγηση','Evaluation')}</strong><span>{tx('Τα σενάρια του οδηγού που ολοκλήρωσε κάθε αξιολογητής, οι βαθμολογίες του και τα αιτήματα «Θέλω την εφαρμογή».','The guide scenarios each evaluator completed, their ratings and their "I want the application" requests.')}</span></div></header>
    {state.loading?<div className="inline-empty">{tx('Φόρτωση…','Loading…')}</div>:<>
      {state.requests.map(request=><div className="demo-request-card" key={request.id}>
        <header><span className="demo-interest-badge"><Send size={12}/>{tx('Θέλει την εφαρμογή','Wants the application')}</span><small>{fmt(request.created_at,en)}</small>
          <select value={request.status} onChange={e=>void changeStatus(request,e.target.value)} aria-label={tx('Κατάσταση αιτήματος','Request status')}>{Object.entries(statusLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></header>
        <strong>{request.contact_name}</strong>
        <span>{[request.contact_email,request.contact_phone].filter(Boolean).join(' · ')}</span>
        {request.message&&<p>{request.message}</p>}
      </div>)}
      {evaluators.length?evaluators.map(userId=>{const rows=state.progress.filter(row=>row.user_id===userId);const done=Object.fromEntries(rows.filter(row=>row.completed_at).map(row=>[row.step_key,row.completed_at]));const rated=Object.fromEntries(rows.filter(row=>row.rating).map(row=>[row.step_key,row]));const overall=rated.guide_opened;const last=rows.map(row=>row.updated_at).sort().at(-1)
        return <div key={userId} className="demo-evaluation-evaluator">
          <div className="demo-evaluation-evaluator-head"><strong>{state.names[userId]||tx('Αξιολογητής','Evaluator')}</strong><small>{tx(`${DEMO_SCENARIOS.filter(s=>done[s.key]).length} από ${DEMO_SCENARIOS.length} σενάρια`,`${DEMO_SCENARIOS.filter(s=>done[s.key]).length} of ${DEMO_SCENARIOS.length} scenarios`)}{last?` · ${tx('τελευταία κίνηση','last activity')} ${fmt(last,en)}`:''}</small>{overall&&<span className="demo-rating-value" title={overall.rating_comment||''}><Star size={13}/>{tx('Συνολικά','Overall')} {overall.rating}/5</span>}</div>
          {overall?.rating_comment&&<q className="demo-evaluation-overall-comment">{overall.rating_comment}</q>}
          <div className="demo-evaluation-steps">{DEMO_SCENARIOS.map(scenario=><div key={scenario.key} className={`demo-evaluation-step ${done[scenario.key]?'is-done':''}`}>{done[scenario.key]?<CheckCircle2 size={15}/>:<Circle size={15}/>}<div>{en?scenario.titleEn:scenario.titleEl}{done[scenario.key]&&<small>{fmt(done[scenario.key],en)}</small>}{rated[scenario.key]&&<span className="demo-rating-value"><Star size={12}/>{rated[scenario.key].rating}/5</span>}{rated[scenario.key]?.rating_comment&&<q>{rated[scenario.key].rating_comment}</q>}</div></div>)}</div>
        </div>}):<div className="inline-empty">{tx('Ο αξιολογητής δεν έχει ανοίξει ακόμη τον οδηγό αξιολόγησης.','The evaluator has not opened the evaluation guide yet.')}</div>}
    </>}
  </section>
}
