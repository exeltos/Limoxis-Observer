import { Compass, FlaskConical, ListChecks, Star } from 'lucide-react'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import './demoEvaluation.css'

// The first screen of an evaluation Demo, once per evaluator: what the Demo is,
// how the scenarios guide them on the screen and that their opinion is asked,
// then a guided tour of their role's first scenario (or the list of scenarios).
export function DemoWelcome({language,organizationName,scenarios,onTour,onScenarios}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const first=scenarios[0]
  const count=scenarios.length
  const cards=[
    {icon:<FlaskConical size={20}/>,title:tx('Ένα δικό σας Demo','A Demo of your own'),
      text:tx(`Το Demo «${organizationName}» έχει δοκιμαστικούς ασθενείς, δείγματα, εργαζόμενους και τμήματα. Δοκιμάστε ό,τι θέλετε· τίποτα δεν αγγίζει πραγματικά δεδομένα.`,`The «${organizationName}» Demo has sample patients, samples, staff and departments. Try anything; nothing touches real data.`)},
    {icon:<ListChecks size={20}/>,title:count===1?tx('Ένα σενάριο, με ξενάγηση','One scenario, with a tour'):tx(`${count} σενάρια, με ξενάγηση`,`${count} scenarios, with a tour`),
      text:tx('Κάθε σενάριο σας δείχνει πάνω στην οθόνη τι να πατήσετε και τσεκάρεται μόλις το κάνετε.','Each scenario shows you on the screen what to press and is checked off as soon as you do it.')},
    {icon:<Star size={20}/>,title:tx('Η γνώμη σας μετράει','Your opinion counts'),
      text:tx('Μετά από κάθε σενάριο, πείτε μας πώς σας φάνηκε: χρησιμότητα, ευκολία, σαφήνεια και ένα σχόλιο.','After each scenario, tell us how you found it: usefulness, ease, clarity and a comment.')},
  ]
  return <ObserverDialog width="wide" className="demo-welcome-dialog" eyebrow="DEMO" title={tx('Καλώς ήρθατε στο Limoxis Observer','Welcome to Limoxis Observer')}
    onClose={onScenarios} footer={<>
      <Button variant="secondary" onClick={onScenarios}>{tx('Δείτε τα σενάρια','See the scenarios')}</Button>
      {first&&<Button onClick={()=>onTour(first)}><Compass size={16}/>{tx('Ξενάγηση','Tour')}: {en?first.titleEn:first.titleEl}</Button>}
    </>}>
    <div className="demo-welcome-cards">{cards.map(card=><div key={card.title} className="demo-welcome-card">{card.icon}<strong>{card.title}</strong><span>{card.text}</span></div>)}</div>
  </ObserverDialog>
}
