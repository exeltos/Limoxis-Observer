import { ArrowRight, CheckCircle2, Circle, Star } from 'lucide-react'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { DEMO_SCENARIOS, demoScenarioDoneCount } from './demoScenarios'
import './demoEvaluation.css'

// The evaluation guide: six scenarios with a link to where each starts and a
// "done" mark the evaluator sets; progress is kept per evaluator. A done
// scenario shows its rating, or "Rate" when it has none yet.
export function DemoGuideDialog({language,scenarios=DEMO_SCENARIOS,progress={},ratings={},working=false,onOpenScenario,onToggle,onRate,onClose}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const done=demoScenarioDoneCount(progress,scenarios),total=scenarios.length
  const allSix=total===DEMO_SCENARIOS.length
  return <ObserverDialog width="wide" className="demo-guide-dialog" eyebrow={tx('Demo αξιολόγησης','Evaluation Demo')} title={tx('Οδηγός αξιολόγησης','Evaluation guide')}
    subtitle={allSix?tx('Έξι σύντομα σενάρια με τα σημεία που ξεχωρίζουν στην καθημερινή δουλειά της Ομάδας Ελέγχου Λοιμώξεων. Ξεκινήστε από όποιο θέλετε.','Six short scenarios with what stands out in an Infection Control team\'s daily work. Start with any of them.'):tx(`${total===1?'Ένα σύντομο σενάριο':`${total} σύντομα σενάρια`} με την καθημερινή δουλειά του ρόλου σας. Αν αλλάξετε ρόλο, αλλάζουν και τα σενάρια.`,`${total===1?'One short scenario':`${total} short scenarios`} with your role's daily work. Switching role switches the scenarios.`)}
    onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>{tx('Κλείσιμο','Close')}</Button>}>
    <div className="demo-guide-progress" aria-label={tx('Πρόοδος','Progress')}>
      <strong>{tx(`${done} από ${total} ολοκληρωμένα`,`${done} of ${total} done`)}</strong>
      <span className="demo-guide-progress-track"><span style={{width:`${Math.round(done/total*100)}%`}}/></span>
    </div>
    <ol className="demo-guide-list">
      {scenarios.map((scenario,index)=>{const isDone=Boolean(progress[scenario.key]);return <li key={scenario.key} className={isDone?'is-done':''}>
        <span className="demo-guide-number">{index+1}</span>
        <div className="demo-guide-body"><strong>{en?scenario.titleEn:scenario.titleEl}</strong><p>{en?scenario.textEn:scenario.textEl}</p>{scenario.steps?.length>0&&<ol className="demo-guide-steps" aria-label={tx('Βήματα','Steps')}>{scenario.steps.map(step=><li key={step.id}>{en?step.labelEn:step.labelEl}</li>)}</ol>}</div>
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
