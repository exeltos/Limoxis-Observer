import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLanguage } from '../../core/i18n/LanguageContext'

export function LabStepNavigator({active,order,labels,canOpen,onMove}){
  const {language}=useLanguage()
  const current=order.indexOf(active)
  if(current<0)return null
  let previous=null,next=null
  for(let i=current-1;i>=0;i--){if(canOpen(order[i])){previous=order[i];break}}
  for(let i=current+1;i<order.length;i++){if(canOpen(order[i])){next=order[i];break}}
  if(!previous&&!next)return null
  return <div className="lab-workflow-navigator" aria-label={language==='el'?'Πλοήγηση βημάτων εργαστηρίου':'Laboratory workflow navigation'}>
    <button type="button" className="lab-workflow-nav-button previous" disabled={!previous} onClick={()=>previous&&onMove(previous)}>
      <ChevronLeft size={16}/><span><small>{language==='el'?'Προηγούμενο βήμα':'Previous step'}</small><strong>{previous?labels[previous]:''}</strong></span>
    </button>
    <div className="lab-workflow-progress"><span>{language==='el'?'Βήμα':'Step'} {current+1} {language==='el'?'από':'of'} {order.length}</span></div>
    <button type="button" className="lab-workflow-nav-button next" disabled={!next} onClick={()=>next&&onMove(next)}>
      <span><small>{language==='el'?'Επόμενο βήμα':'Next step'}</small><strong>{next?labels[next]:''}</strong></span><ChevronRight size={16}/>
    </button>
  </div>
}
