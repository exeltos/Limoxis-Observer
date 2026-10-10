import { useState } from 'react'
import { ArrowRight, CheckCircle2, Flag, Send, Star, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { DEMO_SCENARIOS } from './demoScenarios'
import './demoEvaluation.css'

const RATING_LABELS={el:['','Καθόλου χρήσιμο','Λίγο χρήσιμο','Αρκετά χρήσιμο','Πολύ χρήσιμο','Εξαιρετικό'],en:['','Not useful','Slightly useful','Fairly useful','Very useful','Excellent']}

// The scenario the evaluator is working on, beside the screen: what to do and
// "I'm done" for the scenarios the application cannot tell are done.
export function DemoActiveScenario({scenario,language,working=false,onDone,onClose}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const index=DEMO_SCENARIOS.findIndex(item=>item.key===scenario.key)
  return <aside className="demo-scenario-card" aria-label={tx('Σενάριο αξιολόγησης','Evaluation scenario')}>
    <header><span className="demo-scenario-eyebrow"><Flag size={13}/>{tx(`Σενάριο ${index+1} από ${DEMO_SCENARIOS.length}`,`Scenario ${index+1} of ${DEMO_SCENARIOS.length}`)}</span>
      <button type="button" className="demo-scenario-close" onClick={onClose} aria-label={tx('Κλείσιμο','Close')}><X size={15}/></button></header>
    <strong>{en?scenario.titleEn:scenario.titleEl}</strong>
    <p>{en?scenario.textEn:scenario.textEl}</p>
    <div className="demo-scenario-actions"><Button variant="secondary" disabled={working} onClick={onDone}><CheckCircle2 size={14}/>{tx('Ολοκλήρωσα','I\'m done')}</Button></div>
  </aside>
}

// Asked as soon as a scenario is completed (or, with scenario null, after the
// last one, for the guide as a whole): 1-5 stars and an optional comment.
export function DemoScenarioRating({scenario,next,language,working=false,canRequest=false,onSubmit,onLater,onNext,onRequestApplication}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const [rating,setRating]=useState(0)
  const [hover,setHover]=useState(0)
  const [comment,setComment]=useState('')
  const [sent,setSent]=useState(false)
  const [failed,setFailed]=useState(false)
  const overall=!scenario
  async function submit(){if(!rating)return;setFailed(false);try{await onSubmit?.(rating,comment);setSent(true)}catch{setFailed(true)}}
  if(sent)return <aside className="demo-scenario-card demo-scenario-rating is-sent" role="status">
    <strong><CheckCircle2 size={16}/>{tx('Ευχαριστούμε για την αξιολόγηση!','Thank you for your rating!')}</strong>
    <div className="demo-scenario-actions">
      {next&&<Button onClick={()=>onNext?.(next)}>{tx('Επόμενο σενάριο','Next scenario')}: {en?next.titleEn:next.titleEl}<ArrowRight size={14}/></Button>}
      {overall&&canRequest&&<Button onClick={onRequestApplication}><Send size={14}/>{tx('Θέλω την εφαρμογή','I want the application')}</Button>}
      <Button variant="secondary" onClick={onLater}>{tx('Κλείσιμο','Close')}</Button>
    </div>
  </aside>
  const shown=hover||rating
  return <aside className="demo-scenario-card demo-scenario-rating" role="dialog" aria-label={tx('Αξιολόγηση','Rating')}>
    <span className="demo-scenario-eyebrow is-done"><CheckCircle2 size={13}/>{overall?tx('Ολοκληρώσατε όλα τα σενάρια','You completed every scenario'):tx('Ολοκληρώσατε το σενάριο','Scenario completed')}</span>
    <strong>{overall?tx('Πώς σας φάνηκε συνολικά η εφαρμογή;','Overall, how did you find the application?'):<>{en?scenario.titleEn:scenario.titleEl}: {tx('πώς σας φάνηκε;','how did you find it?')}</>}</strong>
    <div className="demo-rating-stars" role="radiogroup" aria-label={tx('Βαθμολογία','Rating')} onMouseLeave={()=>setHover(0)}>
      {[1,2,3,4,5].map(value=><button key={value} type="button" role="radio" aria-checked={rating===value} aria-label={`${value} – ${RATING_LABELS[en?'en':'el'][value]}`} className={value<=shown?'is-on':''} onMouseEnter={()=>setHover(value)} onClick={()=>setRating(value)}><Star size={22}/></button>)}
      <small>{shown?RATING_LABELS[en?'en':'el'][shown]:tx('Επιλέξτε 1 έως 5 αστέρια','Choose 1 to 5 stars')}</small>
    </div>
    <textarea rows={2} maxLength={1000} value={comment} onChange={event=>setComment(event.target.value)} placeholder={overall?tx('Τι θα θέλατε να βελτιωθεί; (προαιρετικό)','What would you like improved? (optional)'):tx('Τι σας δυσκόλεψε ή τι σας άρεσε; (προαιρετικό)','What was difficult or what did you like? (optional)')}/>
    {failed&&<div className="demo-application-error" role="alert">{tx('Η αξιολόγηση δεν στάλθηκε. Δοκιμάστε ξανά.','The rating was not sent. Please try again.')}</div>}
    <div className="demo-scenario-actions">
      <Button variant="secondary" disabled={working} onClick={onLater}>{tx('Αργότερα','Later')}</Button>
      <Button disabled={!rating||working} loading={working} onClick={()=>void submit()}>{tx('Αποστολή','Send')}</Button>
    </div>
  </aside>
}
