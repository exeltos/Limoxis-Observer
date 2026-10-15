import { useState } from 'react'
import { Button } from './Button'
import { ObserverDialog } from './ObserverDialog'
import { useLanguage } from '../core/i18n/LanguageContext'

// A change that needs a written reason (archive, void…): the shared dialog,
// closed only by its ×, with the confirm action in the footer.
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
  return <ObserverDialog width="compact" className="governed-reason-dialog" eyebrow={en?'Governed change':'Ελεγχόμενη αλλαγή'} title={resolvedTitle} subtitle={resolvedDescription} onClose={cancel} footer={<Button className={danger?'danger':''} disabled={!reason.trim()} onClick={submit}>{resolvedConfirmLabel}</Button>}>
    <label className="field"><span className="lo-field-label">{resolvedLabel}</span><textarea autoFocus rows={4} value={reason} onChange={e=>setReason(e.target.value)} placeholder={en?'Enter the reason for this change...':'Καταγράψτε τον λόγο της αλλαγής...'}/></label>
  </ObserverDialog>
}
