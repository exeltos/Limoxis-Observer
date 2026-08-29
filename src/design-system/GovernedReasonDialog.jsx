import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'
import { useLanguage } from '../core/i18n/LanguageContext'

export function GovernedReasonDialog({
  open,
  title,
  description,
  label,
  confirmLabel,
  danger=false,
  onCancel,
  onConfirm,
}){
  const {language}=useLanguage();const en=language==='en'
  const resolvedTitle=title||(en?'Reason for change':'Αιτιολόγηση αλλαγής')
  const resolvedDescription=description||(en?'The change will be recorded in the record history.':'Η αλλαγή θα καταγραφεί στο ιστορικό της εγγραφής.')
  const resolvedLabel=label||(en?'Reason *':'Αιτιολογία *')
  const resolvedConfirmLabel=confirmLabel||(en?'Continue':'Συνέχεια')
  const [reason,setReason]=useState('')
  if(!open)return null
  const submit=()=>{
    const value=reason.trim()
    if(!value)return
    onConfirm?.(value)
    setReason('')
  }
  const cancel=()=>{setReason('');onCancel?.()}
  return <div className="modal-backdrop">
    <div className="governed-reason-dialog" role="dialog" aria-modal="true" aria-labelledby="governed-reason-title">
      <header><div><span className="eyebrow">{en?'GOVERNED CHANGE':'ΕΛΕΓΧΟΜΕΝΗ ΑΛΛΑΓΗ'}</span><h3 id="governed-reason-title">{resolvedTitle}</h3><p>{resolvedDescription}</p></div><button className="icon-button" onClick={cancel} aria-label={en?'Close':'Κλείσιμο'}><X size={16}/></button></header>
      <label><span>{resolvedLabel}</span><textarea autoFocus rows={4} value={reason} onChange={e=>setReason(e.target.value)} placeholder={en?'Enter the reason for this change...':'Καταγράψτε τον λόγο της αλλαγής...'}/></label>
      <footer><Button variant="secondary" onClick={cancel}>{en?'Cancel':'Ακύρωση'}</Button><Button className={danger?'danger':''} disabled={!reason.trim()} onClick={submit}>{resolvedConfirmLabel}</Button></footer>
    </div>
  </div>
}
