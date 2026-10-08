import { useEffect } from 'react'
import { BookOpenCheck, ChevronDown, Eye, FlaskConical, LogOut, Send } from 'lucide-react'
import { DEMO_SCENARIOS } from '../features/demo/demoScenarios'
import { BrandMark } from '../design-system/BrandMark'
import './demoEvaluationBar.css'

const DEMO_BODY_CLASS='lo-demo-organization'
const formatDate=(value,language)=>{if(!value)return '';const date=new Date(`${value}T00:00:00`);return Number.isNaN(date.getTime())?value:date.toLocaleDateString(language==='en'?'en-GB':'el-GR')}

// A slim bar above the content of a Demo organization: whose Demo it is, how
// long it stays open, and the way to look at the application as another role.
export function DemoEvaluationBar({tenant,access,isPlatformOwner,language,previewOpen=false,previewLabel='',rolePicker=null,onPreviewRoles,onExit,guideDone=0,onOpenGuide,canRequestApplication=false,applicationRequested=false,onRequestApplication}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const days=Number.isFinite(Number(access?.daysLeft))?Number(access.daysLeft):null
  const remaining=days===null?'':days<=0?tx('λήγει σήμερα','ends today'):days===1?tx('απομένει 1 ημέρα','1 day left'):tx(`απομένουν ${days} ημέρες`,`${days} days left`)
  const until=access?.validUntil?tx(`έως ${formatDate(access.validUntil,language)}`,`until ${formatDate(access.validUntil,language)}`):''
  const detail=isPlatformOwner?tx('Τα ίδια δεδομένα με τα Demo των αξιολογητών','The same data as the evaluators\' Demos'):[remaining,until].filter(Boolean).join(' · ')
  // Charts and printing mark the Demo (demoEvaluationBar.css).
  useEffect(()=>{document.body.classList.add(DEMO_BODY_CLASS);return ()=>document.body.classList.remove(DEMO_BODY_CLASS)},[])
  // The last three days: the bar turns to a reminder.
  const ending=!isPlatformOwner&&days!==null&&days<=3
  return <div className={`demo-evaluation-bar${ending?' is-ending':''}`} role="status">
    <span className="demo-evaluation-chip"><FlaskConical size={13}/>DEMO</span>
    <span className="demo-evaluation-text"><strong>{tenant?.name||tx('Demo αξιολόγησης','Evaluation Demo')}</strong>{detail&&<small>{detail}</small>}</span>
    <span className="demo-evaluation-spacer"/>
    {onOpenGuide&&<button type="button" onClick={onOpenGuide}><BookOpenCheck size={14}/>{tx('Οδηγός αξιολόγησης','Evaluation guide')}{!isPlatformOwner&&<b className="demo-evaluation-count">{guideDone}/{DEMO_SCENARIOS.length}</b>}</button>}
    <span className="demo-evaluation-roles role-preview-control">
      <button type="button" className={previewLabel?'active':''} aria-expanded={previewOpen} onClick={onPreviewRoles}><Eye size={14}/>{previewLabel||tx('Δείτε την εφαρμογή ως άλλος ρόλος','See the application as another role')}<ChevronDown size={13}/></button>
      {rolePicker}
    </span>
    {canRequestApplication&&<button type="button" className="demo-evaluation-cta" onClick={onRequestApplication}><Send size={14}/>{applicationRequested?tx('Το αίτημα στάλθηκε','Request sent'):tx('Θέλω την εφαρμογή','I want the application')}</button>}
    {isPlatformOwner&&<button type="button" onClick={onExit}><LogOut size={14}/>{tx('Έξοδος από Demo','Exit Demo')}</button>}
  </div>
}

// Shown to an evaluator whose Demo expired or was paused: the data is closed.
export function DemoClosedScreen({access,language,onLogout}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const paused=access?.status==='paused'||(access?.organizationStatus&&access.organizationStatus!=='active')
  return <div className="demo-closed-screen">
    <div className="demo-closed-card">
      <BrandMark size={44}/>
      <h1>{paused?tx('Το Demo είναι σε παύση','The Demo is paused'):tx('Το Demo έληξε','The Demo has ended')}</h1>
      <p>{paused
        ?tx('Η πρόσβαση στο Demo έχει σταματήσει προσωρινά. Τα δεδομένα δεν είναι διαθέσιμα μέχρι να ενεργοποιηθεί ξανά.','Access to the Demo is on hold. Its data is not available until it is reopened.')
        :tx(`Η περίοδος αξιολόγησης${access?.validUntil?` ολοκληρώθηκε στις ${formatDate(access.validUntil,language)}`:' ολοκληρώθηκε'}. Τα δεδομένα δεν είναι πια διαθέσιμα.`,`The evaluation period${access?.validUntil?` ended on ${formatDate(access.validUntil,language)}`:' has ended'}. Its data is no longer available.`)}</p>
      <p>{tx('Για παράταση ή για να αποκτήσετε την εφαρμογή, επικοινωνήστε μαζί μας.','To extend the Demo or to get the application, contact us.')}</p>
      <button type="button" className="button-secondary" onClick={onLogout}>{tx('Αποσύνδεση','Sign out')}</button>
    </div>
  </div>
}
