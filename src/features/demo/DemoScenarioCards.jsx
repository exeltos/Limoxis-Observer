import { useState } from 'react'
import { ArrowRight, CheckCircle2, Circle, Flag, Send, Star, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { DEMO_SCENARIOS } from './demoScenarios'
import './demoEvaluation.css'

const RATING_LABELS={el:['','Καθόλου χρήσιμο','Λίγο χρήσιμο','Αρκετά χρήσιμο','Πολύ χρήσιμο','Εξαιρετικό'],en:['','Not useful','Slightly useful','Fairly useful','Very useful','Excellent']}

// The Platform Owner's trial run: shown the same, stored nowhere.
const TrialNote=({en})=><small className="demo-scenario-trial">{en?'Trial as Platform Owner: nothing is saved.':'Δοκιμή ως Platform Owner: δεν αποθηκεύεται.'}</small>

// The scenario the evaluator is working on, beside the screen: what to do, its
// steps checked off as the screens report them, and "I'm done" for what the
// application cannot tell is done.
export function DemoActiveScenario({scenario,scenarios=DEMO_SCENARIOS,stepsDone={},language,trial=false,working=false,onDone,onClose}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const index=scenarios.findIndex(item=>item.key===scenario.key)
  const steps=scenario.steps||[]
  const nextStep=steps.find(step=>!stepsDone[step.id])
  return <aside className="demo-scenario-card" aria-label={tx('Σενάριο αξιολόγησης','Evaluation scenario')}>
    <header><span className="demo-scenario-eyebrow"><Flag size={13}/>{tx(`Σενάριο ${index+1} από ${scenarios.length}`,`Scenario ${index+1} of ${scenarios.length}`)}</span>
      <button type="button" className="demo-scenario-close" onClick={onClose} aria-label={tx('Κλείσιμο','Close')}><X size={15}/></button></header>
    <strong>{en?scenario.titleEn:scenario.titleEl}</strong>
    <p>{en?scenario.textEn:scenario.textEl}</p>
    {steps.length>0&&<ol className="demo-scenario-steps" aria-label={tx('Βήματα','Steps')}>{steps.map(step=>{const done=Boolean(stepsDone[step.id]);return <li key={step.id} className={done?'is-done':step===nextStep?'is-next':''} aria-current={step===nextStep?'step':undefined}>{done?<CheckCircle2 size={14} aria-label={tx('Ολοκληρώθηκε','Done')}/>:<Circle size={14} aria-hidden="true"/>}<span>{en?step.labelEn:step.labelEl}</span></li>})}</ol>}
    {trial&&<TrialNote en={en}/>}
    <div className="demo-scenario-actions"><Button variant="secondary" disabled={working} onClick={onDone}><CheckCircle2 size={14}/>{tx('Ολοκλήρωσα','I\'m done')}</Button></div>
  </aside>
}

// Asked as soon as a scenario is completed (or, with scenario null, after the
// last one, for the guide as a whole): 1-5 stars and an optional comment.
export function DemoScenarioRating({scenario,next,language,trial=false,working=false,canRequest=false,onSubmit,onLater,onNext,onRequestApplication}){
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
    {trial&&<TrialNote en={en}/>}
    <textarea rows={2} maxLength={1000} value={comment} onChange={event=>setComment(event.target.value)} placeholder={overall?tx('Τι θα θέλατε να βελτιωθεί; (προαιρετικό)','What would you like improved? (optional)'):tx('Τι σας δυσκόλεψε ή τι σας άρεσε; (προαιρετικό)','What was difficult or what did you like? (optional)')}/>
    {failed&&<div className="demo-application-error" role="alert">{tx('Η αξιολόγηση δεν στάλθηκε. Δοκιμάστε ξανά.','The rating was not sent. Please try again.')}</div>}
    <div className="demo-scenario-actions">
      <Button variant="secondary" disabled={working} onClick={onLater}>{tx('Αργότερα','Later')}</Button>
      <Button disabled={!rating||working} loading={working} onClick={()=>void submit()}>{tx('Αποστολή','Send')}</Button>
    </div>
  </aside>
}
