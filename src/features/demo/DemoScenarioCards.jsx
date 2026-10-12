import { useState } from 'react'
import { ArrowRight, CheckCircle2, Circle, Compass, Flag, Send, Star, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { DEMO_SCENARIOS } from './demoScenarios'
import './demoEvaluation.css'

const RATING_LABELS={el:['','Καθόλου χρήσιμο','Λίγο χρήσιμο','Αρκετά χρήσιμο','Πολύ χρήσιμο','Εξαιρετικό'],en:['','Not useful','Slightly useful','Fairly useful','Very useful','Excellent']}
const EASE_LABELS={el:['','Πολύ δύσκολο','Δύσκολο','Μέτριο','Εύκολο','Πολύ εύκολο'],en:['','Very hard','Hard','Moderate','Easy','Very easy']}
const CLARITY_LABELS={el:['','Καθόλου σαφείς','Λίγο σαφείς','Αρκετά σαφείς','Σαφείς','Πολύ σαφείς'],en:['','Not clear','Slightly clear','Fairly clear','Clear','Very clear']}

// One 1-5 question of the questionnaire, as a row of stars.
function StarScale({label,value,onChange,labels,en,large=false}){
  const [hover,setHover]=useState(0)
  const shown=hover||value
  return <div className={`demo-rating-stars ${large?'':'is-compact'}`} role="radiogroup" aria-label={label} onMouseLeave={()=>setHover(0)}>
    {!large&&<span className="demo-rating-question">{label}</span>}
    {[1,2,3,4,5].map(item=><button key={item} type="button" role="radio" aria-checked={value===item} aria-label={`${item} – ${labels[en?'en':'el'][item]}`} className={item<=shown?'is-on':''} onMouseEnter={()=>setHover(item)} onClick={()=>onChange(item)}><Star size={large?22:16}/></button>)}
    <small>{shown?labels[en?'en':'el'][shown]:(large?(en?'Choose 1 to 5 stars':'Επιλέξτε 1 έως 5 αστέρια'):'')}</small>
  </div>
}

// The Platform Owner's trial run: shown the same, stored nowhere.
const TrialNote=({en})=><small className="demo-scenario-trial">{en?'Trial as Platform Owner: nothing is saved.':'Δοκιμή ως Platform Owner: δεν αποθηκεύεται.'}</small>

// The scenario the evaluator is working on, beside the screen: what to do and
// its steps, checked off as the screens report them. The screens also tell
// when it is done; a quiet link marks it done when they could not.
export function DemoActiveScenario({scenario,scenarios=DEMO_SCENARIOS,stepsDone={},language,trial=false,working=false,onDone,onClose,onTour=null}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const index=scenarios.findIndex(item=>item.key===scenario.key)
  const steps=scenario.steps||[]
  const nextStep=steps.find(step=>!stepsDone[step.id])
  return <aside className="demo-scenario-card" aria-label={tx('Σενάριο αξιολόγησης','Evaluation scenario')}>
    <header><span className="demo-scenario-eyebrow"><Flag size={13}/>{tx(`Σενάριο ${index+1} από ${scenarios.length}`,`Scenario ${index+1} of ${scenarios.length}`)}</span>
      <button type="button" className="demo-scenario-close" onClick={onClose} aria-label={tx('Κλείσιμο','Close')}><X size={15}/></button></header>
    <strong>{en?scenario.titleEn:scenario.titleEl}</strong>
    <p>{en?scenario.textEn:scenario.textEl}</p>
    {steps.length>0&&<ol className="demo-scenario-steps" aria-label={tx('Βήματα','Steps')}>{steps.map(step=>{const done=Boolean(stepsDone[step.id]);return <li key={step.id} className={done?'is-done':step===nextStep?'is-next':''} aria-current={step===nextStep?'step':undefined}>{done?<CheckCircle2 size={14} aria-label={tx('Ολοκληρώθηκε','Done')}/>:<Circle size={14} aria-hidden="true"/>}<span>{en?step.labelEn:step.labelEl}{step===nextStep&&step.target&&<small className="demo-step-onscreen">{tx('Επισημαίνεται στην οθόνη','Outlined on screen')}</small>}</span></li>})}</ol>}
    {trial&&<TrialNote en={en}/>}
    <div className="demo-scenario-actions">{onTour&&<Button variant="secondary" onClick={onTour}><Compass size={14}/>{tx('Δείξε μου','Show me')}</Button>}</div>
    <button type="button" className="demo-scenario-fallback" disabled={working} onClick={onDone}>{tx('Το κάνατε αλλά δεν καταγράφηκε; Σημειώστε το ως ολοκληρωμένο','Done but not picked up? Mark it as completed')}</button>
  </aside>
}

// Asked as soon as a scenario is completed (or, with scenario null, after the
// last one, for the guide as a whole), beside the screen: one click on the
// stars sends the rating. Then "Add details" opens how easy it was, how clear
// the steps were and a comment, sent over the same rating.
export function DemoScenarioRating({scenario,next,language,trial=false,working=false,canRequest=false,onSubmit,onLater,onNext,onRequestApplication}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const [rating,setRating]=useState(0)
  const [ease,setEase]=useState(0)
  const [clarity,setClarity]=useState(0)
  const [comment,setComment]=useState('')
  const [details,setDetails]=useState(false)
  const [sent,setSent]=useState(false) // the stars are saved
  const [detailsSent,setDetailsSent]=useState(false)
  const [failed,setFailed]=useState(false)
  const overall=!scenario
  async function send(value,extra={}){setFailed(false);try{await onSubmit?.(value,extra.comment??comment,{ease:(extra.ease??ease)||null,clarity:(extra.clarity??clarity)||null});return true}catch{setFailed(true);return false}}
  async function rate(value){setRating(value);if(await send(value))setSent(true)}
  async function sendDetails(){if(await send(rating)){setDetailsSent(true);setDetails(false)}}
  return <aside className="demo-scenario-card demo-scenario-rating" role="dialog" aria-label={tx('Αξιολόγηση','Rating')}>
    <span className="demo-scenario-eyebrow is-done"><CheckCircle2 size={13}/>{overall?tx('Ολοκληρώσατε όλα τα σενάρια','You completed every scenario'):tx('Ολοκληρώσατε το σενάριο','Scenario completed')}</span>
    {!overall&&<strong>{en?scenario.titleEn:scenario.titleEl}</strong>}
    <p className="demo-rating-question">{overall?tx('Πώς σας φάνηκε συνολικά η εφαρμογή;','Overall, how did you find the application?'):tx('Πώς σας φάνηκε;','How did you find it?')}</p>
    <StarScale large label={tx('Βαθμολογία','Rating')} value={rating} onChange={value=>{if(!working)void rate(value)}} labels={RATING_LABELS} en={en}/>
    {sent&&!details&&<p className="demo-rating-thanks" role="status"><CheckCircle2 size={14}/>{detailsSent?tx('Ευχαριστούμε για τα σχόλιά σας!','Thank you for your feedback!'):tx('Ευχαριστούμε! Η βαθμολογία καταχωρίστηκε.','Thank you! Your rating is saved.')}</p>}
    {sent&&!overall&&!details&&!detailsSent&&<button type="button" className="demo-scenario-fallback" onClick={()=>setDetails(true)}>{tx('Προσθέστε λεπτομέρειες (ευκολία, σχόλιο)','Add details (ease, comment)')}</button>}
    {sent&&overall&&!details&&!detailsSent&&<button type="button" className="demo-scenario-fallback" onClick={()=>setDetails(true)}>{tx('Προσθέστε σχόλιο','Add a comment')}</button>}
    {details&&<>
      {!overall&&<div className="demo-rating-extra">
        <StarScale label={tx('Ευκολία','Ease')} value={ease} onChange={setEase} labels={EASE_LABELS} en={en}/>
        <StarScale label={tx('Σαφήνεια οδηγιών','Clarity of the steps')} value={clarity} onChange={setClarity} labels={CLARITY_LABELS} en={en}/>
      </div>}
      {/* Its own box: the textarea expander makes the textarea's parent position:relative. */}
      <div className="demo-rating-comment"><textarea rows={2} maxLength={1000} value={comment} onChange={event=>setComment(event.target.value)} placeholder={overall?tx('Τι θα θέλατε να βελτιωθεί; (προαιρετικό)','What would you like improved? (optional)'):tx('Τι σας δυσκόλεψε ή τι σας άρεσε; (προαιρετικό)','What was difficult or what did you like? (optional)')}/></div>
    </>}
    {trial&&<TrialNote en={en}/>}
    {failed&&<div className="demo-application-error" role="alert">{tx('Η αξιολόγηση δεν στάλθηκε. Δοκιμάστε ξανά.','The rating was not sent. Please try again.')}</div>}
    <div className="demo-scenario-actions">
      {details?<>
        <Button variant="secondary" disabled={working} onClick={()=>setDetails(false)}>{tx('Άκυρο','Cancel')}</Button>
        <Button disabled={working} loading={working} onClick={()=>void sendDetails()}>{tx('Αποστολή','Send')}</Button>
      </>:<>
        <Button variant="secondary" disabled={working} onClick={onLater}>{sent?tx('Κλείσιμο','Close'):tx('Αργότερα','Later')}</Button>
        {next&&<Button onClick={()=>onNext?.(next)}>{tx('Επόμενο','Next')}: {en?next.titleEn:next.titleEl}<ArrowRight size={14}/></Button>}
        {overall&&sent&&canRequest&&<Button onClick={onRequestApplication}><Send size={14}/>{tx('Θέλω την εφαρμογή','I want the application')}</Button>}
      </>}
    </div>
  </aside>
}
