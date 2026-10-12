import { ArrowRight, CheckCircle2, Circle, Star } from 'lucide-react'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { DEMO_SCENARIOS, demoScenarioDoneCount } from './demoScenarios'
import './demoEvaluation.css'

// The application training guide: short scenarios with a link to where each
// starts and a "done" mark the evaluator sets; progress is kept per evaluator.
// A done mark stays (it is not undone by a second click). Marking a scenario
// done asks for its rating right there, under it (`rating`: { key, node },
// key OVERALL_RATING for the guide as a whole); a done scenario shows its
// rating, or "Rate" when it has none yet.
export const OVERALL_RATING='guide_opened'
export function DemoGuideDialog({language,scenarios=DEMO_SCENARIOS,progress={},ratings={},working=false,rating=null,onOpenScenario,onToggle,onRate,onClose}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const done=demoScenarioDoneCount(progress,scenarios),total=scenarios.length
  const allSix=total===DEMO_SCENARIOS.length
  return <ObserverDialog width="wide" className="demo-guide-dialog" eyebrow={tx('Demo αξιολόγησης','Evaluation Demo')} title={tx('Εκπαίδευση εφαρμογής','Application training')}
    subtitle={allSix?tx('Έξι σύντομα σενάρια με τα σημεία που ξεχωρίζουν στην καθημερινή δουλειά της Ομάδας Ελέγχου Λοιμώξεων. Ξεκινήστε από όποιο θέλετε.','Six short scenarios with what stands out in an Infection Control team\'s daily work. Start with any of them.'):tx(`${total===1?'Ένα σύντομο σενάριο':`${total} σύντομα σενάρια`} με την καθημερινή δουλειά του ρόλου σας. Αν αλλάξετε ρόλο, αλλάζουν και τα σενάρια.`,`${total===1?'One short scenario':`${total} short scenarios`} with your role's daily work. Switching role switches the scenarios.`)}
    onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>{tx('Κλείσιμο','Close')}</Button>}>
    <div className="demo-guide-progress" aria-label={tx('Πρόοδος','Progress')}>
      <strong>{tx(`${done} από ${total} ολοκληρωμένα`,`${done} of ${total} done`)}</strong>
      <span className="demo-guide-progress-track"><span style={{width:`${Math.round(done/total*100)}%`}}/></span>
    </div>
    {rating?.key===OVERALL_RATING&&<div className="demo-guide-rating">{rating.node}</div>}
    <ol className="demo-guide-list">
      {scenarios.map((scenario,index)=>{const isDone=Boolean(progress[scenario.key]);return <li key={scenario.key} className={isDone?'is-done':''}>
        <span className="demo-guide-number">{index+1}</span>
        <div className="demo-guide-body"><strong>{en?scenario.titleEn:scenario.titleEl}</strong><p>{en?scenario.textEn:scenario.textEl}</p>{scenario.steps?.length>0&&<ol className="demo-guide-steps" aria-label={tx('Βήματα','Steps')}>{scenario.steps.map(step=><li key={step.id}>{en?step.labelEn:step.labelEl}</li>)}</ol>}</div>
        <div className="demo-guide-actions">
          {isDone&&rating?.key!==scenario.key&&(ratings[scenario.key]?<span className="demo-rating-value" aria-label={tx(`Βαθμολογία ${ratings[scenario.key].rating} από 5`,`Rated ${ratings[scenario.key].rating} of 5`)}><Star size={14}/>{ratings[scenario.key].rating}/5</span>
            :onRate&&<button type="button" className="demo-guide-check" onClick={()=>onRate(scenario.key)}><Star size={15}/>{tx('Αξιολόγηση','Rate')}</button>)}
          <Button variant="secondary" onClick={()=>onOpenScenario?.(scenario)}>{tx('Ξεκινήστε','Start')}<ArrowRight size={14}/></Button>
          {isDone?<span className="demo-guide-check is-done"><CheckCircle2 size={15}/>{tx('Ολοκληρώθηκε','Done')}</span>
            :<button type="button" className="demo-guide-check" disabled={working} onClick={()=>onToggle?.(scenario.key,true)}><Circle size={15}/>{tx('Το έκανα','I did it')}</button>}
        </div>
        {rating?.key===scenario.key&&<div className="demo-guide-rating">{rating.node}</div>}
      </li>})}
    </ol>
  </ObserverDialog>
}
