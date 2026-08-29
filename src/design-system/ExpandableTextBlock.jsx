import { useState } from 'react'
import { Maximize2 } from 'lucide-react'
import { ObserverDialog } from './ObserverDialog'
import { Button } from './Button'
import { useLanguage } from '../core/i18n/LanguageContext'

export function ExpandableTextBlock({label,value,className=''}){
  const {language}=useLanguage();const en=language==='en'
  const [open,setOpen]=useState(false)
  return <>
    <div className={`expandable-text-block ${className}`.trim()}>
      <div className="expandable-text-block-head">
        <span>{label}</span>
        {value&&<button type="button" className="entity-record-icon-button compact" onClick={()=>setOpen(true)} title={`${en?'Expand':'Μεγέθυνση'}: ${label}`} aria-label={`${en?'Expand':'Μεγέθυνση'}: ${label}`}><Maximize2 size={14}/></button>}
      </div>
      <p>{value||'—'}</p>
    </div>
    {open&&<ObserverDialog eyebrow={en?'Text view':'Προβολή κειμένου'} title={label} onClose={()=>setOpen(false)} width="wide" footer={<Button variant="secondary" onClick={()=>setOpen(false)}>{en?'Close':'Κλείσιμο'}</Button>}>
      <div className="expanded-readonly-text">{value}</div>
    </ObserverDialog>}
  </>
}
