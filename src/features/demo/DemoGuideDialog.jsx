import { ArrowRight, CheckCircle2, Circle, Star } from 'lucide-react'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { DEMO_SCENARIOS, demoScenarioDoneCount } from './demoScenarios'
import './demoEvaluation.css'

// The evaluation guide: six scenarios with a link to where each starts and a
// "done" mark the evaluator sets; progress is kept per evaluator. A done
// scenario shows its rating, or "Rate" when it has none yet.
export function DemoGuideDialog({language,progress={},ratings={},working=false,onOpenScenario,onToggle,onRate,onClose}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const done=demoScenarioDoneCount(progress)
  return <ObserverDialog width="wide" className="demo-guide-dialog" eyebrow={tx('Demo αξιολόγησης','Evaluation Demo')} title={tx('Οδηγός αξιολόγησης','Evaluation guide')}
    subtitle={tx('Έξι σύντομα σενάρια με τα σημεία που ξεχωρίζουν στην καθημερινή δουλειά της Ομάδας Ελέγχου Λοιμώξεων. Ξεκινήστε από όποιο θέλετε.','Six short scenarios with what stands out in an Infection Control team\'s daily work. Start with any of them.')}
    onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>{tx('Κλείσιμο','Close')}</Button>}>
    <div className="demo-guide-progress" aria-label={tx('Πρόοδος','Progress')}>
      <strong>{tx(`${done} από ${DEMO_SCENARIOS.length} ολοκληρωμένα`,`${done} of ${DEMO_SCENARIOS.length} done`)}</strong>
      <span className="demo-guide-progress-track"><span style={{width:`${Math.round(done/DEMO_SCENARIOS.length*100)}%`}}/></span>
    </div>
    <ol className="demo-guide-list">
      {DEMO_SCENARIOS.map((scenario,index)=>{const isDone=Boolean(progress[scenario.key]);return <li key={scenario.key} className={isDone?'is-done':''}>
        <span className="demo-guide-number">{index+1}</span>
        <div className="demo-guide-body"><strong>{en?scenario.titleEn:scenario.titleEl}</strong><p>{en?scenario.textEn:scenario.textEl}</p></div>
        <div className="demo-guide-actions">
          {isDone&&(ratings[scenario.key]?<span className="demo-rating-value" aria-label={tx(`Βαθμολογία ${ratings[scenario.key].rating} από 5`,`Rated ${ratings[scenario.key].rating} of 5`)}><Star size={14}/>{ratings[scenario.key].rating}/5</span>
            :onRate&&<button type="button" className="demo-guide-check" onClick={()=>onRate(scenario.key)}><Star size={15}/>{tx('Αξιολόγηση','Rate')}</button>)}
          <Button variant="secondary" onClick={()=>onOpenScenario?.(scenario)}>{tx('Ξεκινήστε','Start')}<ArrowRight size={14}/></Button>
          <button type="button" className={`demo-guide-check ${isDone?'is-done':''}`} disabled={working} aria-pressed={isDone} onClick={()=>onToggle?.(scenario.key,!isDone)}>
            {isDone?<CheckCircle2 size={15}/>:<Circle size={15}/>}{isDone?tx('Ολοκληρώθηκε','Done'):tx('Το έκανα','I did it')}
          </button>
        </div>
      </li>})}
    </ol>
  </ObserverDialog>
}
