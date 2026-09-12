import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLanguage } from '../../../core/i18n/LanguageContext'

export function LaboratoryWorkflowNavigator({active,order,labels,canOpen,onMove}){
  const {language}=useLanguage()
  const current=order.indexOf(active)
  if(current<0)return null

  const previous=order[current-1]||null
  const next=order[current+1]||null
  const previousOpen=Boolean(previous&&canOpen(previous))
  const nextOpen=Boolean(next&&canOpen(next))
  if(!previous&&!next)return null

  return <nav className="lab-workflow-navigator" aria-label={language==='el'?'Πλοήγηση βημάτων εργαστηρίου':'Laboratory workflow navigation'}>
    <button type="button" className="lab-workflow-nav-button previous" disabled={!previousOpen} onClick={()=>previousOpen&&onMove(previous)}>
      <ChevronLeft size={16}/><span><small>{language==='el'?'Προηγούμενο βήμα':'Previous step'}</small><strong>{previous?labels[previous]:''}</strong></span>
    </button>
    <div className="lab-workflow-progress"><span>{language==='el'?'Βήμα':'Step'} {current+1} {language==='el'?'από':'of'} {order.length}</span></div>
    <button type="button" className="lab-workflow-nav-button next" disabled={!nextOpen} onClick={()=>nextOpen&&onMove(next)}>
      <span><small>{language==='el'?'Επόμενο βήμα':'Next step'}</small><strong>{next?labels[next]:''}</strong></span><ChevronRight size={16}/>
    </button>
  </nav>
}
