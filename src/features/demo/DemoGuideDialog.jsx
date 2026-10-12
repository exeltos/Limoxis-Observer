import { ArrowRight, CheckCircle2, Circle, CircleDot, RotateCcw, Star } from 'lucide-react'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { DEMO_SCENARIOS, demoScenarioDoneCount } from './demoScenarios'
import './demoEvaluation.css'

export const OVERALL_RATING='guide_opened'

// The application training: short scenarios, each with where it stands and
// one way in. The application notices by itself when a scenario is done (its
// screens signal it, see demoScenarioSignals.js), so there is nothing to tick:
// a scenario is "not started", "in progress" with its steps checked off, or
// "done" with its rating, or "Rate it" when it has none yet (the rating opens
// in front of the screen, as when the scenario was completed).
export function DemoGuideDialog({language,scenarios=DEMO_SCENARIOS,progress={},ratings={},stepsDone={},activeKey=null,onOpenScenario,onRate,onClose}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const done=demoScenarioDoneCount(progress,scenarios),total=scenarios.length
  const allSix=total===DEMO_SCENARIOS.length
  return <ObserverDialog width="wide" className="demo-guide-dialog" eyebrow={tx('Demo αξιολόγησης','Evaluation Demo')} title={tx('Εκπαίδευση εφαρμογής','Application training')}
    subtitle={allSix?tx('Έξι σύντομα σενάρια με τα σημεία που ξεχωρίζουν στην καθημερινή δουλειά της Ομάδας Ελέγχου Λοιμώξεων. Ξεκινήστε από όποιο θέλετε· η εφαρμογή καταλαβαίνει μόνη της πότε το ολοκληρώσατε.','Six short scenarios with what stands out in an Infection Control team\'s daily work. Start with any of them; the application notices by itself when you complete one.'):tx(`${total===1?'Ένα σύντομο σενάριο':`${total} σύντομα σενάρια`} με την καθημερινή δουλειά του ρόλου σας. Η εφαρμογή καταλαβαίνει μόνη της πότε ολοκληρώσατε το καθένα.`,`${total===1?'One short scenario':`${total} short scenarios`} with your role's daily work. The application notices by itself when you complete each one.`)}
    onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>{tx('Κλείσιμο','Close')}</Button>}>
    <div className="demo-guide-progress" aria-label={tx('Πρόοδος','Progress')}>
      <strong>{tx(`${done} από ${total} ολοκληρωμένα`,`${done} of ${total} done`)}</strong>
      <span className="demo-guide-progress-track"><span style={{width:`${Math.round(done/total*100)}%`}}/></span>
    </div>
    <ol className="demo-guide-list">
      {scenarios.map((scenario,index)=>{
        const isDone=Boolean(progress[scenario.key])
        const steps=scenario.steps||[]
        const checked=stepsDone[scenario.key]||{}
        const stepCount=steps.filter(step=>checked[step.id]).length
        const started=!isDone&&(activeKey===scenario.key||stepCount>0)
        const rating=ratings[scenario.key]
        const state=isDone?'is-done':started?'is-started':''
        return <li key={scenario.key} className={state}>
          <span className="demo-guide-number">{isDone?<CheckCircle2 size={16} aria-label={tx('Ολοκληρώθηκε','Done')}/>:index+1}</span>
          <div className="demo-guide-body">
            <strong>{en?scenario.titleEn:scenario.titleEl}</strong>
            <p>{en?scenario.textEn:scenario.textEl}</p>
            {steps.length>0&&<ol className="demo-guide-steps" aria-label={tx('Βήματα','Steps')}>{steps.map(step=>{const ok=isDone||checked[step.id];return <li key={step.id} className={ok?'is-done':''}>{ok?<CheckCircle2 size={13} aria-label={tx('Έγινε','Done')}/>:<Circle size={13} aria-hidden="true"/>}{en?step.labelEn:step.labelEl}</li>})}</ol>}
          </div>
          <div className="demo-guide-actions">
            <span className={`demo-guide-state ${state}`}>
              {isDone?<><CheckCircle2 size={14}/>{tx('Ολοκληρώθηκε','Done')}</>
                :started?<><CircleDot size={14}/>{steps.length?tx(`Σε εξέλιξη ${stepCount}/${steps.length}`,`In progress ${stepCount}/${steps.length}`):tx('Σε εξέλιξη','In progress')}</>
                :<><Circle size={14}/>{tx('Δεν ξεκίνησε','Not started')}</>}
            </span>
            {isDone&&(rating?<span className="demo-rating-value" aria-label={tx(`Βαθμολογία ${rating.rating} από 5`,`Rated ${rating.rating} of 5`)}><Star size={14}/>{rating.rating}/5</span>
              :onRate&&<button type="button" className="demo-guide-rate" onClick={()=>onRate(scenario.key)}><Star size={14}/>{tx('Βαθμολογήστε','Rate it')}</button>)}
            {isDone?<Button variant="secondary" onClick={()=>onOpenScenario?.(scenario)}><RotateCcw size={14}/>{tx('Ξανά','Again')}</Button>
              :<Button variant={started?'primary':'secondary'} onClick={()=>onOpenScenario?.(scenario)}>{started?tx('Συνέχεια','Continue'):tx('Ξεκινήστε','Start')}<ArrowRight size={14}/></Button>}
          </div>
        </li>})}
    </ol>
  </ObserverDialog>
}
